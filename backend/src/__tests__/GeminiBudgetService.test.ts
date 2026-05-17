import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../utils/prisma', () => {
  const findUniqueBudget = vi.fn();
  const findManyEvents = vi.fn();
  const findFirstAgent = vi.fn();
  return {
    prisma: {
      geminiUsageBudget: { findUnique: findUniqueBudget },
      geminiUsageEvent: { findMany: findManyEvents },
      agent: { findFirst: findFirstAgent },
    },
  };
});

vi.mock('../services/GeminiModelService', () => ({
  hasPriceForModel: vi.fn(async () => true),
}));

import { prisma } from '../utils/prisma';
import { hasPriceForModel } from '../services/GeminiModelService';
import { getTenantUsageState } from '../services/GeminiBudgetService';

const db = prisma as any;

describe('GeminiBudgetService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.agent.findFirst.mockResolvedValue({ geminiModel: 'gemini-2.5-flash' });
  });

  it('sem orçamento retorna OK', async () => {
    db.geminiUsageBudget.findUnique.mockResolvedValue(null);
    db.geminiUsageEvent.findMany.mockResolvedValue([]);
    const state = await getTenantUsageState('t1');
    expect(state.state).toBe('OK');
    expect(state.canUseGemini).toBe(true);
  });

  it('80% usado retorna WARNING_80', async () => {
    db.geminiUsageBudget.findUnique.mockResolvedValue({ monthlyLimitUsd: 100, hardLimitEnabled: false, blockOnLimit: false });
    db.geminiUsageEvent.findMany.mockResolvedValue([{ estimatedCostUsd: 80, estimatedCostBrl: 0, missingPricesJson: [] }]);
    const state = await getTenantUsageState('t1');
    expect(state.state).toBe('WARNING_80');
  });

  it('100% usado sem bloqueio retorna LIMIT_REACHED', async () => {
    db.geminiUsageBudget.findUnique.mockResolvedValue({ monthlyLimitUsd: 100, hardLimitEnabled: false, blockOnLimit: false });
    db.geminiUsageEvent.findMany.mockResolvedValue([{ estimatedCostUsd: 120, estimatedCostBrl: 0, missingPricesJson: [] }]);
    const state = await getTenantUsageState('t1');
    expect(state.state).toBe('LIMIT_REACHED');
  });

  it('100% usado com bloqueio retorna BLOCKED', async () => {
    db.geminiUsageBudget.findUnique.mockResolvedValue({ monthlyLimitUsd: 100, hardLimitEnabled: true, blockOnLimit: true });
    db.geminiUsageEvent.findMany.mockResolvedValue([{ estimatedCostUsd: 120, estimatedCostBrl: 0, missingPricesJson: [] }]);
    const state = await getTenantUsageState('t1');
    expect(state.state).toBe('BLOCKED');
    expect(state.canUseGemini).toBe(false);
  });

  it('modelo usado sem preco abaixo de 50% retorna MISSING_PRICES', async () => {
    db.geminiUsageBudget.findUnique.mockResolvedValue({ monthlyLimitUsd: 100, hardLimitEnabled: false, blockOnLimit: false });
    db.geminiUsageEvent.findMany.mockResolvedValue([{ model: 'gemini-sem-preco', estimatedCostUsd: 10, estimatedCostBrl: 0 }]);
    (hasPriceForModel as any).mockImplementation(async (model: string) => model !== 'gemini-sem-preco');
    const state = await getTenantUsageState('t1');
    expect(state.state).toBe('MISSING_PRICES');
  });
});
