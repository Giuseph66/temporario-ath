import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { prisma } from '../utils/prisma';

export async function listLeads(req: AuthRequest, res: Response): Promise<Response> {
    const { state, search, page = '1', limit = '30' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: Record<string, unknown> = { tenantId: req.tenantId };
    if (state) where.conversationState = state;
    if (search) {
        where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { phoneNumber: { contains: search } },
        ];
    }

    const [leads, total] = await Promise.all([
        prisma.user.findMany({
            where: where as object,
            orderBy: { lastInteraction: 'desc' },
            take: parseInt(limit),
            skip,
            select: {
                id: true, name: true, phoneNumber: true, conversationState: true,
                currentProgramId: true, enrollmentStatus: true, lastInteraction: true,
                interactionCount: true, lgpdConsent: true,
            },
        }),
        prisma.user.count({ where: where as object }),
    ]);

    return res.json({ leads, total, page: parseInt(page), limit: parseInt(limit) });
}

export async function getLead(req: AuthRequest, res: Response): Promise<Response> {
    const lead = await prisma.user.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId },
        include: {
            messages: { orderBy: { createdAt: 'asc' }, take: 50 },
        },
    });
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });
    return res.json(lead);
}

export async function listConversations(req: AuthRequest, res: Response): Promise<Response> {
    const leads = await prisma.user.findMany({
        where: { tenantId: req.tenantId },
        orderBy: { lastInteraction: 'desc' },
        take: 50,
        select: {
            id: true, name: true, phoneNumber: true, conversationState: true,
            lastInteraction: true, enrollmentStatus: true,
            messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
    });
    return res.json(leads);
}

export async function updateLeadState(req: AuthRequest, res: Response): Promise<Response> {
    const { state } = req.body as { state: string };
    const validStates = ['GREETING', 'QUALIFICATION', 'PROGRAM_PRESENTATION', 'OBJECTION_HANDLING', 'CLOSING', 'HUMAN_HANDOFF'];
    if (!validStates.includes(state)) return res.status(400).json({ error: 'Estado inválido' });

    const lead = await prisma.user.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

    await prisma.user.update({ where: { id: req.params.id }, data: { conversationState: state } });
    return res.json({ ok: true });
}

export async function deleteLead(req: AuthRequest, res: Response): Promise<Response> {
    const lead = await prisma.user.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

    await prisma.user.delete({ where: { id: req.params.id } });
    return res.json({ ok: true });
}
