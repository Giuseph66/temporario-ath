import { prisma } from '../utils/prisma';
import { getPriceCatalogForModel, normalizeGeminiModelName } from './GeminiPriceService';

const MODEL_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const lastSyncByTenant = new Map<string, number>();

function sanitizeError(err: unknown): string {
  if (err instanceof Error) return err.message.slice(0, 300);
  return 'Erro desconhecido';
}

async function resolveTenantGeminiKey(tenantId: string): Promise<string | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { geminiApiKey: true },
  });
  return tenant?.geminiApiKey ?? null;
}

function parsePreviewFlag(model: any): boolean {
  const joined = `${model?.name ?? ''} ${model?.displayName ?? ''} ${model?.description ?? ''}`.toLowerCase();
  return joined.includes('preview');
}

function parseDeprecatedFlag(model: any): boolean {
  const joined = `${model?.name ?? ''} ${model?.displayName ?? ''} ${model?.description ?? ''}`.toLowerCase();
  return joined.includes('deprecated') || joined.includes('will be shut down');
}

export async function syncGeminiModelsForTenant(tenantId: string): Promise<{
  count: number;
  added: number;
  updated: number;
  deprecated: number;
  errors: string[];
}> {
  const errors: string[] = [];
  const modelCatalog = (prisma as any).geminiModelCatalog;
  if (!modelCatalog?.upsert) {
    return { count: 0, added: 0, updated: 0, deprecated: 0, errors: ['Prisma Client sem GeminiModelCatalog. Rode migrate + generate.'] };
  }
  try {
    const apiKey = await resolveTenantGeminiKey(tenantId);
    if (!apiKey) {
      return { count: 0, added: 0, updated: 0, deprecated: 0, errors: ['API key Gemini não configurada no tenant.'] };
    }

    const now = Date.now();
    const last = lastSyncByTenant.get(tenantId) ?? 0;
    if (now - last < 60_000) {
      return { count: 0, added: 0, updated: 0, deprecated: 0, errors: ['Sync limitado: aguarde 1 minuto entre sincronizações.'] };
    }
    lastSyncByTenant.set(tenantId, now);

    const res = await fetch(`${MODEL_ENDPOINT}?key=${apiKey}`);
    if (!res.ok) {
      return { count: 0, added: 0, updated: 0, deprecated: 0, errors: [`Falha no ListModels (${res.status}).`] };
    }
    const payload = await res.json() as any;
    const models = Array.isArray(payload?.models) ? payload.models : [];
    let added = 0;
    let updated = 0;

    const remoteNames = new Set<string>();
    for (const model of models) {
      const normalizedName = normalizeGeminiModelName(String(model.name ?? ''));
      if (!normalizedName) continue;
      remoteNames.add(normalizedName);
      const existing = await modelCatalog.findFirst({
        where: { tenantId, name: normalizedName },
        select: { id: true },
      });
      await modelCatalog.upsert({
        where: { tenantId_name: { tenantId, name: normalizedName } },
        create: {
          tenantId,
          name: normalizedName,
          displayName: model.displayName ?? null,
          version: model.version ?? null,
          description: model.description ?? null,
          inputTokenLimit: model.inputTokenLimit ?? null,
          outputTokenLimit: model.outputTokenLimit ?? null,
          supportedMethodsJson: model.supportedGenerationMethods ?? null,
          isAvailable: true,
          isDeprecated: parseDeprecatedFlag(model),
          isPreview: parsePreviewFlag(model),
          rawJson: model,
          lastSyncedAt: new Date(),
        },
        update: {
          displayName: model.displayName ?? null,
          version: model.version ?? null,
          description: model.description ?? null,
          inputTokenLimit: model.inputTokenLimit ?? null,
          outputTokenLimit: model.outputTokenLimit ?? null,
          supportedMethodsJson: model.supportedGenerationMethods ?? null,
          isAvailable: true,
          isDeprecated: parseDeprecatedFlag(model),
          isPreview: parsePreviewFlag(model),
          rawJson: model,
          lastSyncedAt: new Date(),
        },
      });
      if (existing) updated++;
      else added++;
    }

    const stale = await modelCatalog.findMany({
      where: { tenantId, isAvailable: true },
      select: { id: true, name: true },
    });
    let deprecated = 0;
    for (const row of stale) {
      if (!remoteNames.has(row.name)) {
        await modelCatalog.update({
          where: { id: row.id },
          data: { isAvailable: false, isDeprecated: true, lastSyncedAt: new Date() },
        });
        deprecated++;
      }
    }

    return { count: models.length, added, updated, deprecated, errors };
  } catch (error) {
    errors.push(sanitizeError(error));
    return { count: 0, added: 0, updated: 0, deprecated: 0, errors };
  }
}

export async function listGeminiModelsForTenant(
  tenantId: string,
  options?: { method?: 'generateContent' | 'embedContent' | 'countTokens' }
): Promise<any[]> {
  const modelCatalog = (prisma as any).geminiModelCatalog;
  if (!modelCatalog?.findMany) return [];
  const rows = await modelCatalog.findMany({
    where: { tenantId },
    orderBy: [{ isAvailable: 'desc' }, { name: 'asc' }],
  });
  const method = options?.method;
  if (!method) return rows;
  return rows.filter((row: any) => {
    const methods = Array.isArray(row.supportedMethodsJson) ? row.supportedMethodsJson : [];
    return methods.includes(method);
  });
}

export async function getModelAvailability(
  tenantId: string,
  model: string
): Promise<{
  available: boolean;
  supportedMethods: string[];
  isDeprecated: boolean;
  reason?: string;
}> {
  const modelCatalog = (prisma as any).geminiModelCatalog;
  if (!modelCatalog?.findFirst) {
    return {
      available: false,
      supportedMethods: [],
      isDeprecated: false,
      reason: 'Prisma Client sem GeminiModelCatalog. Rode migrate + generate.',
    };
  }
  const normalized = normalizeGeminiModelName(model);
  const row = await modelCatalog.findFirst({
    where: { tenantId, name: normalized },
  });
  if (!row) {
    return {
      available: false,
      supportedMethods: [],
      isDeprecated: false,
      reason: 'Modelo não encontrado no catálogo do tenant. Faça sync.',
    };
  }
  return {
    available: Boolean(row.isAvailable),
    supportedMethods: Array.isArray(row.supportedMethodsJson) ? row.supportedMethodsJson : [],
    isDeprecated: Boolean(row.isDeprecated),
    reason: row.isAvailable ? undefined : 'Modelo indisponível na chave atual.',
  };
}

export async function hasPriceForModel(model: string): Promise<boolean> {
  const rows = await getPriceCatalogForModel(model);
  return rows.length > 0;
}
