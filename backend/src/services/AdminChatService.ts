import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../utils/prisma';
import { log } from './LogService';

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
- Se perguntarem para fazer algo (deletar, atualizar), avise que isso é feito pelo painel web
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
    try {
        const apiKey = await resolveGeminiKey(tenantId);
        const agent = await prisma.agent.findFirst({ where: { tenantId }, select: { geminiModel: true } });
        const model = agent?.geminiModel ?? 'gemini-2.5-flash-preview-05-20';

        const genAI = new GoogleGenerativeAI(apiKey);
        const systemInstruction = await buildSystemContext(tenantId);

        const chat = genAI.getGenerativeModel({ model, systemInstruction }).startChat({
            history: history.slice(-10).map(h => ({
                role: h.role,
                parts: [{ text: h.content }],
            })),
        });

        const result = await chat.sendMessage(message);
        return result.response.text();
    } catch (err: any) {
        log.ai('error', 'Erro no admin chat', { error: err?.message });
        return `⚠️ Erro ao processar: ${err?.message ?? 'desconhecido'}`;
    }
}
