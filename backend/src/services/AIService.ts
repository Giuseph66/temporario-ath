import { GoogleGenerativeAI, FunctionDeclaration, SchemaType, Tool } from "@google/generative-ai";
import dotenv from "dotenv";
import { calendarService } from "./CalendarService";
import { asaasService, asaasServiceForTenant } from "./AsaasService";
import { WhatsAppService } from "./WhatsAppService";
import { prisma } from '../utils/prisma';
import { recordError, recordUsage } from './GeminiUsageService';
import { getTenantUsageState } from './GeminiBudgetService';

dotenv.config();

const whatsapp = new WhatsAppService();

// ── Error classification for intelligent retry logic ─────────────────────────
type ErrorCategory = 'TRANSIENT' | 'RATE_LIMIT' | 'PERMANENT';

function classifyError(error: unknown): ErrorCategory {
    if (error instanceof Error) {
        const name = error.name;
        const msg = error.message.toLowerCase();

        // AbortError = timeout from the SDK's internal AbortController
        if (name === 'AbortError' || msg.includes('aborted')) return 'TRANSIENT';
        // Network failures
        if (msg.includes('econnreset') || msg.includes('econnrefused') ||
            msg.includes('etimedout') || msg.includes('fetch failed') ||
            msg.includes('network')) return 'TRANSIENT';
        // 500/503 server errors from Google
        if (msg.includes('500') || msg.includes('503') ||
            msg.includes('internal') || msg.includes('unavailable')) return 'TRANSIENT';
        // 429 / resource exhausted
        if (msg.includes('429') || msg.includes('rate limit') ||
            msg.includes('resource exhausted') || msg.includes('quota')) return 'RATE_LIMIT';
    }
    // Everything else (400, 401, 403, invalid request, etc.) is permanent
    return 'PERMANENT';
}

// Tool declarations exposed to the Gemini model for real calendar operations
const checkAvailabilityDecl: FunctionDeclaration = {
    name: "check_availability",
    description: "Verifica os horários ocupados no calendário da Confluence para um intervalo de tempo. Retorna uma lista de slots ocupados. Use isso ANTES de confirmar qualquer horário ao cliente.",
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            timeMin: {
                type: SchemaType.STRING,
                description: "Início do intervalo a verificar, em formato ISO 8601 (ex: 2026-03-10T08:00:00-04:00)"
            },
            timeMax: {
                type: SchemaType.STRING,
                description: "Fim do intervalo a verificar, em formato ISO 8601 (ex: 2026-03-10T18:00:00-04:00)"
            }
        },
        required: ["timeMin", "timeMax"]
    }
};

const createAppointmentDecl: FunctionDeclaration = {
    name: "create_appointment",
    description: "Cria um evento no calendário da Confluence. Só chame esta função APÓS o cliente ter confirmado explicitamente o horário desejado. Para matrículas regulares, SEMPRE chame esta função JUNTO com 'generate_payment' na mesma resposta — nunca uma sem a outra. A única exceção é aula experimental gratuita (recurringWeeks: 0). Para programas semestrais (Inglês Personalizado, Tech Lab), use 'recurringWeeks' para agendar todas as aulas do semestre de uma vez.",
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            summary: {
                type: SchemaType.STRING,
                description: "Título do evento, incluindo o tipo de serviço e o nome do cliente (ex: 'Inglês Personalizado - João Silva')"
            },
            startTime: {
                type: SchemaType.STRING,
                description: "Data e hora de início do agendamento, em formato ISO 8601 (ex: 2026-03-10T09:00:00-04:00)"
            },
            endTime: {
                type: SchemaType.STRING,
                description: "Data e hora de término do agendamento, em formato ISO 8601 (ex: 2026-03-10T10:00:00-04:00)"
            },
            recurringWeeks: {
                type: SchemaType.NUMBER,
                description: "Número de semanas para repetir o evento semanalmente. Use o valor de 'duration_weeks' do programa (ex: 24 para programas de 6 meses). Omita ou use 0 para aulas avulsas e aulas experimentais."
            }
        },
        required: ["summary", "startTime", "endTime"]
    }
};

const findAppointmentsDecl: FunctionDeclaration = {
    name: "find_appointments",
    description: "Busca eventos agendados no calendário da Confluence num intervalo de tempo. Retorna lista de eventos com id, resumo e horários. Use ANTES de cancelar uma aula para identificar o evento correto.",
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            query: {
                type: SchemaType.STRING,
                description: "Texto para filtrar pelo título do evento (ex: nome do aluno). Deixe vazio para listar todos no período."
            },
            timeMin: {
                type: SchemaType.STRING,
                description: "Início do intervalo de busca, em formato ISO 8601 (ex: 2026-03-10T08:00:00-04:00)"
            },
            timeMax: {
                type: SchemaType.STRING,
                description: "Fim do intervalo de busca, em formato ISO 8601 (ex: 2026-03-10T18:00:00-04:00)"
            }
        },
        required: ["timeMin", "timeMax"]
    }
};

