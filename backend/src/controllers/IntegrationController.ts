import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { prisma } from '../utils/prisma';

type IntegrationFields = {
    geminiApiKey?: string;
    evolutionApiKey?: string;
    evolutionBaseUrl?: string;
    evolutionInstance?: string;
    asaasApiKey?: string;
    asaasBaseUrl?: string;
    asaasWebhookSecret?: string;
    metaAccessToken?: string;
    metaPhoneId?: string;
    metaVerifyToken?: string;
    googleCalendarId?: string;
};

function mask(val: string | null | undefined): string | null {
    return val ? '••••••••' : null;
}

export async function getIntegrations(req: AuthRequest, res: Response): Promise<Response> {
    const t = await prisma.tenant.findUnique({
        where: { id: req.tenantId },
        select: {
            evolutionApiKey: true, evolutionBaseUrl: true, evolutionInstance: true,
            asaasApiKey: true, asaasBaseUrl: true, asaasWebhookSecret: true,
            metaAccessToken: true, metaPhoneId: true, metaVerifyToken: true,
            googleCalendarId: true,
        },
    });
    if (!t) return res.status(404).json({ error: 'Tenant não encontrado' });

    return res.json({
        evolution: {
            configured: !!(t.evolutionApiKey && t.evolutionBaseUrl),
            baseUrl: t.evolutionBaseUrl ?? null,
            instance: t.evolutionInstance ?? null,
            apiKey: mask(t.evolutionApiKey),
        },
        asaas: {
            configured: !!t.asaasApiKey,
            baseUrl: t.asaasBaseUrl ?? 'https://sandbox.asaas.com/api/v3',
            sandbox: (t.asaasBaseUrl ?? '').includes('sandbox'),
            apiKey: mask(t.asaasApiKey),
            webhookSecret: mask(t.asaasWebhookSecret),
        },
        meta: {
            configured: !!(t.metaAccessToken && t.metaPhoneId),
            phoneId: t.metaPhoneId ?? null,
            accessToken: mask(t.metaAccessToken),
            verifyToken: mask(t.metaVerifyToken),
        },
        calendar: {
            configured: !!t.googleCalendarId,
            calendarId: t.googleCalendarId ?? null,
        },
    });
}

async function patchTenant(req: AuthRequest, res: Response, allowed: (keyof IntegrationFields)[]): Promise<Response> {
    const body = req.body as IntegrationFields;
    const data: Record<string, string | null> = {};

    for (const key of allowed) {
        if (body[key] !== undefined) {
            const val = (body[key] as string).trim();
            data[key] = val || null;
        }
    }

    if (Object.keys(data).length === 0) {
        return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    await prisma.tenant.update({ where: { id: req.tenantId }, data });
    return res.json({ ok: true });
}

export async function updateEvolutionIntegration(req: AuthRequest, res: Response): Promise<Response> {
    return patchTenant(req, res, ['evolutionApiKey', 'evolutionBaseUrl', 'evolutionInstance']);
}

export async function updateAsaasIntegration(req: AuthRequest, res: Response): Promise<Response> {
    return patchTenant(req, res, ['asaasApiKey', 'asaasBaseUrl', 'asaasWebhookSecret']);
}

export async function updateMetaIntegration(req: AuthRequest, res: Response): Promise<Response> {
    return patchTenant(req, res, ['metaAccessToken', 'metaPhoneId', 'metaVerifyToken']);
}

export async function updateCalendarIntegration(req: AuthRequest, res: Response): Promise<Response> {
    return patchTenant(req, res, ['googleCalendarId']);
}
