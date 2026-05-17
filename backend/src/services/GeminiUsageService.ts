import { prisma } from '../utils/prisma';
import { calculateGeminiCost } from './GeminiPriceService';
import { hasPriceForModel } from './GeminiModelService';

export type GeminiCallContext = {
  tenantId: string;
  agentId?: string;
  userId?: string;
  chatHistoryId?: string;
  source: string;
  feature: string;
  phase?: string;
  fsmState?: string;
  channel?: string;
  model: string;
  attempt?: number;
  toolsUsed?: string[];
  requestMeta?: Record<string, unknown>;
  startedAt?: number;
};

export type ExtractedUsageMetadata = {
  usageMetadata: any | null;
  modelVersion?: string;
  responseId?: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedTokens: number;
  thinkingTokens: number;
  toolUsePromptTokens: number;
  inputTextTokens: number;
  inputAudioTokens: number;
  inputImageTokens: number;
  inputVideoTokens: number;
  inputDocumentTokens: number;
  inputEmbeddingTokens: number;
  usageMissing: boolean;
};

function toNum(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function trackEnabled(): boolean {
  return String(process.env.GEMINI_TRACKING_ENABLED ?? 'true') === 'true';
}

function usageEventModel(): any | null {
  const model = (prisma as any).geminiUsageEvent;
  return model && typeof model.findMany === 'function' ? model : null;
}

function sanitizeErrorMessage(input: unknown): string | null {
  if (input == null) return null;
  const text = String(input)
    .replace(/(api[_-]?key|authorization|token)\s*[:=]\s*["']?[^"'\s]+/gi, '$1=[redacted]')
    .replace(/key=[^&\s]+/gi, 'key=[redacted]');
  return text.slice(0, 500);
}

function sanitizeRequestMeta(input?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!input) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    const key = k.toLowerCase();
    if (key.includes('apikey') || key.includes('token') || key.includes('authorization') || key.includes('secret')) {
      out[k] = '[redacted]';
      continue;
    }
    out[k] = v;
  }
  return out;
}

function extractUsageObject(responseLike: any): any | null {
  if (!responseLike) return null;
  if (responseLike.usageMetadata) return responseLike.usageMetadata;
  if (responseLike.response?.usageMetadata) return responseLike.response.usageMetadata;
  if (responseLike.candidates && responseLike.usageMetadata) return responseLike.usageMetadata;
  if (responseLike.result?.usageMetadata) return responseLike.result.usageMetadata;
  return null;
}

function extractModalitiesFromDetails(details: any[]): {
  text: number; audio: number; image: number; video: number; document: number; embedding: number;
} {
  const out = { text: 0, audio: 0, image: 0, video: 0, document: 0, embedding: 0 };
  for (const item of details) {
    const modality = String(item?.modality ?? item?.type ?? '').toLowerCase();
    const count = toNum(item?.tokenCount ?? item?.tokens ?? item?.count);
    if (modality.includes('audio')) out.audio += count;
    else if (modality.includes('image')) out.image += count;
    else if (modality.includes('video')) out.video += count;
    else if (modality.includes('document') || modality.includes('pdf')) out.document += count;
    else if (modality.includes('embedding')) out.embedding += count;
    else out.text += count;
  }
  return out;
}

export function extractUsageMetadata(responseLike: any): ExtractedUsageMetadata {
  const usageMetadata = extractUsageObject(responseLike);
  const modelVersion = responseLike?.modelVersion ?? responseLike?.response?.modelVersion;
  const responseId = responseLike?.responseId ?? responseLike?.response?.responseId ?? responseLike?.response?.candidates?.[0]?.id;

  if (!usageMetadata) {
    return {
      usageMetadata: null,
      modelVersion,
      responseId,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cachedTokens: 0,
      thinkingTokens: 0,
      toolUsePromptTokens: 0,
      inputTextTokens: 0,
      inputAudioTokens: 0,
      inputImageTokens: 0,
      inputVideoTokens: 0,
      inputDocumentTokens: 0,
      inputEmbeddingTokens: 0,
      usageMissing: true,
    };
  }

  const inputTokens = toNum(usageMetadata.promptTokenCount);
  const outputTokens = toNum(usageMetadata.candidatesTokenCount);
  const totalTokens = toNum(usageMetadata.totalTokenCount);
  const cachedTokens = toNum(usageMetadata.cachedContentTokenCount);
  const thinkingTokens = toNum(usageMetadata.thoughtsTokenCount);
  const toolUsePromptTokens = toNum(usageMetadata.toolUsePromptTokenCount);

  const details = Array.isArray(usageMetadata.promptTokensDetails) ? usageMetadata.promptTokensDetails : [];
  const mods = extractModalitiesFromDetails(details);
  const inputTextTokens = details.length ? mods.text : inputTokens;

  return {
    usageMetadata,
    modelVersion,
    responseId,
    inputTokens,
    outputTokens,
    totalTokens,
    cachedTokens,
    thinkingTokens,
    toolUsePromptTokens,
    inputTextTokens,
    inputAudioTokens: mods.audio,
    inputImageTokens: mods.image,
    inputVideoTokens: mods.video,
    inputDocumentTokens: mods.document,
    inputEmbeddingTokens: mods.embedding,
    usageMissing: false,
  };
}

export async function recordUsage(
  context: GeminiCallContext,
  responseLike: any,
  options?: {
    status?: 'SUCCESS' | 'ERROR' | 'TIMEOUT' | 'BLOCKED' | 'MISSING_PRICE';
    errorCode?: string;
    errorMessage?: string;
  }
): Promise<void> {
  if (!trackEnabled()) return;
  const model = usageEventModel();
  if (!model) return;
  try {
    const extracted = extractUsageMetadata(responseLike);
    const latencyMs = context.startedAt ? Math.max(0, Date.now() - context.startedAt) : undefined;
    const cost = await calculateGeminiCost(context.tenantId, {
      model: context.model,
      inputTextTokens: extracted.inputTextTokens,
      inputAudioTokens: extracted.inputAudioTokens,
      inputImageTokens: extracted.inputImageTokens,
      inputVideoTokens: extracted.inputVideoTokens,
      inputDocumentTokens: extracted.inputDocumentTokens,
      inputEmbeddingTokens: extracted.inputEmbeddingTokens,
      cachedTokens: extracted.cachedTokens,
      outputTokens: extracted.outputTokens,
      thinkingTokens: extracted.thinkingTokens,
      toolUsePromptTokens: extracted.toolUsePromptTokens,
      contextLength: extracted.inputTokens,
    });

    await model.create({
      data: {
        tenantId: context.tenantId,
        agentId: context.agentId ?? null,
        userId: context.userId ?? null,
        chatHistoryId: context.chatHistoryId ?? null,
        source: context.source,
        feature: context.feature,
        phase: context.phase ?? null,
        fsmState: context.fsmState ?? null,
        channel: context.channel ?? null,
        model: context.model,
        modelVersion: extracted.modelVersion ?? null,
        responseId: extracted.responseId ?? null,
        attempt: context.attempt ?? 1,
        inputTokens: extracted.inputTokens,
        outputTokens: extracted.outputTokens,
        totalTokens: extracted.totalTokens,
        thinkingTokens: extracted.thinkingTokens,
        cachedTokens: extracted.cachedTokens,
        toolUsePromptTokens: extracted.toolUsePromptTokens,
        inputTextTokens: extracted.inputTextTokens,
        inputAudioTokens: extracted.inputAudioTokens,
        inputImageTokens: extracted.inputImageTokens,
        inputVideoTokens: extracted.inputVideoTokens,
        inputDocumentTokens: extracted.inputDocumentTokens,
        inputEmbeddingTokens: extracted.inputEmbeddingTokens,
        estimatedCostUsd: cost.estimatedCostUsd,
        estimatedCostBrl: cost.estimatedCostBrl ?? 0,
        exchangeRateUsdBrl: cost.exchangeRateUsdBrl ?? null,
        status: options?.status ?? (cost.missingPrices.length > 0 ? 'MISSING_PRICE' : 'SUCCESS'),
        errorCode: options?.errorCode ?? null,
        errorMessage: sanitizeErrorMessage(options?.errorMessage) ?? null,
        latencyMs: latencyMs ?? null,
        usageMetadataJson: extracted.usageMetadata ?? null,
        priceSnapshotJson: cost.priceSnapshot,
        requestMetaJson: sanitizeRequestMeta(context.requestMeta) ?? null,
        toolsUsedJson: context.toolsUsed ?? null,
        missingPricesJson: cost.missingPrices,
      },
    });
  } catch (error) {
    console.warn('[GeminiUsageService] recordUsage falhou:', sanitizeErrorMessage(error));
  }
}

export async function recordError(
  context: GeminiCallContext,
  error: unknown,
  options?: { latencyMs?: number }
): Promise<void> {
  if (!trackEnabled()) return;
  const model = usageEventModel();
  if (!model) return;
  try {
    await model.create({
      data: {
        tenantId: context.tenantId,
        agentId: context.agentId ?? null,
        userId: context.userId ?? null,
        chatHistoryId: context.chatHistoryId ?? null,
        source: context.source,
        feature: context.feature,
        phase: context.phase ?? null,
        fsmState: context.fsmState ?? null,
        channel: context.channel ?? null,
        model: context.model,
        attempt: context.attempt ?? 1,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        thinkingTokens: 0,
        cachedTokens: 0,
        toolUsePromptTokens: 0,
        inputTextTokens: 0,
        inputAudioTokens: 0,
        inputImageTokens: 0,
        inputVideoTokens: 0,
        inputDocumentTokens: 0,
        inputEmbeddingTokens: 0,
        estimatedCostUsd: 0,
        estimatedCostBrl: 0,
        exchangeRateUsdBrl: null,
        status: 'ERROR',
        errorCode: (error as any)?.code ?? null,
        errorMessage: sanitizeErrorMessage((error as any)?.message ?? error),
        latencyMs: options?.latencyMs ?? (context.startedAt ? Date.now() - context.startedAt : null),
        usageMetadataJson: null,
        priceSnapshotJson: null,
        requestMetaJson: sanitizeRequestMeta(context.requestMeta) ?? null,
        toolsUsedJson: context.toolsUsed ?? null,
        missingPricesJson: null,
      },
    });
  } catch (err) {
    console.warn('[GeminiUsageService] recordError falhou:', sanitizeErrorMessage(err));
  }
}

export async function getUsageSummary(tenantId: string, from: Date, to: Date): Promise<any> {
  const model = usageEventModel();
  if (!model) {
    return {
      totalCalls: 0,
      totalTokens: 0,
      cachedTokens: 0,
      totalCostUsd: 0,
      totalCostBrl: 0,
      avgCostPerCallUsd: 0,
      hasMissingPrices: false,
      usedModelsWithoutPrice: [],
    };
  }

  const rows = await model.findMany({
    where: { tenantId, createdAt: { gte: from, lte: to } },
    select: {
      id: true,
      model: true,
      feature: true,
      fsmState: true,
      source: true,
      status: true,
      totalTokens: true,
      cachedTokens: true,
      estimatedCostUsd: true,
      estimatedCostBrl: true,
      missingPricesJson: true,
    },
  });

  const totalCalls = rows.length;
  const totalTokens = rows.reduce((acc: number, row: any) => acc + toNum(row.totalTokens), 0);
  const cachedTokens = rows.reduce((acc: number, row: any) => acc + toNum(row.cachedTokens), 0);
  const totalCostUsd = rows.reduce((acc: number, row: any) => acc + toNum(row.estimatedCostUsd), 0);
  const totalCostBrl = rows.reduce((acc: number, row: any) => acc + toNum(row.estimatedCostBrl), 0);
  const avgCostPerCallUsd = totalCalls > 0 ? totalCostUsd / totalCalls : 0;
  const usedModels = Array.from(new Set<string>(rows.map((row: any) => String(row.model ?? '')).filter(Boolean)));
  const usedModelsWithoutPrice = (await Promise.all(
    usedModels.map(async (model: string) => (await hasPriceForModel(model)) ? null : model)
  )).filter(Boolean);
  const hasMissingPrices = usedModelsWithoutPrice.length > 0;

  return {
    totalCalls,
    totalTokens,
    cachedTokens,
    totalCostUsd,
    totalCostBrl,
    avgCostPerCallUsd,
    hasMissingPrices,
    usedModelsWithoutPrice,
  };
}

export async function getDailyUsage(
  tenantId: string,
  from: Date,
  to: Date
): Promise<Array<{ date: string; costUsd: number; costBrl: number | null; tokens: number; calls: number }>> {
  const model = usageEventModel();
  if (!model) return [];

  const rows = await model.findMany({
    where: { tenantId, createdAt: { gte: from, lte: to } },
    select: { createdAt: true, totalTokens: true, estimatedCostUsd: true, estimatedCostBrl: true },
    orderBy: { createdAt: 'asc' },
  });

  const map = new Map<string, { costUsd: number; costBrl: number; tokens: number; calls: number }>();
  for (const row of rows) {
    const date = new Date(row.createdAt).toISOString().slice(0, 10);
    const agg = map.get(date) ?? { costUsd: 0, costBrl: 0, tokens: 0, calls: 0 };
    agg.costUsd += toNum(row.estimatedCostUsd);
    agg.costBrl += toNum(row.estimatedCostBrl);
    agg.tokens += toNum(row.totalTokens);
    agg.calls += 1;
    map.set(date, agg);
  }

  return Array.from(map.entries()).map(([date, value]) => ({
    date,
    costUsd: value.costUsd,
    costBrl: value.costBrl,
    tokens: value.tokens,
    calls: value.calls,
  }));
}

function maskPhone(input: string): string {
  const digits = String(input).replace(/\D/g, '');
  if (digits.length <= 6) return `${digits.slice(0, 2)}****`;
  return `${digits.slice(0, 4)}****${digits.slice(-2)}`;
}

export async function getUsageByLead(
  tenantId: string,
  from: Date,
  to: Date,
  limit = 20
): Promise<Array<{
  userId: string;
  maskedPhone: string;
  userName: string | null;
  calls: number;
  tokens: number;
  costUsd: number;
  costBrl: number | null;
}>> {
  const model = usageEventModel();
  if (!model) return [];

  const rows = await model.findMany({
    where: { tenantId, createdAt: { gte: from, lte: to }, userId: { not: null } },
    include: { user: { select: { id: true, name: true, phoneNumber: true } } },
  });

  const grouped = new Map<string, {
    userId: string;
    maskedPhone: string;
    userName: string | null;
    calls: number;
    tokens: number;
    costUsd: number;
    costBrl: number;
  }>();

  for (const row of rows) {
    if (!row.userId || !row.user) continue;
    const key = row.userId;
    const agg = grouped.get(key) ?? {
      userId: row.userId,
      maskedPhone: maskPhone(row.user.phoneNumber),
      userName: row.user.name ?? null,
      calls: 0,
      tokens: 0,
      costUsd: 0,
      costBrl: 0,
    };
    agg.calls += 1;
    agg.tokens += toNum(row.totalTokens);
    agg.costUsd += toNum(row.estimatedCostUsd);
    agg.costBrl += toNum(row.estimatedCostBrl);
    grouped.set(key, agg);
  }

  return Array.from(grouped.values())
    .sort((a, b) => b.costUsd - a.costUsd)
    .slice(0, limit)
    .map(item => ({ ...item, costBrl: item.costBrl }));
}

export async function listUsageEvents(
  tenantId: string,
  filters: {
    from?: Date;
    to?: Date;
    model?: string;
    feature?: string;
    status?: string;
    source?: string;
    take?: number;
    cursor?: string;
  }
): Promise<{ events: any[]; nextCursor: string | null }> {
  const take = Math.min(Math.max(filters.take ?? 30, 1), 200);
  const model = usageEventModel();
  if (!model) return { events: [], nextCursor: null };

  const rows = await model.findMany({
    where: {
      tenantId,
      ...(filters.from || filters.to ? { createdAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } } : {}),
      ...(filters.model ? { model: filters.model } : {}),
      ...(filters.feature ? { feature: filters.feature } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.source ? { source: filters.source } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: take + 1,
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
  });

  const hasNext = rows.length > take;
  const trimmed = hasNext ? rows.slice(0, take) : rows;
  const nextCursor = hasNext ? trimmed[trimmed.length - 1]?.id ?? null : null;

  const events = trimmed.map((row: any) => ({
    id: row.id,
    createdAt: row.createdAt,
    source: row.source,
    feature: row.feature,
    phase: row.phase,
    fsmState: row.fsmState,
    model: row.model,
    status: row.status,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    totalTokens: row.totalTokens,
    cachedTokens: row.cachedTokens,
    estimatedCostUsd: toNum(row.estimatedCostUsd),
    estimatedCostBrl: toNum(row.estimatedCostBrl),
    latencyMs: row.latencyMs,
    toolsUsed: Array.isArray(row.toolsUsedJson) ? row.toolsUsedJson : [],
    missingPrices: Array.isArray(row.missingPricesJson) ? row.missingPricesJson : [],
  }));

  return { events, nextCursor };
}
