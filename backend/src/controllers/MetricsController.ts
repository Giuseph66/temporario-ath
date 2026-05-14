import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { prisma } from '../utils/prisma';

export async function getMetrics(req: AuthRequest, res: Response): Promise<Response> {
    const tenantId = req.tenantId;
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
        totalLeads,
        conversas24h,
        enrolledCount,
        paymentPending,
        stateDistribution,
        recentEnrollments,
    ] = await Promise.all([
        prisma.user.count({ where: { tenantId } }),
        prisma.user.count({ where: { tenantId, lastInteraction: { gte: last24h } } }),
        prisma.user.count({ where: { tenantId, enrollmentStatus: 'ENROLLED' } }),
        prisma.user.count({ where: { tenantId, enrollmentStatus: 'PAYMENT_PENDING' } }),
        prisma.user.groupBy({
            by: ['conversationState'],
            where: { tenantId },
            _count: { _all: true },
        }),
        prisma.user.findMany({
            where: { tenantId, enrollmentStatus: 'ENROLLED' },
            orderBy: { enrollmentDate: 'desc' },
            take: 5,
            select: { name: true, phoneNumber: true, enrollmentDate: true, currentProgramId: true },
        }),
    ]);

    const conversionRate = totalLeads > 0
        ? Math.round((enrolledCount / totalLeads) * 100)
        : 0;

    return res.json({
        totalLeads,
        conversas24h,
        enrolledCount,
        paymentPending,
        conversionRate,
        stateDistribution: stateDistribution.map(s => ({
            state: s.conversationState,
            count: s._count._all,
        })),
        recentEnrollments,
    });
}
