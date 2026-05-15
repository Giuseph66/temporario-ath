import { Request, Response } from 'express';
import { stateService } from '../services/StateService';
import { aiService } from '../services/AIService';
import { buildSystemPrompt } from '../services/PromptBuilder';
import { configLoader } from '../services/ConfigLoader'; // mantido só para compatibilidade com handleHumanHandoff legado
import { WhatsAppService } from '../services/WhatsAppService';
import { EvolutionService } from '../services/EvolutionService';
import { resolveState } from '../flow/StateResolver';
import { prisma } from '../utils/prisma';
import { normalizeBrazilianPhone } from '../utils/phoneNormalizer';
import { retrieveRelevantContext } from '../services/KnowledgeService';

const metaWhatsapp = new WhatsAppService();

async function sendReply(tenantId: string | undefined, to: string, text: string): Promise<void> {
    // Whitelist enforced at send level — nada sai sem passar por aqui
    if (tenantId) {
        const agent = await prisma.agent.findFirst({
            where: { tenantId },
            include: { whitelistPhones: true },
        }).catch(() => null);
        if (agent?.whitelistEnabled) {
            const allowed: string[] = agent.whitelistPhones?.map((w: any) => w.phone) ?? [];
            if (!allowed.includes(to)) {
                console.log(`[sendReply] BLOQUEADO — ${to.slice(0, 4)}**** não está na whitelist.`);
                return;
            }
        }
    }

    if (!tenantId) { await metaWhatsapp.sendText(to, text); return; }
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { evolutionInstance: true } }).catch(() => null);
    if (tenant?.evolutionInstance) {
        await EvolutionService.sendText(tenant.evolutionInstance, to, text);
    } else {
        await metaWhatsapp.sendText(to, text);
    }
}

// --- DEBOUNCE BUFFER ---
// Holds pending messages per user. When a user sends multiple messages
// rapidly, the timer resets and texts accumulate until 5s of silence.
interface BufferEntry {
    timer: NodeJS.Timeout;
    texts: string[];
}

const debounceBuffer = new Map<string, BufferEntry>();

const DEBOUNCE_MS = 5000; // 5 seconds of silence before processing

export function scheduleProcessing(from: string, text: string, tenantId?: string, agentId?: string, messageAlreadySaved = false): void {
    const existing = debounceBuffer.get(from);

    if (existing) {
        clearTimeout(existing.timer);
        existing.texts.push(text);
    } else {
        debounceBuffer.set(from, { timer: null!, texts: [text] });
    }

    const entry = debounceBuffer.get(from)!;

    entry.timer = setTimeout(() => {
        debounceBuffer.delete(from);
        const aggregatedText = entry.texts.join('\n');
        console.log(`⏱️  Debounce expirou para ${from}. Processando ${entry.texts.length} mensagem(ns) agregada(s).`);
        processMessages(from, aggregatedText, tenantId, agentId, messageAlreadySaved);
    }, DEBOUNCE_MS);
}

// ─── HUMAN HANDOFF ───────────────────────────────────────────────────────────
// Builds and sends the correct deterministic message for each handoff scenario.
// Returns the text that was sent (so it can be saved to history).
async function getProtocols(tenantId?: string): Promise<Record<string, string>> {
    if (tenantId) {
        const rows = await prisma.agentProtocol.findMany({
            where: { agent: { tenantId } },
        }).catch(() => []);
        if (rows.length > 0) {
            return Object.fromEntries(rows.map(r => [r.key, r.value]));
        }
    }
    return configLoader.getConfig().persona.protocols as unknown as Record<string, string>;
}

