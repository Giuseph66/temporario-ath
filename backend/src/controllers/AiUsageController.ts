import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { prisma } from '../utils/prisma';
import { getTenantUsageState } from '../services/GeminiBudgetService';
import { getUsageByLead, getUsageSummary, getDailyUsage, listUsageEvents } from '../services/GeminiUsageService';
import { listGeminiModelsForTenant, syncGeminiModelsForTenant, hasPriceForModel, getModelAvailability } from '../services/GeminiModelService';
import { syncGeminiPriceCatalogFromOfficialSource } from '../services/GeminiPricingSyncService';

type Period = 'today' | '7d' | '30d' | 'month';

function toNum(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function parsePeriod(raw?: string): { from: Date; to: Date; period: Period } {
  const now = new Date();
  const period = (raw ?? '30d') as Period;
  if (period === 'today') return { period, from: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0), to: now };
  if (period === '7d') return { period, from: new Date(now.getTime() - 7 * 86400000), to: now };
  if (period === 'month') return { period, from: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0), to: now };
  return { period: '30d', from: new Date(now.getTime() - 30 * 86400000), to: now };
}

function parseRange(req: AuthRequest): { from: Date; to: Date; period: Period } {
  const byPeriod = parsePeriod(req.query.period as string | undefined);
  const from = parseDate(req.query.from as string | undefined) ?? byPeriod.from;
  const to = parseDate(req.query.to as string | undefined) ?? byPeriod.to;
  return { from, to, period: byPeriod.period };
}

function normalizeOptionalDecimal(value: unknown): unknown {
  if (value === '') return null;
  return value;
}

async function usageRows(tenantId: string, from: Date, to: Date, extraWhere?: Record<string, unknown>) {
  return (prisma as any).geminiUsageEvent.findMany({
    where: { tenantId, createdAt: { gte: from, lte: to }, ...(extraWhere ?? {}) },
    select: {
      model: true,
      feature: true,
      fsmState: true,
      source: true,
      status: true,
      totalTokens: true,
      estimatedCostUsd: true,
      estimatedCostBrl: true,
    },
  });
}

function groupByKey(rows: any[], key: string) {
  const map = new Map<string, { key: string; calls: number; tokens: number; costUsd: number; costBrl: number }>();
  for (const row of rows) {
    const groupKey = String(row[key] ?? 'unknown');
    const agg = map.get(groupKey) ?? { key: groupKey, calls: 0, tokens: 0, costUsd: 0, costBrl: 0 };
    agg.calls += 1;
    agg.tokens += toNum(row.totalTokens);
    agg.costUsd += toNum(row.estimatedCostUsd);
    agg.costBrl += toNum(row.estimatedCostBrl);
    map.set(groupKey, agg);
  }
  return Array.from(map.values()).sort((a, b) => b.costUsd - a.costUsd);
}

export async function getAiUsageSummary(req: AuthRequest, res: Response): Promise<Response> {
  const { from, to, period } = parseRange(req);
  const summary = await getUsageSummary(req.tenantId, from, to);
  return res.json({ period, from, to, ...summary });
}

export async function getAiUsageTimeseries(req: AuthRequest, res: Response): Promise<Response> {
  const { from, to, period } = parseRange(req);
  const data = await getDailyUsage(req.tenantId, from, to);
  return res.json({ period, from, to, data });
}

export async function getAiUsageByModel(req: AuthRequest, res: Response): Promise<Response> {
  const { from, to, period } = parseRange(req);
  const rows = await usageRows(req.tenantId, from, to);
  return res.json({ period, from, to, data: groupByKey(rows, 'model') });
}

export async function getAiUsageByFeature(req: AuthRequest, res: Response): Promise<Response> {
  const { from, to, period } = parseRange(req);
  const rows = await usageRows(req.tenantId, from, to);
  return res.json({ period, from, to, data: groupByKey(rows, 'feature') });
}

