import { prisma } from '../utils/prisma';
import { EvolutionService } from './EvolutionService';
import { WhatsAppService } from './WhatsAppService';
import { aiService } from './AIService';

const db = prisma as any;
const metaWhatsapp = new WhatsAppService();

type JsonMap = Record<string, any>;
type Automation = JsonMap & {
    id: string;
    tenantId: string;
    name: string;
    type: string;
    status: string;
    triggerType: string;
    scheduleJson: unknown;
};
type Lead = JsonMap;

const ACTIVE = 'ACTIVE';
const PAUSED = 'PAUSED';
const PENDING_APPROVAL = 'PENDING_APPROVAL';
const COMPLETED = 'COMPLETED';

function asObject(value: unknown): JsonMap {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonMap : {};
}

function addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60_000);
}

function parseClock(value?: string): number | null {
    if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
    const [h, m] = value.split(':').map(Number);
    if (h > 23 || m > 59) return null;
    return h * 60 + m;
}

function isInsideWindow(window?: { start?: string; end?: string }, now = new Date()): boolean {
    if (!window?.start || !window?.end) return true;
    const start = parseClock(window.start);
    const end = parseClock(window.end);
    if (start === null || end === null) return true;

    const current = now.getHours() * 60 + now.getMinutes();
    if (start <= end) return current >= start && current <= end;
    return current >= start || current <= end;
}

function nextDailyRun(clock: string, from = new Date()): Date {
    const minutes = parseClock(clock) ?? 9 * 60;
    const next = new Date(from);
    next.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    if (next <= from) next.setDate(next.getDate() + 1);
    return next;
}

function computeNextRunAt(automation: Pick<Automation, 'type' | 'triggerType' | 'scheduleJson'>, from = new Date()): Date | null {
    const schedule = asObject(automation.scheduleJson);
    if (automation.triggerType === 'EVENT' || automation.type === 'MANUAL') return null;
    if (automation.type === 'ONE_OFF') {
        return schedule.runAt ? new Date(schedule.runAt) : null;
    }
    if (schedule.dailyAt) return nextDailyRun(String(schedule.dailyAt), from);

    const fallback = automation.type === 'INACTIVITY' ? 1440 : 60;
    return addMinutes(from, Number(schedule.intervalMinutes ?? fallback));
}

function renderTemplate(template: string, lead: Lead): string {
    const firstName = String(lead.name ?? '').trim().split(/\s+/)[0] || 'tudo bem';
    return template
        .replace(/\{\{firstName\}\}/g, firstName)
        .replace(/\{\{name\}\}/g, lead.name ?? '')
        .replace(/\{\{phone\}\}/g, lead.phoneNumber ?? '')
        .replace(/\{\{program\}\}/g, lead.currentProgramId ?? 'programa');
}

function eventKeyFromPayload(triggerPayload: JsonMap): string | null {
    if (triggerPayload.source !== 'event') return null;
    const payload = asObject(triggerPayload.payload);
    const stableId = payload.id ?? payload.paymentId ?? payload.eventId ?? payload.userId;
    return `${triggerPayload.eventName ?? 'event'}:${stableId ?? JSON.stringify(payload)}`;
}

async function sendWhatsapp(tenantId: string, phone: string, text: string): Promise<void> {
    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { evolutionInstance: true },
    });
    if (tenant?.evolutionInstance) {
        await EvolutionService.sendText(tenant.evolutionInstance, phone, text);
        return;
    }
    await metaWhatsapp.sendText(phone, text);
}

export class AutomationService {
    private timer: NodeJS.Timeout | null = null;
    private running = false;
    private disabledUntilMigration = false;

    buildNextRunAt(input: Pick<Automation, 'type' | 'triggerType' | 'scheduleJson'>): Date | null {
        return computeNextRunAt(input);
    }