async function handleHumanHandoff(
    from: string,
    handoffType: 'HOSTILE' | 'SOFT' | 'MENTAL_HEALTH' | 'DELETION',
    previousState: string,
    userGoal: string | null | undefined,
    tenantId?: string,
): Promise<string> {
    const protocols = await getProtocols(tenantId);
    const link: string = protocols.human_contact_link ?? '';
    const program: string = userGoal || 'os programas da Confluence';

    let messageSent: string;

    if (handoffType === 'DELETION') {
        // LGPD Art. 18 — Exclusão imediata e confirmação ao titular
        console.log('🗑️ [Handoff] Exclusão de dados solicitada → deletando registro do usuário.');
        await stateService.deleteUserData(from);
        messageSent =
            '✅ *Seus dados foram excluídos.*\n\n' +
            'Conforme a LGPD (Lei nº 13.709/2018), seu perfil e todo o histórico de conversa foram permanentemente removidos dos nossos sistemas.\n\n' +
            'Caso precise de algo no futuro, será como um primeiro contato. Até mais! 👋';
        await sendReply(tenantId, from, messageSent);
        return messageSent;
    }

    if (handoffType === 'MENTAL_HEALTH') {
        console.log('🏥 [Handoff] Conteúdo de saúde mental → encaminhando para humano (MENTAL_HEALTH).');
        messageSent =
            'Percebi que você pode estar passando por um momento difícil. 💙\n\n' +
            'Esse tipo de conversa merece um cuidado especial e uma escuta humana — não é algo que devo tratar de forma automatizada.\n\n' +
            `Nossa equipe está aqui para você: ${link}\n\n` +
            'Se estiver em crise, o CVV atende 24h pelo número 188 ou em cvv.org.br.';
        await sendReply(tenantId, from, messageSent);
        return messageSent;
    }

    if (handoffType === 'HOSTILE') {
        // Immediate link — no consent question needed
        messageSent = protocols.human_handoff_hostile.replace('{LINK}', link);
        console.log('🚨 [Handoff] Enviando link imediato (HOSTILE).');
    } else {
        // SOFT — two sub-cases based on what the previous state was
        if (previousState === 'HUMAN_HANDOFF') {
            // User already received the consent question and replied → send the link + template
            messageSent = protocols.human_handoff_confirmed
                .replace('{LINK}', link)
                .replace('{PROGRAM}', program);
            console.log('🤝 [Handoff] Usuário confirmou → enviando link + modelo de mensagem.');
        } else {
            // First time reaching HUMAN_HANDOFF (soft) → ask for consent
            messageSent = protocols.human_handoff_consent;
            console.log('🤝 [Handoff] Primeira vez → enviando pergunta de consentimento.');
        }
    }

    await sendReply(tenantId, from, messageSent);
    return messageSent;
}

