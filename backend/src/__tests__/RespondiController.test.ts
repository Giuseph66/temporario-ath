import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';

// Mock prisma before importing controller
vi.mock('../utils/prisma', () => ({
    prisma: {
        user: {
            findUnique: vi.fn(),
            findFirst: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
        },
    },
}));

vi.mock('../utils/phoneNormalizer', () => ({
    normalizeBrazilianPhone: (phone: string) => {
        const digits = phone.replace(/\D/g, '');
        if (!digits.startsWith('55')) return '55' + digits;
        if (digits.length === 12) {
            return digits.slice(0, 4) + '9' + digits.slice(4);
        }
        return digits;
    },
}));

import { handleRespondiWebhook } from '../controllers/RespondiController';
import { prisma } from '../utils/prisma';

function makeReq(overrides: Partial<Request> = {}): Request {
    return {
        query: { token: 'test-secret' },
        body: {
            respondent: {
                answers: {
                    'WhatsApp': { country: '55', phone: '66999999999' },
                    'Nome completo': 'João Silva',
                    'Qual o CPF do cadastro?': '12345678900',
                    'email': 'joao@example.com',
                    'consentimento LGPD': 'sim',
                },
                raw_answers: [],
            },
        },
        headers: {},
        ...overrides,
    } as unknown as Request;
}

function makeRes(): Response {
    const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
        sendStatus: vi.fn().mockReturnThis(),
    };
    return res as unknown as Response;
}

describe('RespondiController', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.RESPONDI_WEBHOOK_SECRET = 'test-secret';
    });

    it('token ausente retorna 401', async () => {
        const req = makeReq({ query: {} } as any);
        const res = makeRes();
        await handleRespondiWebhook(req, res);
        expect(res.status).toHaveBeenCalledWith(401);
    });

    it('token inválido retorna 401', async () => {
        const req = makeReq({ query: { token: 'wrong' } } as any);
        const res = makeRes();
        await handleRespondiWebhook(req, res);
        expect(res.status).toHaveBeenCalledWith(401);
    });

    it('lgpdConsent = true quando resposta for "sim"', async () => {
        const mockCreate = vi.mocked(prisma.user.create);
        mockCreate.mockResolvedValue({ id: 'abc123' } as any);
        vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

        const req = makeReq();
        const res = makeRes();
        await handleRespondiWebhook(req, res);

        const callArgs = mockCreate.mock.calls[0]?.[0];
        expect(callArgs?.data?.lgpdConsent).toBe(true);
    });

    it('usuário existente → update (não cria duplicata)', async () => {
        const mockUpdate = vi.mocked(prisma.user.update);
        vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'existing-id', phoneNumber: '5566999999999' } as any);
        mockUpdate.mockResolvedValue({ id: 'existing-id' } as any);

        const req = makeReq();
        const res = makeRes();
        await handleRespondiWebhook(req, res);

        expect(mockUpdate).toHaveBeenCalled();
        expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('CPF é salvo apenas com dígitos', async () => {
        const mockCreate = vi.mocked(prisma.user.create);
        mockCreate.mockResolvedValue({ id: 'abc' } as any);
        vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

        const req = makeReq();
        const res = makeRes();
        await handleRespondiWebhook(req, res);

        const callArgs = mockCreate.mock.calls[0]?.[0];
        expect(callArgs?.data?.cpf).toMatch(/^\d+$/);
    });
});