    async estimateTargets(tenantId: string, targetJson: JsonMap, conditionsJson: JsonMap): Promise<number> {
        return db.user.count({ where: this.buildLeadWhere(tenantId, targetJson, conditionsJson) });
    }

    async tick(): Promise<void> {
        if (this.disabledUntilMigration) return;
        if (this.running) return;
        this.running = true;
        try {
            const due = await db.automation.findMany({
                where: {
                    status: ACTIVE,
                    nextRunAt: { lte: new Date() },
                },
                orderBy: { nextRunAt: 'asc' },
                take: 20,
            });

            for (const automation of due) {
                await this.executeAutomation(automation.id, { source: 'cron' }).catch(err => {
                    console.error('[AutomationService] Falha ao executar automação:', err);
                });
            }
        } catch (err) {
            if (this.isMissingAutomationTableError(err)) {
                this.disabledUntilMigration = true;
                console.warn('[AutomationService] Tabelas de automação ainda não existem. Rode a migration do Prisma para ativar o motor.');
                return;
            }
            throw err;
        } finally {
            this.running = false;
        }
    }

    start(): void {
        if (this.timer) return;
        this.timer = setInterval(() => {
            this.tick().catch(err => console.error('[AutomationService] tick falhou:', err));
        }, 60_000);
    }

    stop(): void {
        if (!this.timer) return;
        clearInterval(this.timer);
        this.timer = null;
    }

    async handleEvent(tenantId: string, eventName: string, payload: JsonMap = {}): Promise<void> {
        if (this.disabledUntilMigration) return;
        const automations = await db.automation.findMany({
            where: {
                tenantId,
                status: ACTIVE,
                triggerType: 'EVENT',
            },
        });

        for (const automation of automations) {
            const schedule = asObject(automation.scheduleJson);
            if (schedule.eventName && schedule.eventName !== eventName) continue;
            await this.executeAutomation(automation.id, { source: 'event', eventName, payload }).catch(err => {
                console.error(`[AutomationService] Evento ${eventName} falhou:`, err);
            });
        }
    }

    private isMissingAutomationTableError(err: unknown): boolean {
        const error = err as { code?: string; meta?: { table?: string }; message?: string };
        return error?.code === 'P2021' && String(error.meta?.table ?? error.message ?? '').includes('Automation');
    }

    async executeAutomation(automationId: string, triggerPayload: JsonMap = {}) {
        const automation = await db.automation.findUnique({ where: { id: automationId } });
        if (!automation) throw new Error('Automação não encontrada.');
        if (![ACTIVE, PENDING_APPROVAL].includes(automation.status) && triggerPayload.source !== 'manual') {
            throw new Error('Automação não está ativa.');
        }
        if (automation.status === PENDING_APPROVAL && triggerPayload.source !== 'approval') {
            throw new Error('Automação pendente de aprovação.');
        }

        const run = await db.automationRun.create({
            data: {
                tenantId: automation.tenantId,
                automationId: automation.id,
                status: 'RUNNING',
                triggerPayload,
            },
        });

        let sentCount = 0;
        let skippedCount = 0;
        let failedCount = 0;

        try {
            const leads = await this.resolveTargets(automation, triggerPayload);

            for (const lead of leads) {
                if (await this.wasEventAlreadyHandled(automation, lead, triggerPayload)) {
                    skippedCount++;
                    await this.createTargetRun(automation, run.id, lead, 'SKIPPED', 'Evento já processado', undefined, triggerPayload);
                    continue;
                }

                const check = await this.canExecuteForLead(automation, lead);
                if (!check.ok) {
                    skippedCount++;
                    await this.createTargetRun(automation, run.id, lead, 'SKIPPED', check.reason, undefined, triggerPayload);
                    continue;
                }

                try {
                    const result = await this.applyAction(automation, lead, run.id, triggerPayload);
                    sentCount += result.sent ? 1 : 0;
                    if (!result.sent) skippedCount++;
                } catch (err) {
                    failedCount++;
                    await this.createTargetRun(
                        automation,
                        run.id,
                        lead,
                        'FAILED',
                        err instanceof Error ? err.message : 'Falha desconhecida',
                        undefined,
                        triggerPayload
                    );
                }
            }

            await db.automationRun.update({
                where: { id: run.id },
                data: {
                    status: COMPLETED,
                    finishedAt: new Date(),
                    sentCount,
                    skippedCount,
                    failedCount,
                },
            });

            await this.afterRun(automation);
        } catch (err) {
            await db.automationRun.update({
                where: { id: run.id },
                data: {
                    status: 'FAILED',
                    finishedAt: new Date(),
                    sentCount,
                    skippedCount,
                    failedCount,
                    error: err instanceof Error ? err.message : 'Falha desconhecida',
                },
            });
            throw err;
        }

        return { runId: run.id, sentCount, skippedCount, failedCount };
    }

