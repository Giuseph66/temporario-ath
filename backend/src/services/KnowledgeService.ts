import { prisma } from '../utils/prisma';
import { embedText, cosineSimilarity } from './EmbeddingService';

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 120;
const TOP_K = 4;
const MIN_SIMILARITY = 0.55;
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export const MAX_DOC_CHARS = 200_000;
const MAX_BASE64_LENGTH = 7_000_000;
const SUPPORTED_INGEST_MIME = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
]);
const FILE_EXTRACTION_MODEL_FALLBACKS = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
];

function chunkText(text: string): string[] {
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
        const end = Math.min(start + CHUNK_SIZE, text.length);
        chunks.push(text.slice(start, end).trim());
        if (end === text.length) break;
        start += CHUNK_SIZE - CHUNK_OVERLAP;
    }
    return chunks.filter(c => c.length > 40);
}

// pgvector format: '[0.1,0.2,...]'
function toVectorLiteral(embedding: number[]): string {
    return `[${embedding.join(',')}]`;
}

async function resolveGeminiApiKey(tenantId: string): Promise<string> {
    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { geminiApiKey: true },
    });
    if (tenant?.geminiApiKey) return tenant.geminiApiKey;

    const envKey = process.env.GEMINI_API_KEY;
    if (envKey) return envKey;
    throw new Error('Gemini API key não configurada para processar arquivos.');
}

async function resolveGeminiModel(tenantId: string): Promise<string> {
    const agent = await prisma.agent.findFirst({
        where: { tenantId },
        select: { geminiModel: true },
    });
    return agent?.geminiModel || 'gemini-2.5-flash';
}

function buildModelCandidates(model: string): string[] {
    return Array.from(new Set([
        model,
        ...FILE_EXTRACTION_MODEL_FALLBACKS,
    ].filter(Boolean)));
}

