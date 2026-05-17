import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { verifyWebhook, handleWebhook } from './controllers/WebhookController';
import { handleAsaasWebhook } from './controllers/AsaasWebhookController';
import { handleRespondiWebhook } from './controllers/RespondiController';
import { login, refresh, register } from './controllers/AuthController';
import { requireAuth } from './middlewares/auth';
import { createInstance, getQRCode, getStatus, disconnectInstance, configureWebhook, getWebhookStatus, getOwnerPhone } from './controllers/InstanceController';
import { evolutionWebhook } from './controllers/EvolutionWebhookController';
import { listLeads, getLead, listConversations, updateLeadState, updateLead, deleteLead, sendMessage, sendMediaMessage, backfillNames, clearSession } from './controllers/LeadsController';
import { getMetrics } from './controllers/MetricsController';
import { getAgent, updatePersona, updatePrograms, updateSettings, toggleAgent } from './controllers/AgentController';
import { getTenant, updateTenantKeys } from './controllers/TenantController';
import { getIntegrations, updateEvolutionIntegration, updateAsaasIntegration, updateMetaIntegration, updateCalendarIntegration, revealIntegrationField } from './controllers/IntegrationController';
import { disconnectGoogleCalendar, getGoogleCalendarAuthUrl, getGoogleCalendarStatus, handleGoogleCalendarCallback, testGoogleCalendar } from './controllers/GoogleCalendarIntegrationController';
import { getLogs, clearCategory } from './controllers/LogController';
import { asaasListPayments, asaasCreatePayment, asaasCancelPayment, asaasListCustomers, asaasCreateCustomer, asaasSimulateConfirm, asaasSimulateOverdue, asaasSimulateRefund } from './controllers/AsaasManagementController';
import { log } from './services/LogService';
import { getContacts, getWhitelist, updateWhitelist, addToWhitelist, removeFromWhitelist, syncContactsEndpoint, updateContactName } from './controllers/ContactController';
import { listKnowledge, getKnowledge, createKnowledge, deleteKnowledge } from './controllers/KnowledgeController';
import { simulateMessage } from './controllers/SimulatorController';
import { getMessageMedia } from './controllers/MediaController';
import { listSessions, getSession, createSession, updateSession, deleteSession } from './controllers/SimulatorSessionController';
import { approveAutomation, createAutomation, getAutomation, listAutomations, pauseAutomation, resumeAutomation, runAutomation, updateAutomation } from './controllers/AutomationController';
import { automationService } from './services/AutomationService';
import { prisma } from './utils/prisma';
import {
    getAiUsageSummary,
    getAiUsageTimeseries,
    getAiUsageByModel,
    getAiUsageByFeature,
    getAiUsageByState,
    getAiUsageByLead,
    getAiUsageEvents,
    getAiUsageBudget,
    patchAiUsageBudget,
    getAiUsageStatus,
    getAiUsageModels,
    postAiUsageModelsSync,
    getAiUsagePrices,
    postAiUsagePrices,
    patchAiUsagePrice,
    postAiUsagePriceSync,
} from './controllers/AiUsageController';

dotenv.config();

// DATABASE_URL é o único requisito fatal — sem banco nada funciona
if (!process.env.DATABASE_URL) {
    console.error("🚨 ERRO FATAL: DATABASE_URL ausente no .env!");
    process.exit(1);
}

// Avisos opcionais — sistema funciona sem estas mas com funcionalidades reduzidas
if (!process.env.GEMINI_API_KEY) {
    console.warn("⚠️  AVISO: GEMINI_API_KEY ausente no .env. Chave será lida do banco por tenant.");
}
if (!process.env.ASAAS_API_KEY) {
    console.warn("⚠️  AVISO: ASAAS_API_KEY ausente. Pagamentos desativados.");
}
if (!process.env.RESPONDI_WEBHOOK_SECRET) {
    console.warn("⚠️  AVISO: RESPONDI_WEBHOOK_SECRET ausente. Webhook de cadastro vulnerável.");
}

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json({ limit: '100mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '100mb' }));

function sanitizeDevLog(value: unknown): unknown {
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(sanitizeDevLog);
    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, val]) => {
            const k = key.toLowerCase();
            if (k.includes('password') || k.includes('token') || k.includes('authorization') || k.includes('apikey')) {
                return [key, '[redacted]'];
            }
            return [key, sanitizeDevLog(val)];
        })
    );
}

