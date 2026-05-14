import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { verifyWebhook, handleWebhook } from './controllers/WebhookController';
import { handleAsaasWebhook } from './controllers/AsaasWebhookController';
import { handleRespondiWebhook } from './controllers/RespondiController';
import { login, refresh, register } from './controllers/AuthController';
import { requireAuth } from './middlewares/auth';
import { createInstance, getQRCode, getStatus, disconnectInstance } from './controllers/InstanceController';
import { evolutionWebhook } from './controllers/EvolutionWebhookController';
import { listLeads, getLead, listConversations, updateLeadState, deleteLead } from './controllers/LeadsController';
import { getMetrics } from './controllers/MetricsController';
import { getAgent, updatePersona, updatePrograms, updateSettings, toggleAgent } from './controllers/AgentController';
import { getTenant, updateTenantKeys } from './controllers/TenantController';
import { prisma } from './utils/prisma';

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

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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
app.patch('/api/leads/:id/state',    requireAuth as any, updateLeadState as any);
app.delete('/api/leads/:id',         requireAuth as any, deleteLead as any);

// Métricas
app.get('/api/metrics', requireAuth as any, getMetrics as any);

// Agente
// Tenant — chaves e configurações
app.get('/api/tenant',              requireAuth as any, getTenant as any);
app.patch('/api/tenant/keys',       requireAuth as any, updateTenantKeys as any);

app.get('/api/agent',                requireAuth as any, getAgent as any);
app.patch('/api/agent/persona',      requireAuth as any, updatePersona as any);
app.patch('/api/agent/programs',     requireAuth as any, updatePrograms as any);
app.patch('/api/agent/settings',     requireAuth as any, updateSettings as any);
app.patch('/api/agent/toggle',       requireAuth as any, toggleAgent as any);

// Evolution API — instâncias WhatsApp
app.post('/api/instances/create',       requireAuth as any, createInstance as any);
app.get('/api/instances/qrcode',        requireAuth as any, getQRCode as any);
app.get('/api/instances/status',        requireAuth as any, getStatus as any);
app.delete('/api/instances/disconnect', requireAuth as any, disconnectInstance as any);

// Evolution webhook
app.post('/webhook/evolution', evolutionWebhook);

// WhatsApp Meta webhooks
app.get('/webhook', verifyWebhook);
app.post('/webhook', handleWebhook);
app.post('/webhook/asaas', handleAsaasWebhook);
app.post('/webhook/respondi', handleRespondiWebhook);

// Start Server
const server = app.listen(port, () => {
    console.log(`🚀 Artemis PRO rodando perfeitamente na porta ${port}`);
});

async function shutdown(signal: string): Promise<void> {
    console.log(`${signal} recebido. Encerrando Artemis...`);
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