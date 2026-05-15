import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { prisma } from '../utils/prisma';
import { googleCalendarIntegrationService } from '../services/GoogleCalendarIntegrationService';

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

const REVEAL_ALLOWLIST = new Set<keyof IntegrationFields>([
    'geminiApiKey', 'evolutionApiKey', 'asaasApiKey', 'asaasWebhookSecret',
    'metaAccessToken', 'metaPhoneId', 'metaVerifyToken', 'googleCalendarId',
    'evolutionBaseUrl', 'evolutionInstance',
]);

export async function revealIntegrationField(req: AuthRequest, res: Response): Promise<Response> {
    const field = req.query.field as string;
    if (!field || !REVEAL_ALLOWLIST.has(field as keyof IntegrationFields)) {
        return res.status(400).json({ error: 'Campo inválido' });
    }
    const tenant = await prisma.tenant.findUnique({
        where: { id: req.tenantId },
        select: { [field]: true } as any,
    });
    if (!tenant) return res.status(404).json({ error: 'Tenant não encontrado' });
    return res.json({ value: (tenant as any)[field] ?? null });
}

export async function getIntegrations(req: AuthRequest, res: Response): Promise<Response> {
    const [t, calendar] = await Promise.all([
        prisma.tenant.findUnique({
        where: { id: req.tenantId },
        select: {
            evolutionApiKey: true, evolutionBaseUrl: true, evolutionInstance: true,
            asaasApiKey: true, asaasBaseUrl: true, asaasWebhookSecret: true,
            metaAccessToken: true, metaPhoneId: true, metaVerifyToken: true,
            googleCalendarId: true,
        },
        }),
        googleCalendarIntegrationService.getStatus({ tenantId: req.tenantId, userId: req.userId }),
    ]);
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
            configured: calendar.connected,
            connected: calendar.connected,
            status: calendar.status,
            email: calendar.email,
            scopes: calendar.scopes,
            connectedAt: calendar.connectedAt,
            revokedAt: calendar.revokedAt,
            message: calendar.message,
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