export async function getAiUsageByState(req: AuthRequest, res: Response): Promise<Response> {
  const { from, to, period } = parseRange(req);
  const rows = await usageRows(req.tenantId, from, to);
  return res.json({ period, from, to, data: groupByKey(rows, 'fsmState') });
}

export async function getAiUsageByLead(req: AuthRequest, res: Response): Promise<Response> {
  const { from, to, period } = parseRange(req);
  const limit = Math.min(Math.max(Number(req.query.limit ?? 20), 1), 200);
  const data = await getUsageByLead(req.tenantId, from, to, limit);
  return res.json({ period, from, to, data });
}

export async function getAiUsageEvents(req: AuthRequest, res: Response): Promise<Response> {
  const { from, to, period } = parseRange(req);
  const take = Math.min(Math.max(Number(req.query.take ?? 30), 1), 200);
  const result = await listUsageEvents(req.tenantId, {
    from,
    to,
    model: req.query.model as string | undefined,
    feature: req.query.feature as string | undefined,
    source: req.query.source as string | undefined,
    status: req.query.status as string | undefined,
    take,
    cursor: req.query.cursor as string | undefined,
  });
  return res.json({ period, from, to, ...result });
}

export async function getAiUsageBudget(req: AuthRequest, res: Response): Promise<Response> {
  const budgetModel = (prisma as any).geminiUsageBudget;
  if (!budgetModel?.findUnique) return res.json(null);
  const budget = await budgetModel.findUnique({ where: { tenantId: req.tenantId } });
  return res.json(budget ?? null);
}

export async function patchAiUsageBudget(req: AuthRequest, res: Response): Promise<Response> {
  const budgetModel = (prisma as any).geminiUsageBudget;
  if (!budgetModel?.upsert) {
    return res.status(400).json({ error: 'Prisma Client sem GeminiUsageBudget. Rode migrate + generate.' });
  }
  const body = req.body as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  const scalarFields = [
    'monthlyLimitUsd',
    'monthlyLimitBrl',
    'fixedExchangeRateUsdBrl',
    'warning50Enabled',
    'warning80Enabled',
    'warning90Enabled',
    'hardLimitEnabled',
    'blockOnLimit',
    'preciseEmbeddingCount',
    'costCalculationMethod',
    'alertEmail',
    'alertWhatsapp',
  ];
  for (const field of scalarFields) {
    if (body[field] === undefined) continue;
    data[field] = ['monthlyLimitUsd', 'monthlyLimitBrl', 'fixedExchangeRateUsdBrl'].includes(field)
      ? normalizeOptionalDecimal(body[field])
      : body[field];
  }

  const result = await budgetModel.upsert({
    where: { tenantId: req.tenantId },
    create: { tenantId: req.tenantId, ...data },
    update: data,
  });
  return res.json(result);
}

export async function getAiUsageStatus(req: AuthRequest, res: Response): Promise<Response> {
  const state = await getTenantUsageState(req.tenantId);
  return res.json(state);
}

export async function getAiUsageModels(req: AuthRequest, res: Response): Promise<Response> {
  const method = req.query.method as 'generateContent' | 'embedContent' | 'countTokens' | undefined;
  const models = await listGeminiModelsForTenant(req.tenantId, method ? { method } : undefined);

  const enriched = await Promise.all(models.map(async (model: any) => ({
    ...model,
    hasPrice: await hasPriceForModel(model.name),
  })));

  const currentAgent = await prisma.agent.findFirst({ where: { tenantId: req.tenantId }, select: { geminiModel: true } });
  const availability = currentAgent?.geminiModel
    ? await getModelAvailability(req.tenantId, currentAgent.geminiModel)
    : null;
  const currentAgentModelHasPrice = currentAgent?.geminiModel
    ? await hasPriceForModel(currentAgent.geminiModel)
    : null;

  return res.json({
    currentAgentModel: currentAgent?.geminiModel ?? null,
    currentAgentModelAvailability: availability,
    currentAgentModelHasPrice,
    models: enriched,
  });
}

