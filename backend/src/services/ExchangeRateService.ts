import { prisma } from '../utils/prisma';

const CACHE_ID = 'exchange-rate';

let memoryRate: number | null = null;
let memoryRateAt: number | null = null;

function cacheHours(): number {
  const raw = Number(process.env.EXCHANGE_RATE_CACHE_HOURS ?? '1');
  return Number.isFinite(raw) && raw > 0 ? raw : 1;
}

function cacheMs(): number {
  return cacheHours() * 60 * 60 * 1000;
}

function isMemoryFresh(): boolean {
  if (memoryRate === null || memoryRateAt === null) return false;
  return Date.now() - memoryRateAt < cacheMs();
}

function parseRateFromPayload(payload: unknown): number | null {
  try {
    const bid = (payload as any)?.USDBRL?.bid;
    const parsed = Number(bid);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function readRateFromDbCache(): Promise<number | null> {
  const cacheModel = (prisma as any).geminiPricingCache;
  if (!cacheModel?.findUnique) return null;
  try {
    const row = await cacheModel.findUnique({ where: { id: CACHE_ID } });
    if (!row?.data) return null;
    const parsed = Number(row.data);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    memoryRate = parsed;
    memoryRateAt = row.updatedAt ? new Date(row.updatedAt).getTime() : Date.now();
    return parsed;
  } catch {
    return null;
  }
}

async function writeRateToDbCache(rate: number): Promise<void> {
  const cacheModel = (prisma as any).geminiPricingCache;
  if (!cacheModel?.upsert) return;
  try {
    await cacheModel.upsert({
      where: { id: CACHE_ID },
      create: { id: CACHE_ID, data: String(rate) },
      update: { data: String(rate) },
    });
  } catch {
    // tracking cache failure never quebra fluxo
  }
}

export async function getCurrentExchangeRate(): Promise<number | null> {
  try {
    if (isMemoryFresh()) return memoryRate;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL', {
        method: 'GET',
        signal: controller.signal,
      });
      if (!res.ok) {
        clearTimeout(timeout);
        const fallbackDb = await readRateFromDbCache();
        return fallbackDb;
      }
      const payload = await res.json();
      clearTimeout(timeout);
      const rate = parseRateFromPayload(payload);
      if (rate === null) {
        const fallbackDb = await readRateFromDbCache();
        return fallbackDb;
      }
      memoryRate = rate;
      memoryRateAt = Date.now();
      await writeRateToDbCache(rate);
      return rate;
    } catch {
      clearTimeout(timeout);
      const fallbackDb = await readRateFromDbCache();
      return fallbackDb;
    }
  } catch {
    return null;
  }
}

export async function getUsdBrlRateForTenant(tenantId?: string): Promise<number | null> {
  try {
    if (tenantId) {
      const budget = await (prisma as any).geminiUsageBudget.findUnique({
        where: { tenantId },
        select: { fixedExchangeRateUsdBrl: true },
      });
      const fixed = budget?.fixedExchangeRateUsdBrl != null ? Number(budget.fixedExchangeRateUsdBrl) : null;
      if (fixed && Number.isFinite(fixed) && fixed > 0) return fixed;
    }
    return await getCurrentExchangeRate();
  } catch {
    return await getCurrentExchangeRate();
  }
}

export function convertUsdToBrl(usd: number, rate: number | null): number | null {
  if (!Number.isFinite(usd)) return null;
  if (rate === null || !Number.isFinite(rate) || rate <= 0) return null;
  return usd * rate;
}
