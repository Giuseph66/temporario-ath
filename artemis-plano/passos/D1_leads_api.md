# Passo D1 — Backend: Endpoints de Leads e Conversas

## Contexto
Artemis Bot em `/home/jesus/Neurelix/Artemis-Bot`. O painel precisa listar leads e conversas do tenant logado. Todos os dados filtrados por `tenantId` — nunca retornar dados de outro tenant.

**Pré-requisito:** Sprint B concluído (middleware `requireAuth` funcionando).

## O que Fazer

**1. Crie `src/controllers/LeadsController.ts`**

```typescript
import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { prisma } from '../utils/prisma';

// Lista paginada de leads com filtro opcional por estado FSM
export async function listLeads(req: AuthRequest, res: Response) {
  const { state, search, page = '1', limit = '30' } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where: any = { tenantId: req.tenantId };
  if (state) where.conversationState = state;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { phoneNumber: { contains: search } },
    ];
  }

  const [leads, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { lastInteraction: 'desc' },
      take: parseInt(limit),
      skip,
      select: {
        id: true, name: true, phoneNumber: true, conversationState: true,
        currentProgramId: true, enrollmentStatus: true, lastInteraction: true,
        interactionCount: true, lgpdConsent: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return res.json({ leads, total, page: parseInt(page), limit: parseInt(limit) });
}

// Detalhe de um lead com histórico completo
export async function getLead(req: AuthRequest, res: Response) {
  const lead = await prisma.user.findFirst({
    where: { id: req.params.id, tenantId: req.tenantId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        take: 50,
      },
    },
  });
  if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });
  return res.json(lead);
}

// Conversas recentes (última mensagem por lead)
export async function listConversations(req: AuthRequest, res: Response) {
  const leads = await prisma.user.findMany({
    where: { tenantId: req.tenantId },
    orderBy: { lastInteraction: 'desc' },
    take: 50,
    select: {
      id: true, name: true, phoneNumber: true, conversationState: true,
      lastInteraction: true, enrollmentStatus: true,
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
  return res.json(leads);
}

// Forçar estado FSM de um lead
export async function updateLeadState(req: AuthRequest, res: Response) {
  const { state } = req.body;
  const validStates = ['GREETING','QUALIFICATION','PROGRAM_PRESENTATION','OBJECTION_HANDLING','CLOSING','HUMAN_HANDOFF'];
  if (!validStates.includes(state)) return res.status(400).json({ error: 'Estado inválido' });

  const lead = await prisma.user.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
  if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

  await prisma.user.update({ where: { id: req.params.id }, data: { conversationState: state } });
  return res.json({ ok: true });
}

// Excluir lead (LGPD Art. 18) — cascade apaga ChatHistory
export async function deleteLead(req: AuthRequest, res: Response) {
  const lead = await prisma.user.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
  if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

  await prisma.user.delete({ where: { id: req.params.id } });
  return res.json({ ok: true });
}
```

**2. Registre as rotas em `src/index.ts`**

```typescript
import { requireAuth } from './middlewares/auth';
import { listLeads, getLead, listConversations, updateLeadState, deleteLead } from './controllers/LeadsController';

app.get('/api/leads',                requireAuth, listLeads);
app.get('/api/leads/:id',            requireAuth, getLead);
app.get('/api/conversations',        requireAuth, listConversations);
app.patch('/api/leads/:id/state',    requireAuth, updateLeadState);
app.delete('/api/leads/:id',         requireAuth, deleteLead);
```

## Verificação
```bash
curl http://localhost:3000/api/leads \
  -H "Authorization: Bearer SEU_TOKEN"
```
Deve retornar array de leads do tenant. Se 0 resultados, banco ainda vazio — normal.
```bash
npm run build
```
Sem erros.
