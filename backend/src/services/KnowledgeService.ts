import { prisma } from '../utils/prisma';
import { embedText, cosineSimilarity } from './EmbeddingService';

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 120;
const TOP_K = 4;
const MIN_SIMILARITY = 0.55;

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
