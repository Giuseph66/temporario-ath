import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { createTenant } from '../services/TenantService';
import { log } from '../services/LogService';

function signAccess(payload: { tenantId: string; userId: string }) {
    return jwt.sign(payload, process.env.JWT_ACCESS_SECRET!, {
        expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN ?? '15m') as jwt.SignOptions['expiresIn'],
    });
}

function signRefresh(payload: { tenantId: string; userId: string }) {
    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
        expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ?? '7d') as jwt.SignOptions['expiresIn'],
    });
}

export async function login(req: Request, res: Response): Promise<Response> {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email e password obrigatórios' });

    const user = await prisma.tenantUser.findUnique({ where: { email } });
    if (!user) { log.auth('warn', 'Login falhou: email não encontrado', { email }); return res.status(401).json({ error: 'Credenciais inválidas' }); }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) { log.auth('warn', 'Login falhou: senha incorreta', { email }); return res.status(401).json({ error: 'Credenciais inválidas' }); }

    await prisma.tenantUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    log.auth('info', 'Login bem-sucedido', { email, tenantId: user.tenantId });

    const payload = { tenantId: user.tenantId, userId: user.id };
    return res.json({
        accessToken: signAccess(payload),
        refreshToken: signRefresh(payload),
    });
}

export async function refresh(req: Request, res: Response): Promise<Response> {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'refreshToken obrigatório' });

    try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as {
            tenantId: string;
            userId: string;
        };
        return res.json({
            accessToken: signAccess({ tenantId: decoded.tenantId, userId: decoded.userId }),
        });
    } catch {
        return res.status(401).json({ error: 'Refresh token inválido ou expirado' });
    }
}

export async function register(req: Request, res: Response): Promise<Response> {
    const { companyName, agentName, email, password } = req.body as {
        companyName: string; agentName: string; email: string; password: string;
    };

    if (!companyName || !agentName || !email || !password) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }
    if (password.length < 8) {
        return res.status(400).json({ error: 'Senha mínima: 8 caracteres' });
    }

    const exists = await prisma.tenantUser.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ error: 'Email já cadastrado' });

    const slug = companyName
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 30);

    const slugExists = await prisma.tenant.findUnique({ where: { slug } });
    if (slugExists) {
        return res.status(409).json({ error: 'Nome de empresa já em uso. Tente outro.' });
    }

    try {
        const tenant = await createTenant({ companyName, slug, agentName, ownerEmail: email, ownerPassword: password });
        const user = await prisma.tenantUser.findUnique({ where: { email } });
        const payload = { tenantId: tenant.id, userId: user!.id };

        return res.status(201).json({
            accessToken: signAccess(payload),
            refreshToken: signRefresh(payload),
            tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
        });
    } catch (err) {
        console.error('[Register]', err);
        return res.status(500).json({ error: 'Erro ao criar conta. Tente novamente.' });
    }
}
