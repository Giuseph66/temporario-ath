import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { normalizeBrazilianPhone } from '../utils/phoneNormalizer';
import { log } from '../services/LogService';
import { handleAdminMessageWithTrace } from '../services/AdminChatService';
import { EvolutionService } from '../services/EvolutionService';

function phoneVariants(phone: string): string[] {
    const digits = phone.replace(/\D/g, '');
    const v = new Set<string>([digits, '+' + digits]);
    if (digits.length === 13 && digits.startsWith('55')) {
        const short = digits.slice(0, 4) + digits.slice(5);
        v.add(short); v.add('+' + short);
    }
    if (digits.length === 12 && digits.startsWith('55')) {
        const long = digits.slice(0, 4) + '9' + digits.slice(4);
        v.add(long); v.add('+' + long);
    }
    return Array.from(v);
}


export async function evolutionWebhook(req: Request, res: Response): Promise<void> {
    res.sendStatus(200);

    const evEvent = req.body?.event ?? 'unknown';
    const evInstance = req.body?.instance ?? 'unknown';
    console.log(`[EVO-WH] ▶ payload recebido | event="${evEvent}" instance="${evInstance}"`);
    log.webhook('info', `Payload recebido`, { event: evEvent, instance: evInstance });

    try {
        const { event, instance, data } = req.body as {
            event: string;
            instance: string;
            data: {
                key?: { remoteJid?: string; fromMe?: boolean };
                message?: { conversation?: string; extendedTextMessage?: { text?: string } };
            };
        };

        if (event !== 'messages.upsert') {
            log.webhook('info', `Evento ignorado: ${event}`, { instance });
            return;
        }

        const ignoreFromMe = process.env.IGNORE_FROM_ME !== 'false';
        if (data?.key?.fromMe) {
            if (ignoreFromMe) {
                log.webhook('info', 'Mensagem própria ignorada (IGNORE_FROM_ME=true)', { instance });
                return;
            }
            // IGNORE_FROM_ME=false: salva no banco mas NÃO dispara bot (evita loop)
            log.webhook('info', 'Mensagem própria: salva sem resposta do bot (IGNORE_FROM_ME=false)', { instance });
        }

        const remoteJid = data?.key?.remoteJid ?? '';
        const rawPhone = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');

        if (!rawPhone) {
            log.webhook('warn', `JID inválido ignorado: ${remoteJid}`, { instance });
            return;
        }

        // IDs internos de dispositivo (@lid) — sem grupo nem número real, descarta
        if (remoteJid.includes('@lid')) {
            log.webhook('info', `LID interno ignorado`, { jid: remoteJid });
            return;
        }

        const isGroup = remoteJid.includes('@g.us');

        // Grupos usam o JID bruto como identificador; contatos passam pela normalização BR
        const phoneNumber = isGroup ? rawPhone : normalizeBrazilianPhone(rawPhone);

        const messageText: string =
            data?.message?.conversation ??
            data?.message?.extendedTextMessage?.text ??
            '';

        if (!messageText.trim()) {
            const tipos = Object.keys(data?.message ?? {}).join(', ') || 'nenhum';
            log.webhook('info', `Mídia ignorada (sem texto)`, { jid: remoteJid, tipos });
            return;
        }

        const tenant = await prisma.tenant.findFirst({ where: { evolutionInstance: instance } });

        if (!tenant) {
            log.webhook('error', `Tenant não encontrado para instance="${instance}"`, { instance });
            return;
        }
        if (!tenant.isActive) {
            log.webhook('warn', `Tenant inativo: ${tenant.slug}`, { tenant: tenant.slug });
            return;
        }

        const agent = await prisma.agent.findFirst({
            where: { tenantId: tenant.id },
            include: { whitelistPhones: true, whitelistGroups: true },
        }).catch(() => null);

        // ── SALVA MENSAGEM SEMPRE (antes de qualquer filtro) ─────────────────
        // Garante que o lead e a mensagem existam no banco independente de
        // whitelist ou disponibilidade da IA. Operador pode ver TUDO no painel.
        // Busca nome no cache de contatos (todas as variantes de formato)
        const contactPhoneVariants = phoneVariants(phoneNumber);
        const contact = await prisma.contact.findFirst({
            where: { tenantId: tenant.id, phone: { in: contactPhoneVariants } },
            select: { name: true, customName: true },
        }).catch(() => null);
        const contactName = contact?.customName ?? contact?.name ?? null;

        // Nome que vem no payload da Evolution (pushName)
        const pushName: string | null = (data as any)?.pushName ?? (data as any)?.key?.pushName ?? null;
        const resolvedName = contactName ?? pushName ?? null;

        let user = await prisma.user.findFirst({ where: { phoneNumber, tenantId: tenant.id } });
        const bestName = isGroup
            ? (pushName ? `Grupo: ${pushName}` : `Grupo ${rawPhone.slice(-6)}`)
            : (contact?.customName ?? contact?.name ?? pushName ?? null);
        if (!user) {
            user = await prisma.user.create({
                data: {
                    phoneNumber, tenantId: tenant.id, isGroup,
                    ...(agent ? { agentId: agent.id } : {}),
                    ...(bestName ? { name: bestName } : {}),
                },
            });
        } else {
            const nameUpdate = bestName && bestName !== user.name ? { name: bestName } : {};
            const tenantUpdate = !user.tenantId ? { tenantId: tenant.id, ...(agent ? { agentId: agent.id } : {}) } : {};
            if (Object.keys({ ...nameUpdate, ...tenantUpdate }).length > 0) {
                user = await prisma.user.update({ where: { id: user.id }, data: { ...tenantUpdate, ...nameUpdate } });
            }
        }
        await prisma.user.update({ where: { id: user.id }, data: { lastInteraction: new Date(), interactionCount: { increment: 1 } } });
        const role = data?.key?.fromMe ? 'operator' : 'user';
        await prisma.chatHistory.create({ data: { userId: user.id, role, content: messageText } });

        log.webhook('info', 'Mensagem salva', {
            tenant: tenant.slug,
            phone: phoneNumber.slice(0, 4) + '****',
            role,
            chars: messageText.length,
        });

        // ── BOT INATIVO: salva mensagem mas nunca responde ────────────────────
        if (agent && !agent.isActive) {
            log.webhook('info', 'Bot inativo — mensagem salva, sem resposta', { tenant: tenant.slug });
            return;
        }

        // ── SELF-MESSAGE: detecta quando o operador fala consigo mesmo ────────
        if (data?.key?.fromMe) {
            const adminEnabled  = agent?.adminChatEnabled !== false;
            const internalMode  = (agent as any)?.agentInternalMode ?? 'orientador';
            const ownerPhone    = (agent as any)?.ownerPhone as string | undefined;

            const isSelfMessage = ownerPhone
                ? phoneVariants(rawPhone).some(v => phoneVariants(ownerPhone).includes(v))
                : false;

            if (isSelfMessage && adminEnabled) {
                if (internalMode === 'simulador') {
                    // ── MODO SIMULADOR: roda fluxo normal do agente, com tag ──
                    log.webhook('info', 'Agente Interno [SIMULADOR]: mensagem para si mesmo → processa como lead', { tenant: tenant.slug });

                    const { scheduleProcessing } = await import('./WebhookController');
                    await Promise.race([
                        // messageAlreadySaved=true (já salvou acima), simulatorMode=true
                        Promise.resolve(scheduleProcessing(phoneNumber, messageText, tenant.id, agent?.id ?? undefined, true, true)),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 120_000)),
                    ]).catch(err => {
                        log.webhook('error', 'Erro no simulador', { error: err?.message });
                    });
                } else {
                    // ── MODO ORIENTADOR: responde sobre o sistema ─────────────
                    log.webhook('info', 'Agente Interno [ORIENTADOR]: consultando sistema', { tenant: tenant.slug });
                    const adminHistory = await prisma.chatHistory.findMany({
                        where: { userId: user.id },
                        orderBy: { createdAt: 'desc' },
                        take: 20,
                        select: { role: true, content: true },
                    });
                    const history = adminHistory.reverse()
                        .slice(0, -1)
                        .filter(m => m.role === 'user' || m.role === 'operator' || m.role === 'model')
                        .map(m => ({
                            role: (m.role === 'model' ? 'model' : 'user') as 'user' | 'model',
                            content: m.content,
                        }));

                    const { text: reply, trace } = await handleAdminMessageWithTrace(tenant.id, messageText, history);
                    const whatsappReply = `*[🧭 ORIENTADOR]*\n${reply}`;
                    await prisma.chatHistory.create({ data: { userId: user.id, role: 'model', content: reply, trace: trace as any } });
                    await EvolutionService.sendText(tenant.evolutionInstance!, phoneNumber, whatsappReply);
                    log.webhook('info', 'Orientador: resposta enviada', { tenant: tenant.slug, chars: reply.length });
                }
            }
            return;
        }

        // ── GRUPOS: salvar sempre; responder só se ignoreGroups=false ─────────
        if (isGroup) {
            if (agent?.ignoreGroups !== false) {
                log.webhook('info', 'Grupo: salvo, bot não responde (ignoreGroups=true)', { id: phoneNumber.slice(-6) });
                return;
            }
            const allowedGroups: string[] = agent?.whitelistGroups?.map((g: any) => g.groupId) ?? [];
            if (allowedGroups.length > 0 && !allowedGroups.includes(phoneNumber)) {
                log.webhook('info', 'Grupo bloqueado pela whitelist', { id: phoneNumber.slice(-6) });
                return;
            }
        }

        // ── WHITELIST: decide se bot responde (não impede salvar) ─────────────
        if (agent?.whitelistEnabled) {
            const allowedSet = new Set(agent?.whitelistPhones?.map((w: any) => w.phone) ?? []);
            const variants = phoneVariants(phoneNumber);
            if (!variants.some(v => allowedSet.has(v))) {
                log.webhook('info', 'Whitelist: contato bloqueado (mensagem salva, bot não responde)', {
                    phone: phoneNumber.slice(0, 4) + '****',
                    variants: variants.join(','),
                    allowed: [...allowedSet].join(','),
                });
                return;
            }
        }

        // ── DISPARA PROCESSAMENTO (IA responde) — mensagem já salva ──────────
        const { scheduleProcessing } = await import('./WebhookController');
        await Promise.race([
            Promise.resolve(scheduleProcessing(phoneNumber, messageText, tenant.id, agent?.id ?? undefined, true)),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 120_000)),
        ]).catch(err => {
            log.webhook('error', 'Erro no processamento', { tenant: tenant.slug, error: err instanceof Error ? err.message : String(err) });
        });

        log.webhook('info', 'Processamento concluído', { tenant: tenant.slug });

    } catch (err) {
        console.error('[EVO-WH] 💥 ERRO CRÍTICO no webhook Evolution:', err);
    }
}
