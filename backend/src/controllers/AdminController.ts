import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import * as jwt from 'jsonwebtoken';
import { updateSubscriptionStatus, SubscriptionStatus } from '../services/SubscriptionService';
import { createAsaasCustomer, createAsaasSubscription, listAsaasCharges, createAsaasCharge, deleteAsaasCharge } from '../services/AsaasAdminService';

export async function adminAsaasCreateCustomer(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    try {
        const result = await createAsaasCustomer(id);
        return res.json(result);
    } catch (err: any) {
        const msg: Record<string, string> = {
            NO_COMPANY_LINKED: 'Nenhuma empresa vinculada a este cliente.',
            NO_DOCUMENT: 'Empresa sem CPF/CNPJ cadastrado.',
            ASAAS_NOT_CONFIGURED: 'Asaas não configurado. Configure a API Key em Configurações → Asaas.',
        };
        return res.status(400).json({ error: msg[err.message] ?? `Erro Asaas: ${err.response?.data?.errors?.[0]?.description ?? err.message}` });
    }
}

export async function adminAsaasCreateCharge(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const { billingType, value, dueDate, description } = req.body;
    if (!billingType || !value || !dueDate) return res.status(400).json({ error: 'billingType, value e dueDate obrigatórios' });
    try {
        const data = await createAsaasCharge(id, { billingType, value: Number(value), dueDate, description });
        return res.json(data);
    } catch (err: any) {
        const msg: Record<string, string> = {
            NO_CUSTOMER_ID: 'Cliente sem Customer ID. Crie o cliente no Asaas primeiro.',
            INVALID_PRICE: 'Valor deve ser maior que zero.',
            ASAAS_NOT_CONFIGURED: 'Asaas não configurado.',
        };
        return res.status(400).json({ error: msg[err.message] ?? `Erro Asaas: ${err.response?.data?.errors?.[0]?.description ?? err.message}` });
    }
}

export async function adminAsaasDeleteCharge(req: Request, res: Response): Promise<Response> {
    const { chargeId } = req.params;
    try {
        await deleteAsaasCharge(chargeId);
        return res.status(204).send();
    } catch (err: any) {
        return res.status(400).json({ error: `Erro Asaas: ${err.response?.data?.errors?.[0]?.description ?? err.message}` });
    }
}

export async function adminAsaasListCharges(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    try {
        const data = await listAsaasCharges(id);
        return res.json(data);
    } catch (err: any) {
        const msg: Record<string, string> = {
            NO_ASAAS_IDS: 'Nenhum Customer ID ou Subscription ID cadastrado.',
            ASAAS_NOT_CONFIGURED: 'Asaas não configurado.',
        };
        return res.status(400).json({ error: msg[err.message] ?? `Erro Asaas: ${err.response?.data?.errors?.[0]?.description ?? err.message}` });
    }
}

export async function adminAsaasCreateSubscription(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const { billingType, nextDueDate } = req.body;
    if (!billingType || !nextDueDate) return res.status(400).json({ error: 'billingType e nextDueDate obrigatórios' });
    try {
        const result = await createAsaasSubscription(id, { billingType, nextDueDate });
        return res.json(result);
    } catch (err: any) {
        const msg: Record<string, string> = {
            NO_CUSTOMER_ID: 'Crie o cliente no Asaas primeiro.',
            INVALID_PRICE: 'Defina um valor de assinatura maior que zero.',
            ASAAS_NOT_CONFIGURED: 'Asaas não configurado.',
        };
        return res.status(400).json({ error: msg[err.message] ?? `Erro Asaas: ${err.response?.data?.errors?.[0]?.description ?? err.message}` });
    }
}

