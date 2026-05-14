import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { prisma } from '../utils/prisma';
import { EvolutionService } from '../services/EvolutionService';

export async function createInstance(req: AuthRequest, res: Response): Promise<Response> {
    const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
    if (!tenant) return res.status(404).json({ error: 'Tenant não encontrado' });

    const instanceName = `artemis-${tenant.slug}`;
    await EvolutionService.createInstance(instanceName);

    await prisma.tenant.update({
        where: { id: req.tenantId },
        data: { evolutionInstance: instanceName },
    });

    return res.json({ instance: instanceName });
}

export async function getQRCode(req: AuthRequest, res: Response): Promise<Response> {
    const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
    if (!tenant?.evolutionInstance) {
        return res.status(400).json({ error: 'Instância não criada. Crie via POST /api/instances/create' });
    }

    const qr = await EvolutionService.getQRCode(tenant.evolutionInstance);
    if (!qr) return res.status(202).json({ status: 'connecting', qr: null });

    return res.json({ status: 'connecting', qr });
}

export async function getStatus(req: AuthRequest, res: Response): Promise<Response> {
    const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
    if (!tenant?.evolutionInstance) {
        return res.json({ status: 'not_created' });
    }

    const status = await EvolutionService.getStatus(tenant.evolutionInstance);
    return res.json({ status, instance: tenant.evolutionInstance });
}

export async function disconnectInstance(req: AuthRequest, res: Response): Promise<Response> {
    const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
    if (!tenant?.evolutionInstance) return res.status(400).json({ error: 'Sem instância ativa' });

    await EvolutionService.disconnect(tenant.evolutionInstance);
    await prisma.tenant.update({ where: { id: req.tenantId }, data: { evolutionInstance: null } });

    return res.json({ ok: true });
}
