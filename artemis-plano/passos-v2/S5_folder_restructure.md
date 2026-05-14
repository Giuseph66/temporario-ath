# S5 — Reorganização de Pastas

## Objetivo
Clareza na estrutura do projeto: frontend separado do backend visualmente.

## Situação atual
```
Artemis-Bot/
├── src/              ← backend TypeScript
├── prisma/           ← schema + migrations
├── config/           ← persona.json, programs.json
├── packages/
│   └── dashboard/    ← frontend React (package.json próprio)
```

## Situação desejada
```
Artemis-Bot/
├── src/              ← backend TypeScript (mantém no root — é o package root)
├── prisma/           ← schema + migrations
├── config/           ← persona.json, programs.json
├── frontend/         ← frontend React (era packages/dashboard/)
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
```

## Passos
1. `mv packages/dashboard frontend/`
2. `rmdir packages/` (se vazia)
3. Verificar `frontend/package.json` — sem referências a `packages/dashboard`
4. Verificar `frontend/vite.config.ts` — sem paths absolutos quebrados
5. Atualizar root `package.json` se tiver script referenciando `packages/dashboard`
6. Confirmar: `cd frontend && npm run dev` funciona

## Nota
O backend permanece no root — tem o `package.json` raiz, `src/`, `prisma/`. Não vale a pena mover para `backend/` pois quebra todas as referências de scripts, CI, e o path da VPS.

## Critério de conclusão
- `ls frontend/src/` mostra todos os arquivos do dashboard
- `packages/` não existe mais
- `cd frontend && npm install && npm run dev` funciona sem erro