function previewDevLog(value: unknown): unknown {
    const sanitized = sanitizeDevLog(value);
    const text = typeof sanitized === 'string' ? sanitized : JSON.stringify(sanitized);
    return text && text.length > 3000 ? `${text.slice(0, 3000)}...` : sanitized;
}

if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        if (!req.path.startsWith('/api') && !req.path.startsWith('/auth')) return next();

        const startedAt = Date.now();
        let responseBody: unknown;
        const originalJson = res.json.bind(res);
        const originalSend = res.send.bind(res);

        res.json = ((body: unknown) => {
            responseBody = body;
            return originalJson(body);
        }) as typeof res.json;

        res.send = ((body: unknown) => {
            if (responseBody === undefined) responseBody = body;
            return originalSend(body as any);
        }) as typeof res.send;

        console.log(`[API →] ${req.method} ${req.originalUrl}`, {
            query: previewDevLog(req.query),
            body: previewDevLog(req.body),
        });

        res.on('finish', () => {
            console.log(`[API ←] ${res.statusCode} ${req.method} ${req.originalUrl} (${Date.now() - startedAt}ms)`, {
                result: previewDevLog(responseBody),
            });
        });

        next();
    });
}

// Rotas
app.get('/', (req, res) => res.send('🤖 Artemis PRO (Architecture Cleaned) Online!'));

// Auth
app.post('/auth/register', register);
app.post('/auth/login', login);
app.post('/auth/refresh', refresh);

// Leads e conversas
app.get('/api/leads',                requireAuth as any, listLeads as any);
app.get('/api/leads/:id',            requireAuth as any, getLead as any);
app.get('/api/conversations',        requireAuth as any, listConversations as any);
app.post('/api/leads/backfill-names',  requireAuth as any, backfillNames as any);
app.post('/api/leads/:id/clear-session', requireAuth as any, clearSession as any);
app.patch('/api/leads/:id',          requireAuth as any, updateLead as any);
app.patch('/api/leads/:id/state',    requireAuth as any, updateLeadState as any);
app.post('/api/leads/:id/send',       requireAuth as any, sendMessage      as any);
app.post('/api/leads/:id/send-media', requireAuth as any, sendMediaMessage as any);
app.delete('/api/leads/:id',         requireAuth as any, deleteLead as any);

// Métricas
app.get('/api/metrics', requireAuth as any, getMetrics as any);

// Agente
// Tenant — chaves e configurações
app.get('/api/tenant',              requireAuth as any, getTenant as any);
app.patch('/api/tenant/keys',       requireAuth as any, updateTenantKeys as any);

// Integrações — configuração por provider
app.get('/api/integrations',                    requireAuth as any, getIntegrations as any);
app.get('/api/integrations/reveal',             requireAuth as any, revealIntegrationField as any);
app.patch('/api/integrations/evolution',        requireAuth as any, updateEvolutionIntegration as any);
app.patch('/api/integrations/asaas',            requireAuth as any, updateAsaasIntegration as any);
app.patch('/api/integrations/meta',             requireAuth as any, updateMetaIntegration as any);
app.patch('/api/integrations/calendar',         requireAuth as any, updateCalendarIntegration as any);
app.get('/api/integrations/google-calendar/auth-url',    requireAuth as any, getGoogleCalendarAuthUrl as any);
app.get('/api/integrations/google-calendar/callback',    handleGoogleCalendarCallback as any);
app.get('/api/integrations/google-calendar/status',      requireAuth as any, getGoogleCalendarStatus as any);
app.post('/api/integrations/google-calendar/disconnect', requireAuth as any, disconnectGoogleCalendar as any);
app.get('/api/integrations/google-calendar/test',        requireAuth as any, testGoogleCalendar as any);