const cancelAppointmentDecl: FunctionDeclaration = {
    name: "cancel_appointment",
    description: "Remove (cancela) um ou todos os eventos de uma série no calendário da Confluence. Só chame APÓS identificar o evento correto com find_appointments e confirmar com o usuário. Use 'id' para cancelar apenas uma aula. Use 'recurringEventId' (retornado por find_appointments) para cancelar TODAS as aulas de uma série recorrente.",
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            eventId: {
                type: SchemaType.STRING,
                description: "ID do evento a cancelar. Para cancelar só uma ocorrência, passe o 'id' da instância. Para cancelar toda a série, passe o 'recurringEventId' retornado por find_appointments."
            }
        },
        required: ["eventId"]
    }
};

const generatePaymentDecl: FunctionDeclaration = {
    name: "generate_payment",
    description: "Gera um link de cobrança real no Asaas para o aluno. Suporta 3 tipos de pagamento: 'monthly' (assinatura recorrente mensal), 'semester' (cobrança única do semestre com 5% de desconto) e 'annual' (cobrança única do ano com 7% de desconto). Para sessão avulsa de terapia PRM, use paymentType 'monthly' com installmentCount 1. SOMENTE chame após informar o valor, confirmar o CPF, perguntar a data de vencimento e o tipo de pagamento preferido.",
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            customerName: {
                type: SchemaType.STRING,
                description: "Nome completo do cliente/aluno."
            },
            cpf: {
                type: SchemaType.STRING,
                description: "CPF do cliente, exatamente como fornecido (com ou sem formatação). Ex: '123.456.789-00' ou '12345678900'."
            },
            amount: {
                type: SchemaType.NUMBER,
                description: "Valor MENSAL (ou por sessão) BASE da cobrança em reais, SEM desconto. Ex: 550.00 para Inglês Personalizado individual, 410.00 para dupla. O sistema aplicará o desconto automaticamente conforme o paymentType."
            },
            description: {
                type: SchemaType.STRING,
                description: "Descrição do curso ou serviço sendo cobrado. Ex: 'Inglês Personalizado 2026 — Mensalidade'"
            },
            installmentCount: {
                type: SchemaType.NUMBER,
                description: "Número de meses/parcelas do programa. Use o valor de 'installments' do programa (ex: 6). Use 1 para sessão avulsa de terapia."
            },
            paymentType: {
                type: SchemaType.STRING,
                format: "enum",
                description: "Tipo de pagamento escolhido pelo aluno. 'monthly' = parcelado mensal (assinatura recorrente). 'semester' = pagamento integral do semestre com 5% de desconto (cobrança única). 'annual' = pagamento integral do ano com 7% de desconto (cobrança única). Para Terapia PRM, use SEMPRE 'monthly'.",
                enum: ["monthly", "semester", "annual"]
            },
            firstDueDate: {
                type: SchemaType.STRING,
                description: "Data do primeiro vencimento no formato YYYY-MM-DD, conforme preferência informada pelo aluno. Ex: '2026-04-10' para vencimento no dia 10 de abril."
            }
        },
        required: ["customerName", "cpf", "amount", "description", "installmentCount", "paymentType"]
    }
};

const cancelAsaasPaymentDecl: FunctionDeclaration = {
    name: "cancel_asaas_payment",
    description: "Cancela todas as cobranças PENDENTES do usuário atual no Asaas. Use quando o usuário quiser cancelar um pagamento ou cobrança gerada. Não requer parâmetros — o sistema identifica o cliente pelo telefone cadastrado.",
    parameters: {
        type: SchemaType.OBJECT,
        properties: {}
    }
};

const createFollowUpDecl: FunctionDeclaration = {
    name: "create_follow_up",
    description: "Cria uma tarefa futura para chamar novamente APENAS o lead atual. Use quando o cliente pedir retorno futuro, inclusive frases relativas como 'daqui 10 min', 'em 2 horas' ou 'amanhã'. Converta sempre para data/hora ISO futura. Nunca use para campanhas em massa.",
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            runAt: {
                type: SchemaType.STRING,
                description: "Data e hora futura em ISO 8601 para executar o follow-up. Ex: 2026-06-17T09:00:00-04:00"
            },
            messageTemplate: {
                type: SchemaType.STRING,
                description: "Mensagem curta que sera enviada no WhatsApp. Pode usar {{firstName}}."
            },
            reason: {
                type: SchemaType.STRING,
                description: "Motivo interno do follow-up, para auditoria e memoria do agente."
            }
        },
        required: ["runAt", "messageTemplate", "reason"]
    }
};

