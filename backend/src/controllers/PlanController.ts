import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';

export async function listPlans(req: Request, res: Response): Promise<Response> {
    const plans = await prisma.plan.findMany({
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { subscriptions: true } } },
    });
    return res.json(plans);
}

export async function createPlan(req: Request, res: Response): Promise<Response> {
    const { name, description, basePrice, billingCycle } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome obrigatório' });
    const plan = await prisma.plan.create({
        data: { name, description: description || null, basePrice: Number(basePrice) || 0, billingCycle: billingCycle || 'monthly' },
    });
    return res.status(201).json(plan);
}

export async function updatePlan(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const { name, description, basePrice, billingCycle, isActive } = req.body;
    const plan = await prisma.plan.update({
        where: { id },
        data: {
            ...(name !== undefined ? { name } : {}),
            ...(description !== undefined ? { description: description || null } : {}),
            ...(basePrice !== undefined ? { basePrice: Number(basePrice) } : {}),
            ...(billingCycle !== undefined ? { billingCycle } : {}),
            ...(isActive !== undefined ? { isActive } : {}),
        },
    });
    return res.json(plan);
}

export async function deletePlan(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    await prisma.subscription.updateMany({ where: { planId: id }, data: { planId: null } });
    await prisma.plan.delete({ where: { id } });
    return res.status(204).send();
}

// ── Subscription adjustments ──────────────────────────────────────────────────

export async function listAdjustments(req: Request, res: Response): Promise<Response> {
    const { tenantId } = req.params;
    const sub = await prisma.subscription.findUnique({ where: { tenantId }, select: { id: true } });
    if (!sub) return res.status(404).json({ error: 'Assinatura não encontrada' });
    const adjustments = await prisma.subscriptionAdjustment.findMany({
        where: { subscriptionId: sub.id },
        orderBy: { createdAt: 'asc' },
    });
    return res.json(adjustments);
}

export async function addAdjustment(req: Request, res: Response): Promise<Response> {
    const { tenantId } = req.params;
    const { type, value, description } = req.body;
    if (!type || !['discount', 'increment'].includes(type)) return res.status(400).json({ error: 'type deve ser discount ou increment' });
    if (!value || !description) return res.status(400).json({ error: 'value e description obrigatórios' });

    let sub = await prisma.subscription.findUnique({ where: { tenantId }, select: { id: true } });
    if (!sub) {
        const created = await prisma.subscription.create({ data: { tenantId, status: 'TRIAL' } });
        sub = created;
    }
    const adj = await prisma.subscriptionAdjustment.create({
        data: { subscriptionId: sub.id, type, value: Number(value), description },
    });
    return res.status(201).json(adj);
}

export async function removeAdjustment(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    await prisma.subscriptionAdjustment.delete({ where: { id } });
    return res.status(204).send();
}

export async function updateAdjustment(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const { type } = req.body;
    if (!type || !['discount', 'increment'].includes(type)) return res.status(400).json({ error: 'type deve ser discount ou increment' });
    const adj = await prisma.subscriptionAdjustment.update({
        where: { id },
        data: { type },
    });
    return res.json(adj);
}

// ── AdminConfig ───────────────────────────────────────────────────────────────

export async function getAdminConfig(req: Request, res: Response): Promise<Response> {
    const config = await prisma.adminConfig.findUnique({ where: { id: 'main' } });
    if (!config) return res.json({ id: 'main', asaasApiKey: null, asaasBaseUrl: 'https://sandbox.asaas.com/api/v3', asaasWebhookSecret: null });
    return res.json({ ...config, asaasApiKey: config.asaasApiKey ? '***configured***' : null });
}

export async function upsertAdminConfig(req: Request, res: Response): Promise<Response> {
    const {
        asaasApiKey, asaasBaseUrl, asaasWebhookSecret,
        billingEnabled, billingDayOfMonth, billingDueDaysAhead,
        billingBillingType, billingWhatsappTemplate,
        billingEvolutionInstance, billingEvolutionApiKey, billingEvolutionBaseUrl,
    } = req.body;

    const update: Record<string, any> = {};
    if (asaasApiKey !== undefined && asaasApiKey !== '***configured***') update.asaasApiKey = asaasApiKey || null;
    if (asaasBaseUrl !== undefined) update.asaasBaseUrl = asaasBaseUrl;
    if (asaasWebhookSecret !== undefined && asaasWebhookSecret !== '***configured***') update.asaasWebhookSecret = asaasWebhookSecret || null;
    if (billingEnabled !== undefined) update.billingEnabled = Boolean(billingEnabled);
    if (billingDayOfMonth !== undefined) update.billingDayOfMonth = Number(billingDayOfMonth);
    if (billingDueDaysAhead !== undefined) update.billingDueDaysAhead = Number(billingDueDaysAhead);
    if (billingBillingType !== undefined) update.billingBillingType = billingBillingType;
    if (billingWhatsappTemplate !== undefined) update.billingWhatsappTemplate = billingWhatsappTemplate || null;
    if (billingEvolutionInstance !== undefined) update.billingEvolutionInstance = billingEvolutionInstance || null;
    if (billingEvolutionApiKey !== undefined && billingEvolutionApiKey !== '***configured***') update.billingEvolutionApiKey = billingEvolutionApiKey || null;
    if (billingEvolutionBaseUrl !== undefined) update.billingEvolutionBaseUrl = billingEvolutionBaseUrl || null;

    const config = await prisma.adminConfig.upsert({
        where: { id: 'main' },
        create: { id: 'main', asaasBaseUrl: 'https://sandbox.asaas.com/api/v3', ...update },
        update,
    });
    return res.json({ ...config, asaasApiKey: config.asaasApiKey ? '***configured***' : null, billingEvolutionApiKey: config.billingEvolutionApiKey ? '***configured***' : null });
}

// ── Billing runs ──────────────────────────────────────────────────────────────

export async function listBillingRuns(req: Request, res: Response): Promise<Response> {
    const { tenantId } = req.query as { tenantId?: string };
    const runs = await prisma.billingRun.findMany({
        where: tenantId ? { tenantId } : {},
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: { tenant: { select: { name: true, slug: true } } },
    });
    return res.json(runs);
}

export async function triggerBillingRun(req: Request, res: Response): Promise<Response> {
    const { tenantId, forceMonth } = req.body;
    try {
        const { runBillingCycle } = await import('../services/BillingCronService');
        const result = await runBillingCycle({ forceMonth, tenantId });
        return res.json(result);
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
}
