import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { prisma } from '../utils/prisma';
import { getAgentFull, serializeAgent } from '../utils/agentQuery';

// ── GET /api/agent ────────────────────────────────────────────────────────────
export async function getAgent(req: AuthRequest, res: Response): Promise<Response> {
    const agent = await getAgentFull({ tenantId: req.tenantId });
    if (!agent) return res.status(404).json({ error: 'Agente não encontrado' });
    return res.json(serializeAgent(agent));
}

// ── PATCH /api/agent/persona ──────────────────────────────────────────────────
export async function updatePersona(req: AuthRequest, res: Response): Promise<Response> {
    const body = req.body as Record<string, unknown>;

    const agent = await prisma.agent.findFirst({ where: { tenantId: req.tenantId } });
    if (!agent) return res.status(404).json({ error: 'Agente não encontrado' });

    // Accept both new flat fields and legacy personaJson wrapper
    const src: Record<string, unknown> = (body.personaJson as Record<string, unknown>) ?? body;

    const data: Record<string, unknown> = {};
    if (src.name     !== undefined) data.name     = String(src.name);
    if (src.role     !== undefined) data.role     = String(src.role);
    if (src.language !== undefined) data.language = String(src.language);
    const tone = src.toneJson ?? src.tone;
    if (tone) data.toneJson = tone as object;
    const qual = src.qualificationJson ?? src.qualification;
    if (qual) data.qualificationJson = qual as any;
    const obj = src.objectionHandlingJson ?? src.objection_handling;
    if (obj) data.objectionHandlingJson = obj as object;
    const kc = src.knowledgeContractsJson ?? src.knowledge_base_contracts;
    if (kc) data.knowledgeContractsJson = kc as object;

    if (Object.keys(data).length) {
        await prisma.agent.update({ where: { id: agent.id }, data });
    }

    // Protocols
    const protocols = src.protocols as Record<string, string> | undefined;
    if (protocols && typeof protocols === 'object') {
        for (const [key, value] of Object.entries(protocols)) {
            if (typeof value !== 'string') continue;
            await prisma.agentProtocol.upsert({
                where: { agentId_key: { agentId: agent.id, key } },
                create: { agentId: agent.id, key, value },
                update: { value },
            });
        }
    }

    // Restrictions
    const restrictions = src.absolute_restrictions as string[] | undefined;
    if (Array.isArray(restrictions)) {
        await prisma.agentRestriction.deleteMany({ where: { agentId: agent.id } });
        for (let i = 0; i < restrictions.length; i++) {
            await prisma.agentRestriction.create({
                data: { agentId: agent.id, text: restrictions[i], sortOrder: i },
            });
        }
    }

    return res.json({ ok: true });
}

// ── PATCH /api/agent/programs ─────────────────────────────────────────────────
export async function updatePrograms(req: AuthRequest, res: Response): Promise<Response> {
    const body = req.body as { programsJson?: { programs?: unknown[] }; programs?: unknown[] };
    const programs = body.programs ?? body.programsJson?.programs;

    if (!Array.isArray(programs)) {
        return res.status(400).json({ error: 'programs[] obrigatório' });
    }

    const agent = await prisma.agent.findFirst({ where: { tenantId: req.tenantId } });
    if (!agent) return res.status(404).json({ error: 'Agente não encontrado' });

    const incomingKeys = new Set<string>();

    for (let i = 0; i < programs.length; i++) {
        const p = programs[i] as Record<string, unknown>;
        const key = String(p.programKey ?? p.id ?? `prog_${i}`).toLowerCase().replace(/\s+/g, '_');
        incomingKeys.add(key);

        await prisma.agentProgram.upsert({
            where: { agentId_programKey: { agentId: agent.id, programKey: key } },
            create: {
                agentId:       agent.id,
                programKey:    key,
                name:          String(p.name ?? ''),
                priceValue:    Number(p.priceValue ?? p.price_value ?? p.price ?? 0),
                priceType:     String(p.priceType ?? p.price_type ?? 'monthly'),
                installments:  Number(p.installments ?? 1),
                durationWeeks: Number(p.durationWeeks ?? p.duration_weeks ?? 0),
                verbatimIntro: String(p.verbatimIntro ?? p.verbatim_intro ?? ''),
                fullText:      String(p.fullText ?? p.full_text ?? ''),
                sortOrder:     i,
            },
            update: {
                name:          String(p.name ?? ''),
                priceValue:    Number(p.priceValue ?? p.price_value ?? p.price ?? 0),
                priceType:     String(p.priceType ?? p.price_type ?? 'monthly'),
                installments:  Number(p.installments ?? 1),
                durationWeeks: Number(p.durationWeeks ?? p.duration_weeks ?? 0),
                verbatimIntro: String(p.verbatimIntro ?? p.verbatim_intro ?? ''),
                fullText:      String(p.fullText ?? p.full_text ?? ''),
                sortOrder:     i,
            },
        });
    }

    const existing = await prisma.agentProgram.findMany({
        where: { agentId: agent.id },
        select: { programKey: true },
    });
    const toDelete = existing.filter(e => !incomingKeys.has(e.programKey)).map(e => e.programKey);
    if (toDelete.length) {
        await prisma.agentProgram.deleteMany({ where: { agentId: agent.id, programKey: { in: toDelete } } });
    }

    return res.json({ ok: true });
}

