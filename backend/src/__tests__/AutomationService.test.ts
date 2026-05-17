import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    sendText: vi.fn(),
    generateAutomationMessage: vi.fn(),
}));

vi.mock('../utils/prisma', () => ({
    prisma: {
        tenant: { findUnique: vi.fn() },
        automation: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), create: vi.fn() },
        automationRun: { create: vi.fn(), update: vi.fn() },
        automationTargetRun: { findFirst: vi.fn(), create: vi.fn() },
        user: { count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
        chatHistory: { create: vi.fn() },
    },
}));

vi.mock('../services/EvolutionService', () => ({
    EvolutionService: { sendText: mocks.sendText },
}));

vi.mock('../services/WhatsAppService', () => ({
    WhatsAppService: vi.fn().mockImplementation(() => ({ sendText: mocks.sendText })),
}));

vi.mock('../services/AIService', () => ({
    aiService: { generateAutomationMessage: mocks.generateAutomationMessage },
}));

import { prisma } from '../utils/prisma';
import { automationService } from '../services/AutomationService';

const db = prisma as any;

const baseAutomation = {
    id: 'automation-1',
    tenantId: 'tenant-1',
    name: 'Recuperacao',
    type: 'INACTIVITY',
    status: 'ACTIVE',
    triggerType: 'TIME',
    scheduleJson: { dailyAt: '09:00' },
    targetJson: { enrollmentStatuses: ['LEAD'] },
    conditionsJson: {
        requireLgpd: true,
        skipGroups: true,
        inactiveDays: 3,
        excludeEnrollmentStatuses: ['ENROLLED', 'CANCELLED'],
        sendWindow: { start: '08:00', end: '18:00' },
    },
    actionJson: {
        messageTemplate: 'Oi, {{firstName}}!',
        internalNote: '[AUTOMACAO INTERNA] Recuperacao enviada.',
    },
    limitsJson: { cooldownHours: 72 },
};

const baseLead = {
    id: 'lead-1',
    tenantId: 'tenant-1',
    name: 'Joao Silva',
    phoneNumber: '5566999999999',
    enrollmentStatus: 'LEAD',
    conversationState: 'PROGRAM_PRESENTATION',
    currentProgramId: 'ingles',
    lgpdConsent: true,
    isGroup: false,
    lastInteraction: new Date('2026-05-10T12:00:00.000Z'),
};

