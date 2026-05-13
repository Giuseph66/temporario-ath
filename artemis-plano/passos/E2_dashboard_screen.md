# Passo E2 — Frontend: Tela de Dashboard

## Contexto
Painel em `packages/dashboard/`. Tela principal com métricas reais. Hero com avatar do agente + stats. Inspirada diretamente no V3 Composer dos exemplos.

**Pré-requisito:** Passo E1 concluído (endpoint `/api/metrics`).

## O que Fazer

**1. Crie `src/pages/Dashboard.tsx`**

```tsx
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const FSM_COLORS: Record<string, string> = {
  GREETING: '#8a8579', QUALIFICATION: '#1a4d8f',
  PROGRAM_PRESENTATION: '#1b6b4d', OBJECTION_HANDLING: '#a86a1a',
  CLOSING: '#65a30d', HUMAN_HANDOFF: '#a83a2a',
};
const FSM_LABELS: Record<string, string> = {
  GREETING: 'Saudação', QUALIFICATION: 'Qualificação',
  PROGRAM_PRESENTATION: 'Apresentação', OBJECTION_HANDLING: 'Objeções',
  CLOSING: 'Fechamento', HUMAN_HANDOFF: 'Humano',
};

export function Dashboard() {
  const { data: metrics } = useQuery({
    queryKey: ['metrics'],
    queryFn: () => axios.get('/api/metrics').then(r => r.data),
    refetchInterval: 30000,
  });

  const { data: agent } = useQuery({
    queryKey: ['agent'],
    queryFn: () => axios.get('/api/agent').then(r => r.data),
  });

  const agentName = agent?.name ?? 'Agente';
  const agentInitial = agentName[0]?.toUpperCase() ?? 'A';

  return (
    <div style={{ padding: '32px 40px', maxWidth: 980, overflowY: 'auto' }}>

      {/* Hero — estilo V3 Composer */}
      <div style={{
        background: 'var(--paper)', border: '1px solid var(--line)',
        borderRadius: 16, padding: '28px 32px', display: 'flex',
        gap: 24, alignItems: 'flex-start', marginBottom: 28,
      }}>
        {/* Avatar */}
        <div style={{
          width: 84, height: 84, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, #2b3a32 0%, #1b6b4d 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Fraunces', serif", fontSize: 36, color: '#fff',
          position: 'relative', border: '1px solid var(--line-2)',
        }}>
          {agentInitial}
          <div style={{
            position: 'absolute', bottom: 4, right: 4, width: 14, height: 14,
            borderRadius: '50%', background: '#5ec88a', border: '3px solid var(--paper)',
          }} />
        </div>
        {/* Info */}
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11,
            textTransform: 'uppercase', letterSpacing: .8, color: 'var(--ink-4)', marginBottom: 4 }}>
            Agente ativo
          </div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 42, fontWeight: 400,
            letterSpacing: -1, lineHeight: 1, color: 'var(--ink-1)', marginBottom: 8 }}>
            {agentName}
          </div>
          {/* Stats */}
          <div style={{ display: 'flex', gap: 28, marginTop: 16,
            paddingTop: 16, borderTop: '1px solid var(--line)' }}>
            {[
              { label: 'Conversas (24h)', value: metrics?.conversas24h ?? '—' },
              { label: 'Total de leads',  value: metrics?.totalLeads ?? '—' },
              { label: 'Matrículas',      value: metrics?.enrolledCount ?? '—' },
              { label: 'Conversão',       value: metrics ? `${metrics.conversionRate}%` : '—' },
              { label: 'Pgto. pendente',  value: metrics?.paymentPending ?? '—' },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10,
                  textTransform: 'uppercase', letterSpacing: .6, color: 'var(--ink-4)', marginBottom: 4 }}>
                  {s.label}
                </div>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 24, color: 'var(--ink-1)' }}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Grid de estados FSM */}
      <div style={{ marginBottom: 8, fontSize: 14, fontWeight: 600, color: 'var(--ink-2)' }}>
        Distribuição por estado
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 28 }}>
        {(metrics?.stateDistribution ?? []).map((s: any) => (
          <div key={s.state} style={{
            background: 'var(--paper)', border: '1px solid var(--line)',
            borderRadius: 10, padding: '16px 20px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                {FSM_LABELS[s.state] ?? s.state}
              </span>
              <span style={{
                fontSize: 10, padding: '2px 7px', borderRadius: 4,
                background: (FSM_COLORS[s.state] ?? '#8a8579') + '20',
                color: FSM_COLORS[s.state] ?? '#8a8579',
                fontFamily: "'Geist Mono', monospace",
              }}>
                {s.state}
              </span>
            </div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 28, color: 'var(--ink-1)', marginTop: 6 }}>
              {s.count}
            </div>
          </div>
        ))}
      </div>

      {/* Últimas matrículas */}
      {metrics?.recentEnrollments?.length > 0 && (
        <>
          <div style={{ marginBottom: 8, fontSize: 14, fontWeight: 600, color: 'var(--ink-2)' }}>
            Últimas matrículas
          </div>
          <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
            {metrics.recentEnrollments.map((e: any, i: number) => (
              <div key={i} style={{ padding: '12px 20px', borderBottom: i < metrics.recentEnrollments.length - 1 ? '1px solid var(--line)' : 'none',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-1)' }}>{e.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>{e.currentProgramId ?? 'Programa não definido'}</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>
                  {e.enrollmentDate ? new Date(e.enrollmentDate).toLocaleDateString('pt-BR') : '—'}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

**2. Crie endpoint `GET /api/agent` no backend**
Adicione em `src/controllers/AgentController.ts` (criado no E3):
```typescript
export async function getAgent(req: AuthRequest, res: Response) {
  const agent = await prisma.agent.findFirst({ where: { tenantId: req.tenantId } });
  if (!agent) return res.status(404).json({ error: 'Agente não encontrado' });
  return res.json(agent);
}
```
Registre: `app.get('/api/agent', requireAuth, getAgent);`

## Verificação
Dashboard abre com hero do agente, 5 métricas no topo, grid de estados FSM e lista de matrículas.
