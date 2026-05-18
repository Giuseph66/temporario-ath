import { Request, Response, NextFunction, RequestHandler } from 'express';
import * as jwt from 'jsonwebtoken';

export interface SuperAdminRequest extends Request {
    adminId: string;
}

export const requireSuperAdmin: RequestHandler = (req, res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Token ausente' });
        return;
    }

    try {
        const token = header.slice(7);
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as {
            role: string; adminId: string;
        };
        if (decoded.role !== 'superadmin') {
            res.status(403).json({ error: 'Acesso restrito a superadmin' });
            return;
        }
        (req as SuperAdminRequest).adminId = decoded.adminId;
        next();
    } catch {
        res.status(401).json({ error: 'Token inválido ou expirado' });
    }
};
