import { FunctionDeclaration, GoogleGenerativeAI, SchemaType, Tool } from '@google/generative-ai';
import { prisma } from '../utils/prisma';
import { log } from './LogService';
import { googleCalendarIntegrationService } from './GoogleCalendarIntegrationService';
import { asaasServiceForTenant } from './AsaasService';

async function resolveGeminiKey(tenantId: string): Promise<string> {
    if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
    const agent = await prisma.agent.findFirst({ where: { tenantId }, select: { geminiModel: true } });
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { geminiApiKey: true } });
    if (tenant?.geminiApiKey) return tenant.geminiApiKey;
    throw new Error('Chave Gemini não configurada.');
}

async function buildSystemContext(tenantId: string): Promise<string> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 86400000);

    const [totalLeads, enrolledLeads, pendingLeads, todayMsgs, recentLeads, recentMsgs] = await Promise.all([
        prisma.user.count({ where: { tenantId, isGroup: false } }),
        prisma.user.count({ where: { tenantId, enrollmentStatus: 'ENROLLED' } }),
        prisma.user.count({ where: { tenantId, enrollmentStatus: 'PAYMENT_PENDING' } }),
        prisma.chatHistory.count({
            where: { user: { tenantId }, createdAt: { gte: todayStart } },
        }),
        prisma.user.findMany({
            where: { tenantId, isGroup: false },
            orderBy: { lastInteraction: 'desc' },
            take: 10,
            select: { name: true, phoneNumber: true, enrollmentStatus: true, conversationState: true, lastInteraction: true },
        }),
        prisma.chatHistory.findMany({
            where: { user: { tenantId }, createdAt: { gte: weekStart }, role: 'user' },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: { content: true, createdAt: true, user: { select: { name: true } } },
        }),
    ]);

    const convRate = totalLeads > 0 ? ((enrolledLeads / totalLeads) * 100).toFixed(1) : '0';

    return `
Você é o assistente operacional interno do sistema Artemis Bot.
Responda APENAS em português brasileiro. Seja direto e objetivo.
O operador está conversando com você para saber sobre o sistema.

## DADOS DO SISTEMA (${now.toLocaleString('pt-BR')}):

### Métricas gerais
- Total de leads: ${totalLeads}
- Matriculados: ${enrolledLeads}
- Aguardando pagamento: ${pendingLeads}
- Taxa de conversão: ${convRate}%
- Mensagens hoje: ${todayMsgs}

### Leads recentes (últimos 10):
${recentLeads.map(l =>
    `- ${l.name ?? l.phoneNumber.slice(-4) + '****'}: ${l.enrollmentStatus} | ${l.conversationState} | ${timeAgo(l.lastInteraction)}`
).join('\n')}

### Mensagens recentes desta semana:
${recentMsgs.map(m =>
    `- ${m.user.name ?? 'Desconhecido'}: "${m.content.slice(0, 80)}${m.content.length > 80 ? '...' : ''}" (${timeAgo(m.createdAt)})`
).join('\n')}

## COMPORTAMENTO:
- Responda perguntas sobre leads, métricas, conversas, status do sistema
- Se perguntarem sobre um lead específico, forneça os dados disponíveis
- Para agendar reunião ou compromisso, use as ferramentas de calendário disponíveis
- Para cancelar reunião ou compromisso no calendário, use as ferramentas de calendário disponíveis
- Para mandar ou agendar mensagem de WhatsApp para contato/lead, use a ferramenta admin_schedule_whatsapp_message
- Para criar ou consultar clientes/cobranças no Asaas, use as ferramentas Asaas disponíveis
- Se faltar data, horário, título ou duração, pergunte antes de criar o evento
- Se faltar contato, texto ou horário da mensagem de WhatsApp, pergunte antes de agendar
- Se faltar nome ou CPF/CNPJ para cliente Asaas, pergunte antes de criar cliente
- Se faltar customer ID, valor ou CPF/CNPJ do cliente para cobrança, pergunte antes de criar cobrança no Asaas
- Se pedirem deletar ou atualizar dados do sistema fora das ferramentas disponíveis, avise que isso é feito pelo painel web
- Seja conciso — respostas curtas e diretas para WhatsApp
`.trim();
}

