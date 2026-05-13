# Passo 01 — Corrigir Prisma Singleton

## Contexto do Projeto
O Artemis Bot é uma aplicação TypeScript/Node.js em `/home/jesus/Neurelix/Artemis-Bot`. Usa Prisma ORM para acessar PostgreSQL. Existe um arquivo singleton em `src/utils/prisma.ts` que exporta uma única instância do `PrismaClient`. **Todo acesso ao banco deve passar por esse singleton.**

## Problema
Três arquivos instanciam `new PrismaClient()` diretamente, abrindo conexões extras com o banco.

Arquivos com o problema:
- `src/index.ts`
- `src/services/AIService.ts`
- `src/controllers/AsaasWebhookController.ts`

## O que Fazer

**1. Leia o singleton existente**
Leia `src/utils/prisma.ts` para confirmar o que ele exporta (algo como `export const prisma = new PrismaClient()`).

**2. Corrija `src/index.ts`**
- Leia o arquivo completo.
- Localize e remova qualquer `const prisma = new PrismaClient()` e o `import { PrismaClient } from '@prisma/client'` correspondente.
- Adicione no topo: `import { prisma } from './utils/prisma';`
- Garanta que todas as chamadas `prisma.qualquerCoisa` continuam funcionando com a instância importada.

**3. Corrija `src/services/AIService.ts`**
- Leia o arquivo completo.
- Remova `new PrismaClient()` e o import direto.
- Adicione no topo: `import { prisma } from '../utils/prisma';`

**4. Corrija `src/controllers/AsaasWebhookController.ts`**
- Leia o arquivo completo.
- Remova `new PrismaClient()` e o import direto.
- Adicione no topo: `import { prisma } from '../utils/prisma';`

## Verificação
No terminal dentro de `/home/jesus/Neurelix/Artemis-Bot`:
```bash
grep -rn "new PrismaClient" src/
```
Resultado deve ser **vazio** ou mostrar somente `src/utils/prisma.ts`.

```bash
npm run build
```
Deve compilar sem erros.
