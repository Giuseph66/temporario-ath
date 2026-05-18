import { prisma } from '../utils/prisma';

export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'OVERDUE' | 'SUSPENDED' | 'CANCELLED';

const TRIAL_DAYS = parseInt(process.env.TRIAL_DAYS ?? '14', 10);

export async function createTrialSubscription(tenantId: string): Promise<void> {
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);

    await prisma.subscription.upsert({
        where: { tenantId },
        create: {
            tenantId,
            status: 'TRIAL',
            planName: 'starter',
            priceMonthly: 0,
            trialEndsAt,
            currentPeriodStart: new Date(),
            currentPeriodEnd: trialEndsAt,
        },
        update: {},
    });
}

export async function updateSubscriptionStatus(
    tenantId: string,
    status: SubscriptionStatus,
    extras?: { asaasCustomerId?: string; asaasSubscriptionId?: string; currentPeriodEnd?: Date }
): Promise<void> {
    await prisma.subscription.upsert({
        where: { tenantId },
        create: {
            tenantId,
            status,
            planName: 'starter',
            currentPeriodStart: new Date(),
            ...extras,
        },
        update: {
            status,
            updatedAt: new Date(),
            ...(extras?.asaasCustomerId ? { asaasCustomerId: extras.asaasCustomerId } : {}),
            ...(extras?.asaasSubscriptionId ? { asaasSubscriptionId: extras.asaasSubscriptionId } : {}),
            ...(extras?.currentPeriodEnd ? { currentPeriodEnd: extras.currentPeriodEnd } : {}),
            ...(status === 'CANCELLED' ? { cancelledAt: new Date() } : {}),
        },
    });

    // Sync tenant isActive based on subscription status
    const isActive = status === 'TRIAL' || status === 'ACTIVE';
    await prisma.tenant.update({ where: { id: tenantId }, data: { isActive } });
}

export async function getSubscription(tenantId: string) {
    return prisma.subscription.findUnique({ where: { tenantId } });
}

export async function checkTrialExpiry(): Promise<void> {
    const expired = await prisma.subscription.findMany({
        where: {
            status: 'TRIAL',
            trialEndsAt: { lt: new Date() },
        },
        select: { tenantId: true },
    });

    for (const sub of expired) {
        await updateSubscriptionStatus(sub.tenantId, 'SUSPENDED');
        console.log(`[Subscription] Trial expirado → suspenso: ${sub.tenantId}`);
    }
}