function timeAgo(date: Date): string {
    const diff = Date.now() - date.getTime();
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${m}min atrás`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h atrás`;
    return `${Math.floor(h / 24)}d atrás`;
}

export async function handleAdminMessage(tenantId: string, message: string, history: Array<{ role: 'user' | 'model'; content: string }>): Promise<string> {
    const result = await handleAdminMessageWithTrace(tenantId, message, history);
    return result.text;
}

const checkCalendarAvailabilityDecl: FunctionDeclaration = {
    name: 'admin_check_calendar_availability',
    description: 'Verifica disponibilidade no Google Calendar conectado do operador para um intervalo de data/hora.',
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            timeMin: { type: SchemaType.STRING, description: 'Início em ISO 8601 com fuso, ex: 2026-05-16T12:00:00-04:00' },
            timeMax: { type: SchemaType.STRING, description: 'Fim em ISO 8601 com fuso, ex: 2026-05-16T12:30:00-04:00' },
        },
        required: ['timeMin', 'timeMax'],
    },
};

const createCalendarEventDecl: FunctionDeclaration = {
    name: 'admin_create_calendar_event',
    description: 'Cria um evento no Google Calendar conectado do operador. Use após ter data, hora, duração e título claros.',
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            summary: { type: SchemaType.STRING, description: 'Título do evento. Ex: Reunião com Luana' },
            startTime: { type: SchemaType.STRING, description: 'Início em ISO 8601 com fuso, ex: 2026-05-16T12:00:00-04:00' },
            endTime: { type: SchemaType.STRING, description: 'Fim em ISO 8601 com fuso, ex: 2026-05-16T12:30:00-04:00' },
            description: { type: SchemaType.STRING, description: 'Descrição opcional do evento' },
        },
        required: ['summary', 'startTime', 'endTime'],
    },
};

const findCalendarEventsDecl: FunctionDeclaration = {
    name: 'admin_find_calendar_events',
    description: 'Busca eventos no Google Calendar conectado do operador por intervalo e texto opcional. Use antes de cancelar eventos.',
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            timeMin: { type: SchemaType.STRING, description: 'Início em ISO 8601 com fuso, ex: 2026-05-16T00:00:00-04:00' },
            timeMax: { type: SchemaType.STRING, description: 'Fim em ISO 8601 com fuso, ex: 2026-05-17T00:00:00-04:00' },
            query: { type: SchemaType.STRING, description: 'Texto para filtrar, ex: Luana. Opcional.' },
        },
        required: ['timeMin', 'timeMax'],
    },
};

const cancelCalendarEventDecl: FunctionDeclaration = {
    name: 'admin_cancel_calendar_event',
    description: 'Cancela um evento do Google Calendar pelo ID. Use somente após identificar um evento específico com admin_find_calendar_events.',
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            eventId: { type: SchemaType.STRING, description: 'ID do evento retornado por admin_find_calendar_events.' },
        },
        required: ['eventId'],
    },
};

const createAsaasCustomerDecl: FunctionDeclaration = {
    name: 'admin_create_asaas_customer',
    description: 'Cria um cliente no Asaas usando a configuração Asaas do tenant.',
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            name: { type: SchemaType.STRING, description: 'Nome completo do cliente.' },
            cpfCnpj: { type: SchemaType.STRING, description: 'CPF ou CNPJ obrigatório.' },
            email: { type: SchemaType.STRING, description: 'Email do cliente. Opcional.' },
            mobilePhone: { type: SchemaType.STRING, description: 'Telefone celular com DDD. Opcional.' },
        },
        required: ['name', 'cpfCnpj'],
    },
};

const listAsaasCustomersDecl: FunctionDeclaration = {
    name: 'admin_list_asaas_customers',
    description: 'Lista clientes do Asaas com filtros opcionais.',
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            name: { type: SchemaType.STRING, description: 'Filtro por nome. Opcional.' },
            cpfCnpj: { type: SchemaType.STRING, description: 'Filtro por CPF/CNPJ. Opcional.' },
            limit: { type: SchemaType.NUMBER, description: 'Limite de resultados. Padrão 10.' },
        },
    },
};

