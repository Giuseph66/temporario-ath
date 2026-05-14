import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { prisma } from '../utils/prisma';
import { EvolutionService } from '../services/EvolutionService';

type WhitelistSettings = {
    enabled: boolean;
    phones: string[];
    groupWhitelistEnabled: boolean;
    allowedGroups: string[];
};

async function getWhitelistSettings(tenantId: string): Promise<WhitelistSettings> {
    const agent = await prisma.agent.findFirst({ where: { tenantId } });
    const settings = (agent?.settingsJson as Record<string, unknown>) ?? {};
    return {
        enabled: (settings.whitelistEnabled as boolean) ?? false,
        phones: (settings.allowedPhones as string[]) ?? [],
        groupWhitelistEnabled: (settings.groupWhitelistEnabled as boolean) ?? false,
        allowedGroups: (settings.allowedGroups as string[]) ?? [],
    };
}

export async function getContacts(req: AuthRequest, res: Response): Promise<Response> {
    const page    = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit   = Math.min(100, parseInt(req.query.limit as string) || 50);
    const search  = (req.query.search as string ?? '').trim();
    const filter  = (req.query.filter as string) === 'whitelisted' ? 'whitelisted' : 'all';

    const whitelist = await getWhitelistSettings(req.tenantId);
    const whitelistSet = new Set(whitelist.phones);

    // Verifica se cache existe
    const total = await prisma.contact.count({ where: { tenantId: req.tenantId } });
    if (total === 0) {
        syncContacts(req.tenantId).catch(() => null);
        return res.json({ contacts: [], whitelist, syncing: true, total: 0, page, pages: 0 });
    }

    // Filtro por whitelist: busca apenas phones na lista
    let phoneFilter: object | undefined;
    if (filter === 'whitelisted') {
        if (whitelist.phones.length === 0) return res.json({ contacts: [], whitelist, syncing: false, total: 0, page: 1, pages: 0 });
        phoneFilter = { in: whitelist.phones };
    }

    const where = {
        tenantId: req.tenantId,
        ...(phoneFilter ? { phone: phoneFilter } : {}),
        ...(search ? {
            OR: [
                { customName: { contains: search, mode: 'insensitive' as const } },
                { name:       { contains: search, mode: 'insensitive' as const } },
                { phone:      { contains: search } },
            ],
        } : {}),
    };

    const [rows, count] = await Promise.all([
        prisma.contact.findMany({
            where,
            orderBy: [{ customName: 'asc' }, { name: 'asc' }],
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.contact.count({ where }),
    ]);

    const contacts = rows.map(c => ({
        id: c.id,
        phone: c.phone,
        name: c.customName ?? c.name,
        originalName: c.name,
        customName: c.customName,
        profilePicUrl: c.profilePicUrl,
        whitelisted: whitelistSet.has(c.phone),
        syncedAt: c.syncedAt,
    }));

    return res.json({ contacts, whitelist, syncing: false, total: count, page, pages: Math.ceil(count / limit) });
}

export async function syncContacts(tenantId: string): Promise<number> {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant?.evolutionInstance) return 0;

    const raw = await EvolutionService.getContacts(tenant.evolutionInstance);

    // Upsert em lotes de 100
    const BATCH = 100;
    for (let i = 0; i < raw.length; i += BATCH) {
        const batch = raw.slice(i, i + BATCH);
        await Promise.all(batch.map(c =>
            prisma.contact.upsert({
                where: { tenantId_phone: { tenantId, phone: c.phone } },
                update: { name: c.name, profilePicUrl: c.profilePicUrl, syncedAt: new Date() },
                create: { tenantId, phone: c.phone, name: c.name, profilePicUrl: c.profilePicUrl },
            })
        ));
    }

    return raw.length;
}

export async function syncContactsEndpoint(req: AuthRequest, res: Response): Promise<Response> {
    const count = await syncContacts(req.tenantId);
    return res.json({ ok: true, synced: count });
}

export async function updateContactName(req: AuthRequest, res: Response): Promise<Response> {
    const { id } = req.params;
    const { customName } = req.body as { customName: string };

    const contact = await prisma.contact.findFirst({ where: { id, tenantId: req.tenantId } });
    if (!contact) return res.status(404).json({ error: 'Contato não encontrado' });

    await prisma.contact.update({ where: { id }, data: { customName: customName || null } });
    return res.json({ ok: true });
}

export async function getWhitelist(req: AuthRequest, res: Response): Promise<Response> {
    const whitelist = await getWhitelistSettings(req.tenantId);
    return res.json(whitelist);
}

export async function updateWhitelist(req: AuthRequest, res: Response): Promise<Response> {
    const { enabled, phones, groupWhitelistEnabled, allowedGroups } = req.body as {
        enabled?: boolean; phones?: string[];
        groupWhitelistEnabled?: boolean; allowedGroups?: string[];
    };

    const agent = await prisma.agent.findFirst({ where: { tenantId: req.tenantId } });
    if (!agent) return res.status(404).json({ error: 'Agente não encontrado' });

    const existing = (agent.settingsJson as Record<string, unknown>) ?? {};
    const updated = {
        ...existing,
        ...(enabled !== undefined ? { whitelistEnabled: enabled } : {}),
        ...(phones !== undefined ? { allowedPhones: phones } : {}),
        ...(groupWhitelistEnabled !== undefined ? { groupWhitelistEnabled } : {}),
        ...(allowedGroups !== undefined ? { allowedGroups } : {}),
    };

    await prisma.agent.update({ where: { id: agent.id }, data: { settingsJson: updated } });
    return res.json({ ok: true });
}

export async function addToWhitelist(req: AuthRequest, res: Response): Promise<Response> {
    const { phone } = req.body as { phone: string };
    if (!phone) return res.status(400).json({ error: 'phone obrigatório' });

    const agent = await prisma.agent.findFirst({ where: { tenantId: req.tenantId } });
    if (!agent) return res.status(404).json({ error: 'Agente não encontrado' });

    const existing = (agent.settingsJson as Record<string, unknown>) ?? {};
    const phones: string[] = [...new Set([...((existing.allowedPhones as string[]) ?? []), phone])];
    await prisma.agent.update({ where: { id: agent.id }, data: { settingsJson: { ...existing, allowedPhones: phones } } });
    return res.json({ ok: true, phones });
}

export async function removeFromWhitelist(req: AuthRequest, res: Response): Promise<Response> {
    const { phone } = req.params;

    const agent = await prisma.agent.findFirst({ where: { tenantId: req.tenantId } });
    if (!agent) return res.status(404).json({ error: 'Agente não encontrado' });

    const existing = (agent.settingsJson as Record<string, unknown>) ?? {};
    const phones = ((existing.allowedPhones as string[]) ?? []).filter(p => p !== decodeURIComponent(phone));
    await prisma.agent.update({ where: { id: agent.id }, data: { settingsJson: { ...existing, allowedPhones: phones } } });
    return res.json({ ok: true, phones });
}
