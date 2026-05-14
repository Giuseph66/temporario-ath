import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { readLogs, clearLogs, LogCategory, LogLevel } from '../services/LogService';

const CATEGORIES: LogCategory[] = ['webhook', 'ai', 'payment', 'auth', 'system'];

export async function getLogs(req: AuthRequest, res: Response): Promise<Response> {
    const category = req.params.category as LogCategory;
    if (!CATEGORIES.includes(category)) {
        return res.status(400).json({ error: `Categoria inválida. Use: ${CATEGORIES.join(', ')}` });
    }

    const limit = Math.min(500, parseInt(req.query.limit as string) || 200);
    const level = req.query.level as LogLevel | undefined;

    const entries = readLogs(category, limit, level);
    return res.json({ category, entries, total: entries.length });
}

export async function clearCategory(req: AuthRequest, res: Response): Promise<Response> {
    const category = req.params.category as LogCategory;
    if (!CATEGORIES.includes(category)) {
        return res.status(400).json({ error: 'Categoria inválida' });
    }
    clearLogs(category);
    return res.json({ ok: true });
}