const createAsaasPaymentDecl: FunctionDeclaration = {
    name: 'admin_create_asaas_payment',
    description: 'Cria uma cobrança avulsa no Asaas para um customer ID existente. Antes de chamar, garanta que o cliente tem CPF/CNPJ cadastrado. Se dueDate não for informado, o sistema usa a data de hoje.',
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            customer: { type: SchemaType.STRING, description: 'ID do cliente Asaas, ex: cus_000...' },
            billingType: { type: SchemaType.STRING, description: 'Tipo de cobrança: UNDEFINED, BOLETO, PIX ou CREDIT_CARD.' },
            value: { type: SchemaType.NUMBER, description: 'Valor da cobrança em reais.' },
            dueDate: { type: SchemaType.STRING, description: 'Vencimento em YYYY-MM-DD. Opcional; padrão é hoje.' },
            description: { type: SchemaType.STRING, description: 'Descrição da cobrança. Opcional.' },
            externalReference: { type: SchemaType.STRING, description: 'Referência externa. Opcional.' },
        },
        required: ['customer', 'billingType', 'value'],
    },
};

const listAsaasPaymentsDecl: FunctionDeclaration = {
    name: 'admin_list_asaas_payments',
    description: 'Lista cobranças do Asaas com filtros opcionais.',
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            customer: { type: SchemaType.STRING, description: 'ID do cliente Asaas. Opcional.' },
            status: { type: SchemaType.STRING, description: 'Status da cobrança, ex: PENDING, RECEIVED, OVERDUE. Opcional.' },
            paymentId: { type: SchemaType.STRING, description: 'ID da cobrança Asaas, ex: pay_000... Opcional.' },
            limit: { type: SchemaType.NUMBER, description: 'Limite de resultados. Padrão 10.' },
        },
    },
};

const updateAsaasPaymentDecl: FunctionDeclaration = {
    name: 'admin_update_asaas_payment',
    description: 'Atualiza uma cobrança existente do Asaas. Aceita paymentId pay_... ou paymentUrl/invoiceUrl. Use para alterar valor, vencimento, descrição ou tipo de cobrança.',
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            paymentId: { type: SchemaType.STRING, description: 'ID da cobrança Asaas, ex: pay_000... Opcional se paymentUrl for informado.' },
            paymentUrl: { type: SchemaType.STRING, description: 'Link/invoiceUrl da cobrança, ex: https://sandbox.asaas.com/i/.... Opcional se paymentId for informado.' },
            value: { type: SchemaType.NUMBER, description: 'Novo valor em reais. Opcional.' },
            dueDate: { type: SchemaType.STRING, description: 'Novo vencimento em YYYY-MM-DD. Opcional.' },
            description: { type: SchemaType.STRING, description: 'Nova descrição. Opcional.' },
            billingType: { type: SchemaType.STRING, description: 'Novo tipo: UNDEFINED (Livre/cliente escolhe), BOLETO, PIX ou CREDIT_CARD. Opcional.' },
        },
    },
};

const scheduleWhatsappMessageDecl: FunctionDeclaration = {
    name: 'admin_schedule_whatsapp_message',
    description: 'Agenda uma mensagem de WhatsApp para um contato ou lead existente. Use quando o operador pedir para mandar mensagem para alguém agora ou no futuro, incluindo "daqui 10 min", "às 17h" ou "amanhã". Nunca invente contato: procure por nome/apelido/telefone e peça confirmação se houver ambiguidade.',
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            contactQuery: { type: SchemaType.STRING, description: 'Nome, apelido ou telefone do contato. Ex: Maria, minha vida, 556699...' },
            messageText: { type: SchemaType.STRING, description: 'Texto exato ou resumido da mensagem a enviar.' },
            runAt: { type: SchemaType.STRING, description: 'Data/hora futura em ISO 8601 com fuso. Ex: 2026-05-17T14:10:00-04:00' },
        },
        required: ['contactQuery', 'messageText', 'runAt'],
    },
};

type AdminTrace = {
    toolsUsed: string[];
    state: string;
    modelId: string;
    ragUsed?: { chars: number; snippet: string } | null;
};

