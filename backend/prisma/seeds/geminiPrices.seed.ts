import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type PriceSeed = {
  model: string;
  modality: string;
  direction: string;
  pricePerMillion: string;
  contextThreshold?: number;
  thinkingIncludedInOutput?: boolean;
  isDeprecated?: boolean;
  note?: string;
};

const SOURCE_URL = 'https://ai.google.dev/gemini-api/docs/pricing';
const EFFECTIVE_FROM = new Date('2026-01-01T00:00:00.000Z');

// Observação: preços seed são fallback operacional para tracking estimado.
// Podem ser ajustados no painel sem quebrar histórico.
const SEEDS: PriceSeed[] = [
  { model: 'gemini-2.5-flash', modality: 'text', direction: 'input', pricePerMillion: '0.30' },
  { model: 'gemini-2.5-flash', modality: 'text', direction: 'output', pricePerMillion: '2.50' },
  { model: 'gemini-2.5-flash', modality: 'cache', direction: 'input', pricePerMillion: '0.075' },
  { model: 'gemini-2.5-flash', modality: 'audio', direction: 'input', pricePerMillion: '1.20' },
  { model: 'gemini-2.5-flash', modality: 'image', direction: 'input', pricePerMillion: '1.20' },
  { model: 'gemini-2.5-flash', modality: 'video', direction: 'input', pricePerMillion: '2.00' },

  { model: 'gemini-2.5-flash-preview-05-20', modality: 'text', direction: 'input', pricePerMillion: '0.30' },
  { model: 'gemini-2.5-flash-preview-05-20', modality: 'text', direction: 'output', pricePerMillion: '2.50' },
  { model: 'gemini-2.5-flash-preview-05-20', modality: 'cache', direction: 'input', pricePerMillion: '0.075' },

  { model: 'gemini-2.5-flash-lite', modality: 'text', direction: 'input', pricePerMillion: '0.10' },
  { model: 'gemini-2.5-flash-lite', modality: 'text', direction: 'output', pricePerMillion: '0.40' },
  { model: 'gemini-2.5-flash-lite', modality: 'cache', direction: 'input', pricePerMillion: '0.025' },

  { model: 'gemini-2.5-pro', modality: 'text', direction: 'input', pricePerMillion: '1.25' },
  { model: 'gemini-2.5-pro', modality: 'text', direction: 'output', pricePerMillion: '10.00' },
  { model: 'gemini-2.5-pro', modality: 'cache', direction: 'input', pricePerMillion: '0.3125' },
  { model: 'gemini-2.5-pro', modality: 'audio', direction: 'input', pricePerMillion: '2.50' },
  { model: 'gemini-2.5-pro', modality: 'image', direction: 'input', pricePerMillion: '2.50' },
  { model: 'gemini-2.5-pro', modality: 'video', direction: 'input', pricePerMillion: '4.00' },

  { model: 'gemini-2.5-pro-preview', modality: 'text', direction: 'input', pricePerMillion: '1.25' },
  { model: 'gemini-2.5-pro-preview', modality: 'text', direction: 'output', pricePerMillion: '10.00' },
  { model: 'gemini-2.5-pro-preview', modality: 'cache', direction: 'input', pricePerMillion: '0.3125' },

  { model: 'gemini-3-flash-preview', modality: 'text', direction: 'input', pricePerMillion: '0.30' },
  { model: 'gemini-3-flash-preview', modality: 'text', direction: 'output', pricePerMillion: '2.50' },

  { model: 'gemini-3.1-flash-lite', modality: 'text', direction: 'input', pricePerMillion: '0.10' },
  { model: 'gemini-3.1-flash-lite', modality: 'text', direction: 'output', pricePerMillion: '0.40' },
  { model: 'gemini-3.1-flash-lite-preview', modality: 'text', direction: 'input', pricePerMillion: '0.10' },
  { model: 'gemini-3.1-flash-lite-preview', modality: 'text', direction: 'output', pricePerMillion: '0.40' },

  { model: 'gemini-3.1-pro-preview', modality: 'text', direction: 'input', pricePerMillion: '1.25' },
  { model: 'gemini-3.1-pro-preview', modality: 'text', direction: 'output', pricePerMillion: '10.00' },

  { model: 'gemini-embedding-2', modality: 'embedding', direction: 'input', pricePerMillion: '0.15' },

  {
    model: 'gemini-2.0-flash',
    modality: 'text',
    direction: 'input',
    pricePerMillion: '0.10',
    isDeprecated: true,
    note: 'Modelo legado. Manter apenas para compatibilidade histórica.',
  },
  {
    model: 'gemini-2.0-flash',
    modality: 'text',
    direction: 'output',
    pricePerMillion: '0.40',
    isDeprecated: true,
    note: 'Modelo legado. Manter apenas para compatibilidade histórica.',
  },
  {
    model: 'gemini-2.0-flash-lite',
    modality: 'text',
    direction: 'input',
    pricePerMillion: '0.075',
    isDeprecated: true,
    note: 'Modelo legado. Manter apenas para compatibilidade histórica.',
  },
  {
    model: 'gemini-2.0-flash-lite',
    modality: 'text',
    direction: 'output',
    pricePerMillion: '0.30',
    isDeprecated: true,
    note: 'Modelo legado. Manter apenas para compatibilidade histórica.',
  },
];

function seedId(seed: PriceSeed): string {
  const base = `${seed.model}|${seed.modality}|${seed.direction}`.toLowerCase();
  return base.replace(/[^a-z0-9|.-]/g, '_');
}

async function main() {
  for (const item of SEEDS) {
    await prisma.geminiPriceCatalog.upsert({
      where: { id: seedId(item) },
      update: {
        model: item.model,
        modality: item.modality,
        direction: item.direction,
        pricePerMillion: item.pricePerMillion,
        currency: 'USD',
        unit: '1M_TOKENS',
        contextThreshold: item.contextThreshold ?? null,
        thinkingIncludedInOutput: item.thinkingIncludedInOutput ?? true,
        effectiveFrom: EFFECTIVE_FROM,
        effectiveTo: null,
        isManual: true,
        isFallbackSeed: true,
        isDeprecated: item.isDeprecated ?? false,
        note: item.note ?? null,
        sourceUrl: SOURCE_URL,
      },
      create: {
        id: seedId(item),
        model: item.model,
        modality: item.modality,
        direction: item.direction,
        pricePerMillion: item.pricePerMillion,
        currency: 'USD',
        unit: '1M_TOKENS',
        contextThreshold: item.contextThreshold ?? null,
        thinkingIncludedInOutput: item.thinkingIncludedInOutput ?? true,
        effectiveFrom: EFFECTIVE_FROM,
        effectiveTo: null,
        isManual: true,
        isFallbackSeed: true,
        isDeprecated: item.isDeprecated ?? false,
        note: item.note ?? null,
        sourceUrl: SOURCE_URL,
      },
    });
  }

  console.log(`Seed Gemini prices concluído: ${SEEDS.length} registros (upsert).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