    private async afterRun(automation: Automation): Promise<void> {
        const nextRunAt = computeNextRunAt(automation);
        const data: JsonMap = { lastRunAt: new Date(), nextRunAt };
        if (automation.type === 'ONE_OFF') data.status = PAUSED;
        await db.automation.update({ where: { id: automation.id }, data });
    }

    private buildLeadWhere(tenantId: string, targetJson: JsonMap, conditionsJson: JsonMap): JsonMap {
        const where: JsonMap = { tenantId };
        if (targetJson.userId) where.id = targetJson.userId;
        if (Array.isArray(targetJson.enrollmentStatuses) && targetJson.enrollmentStatuses.length) {
            where.enrollmentStatus = { in: targetJson.enrollmentStatuses };
        }
        if (Array.isArray(targetJson.conversationStates) && targetJson.conversationStates.length) {
            where.conversationState = { in: targetJson.conversationStates };
        }
        if (Array.isArray(targetJson.programIds) && targetJson.programIds.length) {
            where.currentProgramId = { in: targetJson.programIds };
        }
        if (conditionsJson.skipGroups !== false) where.isGroup = false;
        return where;
    }

    private async resolveTargets(automation: Automation, triggerPayload: JsonMap): Promise<Lead[]> {
        const target = asObject(automation.targetJson);
        const conditions = asObject(automation.conditionsJson);

        if (triggerPayload.payload?.userId) {
            const lead = await db.user.findFirst({
                where: { id: triggerPayload.payload.userId, tenantId: automation.tenantId },
            });
            return lead ? [lead] : [];
        }

        const where = this.buildLeadWhere(automation.tenantId, target, conditions);

        if (automation.type === 'INACTIVITY' || conditions.inactiveDays) {
            const inactiveDays = Number(conditions.inactiveDays ?? 3);
            where.lastInteraction = { lte: new Date(Date.now() - inactiveDays * 86_400_000) };
        }

        return db.user.findMany({
            where,
            orderBy: { lastInteraction: 'asc' },
            take: Number(target.limit ?? 200),
        });
    }

    private async canExecuteForLead(automation: Automation, lead: Lead): Promise<{ ok: boolean; reason?: string }> {
        const conditions = asObject(automation.conditionsJson);
        const limits = asObject(automation.limitsJson);

        if (conditions.requireLgpd !== false && !lead.lgpdConsent) return { ok: false, reason: 'LGPD pendente' };
        if (conditions.skipGroups !== false && lead.isGroup) return { ok: false, reason: 'Lead é grupo' };

        const excluded = conditions.excludeEnrollmentStatuses ?? ['ENROLLED', 'CANCELLED'];
        if (Array.isArray(excluded) && excluded.includes(lead.enrollmentStatus)) {
            return { ok: false, reason: `Status bloqueado: ${lead.enrollmentStatus}` };
        }

        if (!isInsideWindow(conditions.sendWindow)) {
            return { ok: false, reason: 'Fora da janela de envio' };
        }

        const cooldownHours = Number(limits.cooldownHours ?? 72);
        if (cooldownHours > 0) {
            const since = new Date(Date.now() - cooldownHours * 3_600_000);
            const recent = await db.automationTargetRun.findFirst({
                where: {
                    automationId: automation.id,
                    userId: lead.id,
                    status: 'SENT',
                    createdAt: { gte: since },
                },
                select: { id: true },
            });
            if (recent) return { ok: false, reason: 'Cooldown ativo' };
        }

        return { ok: true };
    }

