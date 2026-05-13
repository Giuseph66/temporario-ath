# Passo E1 — Backend: Endpoint de Métricas

## Contexto
Artemis Bot em `/home/jesus/Neurelix/Artemis-Bot`. O Dashboard precisa de dados agregados do tenant: conversas, leads, taxa de conversão, distribuição por estado FSM.

**Pré-requisito:** Sprint D concluído.

## O que Fazer

**1. Crie `src/controllers/MetricsController.ts`**

```typescript
import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { prisma } from '../utils/prisma';

export async function getMetrics(req: AuthRequest, res: Response) {
  const tenantId = req.tenantId;
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7d  = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalLeads,
    conversas24h,
    enrolledCount,
    paymentPending,
    stateDistribution,
    recentEnrollments,
  ] = await Promise.all([
    // Total de leads
    prisma.user.count({ where: { tenantId } }),

    // Conversas ativas nas últimas 24h
    prisma.user.count({ where: { tenantId, lastInteraction: { gte: last24h } } }),

    // Matrículas confirmadas
    prisma.user.count({ where: { tenantId, enrollmentStatus: 'ENROLLED' } }),

    // Pagamentos pendentes
    prisma.user.count({ where: { tenantId, enrollmentStatus: 'PAYMENT_PENDING' } }),

    // Distribuição por estado FSM
    prisma.user.groupBy({
      by: ['conversationState'],
      where: { tenantId },
      _count: { _all: true },
    }),

    // Últimas matrículas
    prisma.user.findMany({
      where: { tenantId, enrollmentStatus: 'ENROLLED' },
      orderBy: { enrollmentDate: 'desc' },
      take: 5,
      select: { name: true, phoneNumber: true, enrollmentDate: true, currentProgramId: true },
    }),
  ]);

  const conversionRate = totalLeads > 0
    ? Math.round((enrolledCount / totalLeads) * 100)
    : 0;

  return res.json({
    totalLeads,
    conversas24h,
    enrolledCount,
    paymentPending,
    conversionRate,
    stateDistribution: stateDistribution.map(s => ({
      state: s.conversationState,
      count: s._count._all,
    })),
    recentEnrollments,
  });
}
```

**2. Registre a rota em `src/index.ts`**

```typescript
import { getMetrics } from './controllers/MetricsController';
app.get('/api/metrics', requireAuth, getMetrics);
```

## Verificação
```bash
curl http://localhost:3000/api/metrics \
  -H "Authorization: Bearer SEU_TOKEN"
```
Retorna JSON com `totalLeads`, `conversas24h`, `conversionRate`, `stateDistribution` etc.
