# Passo D2 — Frontend: Tela de Conversas (Split View)

## Contexto
Painel em `packages/dashboard/`. Tela inspirada no V2 Console dos exemplos: lista de conversas à esquerda, chat completo à direita. Você consegue ver as conversas do bot acontecendo em tempo real.

**Pré-requisito:** Passo D1 concluído (endpoint `/api/conversations` funcionando).

## O que Fazer

**1. Crie `src/pages/Conversations.tsx`**

```tsx
import { useState } from 'react';
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

export function Conversations() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterState, setFilterState] = useState('');

  const { data: convos = [] } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => axios.get('/api/conversations').then(r => r.data),
    refetchInterval: 5000, // atualiza a cada 5s
  });

  const { data: lead } = useQuery({
    queryKey: ['lead', selectedId],
    queryFn: () => axios.get(`/api/leads/${selectedId}`).then(r => r.data),
    enabled: !!selectedId,
    refetchInterval: 3000,
  });

  const filtered = filterState ? convos.filter((c: any) => c.conversationState === filterState) : convos;

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Lista esquerda */}
      <div style={{
        width: 300, flexShrink: 0, borderRight: '1px solid var(--line)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Filtro por estado */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
          <select value={filterState} onChange={e => setFilterState(e.target.value)}
            style={{ width: '100%', padding: '7px 10px', borderRadius: 8,
              border: '1px solid var(--line-2)', background: 'var(--paper)',
              fontSize: 12, color: 'var(--ink-2)', fontFamily: 'inherit' }}>
            <option value="">Todos os estados</option>
            {Object.entries(FSM_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        {/* Lista */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.map((c: any) => (
            <div key={c.id} onClick={() => setSelectedId(c.id)}
              style={{
                padding: '14px 16px', cursor: 'pointer', borderBottom: '1px solid var(--line)',
                background: selectedId === c.id ? 'var(--accent-soft)' : 'transparent',
                transition: 'background .1s',
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-1)', marginBottom: 3 }}>
                  {c.name || c.phoneNumber}
                </div>
                <div style={{
                  fontSize: 10, fontFamily: "'Geist Mono', monospace",
                  padding: '2px 6px', borderRadius: 4,
                  background: FSM_COLORS[c.conversationState] + '20',
                  color: FSM_COLORS[c.conversationState], border: `1px solid ${FSM_COLORS[c.conversationState]}40`,
                }}>
                  {FSM_LABELS[c.conversationState] ?? c.conversationState}
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>
                {c.messages?.[0]?.content?.slice(0, 60) ?? 'Sem mensagens'}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: 24, fontSize: 13, color: 'var(--ink-5)', textAlign: 'center' }}>
              Nenhuma conversa
            </div>
          )}
        </div>
      </div>

      {/* Chat direito */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {lead ? (
          <>
            {/* Header do chat */}
            <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--line)',
              display: 'flex', alignItems: 'center', gap: 12 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink-1)' }}>
                  {lead.name || lead.phoneNumber}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>
                  {lead.phoneNumber} · {FSM_LABELS[lead.conversationState]}
                  {lead.enrollmentStatus === 'ENROLLED' && (
                    <span style={{ marginLeft: 8, color: 'var(--accent)', fontWeight: 600 }}>✓ Matriculado</span>
                  )}
                </div>
              </div>
            </div>
            {/* Mensagens */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px',
              display: 'flex', flexDirection: 'column', gap: 8 }}>
              {lead.messages?.map((msg: any) => (
                <div key={msg.id} style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-start' : 'flex-end',
                }}>
                  <div style={{
                    maxWidth: '70%', padding: '10px 14px', borderRadius: 12,
                    fontSize: 13, lineHeight: 1.55,
                    background: msg.role === 'user' ? 'var(--paper-3)' : 'var(--accent-soft)',
                    color: msg.role === 'user' ? 'var(--ink-1)' : 'var(--accent-ink)',
                    border: `1px solid ${msg.role === 'user' ? 'var(--line)' : '#c9d8d0'}`,
                  }}>
                    {msg.content}
                    <div style={{ fontSize: 10, color: 'var(--ink-5)', marginTop: 4, textAlign: 'right' }}>
                      {new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--ink-5)', fontSize: 14 }}>
            Selecione uma conversa
          </div>
        )}
      </div>
    </div>
  );
}
```

**2. Configure React Query em `src/main.tsx`**
```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const queryClient = new QueryClient();

// Envolva o App:
<QueryClientProvider client={queryClient}><App /></QueryClientProvider>
```

**3. Registre a tela nas rotas**
Substitua o placeholder de `conversas` por `<Conversations />`.

## Verificação
1. Abra Conversas no painel
2. Lista deve mostrar conversas reais dos leads
3. Click numa conversa: histórico completo aparece à direita
4. A lista atualiza sozinha a cada 5s
