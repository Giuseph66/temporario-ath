import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { WhatsAppService } from '../services/WhatsAppService';
import { EvolutionService } from '../services/EvolutionService';
import { automationService } from '../services/AutomationService';
import { updateSubscriptionStatus } from '../services/SubscriptionService';

const whatsapp = new WhatsAppService();

async function sendAsaasNotification(tenantId: string | null, phone: string, text: string): Promise<void> {
    if (tenantId) {
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { evolutionInstance: true },
        }).catch(() => null);
        if (tenant?.evolutionInstance) {
            await EvolutionService.sendText(tenant.evolutionInstance, phone, text);
            return;
        }
    }
    await whatsapp.sendText(phone, text);
}

export const handleAsaasWebhook = async (req: Request, res: Response): Promise<void> => {
    const receivedToken = req.headers['asaas-access-token'] as string | undefined;

    // Valida token: primeiro ENV global, depois lookup por tenant
    const globalSecret = process.env.ASAAS_WEBHOOK_SECRET;
    const matchesGlobal = globalSecret && receivedToken === globalSecret;
    let resolvedTenantId: string | null = null;

    if (!matchesGlobal) {
        const tenantMatch = receivedToken
            ? await prisma.tenant.findFirst({
                where: { asaasWebhookSecret: receivedToken },
                select: { id: true },
              })
            : null;
        if (!tenantMatch) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        resolvedTenantId = tenantMatch.id;
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

        // Atualiza status de subscription da plataforma (cobrança da mensalidade do tenant)
        const PLATFORM_SUBSCRIPTION_EVENTS: Record<string, string> = {
            PAYMENT_RECEIVED: 'ACTIVE',
            PAYMENT_CONFIRMED: 'ACTIVE',
            PAYMENT_OVERDUE: 'OVERDUE',
            PAYMENT_DELETED: 'CANCELLED',
            SUBSCRIPTION_INACTIVATED: 'SUSPENDED',
        };

        if (event in PLATFORM_SUBSCRIPTION_EVENTS) {
            const subStatus = PLATFORM_SUBSCRIPTION_EVENTS[event] as any;
            // Tenta resolver tenant pelo asaasCustomerId da subscription
            const platformSub = payment?.customer
                ? await prisma.subscription.findFirst({
                    where: { asaasCustomerId: payment.customer },
                    select: { tenantId: true },
                  }).catch(() => null)
                : null;

            if (platformSub) {
                const nextPeriodEnd = event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED'
                    ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                    : undefined;
                await updateSubscriptionStatus(platformSub.tenantId, subStatus, {
                    asaasCustomerId: payment.customer,
                    ...(nextPeriodEnd ? { currentPeriodEnd: nextPeriodEnd } : {}),
                });
                console.log(`[AsaasWebhook] Subscription ${platformSub.tenantId} → ${subStatus}`);
            }
        }

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
            where: { asaasCustomerId },
            select: { id: true, phoneNumber: true, name: true, tenantId: true },
        });

        if (!user || !user.phoneNumber) {
            console.warn(`⚠️  [AsaasWebhook] Nenhum usuário encontrado para asaasCustomerId: ${asaasCustomerId}`);
            return;
        }

        const effectiveTenantId = resolvedTenantId ?? user.tenantId;

        // Atualizar status de matrícula no banco
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
            `Sua matrícula está confirmada! Em breve entraremos em contato para alinhar os próximos passos.\n\n` +
            `Seja muito bem-vindo(a)! 🚀`;

        await sendAsaasNotification(effectiveTenantId, user.phoneNumber, confirmationMessage);
        if (effectiveTenantId) {
            await automationService.handleEvent(effectiveTenantId, 'PAYMENT_CONFIRMED', {
                userId: user.id,
                paymentId,
                value: valueRaw,
            });
        }
        console.log(`📲 [AsaasWebhook] Confirmação enviada via ${effectiveTenantId ? 'Evolution' : 'Meta'}. Status: ENROLLED.`);

    } catch (error) {
        console.error('❌ [AsaasWebhook] Erro ao processar evento:', error);
    }
};
