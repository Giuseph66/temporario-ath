import { prisma } from '../utils/prisma';
import { convertUsdToBrl, getUsdBrlRateForTenant } from './ExchangeRateService';

export type GeminiUsageForCost = {
  model: string;
  contextLength?: number;
  inputTextTokens: number;
  inputAudioTokens: number;
  inputImageTokens: number;
  inputVideoTokens: number;
  inputDocumentTokens: number;
  inputEmbeddingTokens: number;
  cachedTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  toolUsePromptTokens: number;
};

export type GeminiCostResult = {
  estimatedCostUsd: number;
  estimatedCostBrl: number | null;
  exchangeRateUsdBrl: number | null;
  priceSnapshot: Record<string, unknown>;
  missingPrices: string[];
};

type PriceRow = {
  id: string;
  model: string;
  modality: string;
  direction: string;
  pricePerMillion: any;
  currency: string;
  contextThreshold: number | null;
  thinkingIncludedInOutput: boolean;
  sourceUrl: string | null;
};

function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function normalizeRawModel(model: string): string {
  return String(model || '').trim().replace(/^models\//, '');
}

export function normalizeGeminiModelName(model: string): string {
  const base = normalizeRawModel(model);
  return base;
}

function candidateModelNames(model: string): string[] {
  const raw = normalizeRawModel(model);
  const noPreviewDate = raw.replace(/-preview-\d{2}-\d{2}$/i, '');
  const noPreview = raw.replace(/-preview$/i, '');
  const noDate = raw.replace(/-\d{8}$/i, '');
  return Array.from(new Set([raw, noPreviewDate, noPreview, noDate].filter(Boolean)));
}

function pickByContext(rows: PriceRow[], contextLength?: number): PriceRow | null {
  if (!rows.length) return null;
  if (!contextLength || contextLength <= 0) {
    const noThreshold = rows.find(r => r.contextThreshold == null);
    return noThreshold ?? rows[0];
  }

  const eligible = rows.filter(r => r.contextThreshold != null && contextLength > Number(r.contextThreshold));
  if (eligible.length > 0) {
    return eligible.sort((a, b) => Number(b.contextThreshold) - Number(a.contextThreshold))[0];
  }
  return rows.find(r => r.contextThreshold == null) ?? rows[0];
}

async function findMatchedModel(requested: string): Promise<string | null> {
  const model = (prisma as any).geminiPriceCatalog;
  if (!model?.findFirst) return null;
  const candidates = candidateModelNames(requested);
  for (const candidate of candidates) {
    const exact = await model.findFirst({
      where: { model: candidate, isDeprecated: false },
      select: { model: true },
    });
    if (exact?.model) return exact.model;
  }

  const partial = await model.findFirst({
    where: { model: { startsWith: candidates[0] }, isDeprecated: false },
    select: { model: true },
  });
  if (partial?.model) return partial.model;
  return null;
}

export async function getPriceCatalogForModel(model: string): Promise<any[]> {
  try {
    const priceModel = (prisma as any).geminiPriceCatalog;
    if (!priceModel?.findMany) return [];
    const matched = await findMatchedModel(model);
    if (!matched) return [];
    const now = new Date();
    const rows = await priceModel.findMany({
      where: {
        model: matched,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
      },
      orderBy: [{ contextThreshold: 'asc' }, { createdAt: 'desc' }],
    });
    return rows;
  } catch {
    return [];
  }
}

function addCost(
  amountTokens: number,
  pricePerMillion: number,
): number {
  if (!Number.isFinite(amountTokens) || amountTokens <= 0) return 0;
  if (!Number.isFinite(pricePerMillion) || pricePerMillion <= 0) return 0;
  return (amountTokens / 1_000_000) * pricePerMillion;
}

export async function calculateGeminiCost(
  tenantId: string,
  input: GeminiUsageForCost
): Promise<GeminiCostResult> {
  try {
    const modelRequested = normalizeGeminiModelName(input.model);
    const prices = (await getPriceCatalogForModel(modelRequested)) as PriceRow[];
    const modelMatched = prices[0]?.model ?? (await findMatchedModel(modelRequested)) ?? modelRequested;
    const missingPrices = new Set<string>();
    const usedPrices: Record<string, unknown> = {};
    let cacheEstimated = false;
    const contextLength = toNumber(input.contextLength);

    const selectPrice = (modality: string, direction: string): PriceRow | null => {
      const rows = prices.filter(p => p.modality === modality && p.direction === direction);
      const picked = pickByContext(rows, contextLength);
      if (!picked) {
        missingPrices.add(`${modality}/${direction}`);
        return null;
      }
      usedPrices[`${modality}/${direction}`] = {
        id: picked.id,
        model: picked.model,
        pricePerMillion: toNumber(picked.pricePerMillion),
        contextThreshold: picked.contextThreshold,
      };
      return picked;
    };

    const textInput = selectPrice('text', 'input');
    const textOutput = selectPrice('text', 'output');
    const documentInput = selectPrice('document', 'input') ?? textInput;
    const audioInput = selectPrice('audio', 'input');
    const imageInput = selectPrice('image', 'input');
    const videoInput = selectPrice('video', 'input');
    const embeddingInput = selectPrice('embedding', 'input');
    const cacheInput = selectPrice('cache', 'input');

    let estimatedCostUsd = 0;
    estimatedCostUsd += addCost(toNumber(input.inputTextTokens), toNumber(textInput?.pricePerMillion));
    estimatedCostUsd += addCost(toNumber(input.inputDocumentTokens), toNumber(documentInput?.pricePerMillion));
    estimatedCostUsd += addCost(toNumber(input.inputAudioTokens), toNumber(audioInput?.pricePerMillion));
    estimatedCostUsd += addCost(toNumber(input.inputImageTokens), toNumber(imageInput?.pricePerMillion));
    estimatedCostUsd += addCost(toNumber(input.inputVideoTokens), toNumber(videoInput?.pricePerMillion));
    estimatedCostUsd += addCost(toNumber(input.inputEmbeddingTokens), toNumber(embeddingInput?.pricePerMillion));
    estimatedCostUsd += addCost(toNumber(input.toolUsePromptTokens), toNumber(textInput?.pricePerMillion));
    estimatedCostUsd += addCost(toNumber(input.outputTokens), toNumber(textOutput?.pricePerMillion));

    if (toNumber(input.cachedTokens) > 0) {
      if (cacheInput) {
        estimatedCostUsd += addCost(toNumber(input.cachedTokens), toNumber(cacheInput.pricePerMillion));
      } else if (textInput) {
        cacheEstimated = true;
        estimatedCostUsd += addCost(toNumber(input.cachedTokens), toNumber(textInput.pricePerMillion) * 0.25);
      } else {
        missingPrices.add('cache/input');
      }
    }

    const thinkingIncludedInOutput = textOutput?.thinkingIncludedInOutput ?? true;
    let thinkingBillingMode = thinkingIncludedInOutput ? 'INCLUDED_IN_OUTPUT' : 'BILLED_SEPARATELY';
    if (!thinkingIncludedInOutput && toNumber(input.thinkingTokens) > 0) {
      if (textOutput) {
        estimatedCostUsd += addCost(toNumber(input.thinkingTokens), toNumber(textOutput.pricePerMillion));
      } else {
        missingPrices.add('thinking/output');
      }
    }

    const rate = await getUsdBrlRateForTenant(tenantId);
    const estimatedCostBrl = convertUsdToBrl(estimatedCostUsd, rate);

    const result: GeminiCostResult = {
      estimatedCostUsd,
      estimatedCostBrl,
      exchangeRateUsdBrl: rate,
      missingPrices: Array.from(missingPrices),
      priceSnapshot: {
        modelRequested,
        modelMatched,
        prices: usedPrices,
        missingPrices: Array.from(missingPrices),
        cacheEstimated,
        thinkingIncludedInOutput,
        thinkingBillingMode,
        contextThresholdApplied: contextLength > 200000 ? 200000 : null,
        currency: 'USD',
        source: 'GeminiPriceCatalog',
        calculatedAt: new Date().toISOString(),
      },
    };
    return result;
  } catch {
    return {
      estimatedCostUsd: 0,
      estimatedCostBrl: null,
      exchangeRateUsdBrl: null,
      missingPrices: ['CALCULATION_ERROR'],
      priceSnapshot: {
        modelRequested: input.model,
        modelMatched: null,
        prices: {},
        missingPrices: ['CALCULATION_ERROR'],
        cacheEstimated: false,
        thinkingIncludedInOutput: true,
        thinkingBillingMode: 'INCLUDED_IN_OUTPUT',
        contextThresholdApplied: null,
        currency: 'USD',
        source: 'GeminiPriceCatalog',
        calculatedAt: new Date().toISOString(),
      },
    };
  }
}
