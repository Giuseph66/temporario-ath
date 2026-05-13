# Passo B1 — Backend: Endpoints de Autenticação JWT

## Contexto
Artemis Bot em `/home/jesus/Neurelix/Artemis-Bot`. O painel web precisa de login. Usaremos JWT com access token (curta duração) + refresh token (longa duração). O payload do JWT carrega `tenantId` e `userId` — assim todo endpoint sabe de qual tenant vem a request sem busca adicional no banco.

**Pré-requisito:** Sprint A concluído (TenantUser existe no banco com senha hasheada pelo seed).

## O que Fazer

**1. Instale dependências**
```bash
npm install jsonwebtoken
npm install --save-dev @types/jsonwebtoken
```

**2. Adicione variáveis ao `.env.example`**
```
JWT_ACCESS_SECRET="secret-access-aqui"
JWT_REFRESH_SECRET="secret-refresh-aqui"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"
```

**3. Crie `src/controllers/AuthController.ts`**

```typescript
import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

function signAccess(payload: { tenantId: string; userId: string }) {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET!, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
  });
}

function signRefresh(payload: { tenantId: string; userId: string }) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  });
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email e password obrigatórios' });

  const user = await prisma.tenantUser.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: 'Credenciais inválidas' });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Credenciais inválidas' });

  await prisma.tenantUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const payload = { tenantId: user.tenantId, userId: user.id };
  return res.json({
    accessToken: signAccess(payload),
    refreshToken: signRefresh(payload),
  });
}

export async function refresh(req: Request, res: Response) {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken obrigatório' });

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as {
      tenantId: string;
      userId: string;
    };
    return res.json({ accessToken: signAccess({ tenantId: decoded.tenantId, userId: decoded.userId }) });
  } catch {
    return res.status(401).json({ error: 'Refresh token inválido ou expirado' });
  }
}
```

**4. Crie `src/middlewares/auth.ts`**

```typescript
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  tenantId: string;
  userId: string;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Token ausente' });

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
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}
```

**5. Registre as rotas em `src/index.ts`**
```typescript
import { login, refresh } from './controllers/AuthController';
app.post('/auth/login', login);
app.post('/auth/refresh', refresh);
```

## Verificação
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@confluence.com","password":"trocar-essa-senha-123"}'
```
Deve retornar `{ accessToken: "...", refreshToken: "..." }`.

```bash
npm run build
```
Sem erros.