async function resolveCalendarAuthUser(tenantId: string) {
    const integration = await prisma.userGoogleCalendarIntegration.findFirst({
        where: { tenantId, status: 'CONNECTED', revokedAt: null },
        orderBy: { updatedAt: 'desc' },
        select: { tenantUserId: true },
    });
    if (!integration) {
        throw new Error('Google Calendar não conectado para este tenant.');
    }
    return { tenantId, userId: integration.tenantUserId };
}

function normalizeAsaasUrlToken(url: string): string {
    return String(url).trim().split('?')[0].replace(/\/$/, '').split('/').pop() ?? '';
}

function normalizeBillingType(value?: string): string | undefined {
    if (!value) return undefined;
    const normalized = String(value).trim().toUpperCase();
    const compact = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    if (['UNDEFINED', 'BOLETO', 'PIX', 'CREDIT_CARD'].includes(normalized)) return normalized;
    if (compact.includes('CLIENTE ESCOL') || compact.includes('LIVRE') || compact.includes('QUALQUER') || compact.includes('INDEFIN')) {
        return 'UNDEFINED';
    }
    if (compact.includes('CARTAO') || compact.includes('CREDITO')) return 'CREDIT_CARD';
    if (compact.includes('BOLETO')) return 'BOLETO';
    if (compact.includes('PIX')) return 'PIX';

    return normalized;
}

