import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { prisma } from '../utils/prisma';

export async function listSessions(req: AuthRequest, res: Response): Promise<void> {
    const sessions = await prisma.simulatorSession.findMany({
        where: { tenantId: req.tenantId },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, title: true, agentType: true, convState: true, simMode: true, createdAt: true, updatedAt: true },
    });
    res.json(sessions);
}

export async function getSession(req: AuthRequest, res: Response): Promise<void> {
    const session = await prisma.simulatorSession.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (!session) { res.status(404).json({ error: 'Sessão não encontrada' }); return; }
    res.json(session);
}

export async function createSession(req: AuthRequest, res: Response): Promise<void> {
    const { title, agentType, convState, simMode } = req.body ?? {};
    const session = await prisma.simulatorSession.create({
        data: {
            tenantId: req.tenantId,
            title: title ?? 'Nova sessão',
            agentType: agentType ?? 'atendente',
            convState: convState ?? 'GREETING',
            simMode: simMode ?? 'cliente',
            messages: [],
        },
    });
    res.status(201).json(session);
}

export async function updateSession(req: AuthRequest, res: Response): Promise<void> {
    const { title, agentType, convState, simMode, messages } = req.body ?? {};

    const session = await prisma.simulatorSession.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (!session) { res.status(404).json({ error: 'Sessão não encontrada' }); return; }

    const updated = await prisma.simulatorSession.update({
        where: { id: req.params.id },
        data: {
            ...(title     !== undefined && { title }),
            ...(agentType !== undefined && { agentType }),
            ...(convState !== undefined && { convState }),
            ...(simMode   !== undefined && { simMode }),
            ...(messages  !== undefined && { messages }),
        },
    });
    res.json(updated);
}

export async function deleteSession(req: AuthRequest, res: Response): Promise<void> {
    const session = await prisma.simulatorSession.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (!session) { res.status(404).json({ error: 'Sessão não encontrada' }); return; }
    await prisma.simulatorSession.delete({ where: { id: req.params.id } });
    res.status(204).end();
}
