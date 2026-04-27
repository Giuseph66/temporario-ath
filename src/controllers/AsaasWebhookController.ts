import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { WhatsAppService } from '../services/WhatsAppService';

const prisma = new PrismaClient();
const whatsapp = new WhatsAppService();

/**
 * AsaasWebhookController
 *
 * Recebe notificações de eventos do Asaas (pagamentos confirmados, recebidos etc.)
 * e dispara uma mensagem proativa de confirmação para o aluno via WhatsApp.
 *
 * IMPORTANTE: O status 200 é enviado IMEDIATAMENTE antes de qualquer processamento
 * para evitar que o Asaas reenvia o evento por timeout.
 */
export const handleAsaasWebhook = async (req: Request, res: Response): Promise<void> => {
    // ✅ Retorno imediato — impede retentativas do Asaas
    res.sendStatus(200);

    try {
        const { event, payment } = req.body;

        console.log(`🔔 [AsaasWebhook] Evento recebido: ${event}`);

        // Só processa eventos de pagamento confirmado ou recebido
        if (event !== 'PAYMENT_RECEIVED' && event !== 'PAYMENT_CONFIRMED') {
            console.log(`ℹ️  [AsaasWebhook] Evento ignorado: ${event}`);
            return;
        }

        const asaasCustomerId: string = payment?.customer;
        const valueRaw: number = payment?.value ?? 0;

        if (!asaasCustomerId) {
            console.warn('⚠️  [AsaasWebhook] Payload sem customer ID. Ignorado.');
            return;
        }

        // Busca o usuário correspondente pelo ID do Asaas
        const user = await prisma.user.findFirst({
            where: { asaasCustomerId }
        });

        if (!user || !user.phoneNumber) {
            console.warn(`⚠️  [AsaasWebhook] Nenhum usuário encontrado para asaasCustomerId: ${asaasCustomerId}`);
            return;
        }

        // Formata o valor para exibição (ex: 497 → "R$ 497,00")
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
        console.log(`📲 [AsaasWebhook] Confirmação enviada para ${user.phoneNumber}`);

    } catch (error) {
        console.error('❌ [AsaasWebhook] Erro ao processar evento:', error);
    }
};
