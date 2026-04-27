import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { verifyWebhook, handleWebhook } from './controllers/WebhookController';
import { handleAsaasWebhook } from './controllers/AsaasWebhookController';
import { handleRespondiWebhook } from './controllers/RespondiController';
import { PrismaClient } from '@prisma/client';

dotenv.config();

// Validação de variáveis de ambiente críticas (Aviso de startup)
if (!process.env.GEMINI_API_KEY || !process.env.DATABASE_URL) {
    console.error("🚨 ERRO FATAL: Variáveis de ambiente faltando no .env!");
    process.exit(1); // Mata a aplicação antes mesmo de rodar quebrado
}

if (!process.env.ASAAS_API_KEY) {
    console.warn("⚠️  AVISO: ASAAS_API_KEY não encontrada no .env. Geração de pagamentos desativada.");
}

if (!process.env.RESPONDI_WEBHOOK_SECRET) {
    console.warn("⚠️ AVISO: RESPONDI_WEBHOOK_SECRET ausente. Webhook de cadastro vulnerável.");
}

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Rotas
app.get('/', (req, res) => res.send('🤖 Artemis PRO (Architecture Cleaned) Online!'));

app.get('/webhook', verifyWebhook);
app.post('/webhook', handleWebhook);
app.post('/webhook/asaas', handleAsaasWebhook);
app.post('/webhook/respondi', handleRespondiWebhook);

// Start Server
app.listen(port, () => {
    console.log(`🚀 Artemis PRO rodando perfeitamente na porta ${port}`);
});

// ── LGPD Cleanup Cron (runs every 24 hours) ──────────────────────────────────
// LGPD Arts. 15 & 16 — Eliminação completa de leads não convertidos inativos há 30+ dias.
// Deleta o registro inteiro do usuário + histórico de chat (cascade).
const prismaForCron = new PrismaClient();

setInterval(async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    try {
        // Busca IDs dos leads a eliminar antes de deletar (para log)
        const toDelete = await prismaForCron.user.findMany({
            where: {
                lastInteraction: { lt: thirtyDaysAgo },
                asaasCustomerId: null // Nunca comprou / gerou link de pagamento
            },
            select: { id: true }
        });

        if (toDelete.length > 0) {
            // Deleta em cascata: ChatHistory é removido automaticamente (onDelete: Cascade)
            const result = await prismaForCron.user.deleteMany({
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