describe('AutomationService', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-05-17T13:00:00.000Z'));
        vi.clearAllMocks();

        db.tenant.findUnique.mockResolvedValue({ evolutionInstance: 'inst-1' });
        db.automation.findUnique.mockResolvedValue(baseAutomation);
        db.automationRun.create.mockResolvedValue({ id: 'run-1' });
        db.automationRun.update.mockResolvedValue({});
        db.automation.update.mockResolvedValue({});
        db.automationTargetRun.findFirst.mockResolvedValue(null);
        db.automationTargetRun.create.mockResolvedValue({});
        db.user.findMany.mockResolvedValue([baseLead]);
        db.user.findFirst.mockResolvedValue(baseLead);
        db.user.update.mockResolvedValue({});
        db.chatHistory.create.mockResolvedValue({});
        mocks.sendText.mockResolvedValue({});
        mocks.generateAutomationMessage.mockResolvedValue('Mensagem IA');
    });

    it('envia mensagem, salva histórico real, nota interna, run e target run', async () => {
        const result = await automationService.executeAutomation('automation-1', { source: 'manual' });

        expect(result).toEqual({ runId: 'run-1', sentCount: 1, skippedCount: 0, failedCount: 0 });
        expect(mocks.sendText).toHaveBeenCalledWith('inst-1', baseLead.phoneNumber, 'Oi, Joao!');
        expect(db.chatHistory.create).toHaveBeenCalledWith({
            data: { userId: baseLead.id, role: 'model', content: 'Oi, Joao!' },
        });
        expect(db.chatHistory.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ userId: baseLead.id, role: 'system' }),
        }));
        expect(db.automationTargetRun.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ status: 'SENT', message: 'Oi, Joao!' }),
        }));
        expect(db.automationRun.update).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ status: 'COMPLETED', sentCount: 1 }),
        }));
    });

    it('ignora lead sem LGPD, grupo, status bloqueado e cooldown ativo', async () => {
        db.user.findMany.mockResolvedValue([
            { ...baseLead, id: 'lgpd', lgpdConsent: false },
            { ...baseLead, id: 'group', isGroup: true },
            { ...baseLead, id: 'enrolled', enrollmentStatus: 'ENROLLED' },
            { ...baseLead, id: 'cooldown' },
        ]);
        db.automationTargetRun.findFirst.mockResolvedValueOnce({ id: 'recent-target-run' });

        const result = await automationService.executeAutomation('automation-1', { source: 'manual' });

        expect(result.sentCount).toBe(0);
        expect(result.skippedCount).toBe(4);
        expect(mocks.sendText).not.toHaveBeenCalled();
        expect(db.automationTargetRun.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ userId: 'lgpd', status: 'SKIPPED', reason: 'LGPD pendente' }),
        }));
        expect(db.automationTargetRun.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ userId: 'group', status: 'SKIPPED', reason: 'Lead é grupo' }),
        }));
        expect(db.automationTargetRun.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ userId: 'enrolled', status: 'SKIPPED', reason: 'Status bloqueado: ENROLLED' }),
        }));
        expect(db.automationTargetRun.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ userId: 'cooldown', status: 'SKIPPED', reason: 'Cooldown ativo' }),
        }));
    });

    it('nao processa duas vezes o mesmo evento para o mesmo lead', async () => {
        db.automation.findUnique.mockResolvedValue({
            ...baseAutomation,
            type: 'EVENT',
            triggerType: 'EVENT',
            scheduleJson: { eventName: 'PAYMENT_CONFIRMED' },
            conditionsJson: { ...baseAutomation.conditionsJson, excludeEnrollmentStatuses: ['CANCELLED'] },
        });
        db.user.findFirst.mockResolvedValue(baseLead);
        db.automationTargetRun.findFirst.mockResolvedValueOnce({ id: 'already-sent' });

        const result = await automationService.executeAutomation('automation-1', {
            source: 'event',
            eventName: 'PAYMENT_CONFIRMED',
            payload: { userId: baseLead.id, paymentId: 'pay-1' },
        });

        expect(result.sentCount).toBe(0);
        expect(result.skippedCount).toBe(1);
        expect(mocks.sendText).not.toHaveBeenCalled();
        expect(db.automationTargetRun.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                status: 'SKIPPED',
                reason: 'Evento já processado',
                trace: expect.objectContaining({ eventKey: 'PAYMENT_CONFIRMED:pay-1' }),
            }),
        }));
    });

    it('gera mensagem por IA quando nao ha template', async () => {
        db.automation.findUnique.mockResolvedValue({
            ...baseAutomation,
            actionJson: { aiPrompt: 'Recupere o interesse do lead.', internalNote: 'nota' },
        });

        const result = await automationService.executeAutomation('automation-1', { source: 'manual' });

        expect(result.sentCount).toBe(1);
        expect(mocks.generateAutomationMessage).toHaveBeenCalled();
        expect(mocks.sendText).toHaveBeenCalledWith('inst-1', baseLead.phoneNumber, 'Mensagem IA');
    });

    it('bloqueia execução manual de automação pendente de aprovação', async () => {
        db.automation.findUnique.mockResolvedValue({
            ...baseAutomation,
            status: 'PENDING_APPROVAL',
            requiresApproval: true,
        });

        await expect(
            automationService.executeAutomation('automation-1', { source: 'manual' })
        ).rejects.toThrow('Automação pendente de aprovação.');
        expect(db.automationRun.create).not.toHaveBeenCalled();
        expect(mocks.sendText).not.toHaveBeenCalled();
    });
});