function normalizeExtractedText(value: string): string {
    return value
        .replace(/\r/g, '\n')
        .replace(/\u0000/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function decodeHtmlEntities(input: string): string {
    return input
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'");
}

function stripHtmlToText(html: string): string {
    const noScripts = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');

    const noTags = noScripts
        .replace(/<\/(p|div|section|article|h1|h2|h3|h4|h5|h6|li|br)>/gi, '\n')
        .replace(/<[^>]+>/g, ' ');

    return normalizeExtractedText(decodeHtmlEntities(noTags));
}

async function extractUrlText(url: string): Promise<string> {
    let normalized: URL;
    try {
        normalized = new URL(url.trim());
    } catch {
        throw new Error('URL inválida.');
    }

    if (!['http:', 'https:'].includes(normalized.protocol)) {
        throw new Error('URL deve começar com http:// ou https://');
    }

    const res = await fetch(normalized.toString(), {
        redirect: 'follow',
        headers: { 'User-Agent': 'ArtemisBot/knowledge-ingest' },
    });
    if (!res.ok) {
        throw new Error(`Falha ao baixar URL (${res.status}).`);
    }

    const raw = await res.text();
    if (!raw.trim()) {
        throw new Error('Página sem conteúdo textual extraível.');
    }

    const ct = (res.headers.get('content-type') || '').toLowerCase();
    const parsed = ct.includes('html') || raw.includes('<html')
        ? stripHtmlToText(raw)
        : normalizeExtractedText(raw);

    if (!parsed) {
        throw new Error('Não foi possível extrair texto útil da URL.');
    }
    return parsed;
}

async function extractFileTextWithGemini(
    tenantId: string,
    title: string,
    mimeType: string,
    base64Data: string
): Promise<string> {
    if (!SUPPORTED_INGEST_MIME.has(mimeType)) {
        throw new Error(`Tipo de arquivo não suportado: ${mimeType}`);
    }
    if (base64Data.length > MAX_BASE64_LENGTH) {
        throw new Error('Arquivo grande demais para upload. Limite aproximado: 5 MB.');
    }

    const apiKey = await resolveGeminiApiKey(tenantId);
    const model = await resolveGeminiModel(tenantId);
    const prompt = [
        'Extraia o texto bruto deste arquivo para indexação de base de conhecimento.',
        'Regras:',
        '- Sem resumo.',
        '- Sem opinião.',
        '- Manter títulos/listas quando possível.',
        '- Retornar somente texto útil.',
        `Título da memória: ${title}`,
    ].join('\n');

    let raw = '';
    let lastError = '';
    for (const candidate of buildModelCandidates(model)) {
        const res = await fetch(`${GEMINI_BASE}/models/${candidate}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    role: 'user',
                    parts: [
                        { text: prompt },
                        { inlineData: { mimeType, data: base64Data } },
                    ],
                }],
                generationConfig: {
                    temperature: 0,
                    maxOutputTokens: 8192,
                },
            }),
        });

        raw = await res.text();
        if (res.ok) break;

        lastError = `Gemini falhou ao processar arquivo com ${candidate} (${res.status}): ${raw}`;
        if (![400, 404].includes(res.status)) {
            throw new Error(lastError);
        }
        raw = '';
    }

    if (!raw) {
        throw new Error(lastError || 'Gemini falhou ao processar arquivo.');
    }

    let parsed: any = null;
    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new Error('Resposta inválida ao extrair texto do arquivo.');
    }

    const parts = parsed?.candidates?.[0]?.content?.parts;
    const merged = Array.isArray(parts)
        ? parts.map((p: any) => (typeof p?.text === 'string' ? p.text : '')).join('\n')
        : '';

    const cleaned = normalizeExtractedText(merged);
    if (!cleaned) {
        throw new Error('Não foi possível extrair texto útil deste arquivo.');
    }
    return cleaned;
}

export async function ingestSourceDocument(
    tenantId: string,
    input: { title: string; sourceType: 'file' | 'url'; mimeType?: string; base64Data?: string; url?: string; }
): Promise<{ documentId: string; chunkCount: number; extractedChars: number; truncated: boolean; }> {
    let extracted = '';

    if (input.sourceType === 'url') {
        if (!input.url?.trim()) throw new Error('URL obrigatória.');
        extracted = await extractUrlText(input.url);
    } else {
        if (!input.mimeType?.trim() || !input.base64Data?.trim()) {
            throw new Error('mimeType e base64Data são obrigatórios para upload de arquivo.');
        }
        extracted = await extractFileTextWithGemini(
            tenantId,
            input.title,
            input.mimeType.trim(),
            input.base64Data.trim()
        );
    }

    const normalized = normalizeExtractedText(extracted);
    if (!normalized) throw new Error('Não foi possível gerar conteúdo indexável.');

    const truncated = normalized.length > MAX_DOC_CHARS;
    const content = truncated ? normalized.slice(0, MAX_DOC_CHARS) : normalized;
    const result = await addDocument(tenantId, input.title.trim(), content);

    return {
        ...result,
        extractedChars: content.length,
        truncated,
    };
}

export async function addDocument(
    tenantId: string,
    title: string,
    content: string
): Promise<{ documentId: string; chunkCount: number }> {
    const doc = await prisma.knowledgeDocument.create({
        data: { tenantId, title, content: content.trim(), charCount: content.length },
    });

    const rawChunks = chunkText(content);
    let chunkCount = 0;

    for (let i = 0; i < rawChunks.length; i++) {
        const chunkContent = rawChunks[i];
        try {
            const embedding = await embedText(chunkContent, tenantId);
            const embJson = JSON.stringify(embedding);
            const vecLiteral = toVectorLiteral(embedding);

            // Insert with both JSON (fallback) and native vector (pgvector HNSW)
            await prisma.$executeRawUnsafe(
                `INSERT INTO "KnowledgeChunk"
                    (id, "tenantId", "documentId", "chunkIndex", content, "embeddingJson", embedding, "createdAt")
                 VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6::vector, NOW())`,
                tenantId, doc.id, i, chunkContent, embJson, vecLiteral
            );
            chunkCount++;
        } catch (err) {
            console.error(`[RAG] Falha ao embedar chunk ${i} do doc ${doc.id}:`, err);
        }
    }

    return { documentId: doc.id, chunkCount };
}

export async function deleteDocument(tenantId: string, documentId: string): Promise<void> {
    await prisma.knowledgeDocument.deleteMany({
        where: { id: documentId, tenantId },
    });
}

export async function getDocument(tenantId: string, documentId: string) {
    return prisma.knowledgeDocument.findFirst({
        where: { id: documentId, tenantId },
        select: {
            id: true,
            title: true,
            content: true,
            charCount: true,
            createdAt: true,
            _count: { select: { chunks: true } },
        },
    });
}

export async function listDocuments(tenantId: string) {
    return prisma.knowledgeDocument.findMany({
        where: { tenantId },
        select: { id: true, title: true, charCount: true, createdAt: true, _count: { select: { chunks: true } } },
        orderBy: { createdAt: 'desc' },
    });
}

export async function retrieveRelevantContext(
    tenantId: string,
    query: string,
    topK = TOP_K
): Promise<string | null> {
    let queryEmbedding: number[];
    try {
        queryEmbedding = await embedText(query, tenantId);
    } catch {
        return null;
    }

    // pgvector cosine distance search with HNSW index
    type ChunkRow = { content: string };
    try {
        const rows = await prisma.$queryRawUnsafe<ChunkRow[]>(
            `SELECT content
             FROM "KnowledgeChunk"
             WHERE "tenantId" = $1
               AND embedding IS NOT NULL
             ORDER BY embedding <=> $2::vector
             LIMIT $3`,
            tenantId,
            toVectorLiteral(queryEmbedding),
            topK
        );

        if (rows.length > 0) {
            console.log(`📚 [RAG] pgvector HNSW: ${rows.length} chunks relevantes.`);
            return rows.map(r => r.content).join('\n\n---\n\n');
        }
    } catch (pgErr) {
        console.warn('[RAG] pgvector query falhou, usando fallback JS:', (pgErr as Error).message);
    }

    // JS fallback — usado se pgvector não estiver ativo ou coluna vazia
    const chunks = await prisma.knowledgeChunk.findMany({
        where: { tenantId },
        select: { content: true, embeddingJson: true },
    });

    if (chunks.length === 0) return null;

    const scored = chunks
        .map(c => {
            try {
                return { content: c.content, score: cosineSimilarity(queryEmbedding, JSON.parse(c.embeddingJson)) };
            } catch { return { content: c.content, score: 0 }; }
        })
        .filter(c => c.score >= MIN_SIMILARITY)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

    if (scored.length === 0) return null;
    console.log(`📚 [RAG] JS fallback: ${scored.length} chunks relevantes.`);
    return scored.map(c => c.content).join('\n\n---\n\n');
}