// ── List all tenants with subscription + metrics ──────────────────────────────
export async function listTenants(req: Request, res: Response): Promise<Response> {
    const tenants = await prisma.tenant.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
            id: true, name: true, slug: true, plan: true, isActive: true, createdAt: true,
            subscription: {
                select: { status: true, planId: true, planName: true, priceMonthly: true, trialEndsAt: true, currentPeriodEnd: true, asaasCustomerId: true, asaasSubscriptionId: true },
            },
            company: { select: { id: true, name: true } },
            tenantUsers: { select: { email: true, role: true, lastLoginAt: true }, orderBy: { createdAt: 'asc' }, take: 1 },
            _count: { select: { users: true, agents: true } },
        },
    });

    return res.json(tenants);
}

// ── Get single tenant detail ──────────────────────────────────────────────────
export async function getTenantDetail(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;

    const tenant = await prisma.tenant.findUnique({
        where: { id },
        select: {
            id: true, name: true, slug: true, plan: true, isActive: true,
            evolutionInstance: true, createdAt: true,
            subscription: true,
            tenantUsers: { select: { id: true, email: true, role: true, lastLoginAt: true, createdAt: true } },
            _count: { select: { users: true, agents: true } },
        },
    });

    if (!tenant) return res.status(404).json({ error: 'Tenant não encontrado' });

    // AI usage last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const aiUsage = await prisma.geminiUsageEvent.aggregate({
        where: { tenantId: id, createdAt: { gte: thirtyDaysAgo } },
        _sum: { totalTokens: true, estimatedCostBrl: true },
        _count: { id: true },
    });

    // Last 5 conversations
    const recentLeads = await prisma.user.findMany({
        where: { tenantId: id },
        orderBy: { lastInteraction: 'desc' },
        take: 5,
        select: { id: true, name: true, phoneNumber: true, conversationState: true, lastInteraction: true, enrollmentStatus: true },
    });

    return res.json({
        ...tenant,
        aiUsage30d: {
            tokens: aiUsage._sum.totalTokens ?? 0,
            costBrl: Number(aiUsage._sum.estimatedCostBrl ?? 0).toFixed(2),
            events: aiUsage._count.id,
        },
        recentLeads,
    });
}

// ── Update tenant subscription ────────────────────────────────────────────────
export async function patchTenantSubscription(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const { status, planId, planName, priceMonthly, trialEndsAt, currentPeriodEnd, asaasCustomerId, asaasSubscriptionId } = req.body;

    const tenant = await prisma.tenant.findUnique({ where: { id }, select: { id: true } });
    if (!tenant) return res.status(404).json({ error: 'Usuário não encontrado' });

    // Ensure subscription exists
    const existingSub = await prisma.subscription.findUnique({ where: { tenantId: id } });
    if (!existingSub) {
        await prisma.subscription.create({ data: { tenantId: id, status: status ?? 'TRIAL', planId: planId || null, planName: planName ?? 'starter', priceMonthly: priceMonthly ? Number(priceMonthly) : 0 } });
    }

    if (status) {
        await updateSubscriptionStatus(id, status as SubscriptionStatus, {
            asaasCustomerId,
            asaasSubscriptionId,
            currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd) : undefined,
        });
    }

    const updateData: Record<string, any> = {};
    if (planId !== undefined) updateData.planId = planId || null;
    if (planName !== undefined) updateData.planName = planName;
    if (priceMonthly !== undefined) updateData.priceMonthly = Number(priceMonthly);
    if (trialEndsAt !== undefined) updateData.trialEndsAt = trialEndsAt ? new Date(trialEndsAt) : null;
    if (currentPeriodEnd !== undefined && !status) updateData.currentPeriodEnd = currentPeriodEnd ? new Date(currentPeriodEnd) : null;
    if (asaasCustomerId !== undefined) updateData.asaasCustomerId = asaasCustomerId || null;
    if (asaasSubscriptionId !== undefined) updateData.asaasSubscriptionId = asaasSubscriptionId || null;

    if (Object.keys(updateData).length > 0) {
        await prisma.subscription.update({ where: { tenantId: id }, data: updateData });
    }

    const updated = await prisma.subscription.findUnique({ where: { tenantId: id } });
    return res.json(updated);
}

