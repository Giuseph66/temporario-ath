import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../utils/prisma', () => {
  const findMany = vi.fn();
  const findFirst = vi.fn();
  return {
    prisma: {
      geminiPriceCatalog: { findMany, findFirst },
    },
  };
});

vi.mock('../services/ExchangeRateService', () => ({
  getUsdBrlRateForTenant: vi.fn(async () => 5),
  convertUsdToBrl: vi.fn((usd: number, rate: number | null) => (rate ? usd * rate : null)),
}));

import { prisma } from '../utils/prisma';
import { calculateGeminiCost } from '../services/GeminiPriceService';

const db = prisma as any;

function p(modality: string, direction: string, pricePerMillion: number, extra?: Record<string, unknown>) {
  return {
    id: `${modality}-${direction}-${pricePerMillion}`,
    model: 'gemini-2.5-flash',
    modality,
    direction,
    pricePerMillion,
    currency: 'USD',
    contextThreshold: null,
    thinkingIncludedInOutput: true,
    sourceUrl: null,
    ...extra,
  };
}

describe('GeminiPriceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calcula 1M input + 1M output', async () => {
    db.geminiPriceCatalog.findFirst.mockResolvedValue({ model: 'gemini-2.5-flash' });
    db.geminiPriceCatalog.findMany.mockResolvedValue([
      p('text', 'input', 1),
      p('text', 'output', 2),
    ]);
    const result = await calculateGeminiCost('t1', {
      model: 'gemini-2.5-flash',
      inputTextTokens: 1_000_000,
      inputAudioTokens: 0,
      inputImageTokens: 0,
      inputVideoTokens: 0,
      inputDocumentTokens: 0,
      inputEmbeddingTokens: 0,
      cachedTokens: 0,
      outputTokens: 1_000_000,
      thinkingTokens: 0,
      toolUsePromptTokens: 0,
    });
    expect(result.estimatedCostUsd).toBeCloseTo(3, 8);
  });

  it('nao cobra thinking em dobro quando incluso no output', async () => {
    db.geminiPriceCatalog.findFirst.mockResolvedValue({ model: 'gemini-2.5-flash' });
    db.geminiPriceCatalog.findMany.mockResolvedValue([
      p('text', 'input', 0.1),
      p('text', 'output', 1, { thinkingIncludedInOutput: true }),
    ]);
    const result = await calculateGeminiCost('t1', {
      model: 'gemini-2.5-flash',
      inputTextTokens: 0,
      inputAudioTokens: 0,
      inputImageTokens: 0,
      inputVideoTokens: 0,
      inputDocumentTokens: 0,
      inputEmbeddingTokens: 0,
      cachedTokens: 0,
      outputTokens: 1_000_000,
      thinkingTokens: 500_000,
      toolUsePromptTokens: 0,
    });
    expect(result.estimatedCostUsd).toBeCloseTo(1, 8);
  });

  it('cobra thinking separado quando nao incluso', async () => {
    db.geminiPriceCatalog.findFirst.mockResolvedValue({ model: 'gemini-2.5-flash' });
    db.geminiPriceCatalog.findMany.mockResolvedValue([
      p('text', 'input', 0.1),
      p('text', 'output', 1, { thinkingIncludedInOutput: false }),
    ]);
    const result = await calculateGeminiCost('t1', {
      model: 'gemini-2.5-flash',
      inputTextTokens: 0,
      inputAudioTokens: 0,
      inputImageTokens: 0,
      inputVideoTokens: 0,
      inputDocumentTokens: 0,
      inputEmbeddingTokens: 0,
      cachedTokens: 0,
      outputTokens: 1_000_000,
      thinkingTokens: 500_000,
      toolUsePromptTokens: 0,
    });
    expect(result.estimatedCostUsd).toBeCloseTo(1.5, 8);
  });

  it('marca missingPrices quando preco ausente', async () => {
    db.geminiPriceCatalog.findFirst.mockResolvedValue({ model: 'gemini-2.5-flash' });
    db.geminiPriceCatalog.findMany.mockResolvedValue([p('text', 'input', 1)]);
    const result = await calculateGeminiCost('t1', {
      model: 'gemini-2.5-flash',
      inputTextTokens: 0,
      inputAudioTokens: 0,
      inputImageTokens: 0,
      inputVideoTokens: 0,
      inputDocumentTokens: 0,
      inputEmbeddingTokens: 0,
      cachedTokens: 0,
      outputTokens: 100,
      thinkingTokens: 0,
      toolUsePromptTokens: 0,
    });
    expect(result.missingPrices.length).toBeGreaterThan(0);
  });

  it('usa preco de audio/input', async () => {
    db.geminiPriceCatalog.findFirst.mockResolvedValue({ model: 'gemini-2.5-flash' });
    db.geminiPriceCatalog.findMany.mockResolvedValue([
      p('text', 'input', 1),
      p('text', 'output', 1),
      p('audio', 'input', 2),
    ]);
    const result = await calculateGeminiCost('t1', {
      model: 'gemini-2.5-flash',
      inputTextTokens: 0,
      inputAudioTokens: 1_000_000,
      inputImageTokens: 0,
      inputVideoTokens: 0,
      inputDocumentTokens: 0,
      inputEmbeddingTokens: 0,
      cachedTokens: 0,
      outputTokens: 0,
      thinkingTokens: 0,
      toolUsePromptTokens: 0,
    });
    expect(result.estimatedCostUsd).toBeCloseTo(2, 8);
  });

  it('cache usa preco cache ou fallback estimado', async () => {
    db.geminiPriceCatalog.findFirst.mockResolvedValue({ model: 'gemini-2.5-flash' });
    db.geminiPriceCatalog.findMany.mockResolvedValue([
      p('text', 'input', 1),
      p('text', 'output', 1),
    ]);
    const result = await calculateGeminiCost('t1', {
      model: 'gemini-2.5-flash',
      inputTextTokens: 0,
      inputAudioTokens: 0,
      inputImageTokens: 0,
      inputVideoTokens: 0,
      inputDocumentTokens: 0,
      inputEmbeddingTokens: 0,
      cachedTokens: 1_000_000,
      outputTokens: 0,
      thinkingTokens: 0,
      toolUsePromptTokens: 0,
    });
    expect(result.estimatedCostUsd).toBeCloseTo(0.25, 8);
  });

  it('aplica tier de contexto longo quando contextLength > 200000', async () => {
    db.geminiPriceCatalog.findFirst.mockResolvedValue({ model: 'gemini-2.5-flash' });
    db.geminiPriceCatalog.findMany.mockResolvedValue([
      p('text', 'input', 1, { contextThreshold: null }),
      p('text', 'input', 3, { id: 'long-tier', contextThreshold: 200000 }),
      p('text', 'output', 1),
    ]);
    const result = await calculateGeminiCost('t1', {
      model: 'gemini-2.5-flash',
      contextLength: 300000,
      inputTextTokens: 1_000_000,
      inputAudioTokens: 0,
      inputImageTokens: 0,
      inputVideoTokens: 0,
      inputDocumentTokens: 0,
      inputEmbeddingTokens: 0,
      cachedTokens: 0,
      outputTokens: 0,
      thinkingTokens: 0,
      toolUsePromptTokens: 0,
    });
    expect(result.estimatedCostUsd).toBeCloseTo(3, 8);
  });
});
