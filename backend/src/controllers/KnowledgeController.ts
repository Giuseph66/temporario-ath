import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { addDocument, deleteDocument, listDocuments } from '../services/KnowledgeService';

export async function listKnowledge(req: AuthRequest, res: Response): Promise<Response> {
    const docs = await listDocuments(req.tenantId!);
    return res.json(docs);
}

export async function createKnowledge(req: AuthRequest, res: Response): Promise<Response> {
    const { title, content } = req.body as { title?: string; content?: string };

    if (!title?.trim() || !content?.trim()) {
        return res.status(400).json({ error: 'title e content são obrigatórios.' });
    }
    if (content.length > 200_000) {
        return res.status(400).json({ error: 'Documento excede 200.000 caracteres.' });
    }

    const result = await addDocument(req.tenantId!, title.trim(), content.trim());
    return res.json(result);
}

export async function deleteKnowledge(req: AuthRequest, res: Response): Promise<Response> {
    const { id } = req.params;
    await deleteDocument(req.tenantId!, id);
    return res.json({ ok: true });
}