function normalizeText(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function phoneDigits(value: string): string {
    return String(value).replace(/\D/g, '');
}

function phoneVariants(value: string): string[] {
    const digits = phoneDigits(value);
    const variants = new Set<string>([digits, `+${digits}`]);
    if (digits.startsWith('55') && digits.length === 13 && digits[4] === '9') {
        variants.add(digits.slice(0, 4) + digits.slice(5));
        variants.add(`+${digits.slice(0, 4) + digits.slice(5)}`);
    }
    if (digits.startsWith('55') && digits.length === 12) {
        variants.add(digits.slice(0, 4) + '9' + digits.slice(4));
        variants.add(`+${digits.slice(0, 4) + '9' + digits.slice(4)}`);
    }
    return [...variants].filter(Boolean);
}

function phoneIdentityKey(value: string): string {
    const digits = phoneDigits(value);
    if (digits.startsWith('55') && digits.length === 13 && digits[4] === '9') {
        return digits.slice(0, 4) + digits.slice(5);
    }
    return digits;
}

function preferBrazilianMobile(a: string, b: string): string {
    const aDigits = phoneDigits(a);
    const bDigits = phoneDigits(b);
    const aHasNinthDigit = aDigits.startsWith('55') && aDigits.length === 13 && aDigits[4] === '9';
    const bHasNinthDigit = bDigits.startsWith('55') && bDigits.length === 13 && bDigits[4] === '9';
    if (aHasNinthDigit && !bHasNinthDigit) return a;
    if (bHasNinthDigit && !aHasNinthDigit) return b;
    return bDigits.length > aDigits.length ? b : a;
}

function contactMatches(query: string, candidate: { name?: string | null; customName?: string | null; phone?: string | null; phoneNumber?: string | null }): boolean {
    const q = normalizeText(query);
    const qDigits = phoneDigits(query);
    const names = [candidate.customName, candidate.name].filter(Boolean).map(v => normalizeText(String(v)));
    const phone = phoneDigits(String(candidate.phone ?? candidate.phoneNumber ?? ''));

    return names.some(name => name.includes(q) || q.includes(name))
        || Boolean(qDigits && phone.includes(qDigits));
}

async function resolveAsaasPaymentId(svc: Awaited<ReturnType<typeof asaasServiceForTenant>>, args: any): Promise<string> {
    const rawPaymentId = String(args.paymentId ?? '').trim();
    if (rawPaymentId.startsWith('pay_')) return rawPaymentId;

    const paymentUrl = String(args.paymentUrl ?? args.invoiceUrl ?? (!rawPaymentId.startsWith('pay_') ? rawPaymentId : '')).trim();
    const token = paymentUrl ? normalizeAsaasUrlToken(paymentUrl) : '';
    if (!token) throw new Error('Informe o ID da cobrança ou o link de pagamento para atualizar.');

    const listed = await svc.listPayments({ limit: 50 });
    const payments: any[] = listed?.data ?? [];
    const match = payments.find(payment => {
        const urls = [payment.invoiceUrl, payment.bankSlipUrl, payment.transactionReceiptUrl].filter(Boolean).map(String);
        return urls.some(url => url === paymentUrl || normalizeAsaasUrlToken(url) === token);
    });

    if (!match?.id) {
        throw new Error('Não encontrei a cobrança correspondente a esse link. Liste cobranças recentes e tente novamente com o ID pay_...');
    }

    return match.id;
}

async function resolveMessageTarget(tenantId: string, query: string): Promise<{ userId?: string; error?: string; options?: Array<{ name: string | null; phone: string }> }> {
    const contacts = await prisma.contact.findMany({
        where: { tenantId },
        take: 200,
        select: { phone: true, name: true, customName: true },
        orderBy: { updatedAt: 'desc' },
    });
    const users = await prisma.user.findMany({
        where: { tenantId, isGroup: false },
        take: 200,
        select: { id: true, phoneNumber: true, name: true },
        orderBy: { lastInteraction: 'desc' },
    });

    const matches = [
        ...contacts.filter(c => contactMatches(query, c)).map(c => ({
            name: c.customName ?? c.name ?? null,
            phone: c.phone,
        })),
        ...users.filter(u => contactMatches(query, u)).map(u => ({
            name: u.name ?? null,
            phone: u.phoneNumber,
        })),
    ];

    const byPhoneIdentity = new Map<string, { name: string | null; phone: string }>();
    for (const match of matches) {
        const key = phoneIdentityKey(match.phone);
        const existing = byPhoneIdentity.get(key);
        byPhoneIdentity.set(key, existing
            ? { name: existing.name ?? match.name, phone: preferBrazilianMobile(existing.phone, match.phone) }
            : match
        );
    }

    const unique = Array.from(byPhoneIdentity.values());
    if (unique.length === 0) return { error: `Não encontrei contato ou lead para "${query}".` };
    if (unique.length > 1) {
        const options = unique.slice(0, 5);
        return {
            error: 'Encontrei mais de um contato possível. Peça confirmação pelo número correto.',
            options,
        };
    }

    const target = unique[0];
    const variants = phoneVariants(target.phone);
    const existing = await prisma.user.findFirst({ where: { tenantId, phoneNumber: { in: variants }, isGroup: false } });
    if (existing) return { userId: existing.id };

    const created = await prisma.user.create({
        data: {
            tenantId,
            phoneNumber: phoneDigits(target.phone),
            name: target.name,
            conversationState: 'GREETING',
            lgpdConsent: false,
        },
    });
    return { userId: created.id };
}

async function executeAdminTool(tenantId: string, name: string, args: any) {
    if (name === 'admin_schedule_whatsapp_message') {
        const runAt = new Date(args.runAt);
        if (Number.isNaN(runAt.getTime()) || runAt <= new Date()) {
            return { error: 'Data/hora de envio inválida ou no passado.' };
        }
        if (!String(args.messageText ?? '').trim()) {
            return { error: 'Texto da mensagem obrigatório.' };
        }

        const target = await resolveMessageTarget(tenantId, String(args.contactQuery ?? ''));
        if (!target.userId) return target;

        const automation = await prisma.automation.create({
            data: {
                tenantId,
                name: `Mensagem agendada - ${args.contactQuery}`,
                type: 'ONE_OFF',
                status: 'ACTIVE',
                triggerType: 'TIME',
                scheduleJson: { runAt: runAt.toISOString() },
                targetJson: { userId: target.userId },
                conditionsJson: {
                    requireLgpd: false,
                    skipGroups: true,
                    excludeEnrollmentStatuses: [],
                },
                actionJson: {
                    messageTemplate: String(args.messageText).trim(),
                    internalNote: `[AUTOMACAO INTERNA] Mensagem agendada pelo operador para "${args.contactQuery}".`,
                },
                limitsJson: { cooldownHours: 0 },
                requiresApproval: false,
                nextRunAt: runAt,
            },
        });

        return {
            ok: true,
            automationId: automation.id,
            runAt: runAt.toISOString(),
            message: 'Mensagem agendada com sucesso.',
        };
    }

    if (name === 'admin_create_asaas_customer') {
        if (!args.cpfCnpj || String(args.cpfCnpj).replace(/\D/g, '').length < 11) {
            return { error: 'CPF ou CNPJ obrigatório para criar cliente Asaas.' };
        }
        const svc = await asaasServiceForTenant(tenantId);
        const customer = await svc.createCustomer({
            name: args.name,
            cpfCnpj: String(args.cpfCnpj).replace(/\D/g, ''),
            email: args.email,
            mobilePhone: args.mobilePhone?.replace(/\D/g, ''),
        });
        return {
            ok: true,
            customer: {
                id: customer.id,
                name: customer.name,
                email: customer.email,
                mobilePhone: customer.mobilePhone,
                cpfCnpj: customer.cpfCnpj,
            },
            message: 'Cliente criado com sucesso. Não destaque o ID técnico salvo se o operador não pedir.',
        };
    }

    if (name === 'admin_list_asaas_customers') {
        const svc = await asaasServiceForTenant(tenantId);
        const result = await svc.listCustomers({
            limit: args.limit ?? 10,
            ...(args.name ? { name: args.name } : {}),
            ...(args.cpfCnpj ? { cpfCnpj: String(args.cpfCnpj).replace(/\D/g, '') } : {}),
        });
        return result;
    }

    if (name === 'admin_create_asaas_payment') {
        const svc = await asaasServiceForTenant(tenantId);
        const today = new Date().toISOString().split('T')[0];
        const payment = await svc.createPayment({
            customer: args.customer,
            billingType: normalizeBillingType(args.billingType) ?? 'UNDEFINED',
            value: Number(args.value),
            dueDate: args.dueDate || today,
            description: args.description,
            externalReference: args.externalReference,
        });
        return {
            ok: true,
            payment: {
                id: payment.id,
                status: payment.status,
                billingType: payment.billingType,
                value: payment.value,
                dueDate: payment.dueDate,
                invoiceUrl: payment.invoiceUrl,
                bankSlipUrl: payment.bankSlipUrl,
                transactionReceiptUrl: payment.transactionReceiptUrl,
                pixQrCode: payment.pixQrCode,
            },
            message: 'Cobrança criada com sucesso. Informe valor, vencimento, status e link de pagamento quando disponível.',
        };
    }

    if (name === 'admin_list_asaas_payments') {
        const svc = await asaasServiceForTenant(tenantId);
        return svc.listPayments({
            limit: args.limit ?? 10,
            ...(args.paymentId ? { id: args.paymentId } : {}),
            ...(args.customer ? { customer: args.customer } : {}),
            ...(args.status ? { status: args.status } : {}),
        });
    }

    if (name === 'admin_update_asaas_payment') {
        const svc = await asaasServiceForTenant(tenantId);
        const paymentId = await resolveAsaasPaymentId(svc, args);
        const payment = await svc.updatePayment(paymentId, {
            ...(args.value !== undefined ? { value: Number(args.value) } : {}),
            ...(args.dueDate ? { dueDate: args.dueDate } : {}),
            ...(args.description ? { description: args.description } : {}),
            ...(args.billingType ? { billingType: normalizeBillingType(args.billingType) } : {}),
        });
        return {
            ok: true,
            payment: {
                id: payment.id,
                status: payment.status,
                billingType: payment.billingType,
                value: payment.value,
                dueDate: payment.dueDate,
                invoiceUrl: payment.invoiceUrl,
            },
            message: 'Cobrança atualizada com sucesso. Informe valor, vencimento, status e link de pagamento quando disponível.',
        };
    }

    const authUser = await resolveCalendarAuthUser(tenantId);

    if (name === 'admin_check_calendar_availability') {
        const result = await googleCalendarIntegrationService.listEvents(authUser, {
            timeMin: new Date(args.timeMin).toISOString(),
            timeMax: new Date(args.timeMax).toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
        });
        const busy = result.items?.map((event: any) => ({
            id: event.id,
            summary: event.summary,
            start: event.start?.dateTime ?? event.start?.date,
            end: event.end?.dateTime ?? event.end?.date,
        })) ?? [];
        return busy.length === 0
            ? { busySlots: [], message: 'Horário disponível.' }
            : { busySlots: busy, message: `${busy.length} conflito(s) encontrado(s).` };
    }

    if (name === 'admin_create_calendar_event') {
        const busyResult = await googleCalendarIntegrationService.listEvents(authUser, {
            timeMin: new Date(args.startTime).toISOString(),
            timeMax: new Date(args.endTime).toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
        });
        const busy = busyResult.items ?? [];
        if (busy.length > 0) {
            return { error: 'Horário indisponível. Já existe compromisso neste intervalo.', busySlots: busy };
        }

        const event = await googleCalendarIntegrationService.createEvent(authUser, {
            summary: args.summary,
            description: args.description,
            start: { dateTime: new Date(args.startTime).toISOString(), timeZone: 'America/Cuiaba' },
            end: { dateTime: new Date(args.endTime).toISOString(), timeZone: 'America/Cuiaba' },
        });

        return { ok: true, eventId: event.id, htmlLink: event.htmlLink, summary: event.summary };
    }

    if (name === 'admin_find_calendar_events') {
        const result = await googleCalendarIntegrationService.listEvents(authUser, {
            timeMin: new Date(args.timeMin).toISOString(),
            timeMax: new Date(args.timeMax).toISOString(),
            q: args.query || undefined,
            singleEvents: true,
            orderBy: 'startTime',
        });
        const events = result.items?.map((event: any) => ({
            id: event.id,
            summary: event.summary,
            start: event.start?.dateTime ?? event.start?.date,
            end: event.end?.dateTime ?? event.end?.date,
        })) ?? [];
        return events.length === 0
            ? { events: [], message: 'Nenhum evento encontrado neste intervalo.' }
            : { events, message: `${events.length} evento(s) encontrado(s).` };
    }

    if (name === 'admin_cancel_calendar_event') {
        await googleCalendarIntegrationService.deleteEvent(authUser, args.eventId);
        return { ok: true, message: 'Evento cancelado com sucesso.' };
    }

    return { error: `Ferramenta '${name}' não reconhecida.` };
}

export async function handleAdminMessageWithTrace(tenantId: string, message: string, history: Array<{ role: 'user' | 'model'; content: string }>): Promise<{ text: string; trace: AdminTrace }> {
    const toolsUsed: string[] = [];
    try {
        const apiKey = await resolveGeminiKey(tenantId);
        // Usa modelo fixo para admin (gemini-2.5-flash, sem preview)
        const MODEL = 'gemini-2.5-flash';

        const genAI = new GoogleGenerativeAI(apiKey);
        const baseContext = await buildSystemContext(tenantId);
        const now = new Date();
        const systemInstruction = `${baseContext}

## CALENDÁRIO
- Data/hora atual: ${now.toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' })}
- Fuso padrão: America/Cuiaba
- Se o usuário disser "amanhã", calcule a data a partir da data atual acima
- Se duração não for informada, use 30 minutos para reunião
- Se participante não tiver email explícito, crie o evento sem convidado externo
- Antes de criar evento, chame admin_check_calendar_availability para o mesmo intervalo
- Depois de criar evento, confirme título, data e horário em português
- Para cancelar "essa reunião" ou evento citado no histórico recente, use o contexto anterior para inferir data/título, busque com admin_find_calendar_events e cancele apenas se houver um único resultado claro
- Se houver mais de um evento possível, liste opções curtas e peça confirmação antes de cancelar

## ASAAS
- Para "me cadastrar como cliente", peça nome e CPF/CNPJ se não estiverem claros; email e telefone são opcionais
- Após criar cliente Asaas, confirme nome/cadastro criado; não destaque o ID técnico, só informe se o operador pedir ou se precisar usar em próxima ação
- Para criar cobrança, se vencimento não for informado, use a data de hoje
- Para cobrança PIX, use billingType PIX
- Se o usuário pedir "cliente escolhe", "forma livre", "qualquer forma" ou "indefinido", use billingType UNDEFINED
- Para criar cobrança, não invente valor ou cliente; o cliente precisa ter CPF/CNPJ cadastrado no Asaas
- Se o cliente atual ainda não tem CPF/CNPJ, peça o CPF/CNPJ antes de criar cobrança PIX
- Se o cliente atual tiver sido criado na conversa recente com CPF/CNPJ, use esse customer ID do contexto
- Após criar cobrança, informe de forma prática: valor, vencimento, status e link de pagamento/invoiceUrl se existir; não exponha JSON bruto nem foque em IDs técnicos
- Para alterar "essa cobrança" ou "dela", use o ID da cobrança criada/listada no histórico recente
- Se houver apenas invoiceUrl/link no histórico, busque cobranças recentes com admin_list_asaas_payments e compare pelo invoiceUrl antes de atualizar
- Se o usuário disser "vencimento dia 20" sem mês/ano, use o mês/ano da cobrança atual; se não houver cobrança no contexto, use mês/ano atuais
- Para atualizar forma de pagamento para livre/cliente escolhe, chame admin_update_asaas_payment com billingType UNDEFINED
- Para atualizar cobrança, use admin_update_asaas_payment; não mande para o painel web

## WHATSAPP / MENSAGENS PARA CONTATOS
- Se o operador pedir "manda mensagem para X", "manda um oi para X" ou "chama X daqui 10 min", use admin_schedule_whatsapp_message
- Data/hora atual: ${now.toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' })}
- Para "daqui X minutos/horas", calcule runAt a partir da data/hora atual acima
- Para "uns 10 min", trate como aproximadamente 10 minutos
- Se o contato for ambíguo ou não encontrado, diga isso e peça o nome/telefone exato
- Se a ferramenta retornar opções, mostre as opções com nome e telefone; você tem permissão para informar esses números ao operador
- Não diga que não consegue enviar mensagem para contato quando a ferramenta estiver disponível`.trim();
        const tools: Tool[] = [{
            functionDeclarations: [
                checkCalendarAvailabilityDecl,
                createCalendarEventDecl,
                findCalendarEventsDecl,
                cancelCalendarEventDecl,
                createAsaasCustomerDecl,
                listAsaasCustomersDecl,
                createAsaasPaymentDecl,
                listAsaasPaymentsDecl,
                updateAsaasPaymentDecl,
                scheduleWhatsappMessageDecl,
            ],
        }];

        // Gemini exige que history comece com role='user', nunca 'model'
        // Filtra os últimos N turnos e garante que o primeiro seja 'user'
        const rawHistory = history.slice(-10).map(h => ({
            role: h.role as 'user' | 'model',
            parts: [{ text: h.content }],
        }));
        // Descarta mensagens iniciais de 'model' até encontrar primeiro 'user'
        const firstUserIdx = rawHistory.findIndex(h => h.role === 'user');
        const cleanHistory = firstUserIdx >= 0 ? rawHistory.slice(firstUserIdx) : [];

        const chat = genAI.getGenerativeModel({ model: MODEL, systemInstruction, tools }).startChat({
            history: cleanHistory,
        });

        let result = await chat.sendMessage(message);
        const loopStart = Date.now();

        while (Date.now() - loopStart < 60_000) {
            const parts = result.response.candidates?.[0]?.content?.parts ?? [];
            const toolCallParts = parts.filter((p: any) => p.functionCall);
            if (toolCallParts.length === 0) break;

            const functionResponses: Array<{ name: string; result: any }> = [];
            for (const toolCallPart of toolCallParts) {
                const { name, args } = toolCallPart.functionCall as { name: string; args: any };
                if (!toolsUsed.includes(name)) toolsUsed.push(name);

                try {
                    functionResponses.push({ name, result: await executeAdminTool(tenantId, name, args) });
                } catch (toolError: any) {
                    functionResponses.push({ name, result: { error: toolError?.message ?? 'Erro ao executar ferramenta.' } });
                }
            }

            result = await chat.sendMessage(
                functionResponses.map(fr => ({ functionResponse: { name: fr.name, response: { result: fr.result } } }))
            );
        }

        return {
            text: result.response.text().replace(/\*\*/g, '*'),
            trace: { toolsUsed, state: 'ORIENTADOR', modelId: MODEL, ragUsed: { chars: systemInstruction.length, snippet: systemInstruction.slice(0, 300) } },
        };
    } catch (err: any) {
        log.ai('error', 'Erro no admin chat', { error: err?.message });
        return {
            text: `⚠️ Erro ao processar: ${err?.message ?? 'desconhecido'}`,
            trace: { toolsUsed, state: 'ORIENTADOR', modelId: 'gemini-2.5-flash', ragUsed: null },
        };
    }
}