export async function postAiUsageModelsSync(req: AuthRequest, res: Response): Promise<Response> {
  const sync = await syncGeminiModelsForTenant(req.tenantId);
  return res.json(sync);
}

export async function getAiUsagePrices(req: AuthRequest, res: Response): Promise<Response> {
  const priceModel = (prisma as any).geminiPriceCatalog;
  if (!priceModel?.findMany) return res.json([]);
  const rows = await priceModel.findMany({
    orderBy: [{ model: 'asc' }, { modality: 'asc' }, { direction: 'asc' }, { effectiveFrom: 'desc' }],
  });
  return res.json(rows);
}

export async function postAiUsagePrices(req: AuthRequest, res: Response): Promise<Response> {
  const priceModel = (prisma as any).geminiPriceCatalog;
  if (!priceModel?.create) {
    return res.status(400).json({ error: 'Prisma Client sem GeminiPriceCatalog. Rode migrate + generate.' });
  }
  const body = req.body as Record<string, any>;
  if (!body.model || !body.modality || !body.direction || body.pricePerMillion == null) {
    return res.status(400).json({ error: 'model, modality, direction e pricePerMillion são obrigatórios.' });
  }
  const created = await priceModel.create({
    data: {
      model: String(body.model),
      modality: String(body.modality),
      direction: String(body.direction),
      pricePerMillion: body.pricePerMillion,
      currency: body.currency ?? 'USD',
      unit: body.unit ?? '1M_TOKENS',
      contextThreshold: body.contextThreshold ?? null,
      thinkingIncludedInOutput: body.thinkingIncludedInOutput ?? true,
      effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : new Date(),
      effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : null,
      isManual: body.isManual ?? true,
      isFallbackSeed: body.isFallbackSeed ?? false,
      isDeprecated: body.isDeprecated ?? false,
      note: body.note ?? null,
      sourceUrl: body.sourceUrl ?? null,
    },
  });
  return res.json(created);
}

export async function patchAiUsagePrice(req: AuthRequest, res: Response): Promise<Response> {
  const priceModel = (prisma as any).geminiPriceCatalog;
  if (!priceModel?.update) {
    return res.status(400).json({ error: 'Prisma Client sem GeminiPriceCatalog. Rode migrate + generate.' });
  }
  const id = req.params.id;
  const body = req.body as Record<string, any>;
  const data: Record<string, unknown> = {};
  const fields = [
    'model', 'modality', 'direction', 'pricePerMillion', 'currency', 'unit', 'contextThreshold',
    'thinkingIncludedInOutput', 'effectiveFrom', 'effectiveTo', 'isManual', 'isFallbackSeed', 'isDeprecated', 'note', 'sourceUrl',
  ];
  for (const field of fields) {
    if (body[field] !== undefined) data[field] = body[field];
  }
  if (data.effectiveFrom) data.effectiveFrom = new Date(String(data.effectiveFrom));
  if (data.effectiveTo) data.effectiveTo = data.effectiveTo ? new Date(String(data.effectiveTo)) : null;

  const updated = await priceModel.update({
    where: { id },
    data,
  });
  return res.json(updated);
}

export async function postAiUsagePriceSync(req: AuthRequest, res: Response): Promise<Response> {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const dryRun = body.dryRun !== false;
  const forceOverwriteManual = body.forceOverwriteManual === true;
  const sourceUrl = typeof body.sourceUrl === 'string' && body.sourceUrl.trim()
    ? body.sourceUrl.trim()
    : undefined;

  const result = await syncGeminiPriceCatalogFromOfficialSource({
    sourceUrl,
    dryRun,
    forceOverwriteManual,
  });

  const statusCode = result.errors.length ? 400 : 200;
  return res.status(statusCode).json(result);
}
