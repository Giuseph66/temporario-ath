import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../utils/prisma';

const MODEL = 'text-embedding-004'; // 768 dims, multilingual

function getClient(apiKey?: string | null): GoogleGenerativeAI {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY não configurada para embeddings.');
    return new GoogleGenerativeAI(key);
}

export async function embedText(text: string, tenantId?: string): Promise<number[]> {
    let apiKey: string | null = null;
    if (tenantId) {
        const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { geminiApiKey: true } });
        apiKey = tenant?.geminiApiKey ?? null;
    }

    const client = getClient(apiKey);
    const model = client.getGenerativeModel({ model: MODEL });
    const result = await model.embedContent(text);
    return result.embedding.values;
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
