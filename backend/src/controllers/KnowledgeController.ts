import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { addDocument, deleteDocument, getDocument, ingestSourceDocument, listDocuments, MAX_DOC_CHARS } from '../services/KnowledgeService';

export async function listKnowledge(req: AuthRequest, res: Response): Promise<Response> {
    const docs = await listDocuments(req.tenantId!);
    return res.json(docs);
}

export async function getKnowledge(req: AuthRequest, res: Response): Promise<Response> {
    const doc = await getDocument(req.tenantId!, req.params.id);
    if (!doc) return res.status(404).json({ error: 'Documento não encontrado.' });
    return res.json(doc);
}

export async function createKnowledge(req: AuthRequest, res: Response): Promise<Response> {
    const { title, content, sourceType, mimeType, base64Data, url } = req.body as {
        title?: string;
        content?: string;
        sourceType?: 'file' | 'url';
        mimeType?: string;
        base64Data?: string;
        url?: string;
    };

    if (!title?.trim()) {
        return res.status(400).json({ error: 'title é obrigatório.' });
    }

    // Fluxo legado/manual
    if (content?.trim()) {
        if (content.length > MAX_DOC_CHARS) {
            return res.status(400).json({ error: `Documento excede ${MAX_DOC_CHARS.toLocaleString()} caracteres.` });
        }
        const result = await addDocument(req.tenantId!, title.trim(), content.trim());
        return res.json(result);
    }

    // Novo fluxo de ingestão (arquivo/url)
    if (!sourceType || !['file', 'url'].includes(sourceType)) {
        return res.status(400).json({ error: 'Envie content (texto) ou sourceType válido (file/url).' });
    }

    try {
        const result = await ingestSourceDocument(req.tenantId!, {
            title: title.trim(),
            sourceType,
            mimeType,
            base64Data,
            url,
        });
        return res.json(result);
    } catch (err) {
        return res.status(400).json({ error: err instanceof Error ? err.message : 'Falha ao processar fonte de memória.' });
    }
}

export async function deleteKnowledge(req: AuthRequest, res: Response): Promise<Response> {
    const { id } = req.params;
    await deleteDocument(req.tenantId!, id);
    return res.json({ ok: true });
}
