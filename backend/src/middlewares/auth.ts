import { Request, Response, NextFunction, RequestHandler } from 'express';
import * as jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
    tenantId: string;
    userId: string;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Token ausente' });
        return;
    }

    try {
        const token = header.slice(7);
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as {
            tenantId: string;
            userId: string;
        };
        (req as AuthRequest).tenantId = decoded.tenantId;
        (req as AuthRequest).userId = decoded.userId;
        next();
    } catch {
        res.status(401).json({ error: 'Token inválido ou expirado' });
    }
}

export const requireAuthSSE: RequestHandler = (req, res, next) => {
    const token = (req.query.token as string) || req.headers.authorization?.slice(7);
    if (!token) { res.status(401).json({ error: 'Token ausente' }); return; }
    try {
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as { tenantId: string; userId: string };
        (req as AuthRequest).tenantId = decoded.tenantId;
        (req as AuthRequest).userId = decoded.userId;
        next();
    } catch {
        res.status(401).json({ error: 'Token inválido ou expirado' });
    }
};