function normalizeText(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function parseRelativeFollowUp(message: string): { runAt: Date; label: string; reason: string } | null {
    const normalized = normalizeText(message);
    const match = normalized.match(/(?:daqui|em)\s+(\d{1,3})\s*(min(?:uto)?s?|m|h|hr|hrs|hora?s?|dia?s?)/i);
    if (!match) return null;

    const hasFollowUpIntent = [
        'me chama',
        'chama',
        'retorna',
        'retorno',
        'me lembra',
        'lembra',
        'manda mensagem',
        'falar',
        'conversar',
        'livre',
        'tempinho',
        'agora nao',
        'depois',
    ].some(term => normalized.includes(term));
    if (!hasFollowUpIntent) return null;

    const amount = Number(match[1]);
    const unit = match[2];
    if (!Number.isFinite(amount) || amount <= 0) return null;

    let minutes = amount;
    let labelUnit = amount === 1 ? 'minuto' : 'minutos';
    if (/^(h|hr|hrs|hora)/.test(unit)) {
        minutes = amount * 60;
        labelUnit = amount === 1 ? 'hora' : 'horas';
    } else if (/^dia/.test(unit)) {
        minutes = amount * 1440;
        labelUnit = amount === 1 ? 'dia' : 'dias';
    }

    return {
        runAt: new Date(Date.now() + minutes * 60_000),
        label: `daqui ${amount} ${labelUnit}`,
        reason: `Pedido explícito do lead: "${message}"`,
    };
}

function asObject(value: unknown): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

export class AIService {
    // Resolve chave Gemini: banco do tenant > env > erro
    private async resolveApiKey(tenantId?: string): Promise<string> {
        if (tenantId) {
            const tenant = await prisma.tenant.findUnique({
                where: { id: tenantId },
                select: { geminiApiKey: true },
            });
            if (tenant?.geminiApiKey) return tenant.geminiApiKey;
        }
        const envKey = process.env.GEMINI_API_KEY;
        if (envKey) return envKey;
        throw new Error('Chave Gemini não configurada. Defina GEMINI_API_KEY no .env ou configure a chave do tenant no banco.');
    }

    private async getGenAI(tenantId?: string): Promise<GoogleGenerativeAI> {
        const apiKey = await this.resolveApiKey(tenantId);
        return new GoogleGenerativeAI(apiKey);
    }

    async generateAutomationMessage(
        tenantId: string,
        input: { prompt: string; lead: Record<string, unknown>; automationName: string }
    ): Promise<string> {
        const usageState = await getTenantUsageState(tenantId);
        if (!usageState.canUseGemini) {
            throw new Error('Estou passando por uma instabilidade temporária. Nossa equipe foi notificada. Tente novamente em breve.');
        }
        const genAI = await this.getGenAI(tenantId);
        const prompt = `
Crie uma mensagem curta de WhatsApp em portugues do Brasil.
Use tom humano, direto e respeitoso.
Nao diga que a mensagem e automatica.
Nao invente dados.
Retorne apenas a mensagem final.

Automacao: ${input.automationName}
Lead: ${JSON.stringify(input.lead)}
Instrucao: ${input.prompt}
`;

        let lastError: unknown;
        for (const modelId of ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash']) {
            const startedAt = Date.now();
            try {
                const model = genAI.getGenerativeModel({
                    model: modelId,
                    generationConfig: { temperature: 0.3, topP: 0.85 },
                }, { timeout: 30_000 });
                const result = await model.generateContent(prompt);
                recordUsage({
                    tenantId,
                    source: 'automation',
                    feature: 'automation_message',
                    phase: modelId === 'gemini-2.5-flash' ? 'initial' : 'fallback',
                    channel: 'whatsapp',
                    model: modelId,
                    startedAt,
                }, result, { status: 'SUCCESS' }).catch(() => {});
                const text = result.response.text().replace(/\*\*/g, '*').trim();
                if (text) return text;
            } catch (error) {
                recordError({
                    tenantId,
                    source: 'automation',
                    feature: 'automation_message',
                    phase: modelId === 'gemini-2.5-flash' ? 'initial' : 'fallback',
                    channel: 'whatsapp',
                    model: modelId,
                    startedAt,
                }, error).catch(() => {});
                lastError = error;
            }
        }

        throw lastError instanceof Error ? lastError : new Error('Falha ao gerar mensagem da automação.');
    }

    private isModelReasoning(text: string): boolean {
        const trimmed = text.trim();
        if (!trimmed) return true;
        
        // Detect English monologue patterns that are clearly internal reasoning
        const reasoningPatterns = [
            /^(Wait|Actually|I should|I will|I've done|I don't need|I need to|Let me|The system|The tool)/i,
            /tool calls? (are|is) executing/i,
            /I should just (output|return|wait)/i,
            /the prompt (allows|says|instructs)/i,
        ];
        if (reasoningPatterns.some(p => p.test(trimmed))) return true;
        
        // Detecta texto predominantemente inglês (>85% palavras ASCII puras)
        // Threshold alto para não matar respostas com nomes de programas em inglês
        const words = trimmed.split(/\s+/);
        if (words.length > 10) {
            const asciiWordPattern = /^[a-zA-Z']+$/;
            const asciiWords = words.filter(w => asciiWordPattern.test(w)).length;
            if (asciiWords / words.length > 0.85) return true;
        }

        return false;
    }

    private async createLeadFollowUp(
        userPhone: string,
        tenantId: string | undefined,
        runAt: Date,
        messageTemplate: string,
        reason: string,
    ): Promise<{ ok: boolean; error?: string; runAt?: string }> {
        const dbUser = await prisma.user.findFirst({ where: { phoneNumber: userPhone } });
        const effectiveTenantId = tenantId ?? dbUser?.tenantId;

        if (!dbUser || !effectiveTenantId) {
            return { ok: false, error: 'Lead nao encontrado para criar follow-up.' };
        }
        if (Number.isNaN(runAt.getTime()) || runAt <= new Date()) {
            return { ok: false, error: 'Data do follow-up invalida ou no passado.' };
        }

        await this.pausePendingLeadFollowUps(effectiveTenantId, dbUser.id);

        await prisma.automation.create({
            data: {
                tenantId: effectiveTenantId,
                name: `Follow-up - ${dbUser.name ?? dbUser.phoneNumber}`,
                type: 'ONE_OFF',
                status: 'ACTIVE',
                triggerType: 'TIME',
                scheduleJson: { runAt: runAt.toISOString() },
                targetJson: { userId: dbUser.id },
                conditionsJson: {
                    requireLgpd: false,
                    skipGroups: true,
                    sendWindow: { start: '08:00', end: '18:00' },
                    excludeEnrollmentStatuses: ['ENROLLED', 'CANCELLED'],
                },
                actionJson: {
                    messageTemplate,
                    internalNote: `[AUTOMACAO INTERNA] Follow-up criado pelo agente. Motivo: ${reason}`,
                    cancelIfLeadInteracted: true,
                },
                limitsJson: { cooldownHours: 0 },
                requiresApproval: false,
                nextRunAt: runAt,
            },
        });

        return { ok: true, runAt: runAt.toISOString() };
    }

    private async pausePendingLeadFollowUps(tenantId: string, userId: string): Promise<void> {
        const pending = await prisma.automation.findMany({
            where: {
                tenantId,
                status: 'ACTIVE',
                type: 'ONE_OFF',
                nextRunAt: { gt: new Date() },
            },
            select: {
                id: true,
                targetJson: true,
                actionJson: true,
            },
        });

        const oldFollowUpIds = pending
            .filter(automation => {
                const target = asObject(automation.targetJson);
                const action = asObject(automation.actionJson);
                return target.userId === userId
                    && (action.cancelIfLeadInteracted === true || String(action.internalNote ?? '').includes('Follow-up criado pelo agente'));
            })
            .map(automation => automation.id);

        if (oldFollowUpIds.length === 0) return;

        await prisma.automation.updateMany({
            where: { id: { in: oldFollowUpIds } },
            data: { status: 'PAUSED', nextRunAt: null },
        });
    }

    private async executeToolCall(name: string, args: any, userPhone: string, tenantId?: string): Promise<{ result: any; capturedPaymentUrl?: string }> {
        let toolResult: any;
        let capturedPaymentUrl: string | undefined;

        try {
            if (name === "check_availability") {
                console.log(`🗓️ Artemis chamou check_availability: ${args.timeMin} → ${args.timeMax}`);
                const rawSlots = await calendarService.checkAvailability(args.timeMin, args.timeMax);
                console.log(`🗓️ Resultado check_availability:`, JSON.stringify(rawSlots));
                toolResult = rawSlots.length === 0
                    ? { busySlots: [], message: "Nenhum horário ocupado neste período — todos os slots estão disponíveis." }
                    : { busySlots: rawSlots, message: `${rawSlots.length} horário(s) ocupado(s) encontrado(s).` };

            } else if (name === "create_appointment") {
                console.log(`📅 Artemis chamou create_appointment: "${args.summary}" às ${args.startTime}${args.recurringWeeks ? ` (recorrente: ${args.recurringWeeks} semanas)` : ''}`);

                // Server-side availability guard: reject if the slot is already taken
                const busySlots = await calendarService.checkAvailability(args.startTime, args.endTime);
                if (busySlots.length > 0) {
                    console.warn(`⛔ Horário indisponível para create_appointment. Slots ocupados:`, JSON.stringify(busySlots));
                    toolResult = {
                        error: 'Horário indisponível. Já existe um agendamento neste horário.',
                        busySlots: busySlots,
                    };
                } else {
                    toolResult = await calendarService.createAppointment(args.summary, args.startTime, args.endTime, args.recurringWeeks);
                    console.log(`📅 Evento criado:`, toolResult);
                }
                // NOTE: WhatsApp Business API requires 24h messaging window — Dayana
                // notifications disabled for now. Calendar event itself serves as notification.

            } else if (name === "find_appointments") {
                console.log(`🔍 Artemis chamou find_appointments: query="${args.query ?? ''}" | ${args.timeMin} → ${args.timeMax}`);
                const rawEvents = await calendarService.findAppointments(args.query ?? '', args.timeMin, args.timeMax);
                console.log(`🔍 Resultado find_appointments:`, JSON.stringify(rawEvents));
                toolResult = rawEvents.length === 0
                    ? { events: [], message: "Nenhum evento encontrado neste período." }
                    : { events: rawEvents, message: `${rawEvents.length} evento(s) encontrado(s).` };

            } else if (name === "cancel_appointment") {
                console.log(`🗑️  Artemis chamou cancel_appointment: eventId=${args.eventId}`);
                toolResult = await calendarService.cancelAppointment(args.eventId);
                console.log(`🗑️  Resultado cancel_appointment:`, toolResult);

            } else if (name === "generate_payment") {
                const paymentType = args.paymentType || 'monthly';
                console.log(`💳 Artemis chamou generate_payment: R$${args.amount} | tipo: ${paymentType}`);

                // 1. Busca o usuário no banco pelo telefone
                const dbUser = await prisma.user.findFirst({ where: { phoneNumber: userPhone } });

                let asaasCustomerId = dbUser?.asaasCustomerId ?? null;

                // 2. Valida o ID salvo no Asaas atual; se estiver inválido, busca/cria por CPF.
                if (dbUser) {
                    const svc = tenantId ? await asaasServiceForTenant(tenantId) : asaasService;
                    asaasCustomerId = await svc.ensureCustomer(
                        args.customerName,
                        args.cpf,
                        userPhone,
                        asaasCustomerId
                    );
                    await prisma.user.update({
                        where: { id: dbUser.id },
                        data: {
                            asaasCustomerId: asaasCustomerId,
                            cpf: args.cpf.replace(/\D/g, '') // Salva só os dígitos
                        }
                    });
                    console.log(`💾 asaasCustomerId e CPF salvos no banco.`);
                }

                // 3. Calcula valor final e parcelas conforme tipo de pagamento
                let finalAmount = args.amount;
                let finalInstallments = args.installmentCount ?? 1;

                if (paymentType === 'semester') {
                    // Cobrança única do semestre com 5% de desconto
                    finalAmount = args.amount * (args.installmentCount ?? 6) * 0.95;
                    finalInstallments = 1;
                    console.log(`💰 Pagamento semestral: ${args.installmentCount ?? 6}x R$${args.amount} com 5% desc = R$${finalAmount.toFixed(2)}`);
                } else if (paymentType === 'annual') {
                    // Cobrança única do ano (12 meses) com 7% de desconto
                    finalAmount = args.amount * 12 * 0.93;
                    finalInstallments = 1;
                    console.log(`💰 Pagamento anual: 12x R$${args.amount} com 7% desc = R$${finalAmount.toFixed(2)}`);
                }

                // Arredonda para 2 casas decimais
                finalAmount = Math.round(finalAmount * 100) / 100;

                // 4. Gera o link de cobrança (assinatura ou avulso)
                if (!asaasCustomerId) {
                    toolResult = { error: 'Cliente Asaas não encontrado. Tente novamente.' };
                    return { result: toolResult };
                }
                const svc2 = tenantId ? await asaasServiceForTenant(tenantId) : asaasService;
                let invoiceUrl: string;
                try {
                    invoiceUrl = await svc2.generatePaymentLink(
                        asaasCustomerId,
                        finalAmount,
                        args.description,
                        finalInstallments,
                        args.firstDueDate
                    );
                } catch (paymentError: any) {
                    if (!String(paymentError?.message ?? '').includes('invalid_customer') || !dbUser) {
                        throw paymentError;
                    }

                    console.warn(`⚠️ Cliente Asaas rejeitado na cobrança (${asaasCustomerId}). Recriando e tentando novamente.`);
                    asaasCustomerId = await svc2.ensureCustomer(args.customerName, args.cpf, userPhone, null);
                    await prisma.user.update({
                        where: { id: dbUser.id },
                        data: {
                            asaasCustomerId,
                            cpf: args.cpf.replace(/\D/g, ''),
                        },
                    });
                    invoiceUrl = await svc2.generatePaymentLink(
                        asaasCustomerId,
                        finalAmount,
                        args.description,
                        finalInstallments,
                        args.firstDueDate
                    );
                }

                capturedPaymentUrl = invoiceUrl;

                // Persist the real URL to the DB so it can be recalled without history
                if (dbUser) {
                    await prisma.user.update({
                        where: { id: dbUser.id },
                        data: { lastPaymentUrl: invoiceUrl }
                    });
                }

                // NOTE: WhatsApp Business API requires 24h messaging window — Dayana
                // enrollment notifications disabled for now. Payment confirmation
                // is handled by the Asaas webhook flow instead.

                // Tell the model the link was generated but NOT to include it in text —
                // the code will send the exact URL as a separate message to prevent truncation.
                toolResult = {
                    success: true,
                    message: 'Link de pagamento gerado com sucesso. O link será enviado automaticamente ao usuário como mensagem separada — NÃO escreva nem repita o link no texto da sua resposta.'
                };
                console.log(`✅ Link de pagamento gerado com sucesso: ${invoiceUrl}`);

            } else if (name === "create_follow_up") {
                const runAt = new Date(args.runAt);
                const created = await this.createLeadFollowUp(
                    userPhone,
                    tenantId,
                    runAt,
                    args.messageTemplate,
                    args.reason,
                );
                if (!created.ok) {
                    toolResult = { error: created.error };
                } else {
                    toolResult = { ok: true, runAt: created.runAt, message: 'Follow-up criado.' };
                }

            } else if (name === "cancel_asaas_payment") {
                console.log(`🚫 Artemis chamou cancel_asaas_payment para ${userPhone}`);
                const dbUser = await prisma.user.findFirst({ where: { phoneNumber: userPhone } });
                if (!dbUser?.asaasCustomerId) {
                    toolResult = { success: false, message: 'Nenhuma cobrança encontrada para este usuário.' };
                } else {
                    const svc3 = tenantId ? await asaasServiceForTenant(tenantId) : asaasService;
                    toolResult = await svc3.cancelPendingPayments(dbUser.asaasCustomerId);
                    console.log(`🚫 Resultado cancel_asaas_payment:`, toolResult);
                }

            } else {
                console.warn(`⚠️ Tool desconhecida chamada pelo modelo: ${name}`);
                toolResult = { error: `Ferramenta '${name}' não reconhecida.` };
            }
        } catch (toolError: any) {
            console.error(`❌ Erro ao executar tool '${name}':`, toolError?.message ?? toolError);
            toolResult = { error: `Falha ao executar '${name}': ${toolError?.message ?? 'erro desconhecido'}` };
        }

        return { result: toolResult, capturedPaymentUrl };
    }

    /**
     * Gera a resposta da Artemis.
     *
     * O `systemInstruction` agora é construído externamente pelo PromptBuilder,
     * com apenas os blocos de instrução relevantes para o estado atual da conversa.
     * Isso evita sobrecarregar o modelo com regras que não se aplicam ao momento.
     *
     * Inclui um loop de function calling: quando o modelo chama check_availability,
     * create_appointment ou generate_payment, a função real é executada e o resultado
     * é devolvido ao modelo para que ele possa responder com dados reais.
     *
     * @param userPhone - Número de telefone do usuário (ex: "5565999999999") — usado para buscar/salvar o ID Asaas no banco.
     */
    async generateResponse(userPhone: string, history: any[], message: string, systemInstruction: string, state: string = 'GREETING', tenantId?: string): Promise<{ text: string; paymentUrl?: string; trace?: { toolsUsed: string[]; state: string; modelId: string } }> {
        try {
            if (tenantId) {
                const usageState = await getTenantUsageState(tenantId);
                if (!usageState.canUseGemini) {
                    return {
                        text: 'Estou passando por uma instabilidade temporária. Nossa equipe foi notificada. Tente novamente em breve.',
                        trace: { toolsUsed: [], state, modelId: 'blocked_by_budget' },
                    };
                }
            }

            const relativeFollowUp = parseRelativeFollowUp(String(message));
            if (relativeFollowUp) {
                const created = await this.createLeadFollowUp(
                    userPhone,
                    tenantId,
                    relativeFollowUp.runAt,
                    'Oi {{firstName}}! Passando para te chamar como combinado. Podemos continuar por aqui?',
                    relativeFollowUp.reason,
                );

                if (created.ok) {
                    return {
                        text: `Combinado, vou te chamar ${relativeFollowUp.label}. Até já!`,
                        trace: { toolsUsed: ['create_follow_up'], state, modelId: 'deterministic-follow-up' },
                    };
                }
            }

            const genAI = await this.getGenAI(tenantId);

            // Filter tools based on current conversation state
            const activeToolDecls: FunctionDeclaration[] = [createFollowUpDecl];
            if (['PROGRAM_PRESENTATION', 'OBJECTION_HANDLING', 'CLOSING'].includes(state)) {
                activeToolDecls.push(checkAvailabilityDecl, createAppointmentDecl, findAppointmentsDecl, cancelAppointmentDecl);
            }
            if (state === 'CLOSING') {
                activeToolDecls.push(generatePaymentDecl, cancelAsaasPaymentDecl);
            }
            const toolsToPass: Tool[] | undefined = activeToolDecls.length > 0
                ? [{ functionDeclarations: activeToolDecls }]
                : undefined;

            // States with tool calling need more time: larger system prompt + sequential API calls
            const TOOL_STATES = ['PROGRAM_PRESENTATION', 'OBJECTION_HANDLING', 'CLOSING'];
            const timeoutMs = TOOL_STATES.includes(state) ? 60_000 : 45_000;

            // O modelo é instanciado por chamada, com a instrução de sistema correta
            const model = genAI.getGenerativeModel({
                model: "gemini-3.1-pro-preview",
                systemInstruction: systemInstruction,
                tools: toolsToPass,
                generationConfig: {
                    temperature: 0.2,  // Low randomness: forces strict persona adherence
                    topP: 0.85,        // Narrows vocabulary pool to reduce repetitive patterns
                    topK: 40           // Limits candidate tokens to suppress emoji loops
                }
            }, { timeout: timeoutMs });

            let validHistory: any[] = [];
            if (Array.isArray(history)) {
                validHistory = history.map(h => {
                    const role = h.role === 'assistant' ? 'model' : 'user';
                    const text = h.content || "";
                    return { role: role, parts: [{ text: String(text) }] };
                }).filter(h => h.parts[0].text !== "");
            }

            const chat = model.startChat({ history: validHistory });
            const usageContextBase = tenantId ? {
                tenantId,
                source: 'lead_flow',
                feature: 'lead_agent',
                fsmState: state,
                channel: 'whatsapp',
                model: 'gemini-3.1-pro-preview',
            } : null;
            let usageAttempt = 0;

            const sendTracked = async (payload: any, phase: string, requestMeta?: Record<string, unknown>) => {
                const startedAt = Date.now();
                usageAttempt += 1;
                try {
                    const response = await chat.sendMessage(payload);
                    if (usageContextBase) {
                        recordUsage({
                            ...usageContextBase,
                            phase,
                            attempt: usageAttempt,
                            startedAt,
                            requestMeta,
                        }, response, { status: 'SUCCESS' }).catch(() => {});
                    }
                    return response;
                } catch (error) {
                    if (usageContextBase) {
                        recordError({
                            ...usageContextBase,
                            phase,
                            attempt: usageAttempt,
                            startedAt,
                            requestMeta,
                        }, error).catch(() => {});
                    }
                    throw error;
                }
            };

            let result = await sendTracked(String(message), 'initial');

            // Captures the real payment URL so it can be sent by code (never by model text)
            let capturedPaymentUrl: string | undefined;
            let calledCreateAppointment = false;
            let calledGeneratePayment = false;
            const toolsUsed: string[] = [];

            // Tool-call loop: execute real functions when the model requests them
            const TOOL_LOOP_TIMEOUT_MS = 90_000; // 90s wall clock for the entire tool loop
            const loopStartTime = Date.now();

            while (true) {
                if (Date.now() - loopStartTime > TOOL_LOOP_TIMEOUT_MS) {
                    console.error('⏰ Tool-calling loop exceeded 90s wall clock — aborting.');
                    break;
                }

                const parts = result.response.candidates?.[0]?.content?.parts ?? [];
                const toolCallParts = parts.filter((p: any) => p.functionCall);
                if (toolCallParts.length === 0) break; // No tool call → final text response ready

                const functionResponses: Array<{name: string; result: any}> = [];

                for (const toolCallPart of toolCallParts) {
                    const { name, args } = toolCallPart.functionCall as { name: string; args: any };

                    if (name === "create_appointment") calledCreateAppointment = true;
                    if (name === "generate_payment") calledGeneratePayment = true;
                    if (!toolsUsed.includes(name)) toolsUsed.push(name);

                    const execResult = await this.executeToolCall(name, args, userPhone, tenantId);
                    if (execResult.capturedPaymentUrl) {
                        capturedPaymentUrl = execResult.capturedPaymentUrl;
                    }

                    functionResponses.push({ name, result: execResult.result });
                }

                result = await sendTracked(
                    functionResponses.map(fr => ({ functionResponse: { name: fr.name, response: { result: fr.result } } })),
                    'tool_response',
                    { functionResponseNames: functionResponses.map(fr => fr.name) }
                );
            }

            // Safety net: se create_appointment foi chamado em CLOSING mas generate_payment não foi
            if (state === 'CLOSING' && calledCreateAppointment && !calledGeneratePayment) {
                console.warn('⚠️ Safety net: create_appointment sem generate_payment em CLOSING.');
                result = await sendTracked(
                    'ATENÇÃO: Você agendou a aula com create_appointment mas NÃO gerou o pagamento com generate_payment. ' +
                    'Conforme as regras, ambas devem ser chamadas juntas. Chame generate_payment AGORA com os dados já coletados.',
                    'safety_net_generate_payment'
                );

                let safetyNetAttempts = 0;
                while (safetyNetAttempts < 2) {
                    if (Date.now() - loopStartTime > TOOL_LOOP_TIMEOUT_MS) {
                        console.error('⏰ Safety net loop exceeded wall clock — aborting.');
                        break;
                    }

                    const parts = result.response.candidates?.[0]?.content?.parts ?? [];
                    const toolCallParts = parts.filter((p: any) => p.functionCall);
                    if (toolCallParts.length === 0) break;

                    const functionResponses: Array<{name: string; result: any}> = [];
                    for (const toolCallPart of toolCallParts) {
                        const { name, args } = toolCallPart.functionCall as { name: string; args: any };

                        if (name === "generate_payment") calledGeneratePayment = true;
                        if (!toolsUsed.includes(name)) toolsUsed.push(name);

                        const execResult = await this.executeToolCall(name, args, userPhone, tenantId);
                        if (execResult.capturedPaymentUrl) {
                            capturedPaymentUrl = execResult.capturedPaymentUrl;
                        }

                        functionResponses.push({ name, result: execResult.result });
                    }

                    result = await sendTracked(
                        functionResponses.map(fr => ({ functionResponse: { name: fr.name, response: { result: fr.result } } })),
                        'tool_response',
                        { functionResponseNames: functionResponses.map(fr => fr.name) }
                    );
                    safetyNetAttempts++;
                }
            }

            // Safety net reverso: se generate_payment foi chamado sem create_appointment
            if (state === 'CLOSING' && calledGeneratePayment && !calledCreateAppointment) {
                console.warn('⚠️ Safety net: generate_payment sem create_appointment em CLOSING.');
                result = await sendTracked(
                    'ATENÇÃO: Você chamou generate_payment mas esqueceu de chamar create_appointment. ' +
                    'Conforme as regras, você deve chamar create_appointment AGORA com os dados da aula.',
                    'safety_net_create_appointment'
                );

                let safetyNetAttempts = 0;
                while (safetyNetAttempts < 2) {
                    if (Date.now() - loopStartTime > TOOL_LOOP_TIMEOUT_MS) {
                        console.error('⏰ Safety net loop exceeded wall clock — aborting.');
                        break;
                    }

                    const parts = result.response.candidates?.[0]?.content?.parts ?? [];
                    const toolCallParts = parts.filter((p: any) => p.functionCall);
                    if (toolCallParts.length === 0) break;

                    const functionResponses: Array<{name: string; result: any}> = [];
                    for (const toolCallPart of toolCallParts) {
                        const { name, args } = toolCallPart.functionCall as { name: string; args: any };

                        if (name === "create_appointment") calledCreateAppointment = true;
                        if (!toolsUsed.includes(name)) toolsUsed.push(name);

                        const execResult = await this.executeToolCall(name, args, userPhone, tenantId);
                        if (execResult.capturedPaymentUrl) {
                            capturedPaymentUrl = execResult.capturedPaymentUrl;
                        }

                        functionResponses.push({ name, result: execResult.result });
                    }

                    result = await sendTracked(
                        functionResponses.map(fr => ({ functionResponse: { name: fr.name, response: { result: fr.result } } })),
                        'tool_response',
                        { functionResponseNames: functionResponses.map(fr => fr.name) }
                    );
                    safetyNetAttempts++;
                }
            }

            // Filtra textos de reasoning do modelo antes de enviar pro WhatsApp
            let responseText: string = "";
            try {
                const finalParts = result.response.candidates?.[0]?.content?.parts ?? [];
                const textParts = finalParts
                    .filter((p: any) => p.text && !this.isModelReasoning(p.text))
                    .map((p: any) => p.text as string);
                
                responseText = textParts.join('').replace(/\*\*/g, '*');
            } catch {
                console.warn('⚠️ result.response não retornou as partes corretamente.');
            }

            if (!responseText.trim()) {
                const finishReason = result.response.candidates?.[0]?.finishReason ?? 'unknown';
                const allParts = result.response.candidates?.[0]?.content?.parts ?? [];
                console.warn(`⚠️ Gemini resposta vazia | finishReason=${finishReason} | parts=${allParts.length} | texts=${allParts.filter((p: any) => p.text).length}`);
                try {
                    const retryResult = await sendTracked(
                        'A resposta não conteve texto válido ou foi apenas texto de raciocínio interno. Responda ao usuário em Português agora repassando os dados do agendamento ou pagamento.',
                        'retry_empty_response'
                    );
                    const retryParts = retryResult.response.candidates?.[0]?.content?.parts ?? [];
                    responseText = retryParts
                        .filter((p: any) => p.text && !this.isModelReasoning(p.text))
                        .map((p: any) => p.text as string)
                        .join('')
                        .replace(/\*\*/g, '*');
                } catch {
                    responseText = '';
                }

                if (!responseText.trim()) {
                    console.warn('⚠️ Retry também vazio. Usando fallback neutro.');
                    return {
                        text: 'Desculpe, tive um problema ao processar sua solicitação. Pode repetir o que precisa?',
                        paymentUrl: capturedPaymentUrl,
                        trace: { toolsUsed, state, modelId: 'gemini-3.1-pro-preview' },
                    };
                }
            }

            return {
                text: responseText,
                paymentUrl: capturedPaymentUrl,
                trace: { toolsUsed, state, modelId: 'gemini-3.1-pro-preview' },
            };

        } catch (error: any) {
            if (tenantId) {
                recordError({
                    tenantId,
                    source: 'lead_flow',
                    feature: 'lead_agent',
                    phase: 'initial',
                    fsmState: state,
                    channel: 'whatsapp',
                    model: 'gemini-3.1-pro-preview',
                }, error).catch(() => {});
            }
            const category = classifyError(error);
            console.error(`❌ Erro Crítico na API do Gemini [${category}]:`, {
                name: error?.name,
                message: error?.message,
                state: state,
            });
            const wrappedError = new Error('AI_GENERATION_FAILED');
            (wrappedError as any).category = category;
            (wrappedError as any).cause = error;
            throw wrappedError;
        }
    }

    /**
     * Extrai dados de perfil do histórico da conversa.
     * Usa um modelo separado, focado em retornar JSON puro.
     */
    async extractProfileData(history: any[], tenantId?: string): Promise<any> {
        try {
            if (tenantId) {
                const usageState = await getTenantUsageState(tenantId);
                if (!usageState.canUseGemini) return {};
            }
            const genAI = await this.getGenAI(tenantId);
            const jsonModel = genAI.getGenerativeModel({
                model: "gemini-2.5-flash",
                generationConfig: { responseMimeType: "application/json" }
            }, { timeout: 30_000 });

            const prompt = `
Analise o histórico de conversa abaixo e extraia os dados do usuário.
Retorne ESTRITAMENTE um objeto JSON com as chaves: "name", "age", "goal" e "enrollmentTarget".
- "name": nome completo do aluno.
- "age": idade do aluno-alvo (número inteiro). Se a matrícula é para outra pessoa (filho, filha, etc.), extraia a idade DESSA PESSOA, não de quem está conversando.
- "goal": objetivo do aluno com o inglês.
- "enrollmentTarget": para quem é a matrícula (ex: "para si mesmo", "para meu filho", "para minha filha de 15 anos").
  REGRA CRÍTICA: SOMENTE extraia "enrollmentTarget" se o usuário DECLAROU EXPLICITAMENTE para quem é a matrícula. NUNCA assuma "para si mesmo" por padrão. Se o usuário não disse explicitamente para quem é, retorne null.
Se uma informação ainda não foi dita explicitamente pelo usuário, retorne null para aquela chave.

Histórico:
${JSON.stringify(history)}
`;

            const startedAt = Date.now();
            const result = await jsonModel.generateContent(prompt);
            if (tenantId) {
                recordUsage({
                    tenantId,
                    source: 'lead_flow',
                    feature: 'profile_extraction',
                    phase: 'json_extraction',
                    model: 'gemini-2.5-flash',
                    startedAt,
                }, result, { status: 'SUCCESS' }).catch(() => {});
            }
            let textResponse = result.response.text();
            textResponse = textResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
            return JSON.parse(textResponse);

        } catch (error) {
            if (tenantId) {
                recordError({
                    tenantId,
                    source: 'lead_flow',
                    feature: 'profile_extraction',
                    phase: 'json_extraction',
                    model: 'gemini-2.5-flash',
                }, error).catch(() => {});
            }
            console.error("Erro ao extrair perfil:", error);
            return {};
        }
    }
}

export const aiService = new AIService();
