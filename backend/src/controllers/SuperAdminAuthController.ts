import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

function signSuperAdminAccess(adminId: string) {
    return jwt.sign(
        { role: 'superadmin', adminId },
        process.env.JWT_ACCESS_SECRET!,
        { expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN ?? '15m') as jwt.SignOptions['expiresIn'] }
    );
}

function signSuperAdminRefresh(adminId: string) {
    return jwt.sign(
        { role: 'superadmin', adminId },
        process.env.JWT_REFRESH_SECRET!,
        { expiresIn: '7d' }
    );
}

export async function adminLogin(req: Request, res: Response): Promise<Response> {
    const { email: rawEmail, password } = req.body;
    if (!rawEmail || !password) return res.status(400).json({ error: 'email e password obrigatórios' });
    const email = rawEmail.toLowerCase().trim();

    const admin = await prisma.superAdmin.findUnique({ where: { email } });
    if (!admin) return res.status(401).json({ error: 'Credenciais inválidas' });

    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Credenciais inválidas' });

    await prisma.superAdmin.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });

    return res.json({
        accessToken: signSuperAdminAccess(admin.id),
        refreshToken: signSuperAdminRefresh(admin.id),
        admin: { id: admin.id, email: admin.email },
    });
}

export async function adminRefresh(req: Request, res: Response): Promise<Response> {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'refreshToken obrigatório' });

    try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as {
            role: string; adminId: string;
        };
        if (decoded.role !== 'superadmin') return res.status(401).json({ error: 'Token inválido' });
        return res.json({ accessToken: signSuperAdminAccess(decoded.adminId) });
    } catch {
        return res.status(401).json({ error: 'Refresh token inválido ou expirado' });
    }
}

// Cria superadmin inicial via script ou rota protegida por ADMIN_BOOTSTRAP_SECRET
export async function bootstrapAdmin(req: Request, res: Response): Promise<Response> {
    const secret = req.headers['x-bootstrap-secret'];
    if (!secret || secret !== process.env.ADMIN_BOOTSTRAP_SECRET) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const { email: rawEmail, password } = req.body;
    if (!rawEmail || !password) return res.status(400).json({ error: 'email e password obrigatórios' });
    const email = rawEmail.toLowerCase().trim();
    if (password.length < 12) return res.status(400).json({ error: 'Senha mínima: 12 caracteres' });

    const exists = await prisma.superAdmin.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ error: 'Admin já existe' });

    const passwordHash = await bcrypt.hash(password, 12);
    const admin = await prisma.superAdmin.create({ data: { email, passwordHash } });

    return res.status(201).json({ id: admin.id, email: admin.email });
}
