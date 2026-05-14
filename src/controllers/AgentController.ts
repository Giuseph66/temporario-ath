import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { prisma } from '../utils/prisma';

export async function getAgent(req: AuthRequest, res: Response): Promise<Response> {
    const agent = await prisma.agent.findFirst({ where: { tenantId: req.tenantId } });
    if (!agent) return res.status(404).json({ error: 'Agente não encontrado' });
    return res.json(agent);
}

export async function updatePersona(req: AuthRequest, res: Response): Promise<Response> {
    const { personaJson } = req.body as { personaJson: { name?: string; role?: string } };
    if (!personaJson || typeof personaJson !== 'object') {
        return res.status(400).json({ error: 'personaJson inválido' });
    }
    if (!personaJson.name || !personaJson.role) {
        return res.status(400).json({ error: 'persona precisa ter name e role' });
    }
    const agent = await prisma.agent.findFirst({ where: { tenantId: req.tenantId } });
    if (!agent) return res.status(404).json({ error: 'Agente não encontrado' });
    await prisma.agent.update({ where: { id: agent.id }, data: { personaJson: personaJson as object } });
    return res.json({ ok: true });
}

export async function updatePrograms(req: AuthRequest, res: Response): Promise<Response> {
    const { programsJson } = req.body as { programsJson: { programs?: unknown[] } };
    if (!programsJson || !Array.isArray(programsJson.programs)) {
        return res.status(400).json({ error: 'programsJson deve ter campo programs[]' });
    }
    const agent = await prisma.agent.findFirst({ where: { tenantId: req.tenantId } });
    if (!agent) return res.status(404).json({ error: 'Agente não encontrado' });
    await prisma.agent.update({ where: { id: agent.id }, data: { programsJson: programsJson as object } });
    return res.json({ ok: true });
}

export async function updateSettings(req: AuthRequest, res: Response): Promise<Response> {
    const { settingsJson } = req.body as { settingsJson: Record<string, unknown> };
    if (!settingsJson || typeof settingsJson !== 'object') {
        return res.status(400).json({ error: 'settingsJson inválido' });
    }
    const agent = await prisma.agent.findFirst({ where: { tenantId: req.tenantId } });
    if (!agent) return res.status(404).json({ error: 'Agente não encontrado' });
    await prisma.agent.update({ where: { id: agent.id }, data: { settingsJson: settingsJson as object } });
    return res.json({ ok: true });
}

export async function toggleAgent(req: AuthRequest, res: Response): Promise<Response> {
    const agent = await prisma.agent.findFirst({ where: { tenantId: req.tenantId } });
    if (!agent) return res.status(404).json({ error: 'Agente não encontrado' });
    await prisma.agent.update({ where: { id: agent.id }, data: { isActive: !agent.isActive } });
    return res.json({ isActive: !agent.isActive });
}
