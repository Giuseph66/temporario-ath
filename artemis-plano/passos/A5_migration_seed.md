# Passo A5 — Criar Migration e Seed do Tenant Inicial

## Contexto
Artemis Bot em `/home/jesus/Neurelix/Artemis-Bot`. Com o schema completo (A1–A4), agora cria-se a migration e um seed que popula o Tenant da Confluence como primeiro registro do sistema.

**Pré-requisito:** Passos A1, A2, A3, A4 concluídos. `npx prisma validate` passando sem erros.

## O que Fazer

### Parte 1 — Migration

**1. Crie a migration**
```bash
npx prisma migrate dev --name multi_tenant_base
```

Se o banco já tiver dados da fase single-tenant, o Prisma pode pedir para confirmar reset. Em ambiente local isso é aceitável. Em produção, revisar o SQL gerado antes de aplicar.

**2. Verifique o SQL gerado**
Abra o arquivo em `prisma/migrations/*/migration.sql` e confirme que as tabelas `Tenant`, `TenantUser`, `Agent` foram criadas e que `User` recebeu `tenantId` e `agentId`.

**3. Regenere o Prisma Client**
```bash
npx prisma generate
```

### Parte 2 — Seed

**4. Leia os arquivos de config atuais**
Abra e leia:
- `config/persona.json`
- `config/programs.json`
- `config/settings.json`

**5. Crie o arquivo `prisma/seed.ts`**

```typescript
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import persona from '../config/persona.json';
import programs from '../config/programs.json';
import settings from '../config/settings.json';

const prisma = new PrismaClient();

async function main() {
  // Tenant inicial — Confluence Treinamento
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'confluence' },
    update: {},
    create: {
      name: 'Confluence Treinamento',
      slug: 'confluence',
      plan: 'pro',
      isActive: true,
    },
  });

  // Agent com configs atuais
  const agent = await prisma.agent.upsert({
    where: { id: 'confluence-agent-v1' },
    update: {},
    create: {
      id: 'confluence-agent-v1',
      tenantId: tenant.id,
      name: 'Artemis',
      personaJson: persona as any,
      programsJson: programs as any,
      settingsJson: settings as any,
      isActive: true,
    },
  });

  // Admin owner
  const passwordHash = await bcrypt.hash('trocar-essa-senha-123', 10);
  await prisma.tenantUser.upsert({
    where: { email: 'admin@confluence.com' },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'admin@confluence.com',
      passwordHash,
      role: 'owner',
    },
  });

  console.log('Seed concluído. Tenant:', tenant.id, '| Agent:', agent.id);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

**6. Adicione o script de seed ao `package.json`**
Na seção `"prisma"` (criar se não existir):
```json
"prisma": {
  "seed": "ts-node prisma/seed.ts"
}
```

**7. Execute o seed**
```bash
npx prisma db seed
```

## Verificação
```bash
npx prisma studio
```
Abra no browser. Deve existir 1 Tenant, 1 Agent, 1 TenantUser. A tabela `User` existe (vazia ou com dados existentes com `tenantId` nulo — isso será corrigido manualmente se houver dados em produção).

```bash
npm run build
```
Deve compilar. Haverá erros de tipo onde o código acessa `prisma.user.findUnique` sem `tenantId` — esses serão corrigidos nos sprints B e C.
