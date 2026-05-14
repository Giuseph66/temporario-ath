import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { WhatsAppService } from '../services/WhatsAppService';

const whatsapp = new WhatsAppService();

export const handleAsaasWebhook = async (req: Request, res: Response): Promise<void> => {
    const receivedToken = req.headers['asaas-access-token'] as string | undefined;

    // Validação: aceita token do ENV (global) ou do banco por tenant (multi-tenant)
    // Tenta primeiro o ENV como fallback universal
    const globalSecret = process.env.ASAAS_WEBHOOK_SECRET;
    const matchesGlobal = globalSecret && receivedToken === globalSecret;

    if (!matchesGlobal) {
        // Tenta encontrar tenant com esse webhookSecret no banco
        const tenantMatch = receivedToken
            ? await prisma.tenant.findFirst({ where: { asaasWebhookSecret: receivedToken } })
            : null;
        if (!tenantMatch) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
    }

    // Passo 06 — Validação mínima do payload
    if (!req.body?.event || !req.body?.payment?.id) {
        res.status(400).json({ error: 'Invalid payload' });
        return;
    }

    // ✅ Retorno imediato após validação — impede retentativas do Asaas
    res.sendStatus(200);

    try {
        const { event, payment } = req.body;

        console.log(`🔔 [AsaasWebhook] Evento recebido: ${event}`);

        if (event !== 'PAYMENT_RECEIVED' && event !== 'PAYMENT_CONFIRMED') {
            console.log(`ℹ️  [AsaasWebhook] Evento ignorado: ${event}`);
            return;
        }

        // Passo 07 — Idempotência: ignorar se já processado
        const paymentId: string = payment.id;
        const already = await prisma.processedEvent.findUnique({ where: { id: paymentId } });
        if (already) {
            console.log(`♻️  [AsaasWebhook] Evento ${paymentId} já processado. Ignorando.`);
            return;
        }
        await prisma.processedEvent.create({ data: { id: paymentId } });

        const asaasCustomerId: string = payment?.customer;
        const valueRaw: number = payment?.value ?? 0;

        if (!asaasCustomerId) {
            console.warn('⚠️  [AsaasWebhook] Payload sem customer ID. Ignorado.');
            return;
        }

        const user = await prisma.user.findFirst({
            where: { asaasCustomerId }
        });

        if (!user || !user.phoneNumber) {
            console.warn(`⚠️  [AsaasWebhook] Nenhum usuário encontrado para asaasCustomerId: ${asaasCustomerId}`);
            return;
        }

        // Passo 19 — Atualizar status de matrícula no banco
        await prisma.user.update({
            where: { id: user.id },
            data: {
                enrollmentStatus: 'ENROLLED',
                enrollmentDate: new Date(),
            }
        });

        const valueFormatted = valueRaw.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        });

        const studentName = user.name ? `, ${user.name.split(' ')[0]}` : '';

        const confirmationMessage =
            `✅ *Pagamento confirmado!*\n\n` +
            `Olá${studentName}! Recebemos o seu pagamento de *${valueFormatted}* com sucesso. 🎉\n\n` +
            `Sua matrícula está confirmada! Em breve a nossa equipe da Confluence entrará em contato para alinhar os próximos passos da sua jornada.\n\n` +
            `Seja muito bem-vindo(a)! 🚀`;

        await whatsapp.sendText(user.phoneNumber, confirmationMessage);
        console.log(`📲 [AsaasWebhook] Confirmação enviada. Status atualizado para ENROLLED.`);

    } catch (error) {
        console.error('❌ [AsaasWebhook] Erro ao processar evento:', error);
    }
};
