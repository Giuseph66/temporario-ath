import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { prisma } from '../utils/prisma';

export async function getTenant(req: AuthRequest, res: Response): Promise<Response> {
    const tenant = await prisma.tenant.findUnique({
        where: { id: req.tenantId },
        select: {
            id: true, name: true, slug: true, plan: true, isActive: true,
            evolutionInstance: true, evolutionBaseUrl: true,
            // Nunca retornar as chaves completas — apenas indicar se estão configuradas
            geminiApiKey: false,
            evolutionApiKey: false,
        },
    });
    if (!tenant) return res.status(404).json({ error: 'Tenant não encontrado' });

    // Buscar quais chaves estão configuradas (sem expor o valor)
    const raw = await prisma.tenant.findUnique({
        where: { id: req.tenantId },
        select: { geminiApiKey: true, evolutionApiKey: true },
    });

    return res.json({
        ...tenant,
        keys: {
            geminiApiKey: raw?.geminiApiKey ? '••••••••' : null,
            evolutionApiKey: raw?.evolutionApiKey ? '••••••••' : null,
        },
    });
}

export async function updateTenantKeys(req: AuthRequest, res: Response): Promise<Response> {
    const { geminiApiKey, evolutionApiKey, evolutionBaseUrl } = req.body as {
        geminiApiKey?: string;
        evolutionApiKey?: string;
        evolutionBaseUrl?: string;
    };

    const data: Record<string, string | null> = {};

    // Só atualiza campos presentes no body — string vazia apaga a chave
    if (geminiApiKey !== undefined) {
        data.geminiApiKey = geminiApiKey.trim() || null;
    }
    if (evolutionApiKey !== undefined) {
        data.evolutionApiKey = evolutionApiKey.trim() || null;
    }
    if (evolutionBaseUrl !== undefined) {
        data.evolutionBaseUrl = evolutionBaseUrl.trim() || null;
    }

    if (Object.keys(data).length === 0) {
        return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    await prisma.tenant.update({ where: { id: req.tenantId }, data });
    return res.json({ ok: true });
}
