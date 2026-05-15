import { prisma } from '../utils/prisma';

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
    const apiKey = await resolveApiKey(tenantId);
    const url = `${BASE}/models/${MODEL}:embedContent?key=${apiKey}`;
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
    const data = await res.json() as { embedding: { values: number[] } };
    return data.embedding.values;
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
