import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { prisma } from '../utils/prisma';
import { EvolutionService } from '../services/EvolutionService';

export async function createInstance(req: AuthRequest, res: Response): Promise<Response> {
    try {
        const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
        if (!tenant) return res.status(404).json({ error: 'Tenant não encontrado' });

        const instanceName = `artemis-${tenant.slug}`;
        await EvolutionService.createInstance(instanceName);
        await EvolutionService.setWebhook(instanceName);

        await prisma.tenant.update({
            where: { id: req.tenantId },
            data: { evolutionInstance: instanceName },
        });

        return res.json({ instance: instanceName, webhookConfigured: true });
    } catch (err: any) {
        const status = err?.response?.status;
        if (status === 401) return res.status(400).json({ error: 'API Key da Evolution inválida. Verifique EVOLUTION_API_KEY no .env.' });
        if (status === 409) return res.status(409).json({ error: 'Instância já existe na Evolution API.' });
        return res.status(500).json({ error: `Erro ao conectar na Evolution API: ${err?.message ?? 'desconhecido'}` });
    }
}

export async function getQRCode(req: AuthRequest, res: Response): Promise<Response> {
    try {
        const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
        if (!tenant?.evolutionInstance) {
            return res.status(400).json({ error: 'Instância não criada. Crie via POST /api/instances/create' });
        }

        const qr = await EvolutionService.getQRCode(tenant.evolutionInstance);
        if (!qr) return res.status(202).json({ status: 'connecting', qr: null });

        return res.json({ status: 'connecting', qr });
    } catch (err: any) {
        return res.status(500).json({ error: `Erro ao buscar QR Code: ${err?.message ?? 'desconhecido'}` });
    }
}

export async function getStatus(req: AuthRequest, res: Response): Promise<Response> {
    try {
        const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
        if (!tenant?.evolutionInstance) {
            return res.json({ status: 'not_created' });
        }

        const status = await EvolutionService.getStatus(tenant.evolutionInstance);
        return res.json({ status, instance: tenant.evolutionInstance });
    } catch (err: any) {
        return res.status(500).json({ error: `Erro ao verificar status: ${err?.message ?? 'desconhecido'}` });
    }
}

export async function getOwnerPhone(req: AuthRequest, res: Response): Promise<Response> {
    try {
        const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
        if (!tenant?.evolutionInstance) return res.json({ phone: null });
        const phone = await EvolutionService.getOwnerPhone(tenant.evolutionInstance);
        if (phone) {
            // Persiste no settingsJson do agent para uso no webhook
            const agent = await prisma.agent.findFirst({ where: { tenantId: req.tenantId } });
            if (agent) {
                const s = (agent.settingsJson as Record<string, unknown>) ?? {};
                await prisma.agent.update({ where: { id: agent.id }, data: { settingsJson: { ...s, ownerPhone: phone } } });
            }
        }
        return res.json({ phone });
    } catch (err: any) {
        return res.status(500).json({ error: err?.message });
    }
}

export async function getWebhookStatus(req: AuthRequest, res: Response): Promise<Response> {
    try {
        const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
        if (!tenant?.evolutionInstance) return res.json({ configured: false, url: null, enabled: false });

        const status = await EvolutionService.getWebhookStatus(tenant.evolutionInstance);
        return res.json(status);
    } catch (err: any) {
        return res.status(500).json({ error: `Erro ao verificar webhook: ${err?.message ?? 'desconhecido'}` });
    }
}

export async function configureWebhook(req: AuthRequest, res: Response): Promise<Response> {
    try {
        const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
        if (!tenant?.evolutionInstance) return res.status(400).json({ error: 'Sem instância ativa' });

        await EvolutionService.setWebhook(tenant.evolutionInstance);
        const webhookUrl = `${process.env.SERVER_URL}/webhook/evolution`;
        return res.json({ ok: true, webhookUrl, instance: tenant.evolutionInstance });
    } catch (err: any) {
        return res.status(500).json({ error: `Erro ao configurar webhook: ${err?.message ?? 'desconhecido'}` });
    }
}

export async function disconnectInstance(req: AuthRequest, res: Response): Promise<Response> {
    try {
        const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
        if (!tenant?.evolutionInstance) return res.status(400).json({ error: 'Sem instância ativa' });

        await EvolutionService.disconnect(tenant.evolutionInstance);
        await prisma.tenant.update({ where: { id: req.tenantId }, data: { evolutionInstance: null } });

        return res.json({ ok: true });
    } catch (err: any) {
        return res.status(500).json({ error: `Erro ao desconectar instância: ${err?.message ?? 'desconhecido'}` });
    }
}