// --- BACKGROUND PROCESSOR ---
// Runs fully independently of the HTTP request. All DB, AI, and WhatsApp
// calls happen here, long after the 200 OK has already been sent.
async function processMessages(from: string, messageBody: string, tenantId?: string, agentId?: string, messageAlreadySaved = false): Promise<void> {
    try {
        // ── 0. Guarda isActive — revalida no momento da execução (pode ter mudado durante debounce) ──
        if (tenantId) {
            const agent = await prisma.agent.findFirst({ where: { tenantId }, select: { isActive: true } });
            if (agent && !agent.isActive) {
                console.log(`🔴 Bot inativo — ignorando processamento para ${from.slice(0, 4)}****`);
                return;
            }
        }

        // ── 1. Load the current session ───────────────────────────────────────
        let session = await stateService.getSession(from, tenantId, agentId);

        // Auto-reset de sessão após 24h de inatividade
        const hoursSinceLastInteraction = (Date.now() - new Date(session.lastInteraction).getTime()) / 3600000;
        if (hoursSinceLastInteraction >= 24 && session.conversationState !== 'GREETING') {
            await prisma.user.update({
                where: { id: session.id },
                data: { conversationState: 'GREETING' },
            });
            await prisma.chatHistory.create({
                data: { userId: session.id, role: 'system', content: '— Nova sessão (inatividade > 24h) —' },
            });
            session = await stateService.getSession(from, tenantId, agentId);
            console.log(`🔄 Auto-reset de sessão para ${from} (${Math.floor(hoursSinceLastInteraction)}h inativo)`);
        }

        const previousState = session.conversationState;
        console.log(`📊 Usuário ${from} | Interação nº: ${session.interactionCount} | Estado atual: [${previousState}]`);

        // ── 2. Save the incoming user message to history ──────────────────────
        // Pula se já foi salvo pelo EvolutionWebhookController (evita duplicata)
        if (!messageAlreadySaved) {
            await stateService.addToHistory(from, 'user', messageBody);
        }

        // ── 3. Profile extraction (smart stop condition) ──────────────────────
        // Skip extraction if all three key fields are already populated — this
        // avoids unnecessary Gemini calls once the profile is complete.
        const profileAlreadyComplete = !!(session.name && session.age && session.goal && session.enrollmentTarget && session.currentProgramId);

        if (!profileAlreadyComplete) {
            console.log('🕵️ Perfil incompleto — analisando conversa para extrair dados...');
            // Re-fetch to include the message just saved — passa tenantId p/ não pegar ghost record
            const updatedSession = await stateService.getSession(from, tenantId, agentId);
            const extractedData = await aiService.extractProfileData(updatedSession.conversationHistory, tenantId);
            await stateService.updateUserProfile(from, extractedData);
            console.log('💾 Extração concluída.');
        } else {
            console.log('✅ Perfil já completo — extração pulada.');
        }

        // ── 4. Re-fetch session so resolveState sees the freshest profile ─────
        session = await stateService.getSession(from, tenantId, agentId);

        // ── 5. Resolve the next state (with up-to-date profile data) ──────────
        const { state: nextState, handoffType } = resolveState(session, messageBody);
        console.log(`🔄 Estado resolvido: [${nextState}]${handoffType ? ` (${handoffType})` : ''}`);

        // ── 5.5. LGPD consent — detecta consentimento independente do estado ────
        // Antes restrito a GREETING, mas o ghost-record bug causava estados errados.
        // Agora detecta "sim" / "pode" sempre que lgpdConsent ainda for false.
        if (!session.lgpdConsent) {
            const msgLower = messageBody.toLowerCase().trim();
            const consentWords = ['sim', 'pode', 'claro', 'aceito', 'concordo', 'ok', 'tudo bem', 'pode sim', 'pode ser', 'vamos continuar', 'bora'];
            if (consentWords.some(w => msgLower.includes(w))) {
                await prisma.user.update({
                    where: { id: session.id },
                    data: { lgpdConsent: true },
                });
                console.log(`✅ [LGPD] Consentimento registrado para ${from}`);
                session = { ...session, lgpdConsent: true };
            }
        }

        // ── 5.6. Passo 18 — Salvar currentProgramId deterministicamente ─────────
        // Aplica regra de negócio: 14-16 → techlab, 17+ → personalizado
        // Só salva se ainda não definido (não sobrescreve escolha explícita).
        if (session.age && !session.currentProgramId) {
            let programId: string | null = null;
            if (session.age >= 14 && session.age <= 16) {
                programId = 'ingles_techlab';
            } else if (session.age >= 17) {
                programId = 'ingles_personalizado';
            }
            if (programId) {
                await prisma.user.update({
                    where: { id: session.id },
                    data: { currentProgramId: programId },
                });
                session.currentProgramId = programId;
                console.log(`📚 currentProgramId definido: ${programId} (idade: ${session.age})`);
            }
        }

        // ── 6. Persist the new state BEFORE generating any response ───────────
        await stateService.updateConversationState(from, nextState);

        // ── 7. HUMAN_HANDOFF — bypass AI entirely ─────────────────────────────
        // Send a deterministic, pre-written message so Artemis never
        // falsely claims to have abilities (like notifying someone) it lacks.
        if (nextState === 'HUMAN_HANDOFF') {
            const messageSent = await handleHumanHandoff(
                from,
                handoffType!,
                previousState,
                session.goal,
                tenantId,
            );
            // Save the sent message as the bot's turn in history
            await stateService.addToHistory(from, 'model', messageSent);
            return; // ← skip AI generation entirely
        }

        // ── 8. Build the system prompt — 100% do banco via agentToConfig ────────
        const fileConfig = configLoader.getConfig(); // fallback para campos não migrados
        const { getAgentFull, agentToConfig } = await import('../utils/agentQuery');
        const dbAgent = session.tenantId
            ? await getAgentFull({ tenantId: session.tenantId })
            : null;
        const config = agentToConfig(dbAgent, fileConfig);

        // RAG — retrieve relevant context from knowledge base (non-blocking)
        const ragContext = session.tenantId
            ? await retrieveRelevantContext(session.tenantId, messageBody).catch(() => null)
            : null;
        if (ragContext) console.log(`📚 [RAG] ${ragContext.length} chars de contexto injetado.`);

        const systemInstruction = buildSystemPrompt({
            state: nextState,
            config: config,
            ragContext,
            userProfile: {
                name: session.name,
                age: session.age,
                goal: session.goal,
                currentProgramId: session.currentProgramId,
                lastPaymentUrl: (session as any).lastPaymentUrl ?? null,
                cpf: (session as any).cpf ?? null,
                email: (session as any).email ?? null,
                birthDate: (session as any).birthDate ?? null,
                address: (session as any).address ?? null,
                enrollmentTarget: (session as any).enrollmentTarget ?? null,
                extraInfo: (session as any).extraInfo ?? null,
                paymentDay: (session as any).paymentDay ?? null,
            }
        });

        // ── 9. Generate the AI response (with smart retry) ─────────────────
        let respostaIA = '';
        let paymentUrl: string | undefined;

        const MAX_RETRIES = 3;
        let lastError: any = null;

        function getRetryDelay(attempt: number, category: string): number {
            if (category === 'RATE_LIMIT') {
                // Longer backoff for rate limits: 5s, 15s, 30s
                return [5000, 15000, 30000][attempt] ?? 30000;
            }
            // Transient errors: exponential backoff with jitter (~2s, ~6s, ~14s)
            const baseDelay = Math.min(2000 * Math.pow(2, attempt), 15000);
            const jitter = Math.random() * 1000;
            return baseDelay + jitter;
        }

        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
                if (attempt > 0) {
                    const category = lastError?.category || 'TRANSIENT';
                    const delay = getRetryDelay(attempt, category);
                    console.log(`🔄 Tentativa ${attempt + 1}/${MAX_RETRIES} [${category}] aguardando ${Math.round(delay)}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
                const result = await aiService.generateResponse(
                    from,
                    session.conversationHistory,
                    messageBody,
                    systemInstruction,
                    nextState,
                    tenantId
                );
                respostaIA = result.text;
                paymentUrl = result.paymentUrl;
                break;
            } catch (err: any) {
                lastError = err;
                const category = err?.category || 'PERMANENT';
                console.error(`❌ Tentativa ${attempt + 1}/${MAX_RETRIES} falhou [${category}]:`, err?.cause?.message || err?.message);

                // Don't retry permanent errors — fail immediately
                if (category === 'PERMANENT') {
                    console.error('🚫 Erro permanente — não há razão para tentar novamente.');
                    throw err;
                }

                if (attempt === MAX_RETRIES - 1) throw err;
            }
        }

        console.log(`🤖 Artemis Respondeu: "${respostaIA}"`);

        // ── 10. Save the AI response to history ───────────────────────────────
        await stateService.addToHistory(from, 'model', respostaIA);

        // ── 11. Send the response via WhatsApp ────────────────────────────────
        if (respostaIA.trim()) {
            await sendReply(tenantId, from, respostaIA);
        } else {
            console.warn('⚠️ Resposta vazia — mensagem não enviada ao WhatsApp.');
        }

        // ── 12. If a payment link was generated, send it as a separate message ─
        // The URL is sent directly by code (never through the model's text) to
        // prevent LLM token-generation from truncating or mangling the link.
        if (paymentUrl) {
            console.log(`💳 Enviando link de pagamento como mensagem separada: ${paymentUrl}`);
            await stateService.addToHistory(from, 'model', paymentUrl);
            await sendReply(tenantId, from, paymentUrl);
        }

    } catch (error: any) {
        console.error('❌ Erro ao processar mensagem em background:', error);

        // Erros PERMANENT (chave ausente, config errada) = bot fica em silêncio.
        // Só envia fallback para erros transientes (rede, timeout).
        const isPermanent = error?.category === 'PERMANENT' || error?.message?.includes('PERMANENT') || error?.message?.includes('não configurada') || error?.message?.includes('AI_GENERATION_FAILED');
        if (!isPermanent) {
            await sendReply(tenantId, from, 'Desculpe, estou passando por uma rápida atualização técnica. Tente novamente em instantes.').catch(() => null);
        }
    }
}

// --- VALIDAÇÃO DO FACEBOOK (GET) ---
export const verifyWebhook = async (req: Request, res: Response) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode !== 'subscribe') { res.sendStatus(403); return; }

    // Aceita token do ENV (single-tenant/legado) ou de qualquer tenant no banco
    const globalMatch = token === process.env.META_VERIFY_TOKEN;
    const tenantMatch = !globalMatch && token
        ? await prisma.tenant.findFirst({ where: { metaVerifyToken: token as string } })
        : null;

    if (globalMatch || tenantMatch) {
        console.log('✅ Webhook Meta verificado com sucesso!');
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
};

// --- RECEBIMENTO DE MENSAGENS (POST) ---
export const handleWebhook = (req: Request, res: Response) => {
    const body = req.body;

    if (body.object !== 'whatsapp_business_account') {
        res.sendStatus(404);
        return;
    }

    // ✅ Step 1: Immediate ACK — Meta receives 200 before any heavy work.
    // This prevents the "Retry Storm" of ghost messages.
    res.sendStatus(200);

    // ✅ Step 2 & 3: Feed the debounce buffer and schedule processing.
    if (body.entry?.[0]?.changes?.[0]?.value?.messages) {
        const messageData = body.entry[0].changes[0].value.messages[0];
        const from: string = normalizeBrazilianPhone(messageData.from);
        const messageType: string = messageData.type;
        const messageBody: string | undefined = messageData.text?.body;

        console.log(`📩 Recebido de ${from} [tipo: ${messageType}]`);

        // Passo 16 — Resposta determinística para mídia não suportada
        if (messageType !== 'text') {
            sendReply(undefined, from,
                'No momento consigo responder apenas mensagens de texto. Por favor, descreva sua dúvida por escrito. 😉'
            ).catch(err => console.error('❌ Erro ao enviar resposta de mídia não suportada:', err));
            return;
        }

        if (messageBody) {
            // ✅ Step 4: Heavy processing is scheduled in the buffer,
            // completely decoupled from this HTTP request lifecycle.
            scheduleProcessing(from, messageBody);
        }
    }
};
