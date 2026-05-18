import { Response, NextFunction, RequestHandler } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from './auth';

const BLOCKED_STATUSES = ['SUSPENDED', 'CANCELLED'];

export const requireActiveSubscription: RequestHandler = async (req, res, next) => {
    const tenantId = (req as AuthRequest).tenantId;
    if (!tenantId) { next(); return; }

    try {
        const sub = await prisma.subscription.findUnique({
            where: { tenantId },
            select: { status: true, trialEndsAt: true, planName: true },
        });

        if (!sub) { next(); return; } // sem subscription = trial não criado, deixa passar

        if (BLOCKED_STATUSES.includes(sub.status)) {
            res.status(402).json({
                error: 'Assinatura suspensa ou cancelada',
                subscriptionStatus: sub.status,
                code: 'SUBSCRIPTION_BLOCKED',
            });
            return;
        }

        // Trial expirado mas ainda não atualizado pelo cron
        if (sub.status === 'TRIAL' && sub.trialEndsAt && sub.trialEndsAt < new Date()) {
            res.status(402).json({
                error: 'Período de trial expirado',
                subscriptionStatus: 'TRIAL_EXPIRED',
                code: 'TRIAL_EXPIRED',
            });
            return;
        }

        next();
    } catch {
        next(); // falha silenciosa — não bloqueia por erro de infra
    }
};
