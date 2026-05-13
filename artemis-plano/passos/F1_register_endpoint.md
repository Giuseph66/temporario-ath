# Passo F1 — Backend: Endpoint de Registro de Novo Tenant

## Contexto
Artemis Bot em `/home/jesus/Neurelix/Artemis-Bot`. Endpoint público que permite novos clientes se registrarem no SaaS. Cria Tenant + TenantUser owner + Agent padrão em transação única.

**Pré-requisito:** Sprints A e B concluídos. Modelo `TenantService` criado.

## O que Fazer

**1. Crie `src/services/TenantService.ts`**

```typescript
import { prisma } from '../utils/prisma';
import * as bcrypt from 'bcrypt';
import personaDefault from '../../config/persona.json';
import programsDefault from '../../config/programs.json';
import settingsDefault from '../../config/settings.json';

export async function createTenant(params: {
  companyName: string;
  slug: string;
  agentName: string;
  ownerEmail: string;
  ownerPassword: string;
}) {
  const { companyName, slug, agentName, ownerEmail, ownerPassword } = params;

  const passwordHash = await bcrypt.hash(ownerPassword, 10);

  // Transação atômica: tudo ou nada
  return prisma.$transaction(async tx => {
    const tenant = await tx.tenant.create({
      data: { name: companyName, slug, plan: 'free', isActive: true },
    });

    await tx.tenantUser.create({
      data: {
        tenantId: tenant.id,
        email: ownerEmail,
        passwordHash,
        role: 'owner',
      },
    });

    // Persona customizada com o nome do agente escolhido
    const personaJson = { ...personaDefault, name: agentName };

    await tx.agent.create({
      data: {
        tenantId: tenant.id,
        name: agentName,
        personaJson,
        programsJson: programsDefault as any,
        settingsJson: settingsDefault as any,
        isActive: true,
      },
    });

    return tenant;
  });
}
```

**2. Adicione o endpoint de registro em `src/controllers/AuthController.ts`**

```typescript
import { createTenant } from '../services/TenantService';

export async function register(req: Request, res: Response) {
  const { companyName, agentName, email, password } = req.body;

  if (!companyName || !agentName || !email || !password) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Senha mínima: 8 caracteres' });
  }

  // Verificar email duplicado
  const exists = await prisma.tenantUser.findUnique({ where: { email } });
  if (exists) return res.status(409).json({ error: 'Email já cadastrado' });

  // Gerar slug a partir do nome da empresa
  const slug = companyName
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 30);

  // Verificar slug duplicado
  const slugExists = await prisma.tenant.findUnique({ where: { slug } });
  if (slugExists) {
    return res.status(409).json({ error: 'Nome de empresa já em uso. Tente outro.' });
  }

  try {
    const tenant = await createTenant({ companyName, slug, agentName, ownerEmail: email, ownerPassword: password });

    // Buscar o usuário criado para gerar JWT
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
```

**3. Registre a rota em `src/index.ts`**
```typescript
app.post('/auth/register', register);
```

## Verificação
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"companyName":"Escola XYZ","agentName":"Luna","email":"admin@xyz.com","password":"senha123"}'
```
Deve retornar `{ accessToken, refreshToken, tenant }`. Verifique no `prisma studio` que Tenant + TenantUser + Agent foram criados.
