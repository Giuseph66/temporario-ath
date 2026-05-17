import { prisma } from '../utils/prisma';
import { hasPriceForModel } from './GeminiModelService';

export type UsageState =
  | 'OK'
  | 'MISSING_PRICES'
  | 'WARNING_50'
  | 'WARNING_80'
  | 'CRITICAL_90'
  | 'LIMIT_REACHED'
  | 'BLOCKED';

function monthRange(now = new Date()): { from: Date; to: Date } {
  const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const to = now;
  return { from, to };
}

function pct(used: number, limit: number): number {
  if (!Number.isFinite(limit) || limit <= 0) return 0;
  return (used / limit) * 100;
}

export async function getTenantUsageState(tenantId: string): Promise<{
  state: UsageState;
  canUseGemini: boolean;
  usedPercent: number;
  usedUsd: number;
  usedBrl: number | null;
  monthlyLimitUsd: number | null;
  monthlyLimitBrl: number | null;
  hasMissingPrices: boolean;
  reason?: string;
}> {
  const { from, to } = monthRange();
  const usageModel = (prisma as any).geminiUsageEvent;
  const budgetModel = (prisma as any).geminiUsageBudget;
  if (!usageModel?.findMany || !budgetModel?.findUnique) {
    return {
      state: 'OK',
      canUseGemini: true,
      usedPercent: 0,
      usedUsd: 0,
      usedBrl: 0,
      monthlyLimitUsd: null,
      monthlyLimitBrl: null,
      hasMissingPrices: false,
      reason: 'Tracking Gemini ainda não migrado/gerado no Prisma Client.',
    };
  }

  const [budget, monthEvents, currentAgent] = await Promise.all([
    budgetModel.findUnique({ where: { tenantId } }),
    usageModel.findMany({
      where: { tenantId, createdAt: { gte: from, lte: to } },
      select: { model: true, estimatedCostUsd: true, estimatedCostBrl: true },
    }),
    prisma.agent.findFirst({ where: { tenantId }, select: { geminiModel: true } }),
  ]);

  const usedUsd = monthEvents.reduce((acc: number, row: any) => acc + Number(row.estimatedCostUsd ?? 0), 0);
  const usedBrlRaw = monthEvents.reduce((acc: number, row: any) => acc + Number(row.estimatedCostBrl ?? 0), 0);
  const usedBrl = Number.isFinite(usedBrlRaw) ? usedBrlRaw : null;

  const monthlyLimitUsd = budget?.monthlyLimitUsd != null ? Number(budget.monthlyLimitUsd) : null;
  const monthlyLimitBrl = budget?.monthlyLimitBrl != null ? Number(budget.monthlyLimitBrl) : null;

  let usedPercent = 0;
  if (monthlyLimitUsd && monthlyLimitUsd > 0) usedPercent = pct(usedUsd, monthlyLimitUsd);
  else if (monthlyLimitBrl && monthlyLimitBrl > 0 && usedBrl != null) usedPercent = pct(usedBrl, monthlyLimitBrl);

  const usedModels = Array.from(new Set<string>(monthEvents.map((row: any) => String(row.model ?? '')).filter(Boolean)));
  const usedModelsWithoutPrice = (await Promise.all(
    usedModels.map(async (model: string) => (await hasPriceForModel(model)) ? null : model)
  )).filter(Boolean);
  const modelWithoutPrice = currentAgent?.geminiModel ? !(await hasPriceForModel(currentAgent.geminiModel)) : false;
  const hasMissingPrices = usedModelsWithoutPrice.length > 0 || modelWithoutPrice;

  let state: UsageState = 'OK';
  let reason: string | undefined;

  const hardLimitEnabled = Boolean(budget?.hardLimitEnabled);
  const blockOnLimit = Boolean(budget?.blockOnLimit);

  if (usedPercent >= 100 && hardLimitEnabled && blockOnLimit) {
    state = 'BLOCKED';
    reason = 'Limite mensal atingido com bloqueio ativo.';
  } else if (usedPercent >= 100) {
    state = 'LIMIT_REACHED';
    reason = 'Limite mensal atingido.';
  } else if (usedPercent >= 90) {
    state = 'CRITICAL_90';
    reason = 'Consumo acima de 90%.';
  } else if (usedPercent >= 80) {
    state = 'WARNING_80';
    reason = 'Consumo acima de 80%.';
  } else if (usedPercent >= 50) {
    state = 'WARNING_50';
    reason = 'Consumo acima de 50%.';
  } else if (hasMissingPrices) {
    state = 'MISSING_PRICES';
    reason = 'Há modelo em uso sem preço no catálogo.';
  }

  // Sem orçamento configurado: OK por padrão, mantendo sinalização de missing prices
  if (!monthlyLimitUsd && !monthlyLimitBrl) {
    state = 'OK';
    usedPercent = 0;
  }

  return {
    state,
    canUseGemini: state !== 'BLOCKED',
    usedPercent,
    usedUsd,
    usedBrl,
    monthlyLimitUsd,
    monthlyLimitBrl,
    hasMissingPrices,
    reason,
  };
}