// ── Toggle tenant active ──────────────────────────────────────────────────────
export async function toggleTenantActive(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') return res.status(400).json({ error: 'isActive (boolean) obrigatório' });

    const tenant = await prisma.tenant.update({
        where: { id },
        data: { isActive },
        select: { id: true, name: true, isActive: true },
    });

    return res.json(tenant);
}

// ── Impersonate tenant — generates short-lived token ─────────────────────────
export async function impersonateTenant(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;

    const tenantUser = await prisma.tenantUser.findFirst({
        where: { tenantId: id, role: 'owner' },
        select: { id: true, email: true, tenantId: true },
    });

    if (!tenantUser) return res.status(404).json({ error: 'Owner do tenant não encontrado' });

    const token = jwt.sign(
        { tenantId: id, userId: tenantUser.id, impersonatedByAdmin: true },
        process.env.JWT_ACCESS_SECRET!,
        { expiresIn: '1h' }
    );

    return res.json({
        accessToken: token,
        expiresIn: 3600,
        tenant: { id, ownerEmail: tenantUser.email },
        warning: 'Token de impersonação — expira em 1h. Não compartilhe.',
    });
}

// ── Platform-wide metrics ─────────────────────────────────────────────────────
export async function getAdminMetrics(req: Request, res: Response): Promise<Response> {
    const [
        totalTenants,
        activeSubs,
        trialSubs,
        suspendedSubs,
        cancelledSubs,
        totalLeads,
        aiUsageTotal,
        newThisMonth,
    ] = await Promise.all([
        prisma.tenant.count(),
        prisma.subscription.count({ where: { status: 'ACTIVE' } }),
        prisma.subscription.count({ where: { status: 'TRIAL' } }),
        prisma.subscription.count({ where: { status: 'SUSPENDED' } }),
        prisma.subscription.count({ where: { status: 'CANCELLED' } }),
        prisma.user.count({ where: { isGroup: false } }),
        prisma.geminiUsageEvent.aggregate({
            _sum: { estimatedCostBrl: true, totalTokens: true },
        }),
        prisma.tenant.count({
            where: { createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } },
        }),
    ]);

    const activePlans = await prisma.subscription.groupBy({
        by: ['planName'],
        where: { status: 'ACTIVE' },
        _count: { planName: true },
        _sum: { priceMonthly: true },
    });

    const mrr = activePlans.reduce((acc, p) => acc + (p._sum.priceMonthly ?? 0), 0);

    return res.json({
        tenants: { total: totalTenants, newThisMonth },
        subscriptions: { active: activeSubs, trial: trialSubs, suspended: suspendedSubs, cancelled: cancelledSubs },
        mrr: mrr.toFixed(2),
        leads: { total: totalLeads },
        ai: {
            totalTokens: aiUsageTotal._sum.totalTokens ?? 0,
            totalCostBrl: Number(aiUsageTotal._sum.estimatedCostBrl ?? 0).toFixed(2),
        },
        planBreakdown: activePlans.map(p => ({
            plan: p.planName,
            count: p._count.planName,
            revenue: (p._sum.priceMonthly ?? 0).toFixed(2),
        })),
    });
}

// ── Tenant billing summary (for tenant-facing view) ──────────────────────────
export async function getTenantBilling(req: Request, res: Response): Promise<Response> {
    const tenantId = (req as any).tenantId as string;

    const sub = await prisma.subscription.findUnique({ where: { tenantId } });
    if (!sub) return res.status(404).json({ error: 'Assinatura não encontrada' });

    return res.json({
        status: sub.status,
        planName: sub.planName,
        priceMonthly: sub.priceMonthly,
        trialEndsAt: sub.trialEndsAt,
        currentPeriodEnd: sub.currentPeriodEnd,
        createdAt: sub.createdAt,
    });
}
