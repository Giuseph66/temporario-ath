import { prisma } from '../utils/prisma';
import { normalizeGeminiModelName } from './GeminiPriceService';

const DEFAULT_SOURCE_URL = 'https://ai.google.dev/gemini-api/docs/pricing.md.txt?hl=pt-br';

type ParsedPrice = {
  model: string;
  modality: string;
  direction: string;
  pricePerMillion: number;
  contextThreshold?: number | null;
  sourceUrl: string;
  note?: string;
};

type SyncOptions = {
  sourceUrl?: string;
  dryRun?: boolean;
  forceOverwriteManual?: boolean;
};

type SyncResult = {
  sourceUrl: string;
  parsedCount: number;
  created: number;
  updated: number;
  skippedManual: number;
  unchanged: number;
  errors: string[];
  diff: Array<{
    key: string;
    model: string;
    modality: string;
    direction: string;
    oldPricePerMillion: number | null;
    newPricePerMillion: number;
    action: 'create' | 'update' | 'unchanged' | 'skip_manual';
  }>;
};

function normalizeHeaderCell(cell: string): string {
  return cell
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function parsePriceNumber(cell: string): number | null {
  // aceita: $0.10, 0,10, $1.00 / 1,000,000
  const cleaned = cell.replace(/\./g, '.').replace(',', '.');
  const match = cleaned.match(/\$?\s*([0-9]+(?:\.[0-9]+)?)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function extractModelsFromLine(line: string): string[] {
  const matches = line.replace(/`/g, '').match(/gemini-[a-z0-9.\-]+/gi) ?? [];
  return Array.from(new Set(matches.map(model => normalizeGeminiModelName(model))));
}

function splitMarkdownRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map(c => c.trim());
}

function parseModalities(raw: string, fallback: string): string[] {
  const normalized = normalizeHeaderCell(raw);
  if (!normalized.trim()) return [fallback];

  const modalities: string[] = [];
  if (normalized.includes('text')) modalities.push('text');
  if (normalized.includes('image')) modalities.push('image');
  if (normalized.includes('video')) modalities.push('video');
  if (normalized.includes('audio')) modalities.push('audio');
  if (normalized.includes('document') || normalized.includes('pdf')) modalities.push('document');
  if (normalized.includes('embedding')) modalities.push('embedding');
  return modalities.length ? modalities : [fallback];
}

function parseThresholdPrices(cell: string): Array<{ price: number; contextThreshold: number | null }> {
  const compact = cell.replace(/\\<=/g, '<=').replace(/\\>/g, '>');
  const matches = Array.from(compact.matchAll(/\$([0-9]+(?:\.[0-9]+)?)[^$]*(<=|>|&gt;|&lt;=)\s*200k/gi));
  if (!matches.length) {
    const price = parsePriceNumber(compact);
    return price == null ? [] : [{ price, contextThreshold: null }];
  }

  return matches.map(match => ({
    price: Number(match[1]),
    contextThreshold: match[2].includes('>') || match[2].includes('&gt;') ? 200000 : null,
  })).filter(item => Number.isFinite(item.price) && item.price > 0);
}

function parseModalityPrices(cell: string, fallbackModality: string): Array<{ modality: string; price: number }> {
  const entries = Array.from(cell.matchAll(/\$([0-9]+(?:\.[0-9]+)?)\s*\(([^)]+)\)/gi));
  if (!entries.length) {
    const price = parsePriceNumber(cell);
    return price == null ? [] : [{ modality: fallbackModality, price }];
  }

  const parsed: Array<{ modality: string; price: number }> = [];
  for (const entry of entries) {
    const price = Number(entry[1]);
    if (!Number.isFinite(price) || price <= 0) continue;
    for (const modality of parseModalities(entry[2], fallbackModality)) {
      parsed.push({ modality, price });
    }
  }
  return parsed;
}

function parsePaidTierCell(model: string, rowLabel: string, paidCell: string, sourceUrl: string): ParsedPrice[] {
  const label = normalizeHeaderCell(rowLabel);
  const fallbackInputModality = model.includes('embedding') ? 'embedding' : 'text';

  if (label.includes('input price')) {
    if (/[<>]=?|\b200k\b/i.test(paidCell)) {
      return parseThresholdPrices(paidCell).map(item => ({
        model,
        modality: fallbackInputModality,
        direction: 'input',
        pricePerMillion: item.price,
        contextThreshold: item.contextThreshold,
        sourceUrl,
        note: 'Synced from Standard tier pricing.md.txt',
      }));
    }

    return parseModalityPrices(paidCell, fallbackInputModality).map(item => ({
      model,
      modality: item.modality,
      direction: 'input',
      pricePerMillion: item.price,
      contextThreshold: null,
      sourceUrl,
      note: 'Synced from Standard tier pricing.md.txt',
    }));
  }

  if (label.includes('output price')) {
    return parseThresholdPrices(paidCell).map(item => ({
      model,
      modality: 'text',
      direction: 'output',
      pricePerMillion: item.price,
      contextThreshold: item.contextThreshold,
      sourceUrl,
      note: 'Synced from Standard tier pricing.md.txt',
    }));
  }

  if (label.includes('context caching price')) {
    if (/[<>]=?|\b200k\b/i.test(paidCell)) {
      return parseThresholdPrices(paidCell).map(item => ({
        model,
        modality: 'cache',
        direction: 'input',
        pricePerMillion: item.price,
        contextThreshold: item.contextThreshold,
        sourceUrl,
        note: 'Synced from Standard tier pricing.md.txt',
      }));
    }

    return parseModalityPrices(paidCell.replace(/\$[0-9]+(?:\.[0-9]+)?\s*\/\s*1,000,000 tokens per hour.*$/i, ''), 'cache').map(item => ({
      model,
      modality: item.modality === 'audio' ? 'cache_audio' : 'cache',
      direction: 'input',
      pricePerMillion: item.price,
      contextThreshold: null,
      sourceUrl,
      note: 'Synced from Standard tier pricing.md.txt',
    }));
  }

  return [];
}

function parsePricingMarkdown(raw: string, sourceUrl: string): ParsedPrice[] {
  const lines = raw.split('\n');
  const parsed: ParsedPrice[] = [];

  let currentModels: string[] = [];
  let currentPlan: string | null = null;
  let inPricingTable = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('## ')) {
      currentModels = [];
      currentPlan = null;
      inPricingTable = false;
      continue;
    }

    if (trimmed.includes('`gemini-')) {
      const models = extractModelsFromLine(trimmed);
      if (models.length) currentModels = models;
      continue;
    }

    if (trimmed.startsWith('### ')) {
      currentPlan = trimmed.replace(/^###\s+/, '').trim().toLowerCase();
      inPricingTable = false;
      continue;
    }

    if (!trimmed.includes('|')) continue;

    const cells = splitMarkdownRow(trimmed);
    if (cells.length < 3) continue;

    const isSeparator = cells.every(c => /^:?-{2,}:?$/.test(c.replace(/\s/g, '')));
    if (isSeparator) continue;

    if (cells.some(c => /paid tier/i.test(c)) && cells.some(c => /free tier/i.test(c))) {
      inPricingTable = currentPlan === 'standard' && currentModels.length > 0;
      continue;
    }

    if (!inPricingTable || !currentModels.length) continue;

    const rowLabel = cells[0];
    const paidCell = cells[2] ?? '';
    if (!/input price|output price|context caching price/i.test(rowLabel)) continue;

    for (const model of currentModels) {
      parsed.push(...parsePaidTierCell(model, rowLabel, paidCell, sourceUrl));
    }
  }

  // dedup by key, keep last
  const byKey = new Map<string, ParsedPrice>();
  for (const item of parsed) {
    const key = `${item.model}|${item.modality}|${item.direction}|${item.contextThreshold ?? 'base'}`;
    byKey.set(key, item);
  }

  return Array.from(byKey.values());
}

export async function syncGeminiPriceCatalogFromOfficialSource(options?: SyncOptions): Promise<SyncResult> {
  const sourceUrl = options?.sourceUrl ?? DEFAULT_SOURCE_URL;
  const dryRun = options?.dryRun !== false;
  const forceOverwriteManual = options?.forceOverwriteManual === true;

  const priceModel = (prisma as any).geminiPriceCatalog;
  if (!priceModel?.findMany) {
    return {
      sourceUrl,
      parsedCount: 0,
      created: 0,
      updated: 0,
      skippedManual: 0,
      unchanged: 0,
      errors: ['Prisma Client sem GeminiPriceCatalog. Rode migrate + generate.'],
      diff: [],
    };
  }

  const errors: string[] = [];
  let markdown = '';
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(sourceUrl, { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) {
      return {
        sourceUrl,
        parsedCount: 0,
        created: 0,
        updated: 0,
        skippedManual: 0,
        unchanged: 0,
        errors: [`Falha ao baixar pricing.md.txt (${response.status}).`],
        diff: [],
      };
    }
    markdown = await response.text();
  } catch (error) {
    return {
      sourceUrl,
      parsedCount: 0,
      created: 0,
      updated: 0,
      skippedManual: 0,
      unchanged: 0,
      errors: [error instanceof Error ? error.message : 'Erro desconhecido ao baixar pricing.md.txt.'],
      diff: [],
    };
  }

  const parsed = parsePricingMarkdown(markdown, sourceUrl);
  const existing = await priceModel.findMany({
    select: { id: true, model: true, modality: true, direction: true, contextThreshold: true, pricePerMillion: true, isManual: true, sourceUrl: true, isDeprecated: true },
  });

  const byKey = new Map<string, any>();
  for (const row of existing) {
    byKey.set(`${row.model}|${row.modality}|${row.direction}|${row.contextThreshold ?? 'base'}`, row);
  }

  const diff: SyncResult['diff'] = [];
  let created = 0;
  let updated = 0;
  let skippedManual = 0;
  let unchanged = 0;

  for (const item of parsed) {
    const key = `${item.model}|${item.modality}|${item.direction}|${item.contextThreshold ?? 'base'}`;
    const row = byKey.get(key);

    if (!row) {
      diff.push({
        key,
        model: item.model,
        modality: item.modality,
        direction: item.direction,
        oldPricePerMillion: null,
        newPricePerMillion: item.pricePerMillion,
        action: 'create',
      });
      if (!dryRun) {
        await priceModel.create({
          data: {
            model: item.model,
            modality: item.modality,
            direction: item.direction,
            pricePerMillion: item.pricePerMillion,
            currency: 'USD',
            unit: '1M_TOKENS',
            contextThreshold: item.contextThreshold ?? null,
            thinkingIncludedInOutput: item.direction === 'output',
            isManual: false,
            isFallbackSeed: false,
            isDeprecated: false,
            sourceUrl: item.sourceUrl,
            note: item.note ?? 'Synced from pricing.md.txt',
          },
        });
      }
      created++;
      continue;
    }

    const existingPrice = Number(row.pricePerMillion ?? 0);

    if (Math.abs(existingPrice - item.pricePerMillion) < 1e-9) {
      diff.push({
        key,
        model: item.model,
        modality: item.modality,
        direction: item.direction,
        oldPricePerMillion: existingPrice,
        newPricePerMillion: item.pricePerMillion,
        action: 'unchanged',
      });
      unchanged++;
      continue;
    }

    if (row.isManual && !forceOverwriteManual) {
      diff.push({
        key,
        model: item.model,
        modality: item.modality,
        direction: item.direction,
        oldPricePerMillion: existingPrice,
        newPricePerMillion: item.pricePerMillion,
        action: 'skip_manual',
      });
      skippedManual++;
      continue;
    }

    diff.push({
      key,
      model: item.model,
      modality: item.modality,
      direction: item.direction,
      oldPricePerMillion: existingPrice,
      newPricePerMillion: item.pricePerMillion,
      action: 'update',
    });

    if (!dryRun) {
      await priceModel.update({
        where: { id: row.id },
        data: {
          pricePerMillion: item.pricePerMillion,
          contextThreshold: item.contextThreshold ?? null,
          sourceUrl: item.sourceUrl,
          isDeprecated: false,
          note: row.isManual ? 'Manual overridden by sync (force=true).' : item.note ?? 'Synced from pricing.md.txt',
          isManual: forceOverwriteManual ? false : row.isManual,
        },
      });
    }
    updated++;
  }

  return {
    sourceUrl,
    parsedCount: parsed.length,
    created,
    updated,
    skippedManual,
    unchanged,
    errors,
    diff,
  };
}
