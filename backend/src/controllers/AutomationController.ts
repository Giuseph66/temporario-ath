import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { prisma } from '../utils/prisma';
import { automationService } from '../services/AutomationService';

const db = prisma as any;

function asObject(value: unknown): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

async function getResponseStats(automationId: string) {
    const sentTargets = await db.automationTargetRun.findMany({
        where: { automationId, status: 'SENT', userId: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: 500,
        select: { userId: true, createdAt: true },
    });

    if (sentTargets.length === 0) {
        return { sentTotal: 0, responseCount: 0, responseRate: null };
    }

    let responseCount = 0;
    for (const target of sentTargets) {
        const response = await db.chatHistory.findFirst({
            where: {
                userId: target.userId,
                role: 'user',
                createdAt: { gt: target.createdAt },
            },
            select: { id: true },
        });
        if (response) responseCount++;
    }

    return {
        sentTotal: sentTargets.length,
        responseCount,
        responseRate: Math.round((responseCount / sentTargets.length) * 100),
    };
}

async function buildCreateData(tenantId: string, body: Record<string, any>) {
    const name = String(body.name ?? '').trim();
    const type = String(body.type ?? 'INACTIVITY');
    const triggerType = String(body.triggerType ?? (type === 'EVENT' ? 'EVENT' : 'TIME'));
    const scheduleJson = asObject(body.schedule);
    const targetJson = asObject(body.target);
    const conditionsJson = asObject(body.conditions);
    const actionJson = asObject(body.action);
    const limitsJson = asObject(body.limits);

    if (!name) throw new Error('Nome obrigatório.');
    if (!actionJson.messageTemplate && !actionJson.aiPrompt && !actionJson.internalNote && !actionJson.updateLead) {
        throw new Error('Configure pelo menos uma ação.');
    }

    const estimatedTargets = await automationService.estimateTargets(tenantId, targetJson, conditionsJson);
    const requiresApproval = Boolean(body.requiresApproval) || (type === 'MANUAL' && estimatedTargets > 20);
    const status = requiresApproval ? 'PENDING_APPROVAL' : String(body.status ?? 'ACTIVE');
    const nextRunAt = status === 'ACTIVE'
        ? automationService.buildNextRunAt({ type, triggerType, scheduleJson })
        : null;

    return {
        tenantId,
        name,
        type,
        status,
        triggerType,
        scheduleJson,
        targetJson,
        conditionsJson,
        actionJson,
        limitsJson,
        requiresApproval,
        nextRunAt,
    };
}

export async function listAutomations(req: AuthRequest, res: Response): Promise<Response> {
    const automations = await db.automation.findMany({
        where: { tenantId: req.tenantId },
        orderBy: { createdAt: 'desc' },
        include: {
            runs: {
                orderBy: { startedAt: 'desc' },
                take: 1,
            },
            _count: { select: { runs: true, targetRuns: true } },
        },
    });

    return res.json(await Promise.all(automations.map(async (automation: any) => {
        const lastRun = automation.runs?.[0] ?? null;
        const responseStats = await getResponseStats(automation.id);
        return {
            ...automation,
            lastRun,
            responseStats,
            runs: undefined,
        };
    })));
}

export async function getAutomation(req: AuthRequest, res: Response): Promise<Response> {
    const automation = await db.automation.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId },
        include: {
            runs: {
                orderBy: { startedAt: 'desc' },
                take: 20,
                include: {
                    targets: {
                        orderBy: { createdAt: 'desc' },
                        take: 100,
                        include: {
                            user: {
                                select: { id: true, name: true, phoneNumber: true, enrollmentStatus: true },
                            },
                        },
                    },
                },
            },
        },
    });
    if (!automation) return res.status(404).json({ error: 'Automação não encontrada.' });
    return res.json(automation);
}

export async function createAutomation(req: AuthRequest, res: Response): Promise<Response> {
    try {
        const data = await buildCreateData(req.tenantId!, req.body as Record<string, any>);
        const automation = await db.automation.create({ data });
        return res.json(automation);
    } catch (err) {
        return res.status(400).json({ error: err instanceof Error ? err.message : 'Falha ao criar automação.' });
    }
}

export async function updateAutomation(req: AuthRequest, res: Response): Promise<Response> {
    const automation = await db.automation.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!automation) return res.status(404).json({ error: 'Automação não encontrada.' });

    const body = req.body as Record<string, any>;
    const data: Record<string, any> = {};
    if (body.name !== undefined) data.name = String(body.name).trim();
    if (body.type !== undefined) data.type = String(body.type);
    if (body.triggerType !== undefined) data.triggerType = String(body.triggerType);
    if (body.schedule !== undefined) data.scheduleJson = asObject(body.schedule);
    if (body.target !== undefined) data.targetJson = asObject(body.target);
    if (body.conditions !== undefined) data.conditionsJson = asObject(body.conditions);
    if (body.action !== undefined) data.actionJson = asObject(body.action);
    if (body.limits !== undefined) data.limitsJson = asObject(body.limits);
    if (body.requiresApproval !== undefined) data.requiresApproval = Boolean(body.requiresApproval);

    if (automation.status === 'ACTIVE') {
        data.nextRunAt = automationService.buildNextRunAt({
            type: data.type ?? automation.type,
            triggerType: data.triggerType ?? automation.triggerType,
            scheduleJson: data.scheduleJson ?? automation.scheduleJson,
        });
    }

    const updated = await db.automation.update({ where: { id: automation.id }, data });
    return res.json(updated);
}

export async function pauseAutomation(req: AuthRequest, res: Response): Promise<Response> {
    const automation = await db.automation.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!automation) return res.status(404).json({ error: 'Automação não encontrada.' });
    const updated = await db.automation.update({ where: { id: automation.id }, data: { status: 'PAUSED', nextRunAt: null } });
    return res.json(updated);
}

export async function resumeAutomation(req: AuthRequest, res: Response): Promise<Response> {
    const automation = await db.automation.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!automation) return res.status(404).json({ error: 'Automação não encontrada.' });
    if (automation.status === 'PENDING_APPROVAL' || automation.requiresApproval) {
        return res.status(400).json({ error: 'Automação pendente de aprovação. Use a ação Aprovar.' });
    }
    const nextRunAt = automationService.buildNextRunAt(automation);
    const updated = await db.automation.update({ where: { id: automation.id }, data: { status: 'ACTIVE', nextRunAt } });
    return res.json(updated);
}

export async function approveAutomation(req: AuthRequest, res: Response): Promise<Response> {
    const automation = await db.automation.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!automation) return res.status(404).json({ error: 'Automação não encontrada.' });
    const nextRunAt = automationService.buildNextRunAt(automation);
    const updated = await db.automation.update({
        where: { id: automation.id },
        data: { status: 'ACTIVE', requiresApproval: false, nextRunAt },
    });
    return res.json(updated);
}

export async function runAutomation(req: AuthRequest, res: Response): Promise<Response> {
    const automation = await db.automation.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!automation) return res.status(404).json({ error: 'Automação não encontrada.' });
    try {
        const result = await automationService.executeAutomation(automation.id, { source: 'manual', userId: req.userId });
        return res.json(result);
    } catch (err) {
        return res.status(400).json({ error: err instanceof Error ? err.message : 'Falha ao executar automação.' });
    }
}