// Asaas — Gestão financeira
app.get('/api/asaas/payments',                       requireAuth as any, asaasListPayments as any);
app.post('/api/asaas/payments',                      requireAuth as any, asaasCreatePayment as any);
app.post('/api/asaas/payments/:id/cancel',           requireAuth as any, asaasCancelPayment as any);
app.post('/api/asaas/payments/:id/simulate/confirm', requireAuth as any, asaasSimulateConfirm as any);
app.post('/api/asaas/payments/:id/simulate/overdue', requireAuth as any, asaasSimulateOverdue as any);
app.post('/api/asaas/payments/:id/simulate/refund',  requireAuth as any, asaasSimulateRefund as any);
app.get('/api/asaas/customers',                      requireAuth as any, asaasListCustomers as any);
app.post('/api/asaas/customers',                     requireAuth as any, asaasCreateCustomer as any);

// RAG — Base de Conhecimento
app.get('/api/knowledge',         requireAuth as any, listKnowledge as any);
app.get('/api/knowledge/:id',     requireAuth as any, getKnowledge as any);
app.post('/api/knowledge',        requireAuth as any, createKnowledge as any);
app.delete('/api/knowledge/:id',  requireAuth as any, deleteKnowledge as any);

// Automações Contextuais
app.get('/api/automations',              requireAuth as any, listAutomations as any);
app.post('/api/automations',             requireAuth as any, createAutomation as any);
app.get('/api/automations/:id',          requireAuth as any, getAutomation as any);
app.patch('/api/automations/:id',        requireAuth as any, updateAutomation as any);
app.post('/api/automations/:id/pause',   requireAuth as any, pauseAutomation as any);
app.post('/api/automations/:id/resume',  requireAuth as any, resumeAutomation as any);
app.post('/api/automations/:id/run',     requireAuth as any, runAutomation as any);
app.post('/api/automations/:id/approve', requireAuth as any, approveAutomation as any);

// AI Usage — Tracking Gemini
app.get('/api/ai-usage/summary',      requireAuth as any, getAiUsageSummary as any);
app.get('/api/ai-usage/timeseries',   requireAuth as any, getAiUsageTimeseries as any);
app.get('/api/ai-usage/by-model',     requireAuth as any, getAiUsageByModel as any);
app.get('/api/ai-usage/by-feature',   requireAuth as any, getAiUsageByFeature as any);
app.get('/api/ai-usage/by-state',     requireAuth as any, getAiUsageByState as any);
app.get('/api/ai-usage/by-lead',      requireAuth as any, getAiUsageByLead as any);
app.get('/api/ai-usage/events',       requireAuth as any, getAiUsageEvents as any);
app.get('/api/ai-usage/budget',       requireAuth as any, getAiUsageBudget as any);
app.patch('/api/ai-usage/budget',     requireAuth as any, patchAiUsageBudget as any);
app.get('/api/ai-usage/status',       requireAuth as any, getAiUsageStatus as any);
app.get('/api/ai-usage/models',       requireAuth as any, getAiUsageModels as any);
app.post('/api/ai-usage/models/sync', requireAuth as any, postAiUsageModelsSync as any);
app.get('/api/ai-usage/prices',       requireAuth as any, getAiUsagePrices as any);
app.post('/api/ai-usage/prices',      requireAuth as any, postAiUsagePrices as any);
app.patch('/api/ai-usage/prices/:id', requireAuth as any, patchAiUsagePrice as any);
app.post('/api/ai-usage/prices/sync', requireAuth as any, postAiUsagePriceSync as any);

app.get('/api/agent',                requireAuth as any, getAgent as any);
app.patch('/api/agent/persona',      requireAuth as any, updatePersona as any);
app.patch('/api/agent/programs',     requireAuth as any, updatePrograms as any);
app.patch('/api/agent/settings',     requireAuth as any, updateSettings as any);
app.patch('/api/agent/toggle',       requireAuth as any, toggleAgent as any);

// Mídia — proxy para Evolution API
app.get('/api/messages/:id/media', requireAuth as any, getMessageMedia as any);

// Simulador — sessões persistidas
app.get('/api/simulator/sessions',          requireAuth as any, listSessions   as any);
app.get('/api/simulator/sessions/:id',      requireAuth as any, getSession     as any);
app.post('/api/simulator/sessions',         requireAuth as any, createSession  as any);
app.patch('/api/simulator/sessions/:id',    requireAuth as any, updateSession  as any);
app.delete('/api/simulator/sessions/:id',   requireAuth as any, deleteSession  as any);