    private async wasEventAlreadyHandled(automation: Automation, lead: Lead, triggerPayload: JsonMap): Promise<boolean> {
        const eventKey = eventKeyFromPayload(triggerPayload);
        if (!eventKey) return false;

        const existing = await db.automationTargetRun.findFirst({
            where: {
                automationId: automation.id,
                userId: lead.id,
                status: 'SENT',
                trace: {
                    path: ['eventKey'],
                    equals: eventKey,
                },
            },
            select: { id: true },
        });
        return Boolean(existing);
    }

    private async applyAction(automation: Automation, lead: Lead, runId: string, triggerPayload: JsonMap): Promise<{ sent: boolean }> {
        const action = asObject(automation.actionJson);
        const update = asObject(action.updateLead);
        const internalNote = String(
            action.internalNote ??
            `[AUTOMACAO INTERNA] ${automation.name} executada.`
        );

        let message = '';
        if (action.messageTemplate) {
            message = renderTemplate(String(action.messageTemplate), lead).trim();
        } else if (action.aiPrompt) {
            message = (await aiService.generateAutomationMessage(automation.tenantId, {
                automationName: automation.name,
                prompt: String(action.aiPrompt),
                lead: {
                    name: lead.name,
                    phoneNumber: lead.phoneNumber,
                    enrollmentStatus: lead.enrollmentStatus,
                    conversationState: lead.conversationState,
                    currentProgramId: lead.currentProgramId,
                },
            })).trim();
        }

        if (message) {
            await sendWhatsapp(automation.tenantId, lead.phoneNumber, message);
            await prisma.chatHistory.create({
                data: { userId: lead.id, role: 'model', content: message },
            });
        }

        await prisma.chatHistory.create({
            data: {
                userId: lead.id,
                role: 'system',
                content: internalNote,
                trace: {
                    automationId: automation.id,
                    automationName: automation.name,
                    runId,
                    automatic: true,
                } as any,
            },
        });

        const leadData: JsonMap = {};
        if (update.conversationState) leadData.conversationState = update.conversationState;
        if (update.enrollmentStatus) leadData.enrollmentStatus = update.enrollmentStatus;
        if (Object.keys(leadData).length > 0) {
            await db.user.update({ where: { id: lead.id }, data: leadData });
        }

        await this.createTargetRun(automation, runId, lead, message ? 'SENT' : 'SKIPPED', message ? undefined : 'Ação sem mensagem', message, triggerPayload);
        return { sent: Boolean(message) };
    }

    private async createTargetRun(
        automation: Automation,
        runId: string,
        lead: Lead | null,
        status: string,
        reason?: string,
        message?: string,
        triggerPayload: JsonMap = {}
    ): Promise<void> {
        const eventKey = eventKeyFromPayload(triggerPayload);
        await db.automationTargetRun.create({
            data: {
                tenantId: automation.tenantId,
                automationId: automation.id,
                runId,
                userId: lead?.id ?? null,
                status,
                reason,
                message,
                trace: {
                    eventKey,
                    source: triggerPayload.source,
                    eventName: triggerPayload.eventName,
                    phoneNumber: lead?.phoneNumber,
                    enrollmentStatus: lead?.enrollmentStatus,
                    conversationState: lead?.conversationState,
                },
            },
        });
    }
}

export const automationService = new AutomationService();
