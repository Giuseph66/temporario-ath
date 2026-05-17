import { prisma } from '../utils/prisma';
import { recordError, recordUsage } from './GeminiUsageService';

// gemini-embedding-2 supports Matryoshka dims: 3072, 1024, 768
// outputDimensionality: 768 keeps compatibility with existing vector(768) pgvector column
const MODEL = 'gemini-embedding-2';
const OUTPUT_DIMS = 768;
const BASE = 'https://generativelanguage.googleapis.com/v1beta';

async function resolveApiKey(tenantId?: string): Promise<string> {
    if (tenantId) {
        const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { geminiApiKey: true } });
        if (tenant?.geminiApiKey) return tenant.geminiApiKey;
    }
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY não configurada para embeddings.');
    return key;
}

export async function embedText(text: string, tenantId?: string): Promise<number[]> {
    const startedAt = Date.now();
    const apiKey = await resolveApiKey(tenantId);
    const url = `${BASE}/models/${MODEL}:embedContent?key=${apiKey}`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: `models/${MODEL}`,
                content: { parts: [{ text }] },
                outputDimensionality: OUTPUT_DIMS,
            }),
        });
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Embedding API error ${res.status}: ${err}`);
        }
        const data = await res.json() as { embedding: { values: number[] }; usageMetadata?: any };
        const values = data.embedding.values;

        if (tenantId) {
            let usageMetadata = data.usageMetadata ?? null;
            const requestMeta: Record<string, unknown> = {
                textLength: text.length,
                outputDimensionality: OUTPUT_DIMS,
            };

            if (!usageMetadata) {
                let estimatedTokens = Math.ceil(text.length / 4);
                try {
                    const budget = await (prisma as any).geminiUsageBudget.findUnique({
                        where: { tenantId },
                        select: { preciseEmbeddingCount: true },
                    });
                    if (budget?.preciseEmbeddingCount) {
                        const countRes = await fetch(`${BASE}/models/${MODEL}:countTokens?key=${apiKey}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                model: `models/${MODEL}`,
                                contents: [{ role: 'user', parts: [{ text }] }],
                            }),
                        });
                        if (countRes.ok) {
                            const countPayload = await countRes.json() as { totalTokens?: number };
                            const maybe = Number(countPayload.totalTokens ?? 0);
                            if (Number.isFinite(maybe) && maybe > 0) {
                                estimatedTokens = maybe;
                                requestMeta.tokenEstimationMethod = 'countTokens';
                            }
                        }
                    }
                } catch {
                    // keep char_div_4 fallback
                }
                if (!requestMeta.tokenEstimationMethod) requestMeta.tokenEstimationMethod = 'char_div_4';
                requestMeta.estimatedTokens = true;
                usageMetadata = {
                    promptTokenCount: estimatedTokens,
                    totalTokenCount: estimatedTokens,
                };
            }

            recordUsage({
                tenantId,
                source: 'knowledge',
                feature: 'embedding',
                phase: 'embed_content',
                channel: 'dashboard',
                model: MODEL,
                startedAt,
                requestMeta,
            }, { usageMetadata }, { status: 'SUCCESS' }).catch(() => {});
        }

        return values;
    } catch (error) {
        if (tenantId) {
            recordError({
                tenantId,
                source: 'knowledge',
                feature: 'embedding',
                phase: 'embed_content',
                channel: 'dashboard',
                model: MODEL,
                startedAt,
                requestMeta: {
                    textLength: text.length,
                    outputDimensionality: OUTPUT_DIMS,
                },
            }, error).catch(() => {});
        }
        throw error;
    }
}

export function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        magA += a[i] * a[i];
        magB += b[i] * b[i];
    }
    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    return denom === 0 ? 0 : dot / denom;
}