// Simulador — testa agente sem WhatsApp
app.post('/api/simulate/message', requireAuth as any, async (req, res) => {
    try {
        await (simulateMessage as any)(req, res);
    } catch (err: any) {
        res.status(500).json({ error: err?.message ?? 'Erro interno no simulador' });
    }
});

// Evolution API — instâncias WhatsApp
app.post('/api/instances/create',          requireAuth as any, createInstance as any);
app.get('/api/instances/qrcode',           requireAuth as any, getQRCode as any);
app.get('/api/instances/status',           requireAuth as any, getStatus as any);
app.get('/api/instances/phone',            requireAuth as any, getOwnerPhone as any);
app.get('/api/instances/webhook-status',   requireAuth as any, getWebhookStatus as any);
app.post('/api/instances/webhook',         requireAuth as any, configureWebhook as any);
app.delete('/api/instances/disconnect',    requireAuth as any, disconnectInstance as any);

// Logs
app.get('/api/logs/:category',    requireAuth as any, getLogs as any);
app.delete('/api/logs/:category', requireAuth as any, clearCategory as any);

// Contatos & Whitelist
app.get('/api/contacts',                     requireAuth as any, getContacts as any);
app.post('/api/contacts/sync',               requireAuth as any, syncContactsEndpoint as any);
app.patch('/api/contacts/:id/name',          requireAuth as any, updateContactName as any);
app.get('/api/contacts/whitelist',           requireAuth as any, getWhitelist as any);
app.put('/api/contacts/whitelist',           requireAuth as any, updateWhitelist as any);
app.post('/api/contacts/whitelist',          requireAuth as any, addToWhitelist as any);
app.delete('/api/contacts/whitelist/:phone', requireAuth as any, removeFromWhitelist as any);

// Evolution webhook — aceita tanto /webhook/evolution quanto /webhook/evolution/{event} (webhookByEvents=true)
app.post('/webhook/evolution', evolutionWebhook);
app.post('/webhook/evolution/:event', evolutionWebhook);

// WhatsApp Meta webhooks
app.get('/webhook', verifyWebhook);
app.post('/webhook', handleWebhook);
app.post('/webhook/asaas', handleAsaasWebhook);
app.post('/webhook/respondi', handleRespondiWebhook);

// Start Server
const server = app.listen(port, () => {
    console.log(`🚀 Artemis PRO rodando perfeitamente na porta ${port}`);
    log.system('info', `Servidor iniciado na porta ${port}`, { port, env: process.env.NODE_ENV });
    automationService.start();
});

async function shutdown(signal: string): Promise<void> {
    console.log(`${signal} recebido. Encerrando Artemis...`);
    automationService.stop();
    server.close(async () => {
        await prisma.$disconnect();
        process.exit(0);
    });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ── LGPD Cleanup Cron (runs every 24 hours) ──────────────────────────────────
// LGPD Arts. 15 & 16 — Eliminação completa de leads não convertidos inativos há 30+ dias.
// Deleta o registro inteiro do usuário + histórico de chat (cascade).
setInterval(async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    try {
        // Busca IDs dos leads a eliminar antes de deletar (para log)
        const toDelete = await prisma.user.findMany({
            where: {
                lastInteraction: { lt: thirtyDaysAgo },
                asaasCustomerId: null // Nunca comprou / gerou link de pagamento
            },
            select: { id: true }
        });

        if (toDelete.length > 0) {
            // Deleta em cascata: ChatHistory é removido automaticamente (onDelete: Cascade)
            const result = await prisma.user.deleteMany({
                where: {
                    lastInteraction: { lt: thirtyDaysAgo },
                    asaasCustomerId: null
                }
            });
            console.log(`🗑️ [LGPD Arts.15&16] Purga diária: ${result.count} leads não convertidos eliminados completamente (perfil + histórico).`);
        } else {
            console.log(`🧹 [LGPD] Purga diária: nenhum lead elegível para eliminação.`);
        }
    } catch (e) {
        console.error('Erro na rotina LGPD:', e);
    }
}, 86400000); // 24 hours