// ── PATCH /api/agent/settings ─────────────────────────────────────────────────
export async function updateSettings(req: AuthRequest, res: Response): Promise<Response> {
    const agent = await prisma.agent.findFirst({ where: { tenantId: req.tenantId } });
    if (!agent) return res.status(404).json({ error: 'Agente não encontrado' });

    const body = req.body as Record<string, unknown>;
    const src: Record<string, unknown> = (body.settingsJson as Record<string, unknown>) ?? body;

    const data: Record<string, unknown> = {};
    if (src.whitelistEnabled        !== undefined) data.whitelistEnabled        = Boolean(src.whitelistEnabled);
    if (src.ignoreGroups            !== undefined) data.ignoreGroups            = Boolean(src.ignoreGroups);
    if (src.adminChatEnabled        !== undefined) data.adminChatEnabled        = Boolean(src.adminChatEnabled);
    if (src.agentInternalMode       !== undefined) data.agentInternalMode       = String(src.agentInternalMode);
    if (src.ownerPhone              !== undefined) data.ownerPhone              = src.ownerPhone ? String(src.ownerPhone) : null;
    if (src.humanSupportNumber      !== undefined) data.humanSupportNumber      = src.humanSupportNumber ? String(src.humanSupportNumber) : null;
    if (src.humanHandoffMessage     !== undefined) data.humanHandoffMessage     = src.humanHandoffMessage ? String(src.humanHandoffMessage) : null;
    if (src.humanNotificationNumber !== undefined) data.humanNotificationNumber = src.humanNotificationNumber ? String(src.humanNotificationNumber) : null;

    if (Object.keys(data).length) {
        await prisma.agent.update({ where: { id: agent.id }, data });
    }

    if (Array.isArray(src.allowedPhones)) {
        await prisma.whitelistPhone.deleteMany({ where: { agentId: agent.id } });
        for (const phone of src.allowedPhones as string[]) {
            await prisma.whitelistPhone.create({ data: { agentId: agent.id, phone } });
        }
    }

    if (Array.isArray(src.allowedGroups)) {
        await prisma.whitelistGroup.deleteMany({ where: { agentId: agent.id } });
        for (const groupId of src.allowedGroups as string[]) {
            await prisma.whitelistGroup.create({ data: { agentId: agent.id, groupId } });
        }
    }

    return res.json({ ok: true });
}

// ── PATCH /api/agent/toggle ───────────────────────────────────────────────────
export async function toggleAgent(req: AuthRequest, res: Response): Promise<Response> {
    const agent = await prisma.agent.findFirst({ where: { tenantId: req.tenantId } });
    if (!agent) return res.status(404).json({ error: 'Agente não encontrado' });
    await prisma.agent.update({ where: { id: agent.id }, data: { isActive: !agent.isActive } });
    return res.json({ isActive: !agent.isActive });
}
