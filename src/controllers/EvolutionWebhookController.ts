import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { normalizeBrazilianPhone } from '../utils/phoneNormalizer';

function log(tenantId: string, msg: string, data?: unknown) {
    console.log(JSON.stringify({
        ts: new Date().toISOString(),
        tenant: tenantId,
        msg,
        ...(data ? { data } : {}),
    }));
}

export async function evolutionWebhook(req: Request, res: Response): Promise<void> {
    res.sendStatus(200);

    try {
        const { event, instance, data } = req.body as {
            event: string;
            instance: string;
            data: {
                key?: { remoteJid?: string; fromMe?: boolean };
                message?: { conversation?: string; extendedTextMessage?: { text?: string } };
            };
        };

        if (event !== 'messages.upsert') return;
        if (data?.key?.fromMe) return;

        const remoteJid = data?.key?.remoteJid ?? '';
        const rawPhone = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
        if (!rawPhone) return;

        const phoneNumber = normalizeBrazilianPhone(rawPhone);
        const messageText: string =
            data?.message?.conversation ??
            data?.message?.extendedTextMessage?.text ??
            '';

        if (!messageText.trim()) return;

        const tenant = await prisma.tenant.findFirst({
            where: { evolutionInstance: instance },
        });
        if (!tenant || !tenant.isActive) return;

        log(tenant.id, 'Mensagem recebida', { phone: phoneNumber.slice(0, 4) + '****', chars: messageText.length });

        // Isolamento por tenant — erro aqui não afeta outros tenants
        const { scheduleProcessing } = await import('./WebhookController');
        await Promise.race([
            Promise.resolve(scheduleProcessing(phoneNumber, messageText)),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 120_000)),
        ]).catch(err => {
            log(tenant.id, 'Timeout ou erro no processamento', {
                error: err instanceof Error ? err.message : String(err),
            });
        });

    } catch (err) {
        console.error('[Evolution Webhook] Erro crítico:', err);
    }
}
