# Passo D3 — Frontend: Tela de Leads (Tabela + Sidebar)

## Contexto
Painel em `packages/dashboard/`. Tabela com todos os leads do tenant. Click abre sidebar com perfil completo. Inspirada no V1 Cockpit dos exemplos.

**Pré-requisito:** Passo D1 concluído. React Query configurado (D2).

## O que Fazer

**1. Crie `src/pages/Leads.tsx`**

```tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

const FSM_COLORS: Record<string, string> = {
  GREETING: '#8a8579', QUALIFICATION: '#1a4d8f',
  PROGRAM_PRESENTATION: '#1b6b4d', OBJECTION_HANDLING: '#a86a1a',
  CLOSING: '#65a30d', HUMAN_HANDOFF: '#a83a2a',
};

const ENROLLMENT_LABELS: Record<string, { label: string; color: string }> = {
  LEAD:            { label: 'Lead',          color: '#8a8579' },
  PAYMENT_PENDING: { label: 'Pgto. pendente', color: '#a86a1a' },
  ENROLLED:        { label: 'Matriculado',   color: '#1b6b4d' },
  CANCELLED:       { label: 'Cancelado',     color: '#a83a2a' },
};

export function Leads() {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['leads', search],
    queryFn: () => axios.get(`/api/leads?search=${search}&limit=100`).then(r => r.data),
  });

  const { data: detail } = useQuery({
    queryKey: ['lead', selectedId],
    queryFn: () => axios.get(`/api/leads/${selectedId}`).then(r => r.data),
    enabled: !!selectedId,
  });

  const updateState = useMutation({
    mutationFn: ({ id, state }: { id: string; state: string }) =>
      axios.patch(`/api/leads/${id}/state`, { state }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  });

  const deleteLead = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/leads/${id}`),
    onSuccess: () => { setSelectedId(null); qc.invalidateQueries({ queryKey: ['leads'] }); },
  });

  const leads = data?.leads ?? [];

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Tabela */}
      <div style={{ flex: 1, overflow: 'auto', padding: '28px 32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 24, color: 'var(--ink-1)' }}>
            Leads <span style={{ fontSize: 16, color: 'var(--ink-5)', fontFamily: 'inherit' }}>
              {data?.total ?? 0}
            </span>
          </div>
          <input placeholder="Buscar por nome ou telefone…"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line-2)',
              background: 'var(--paper)', fontSize: 13, fontFamily: 'inherit',
              color: 'var(--ink-1)', width: 260, outline: 'none' }} />
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--line)' }}>
              {['Nome', 'Telefone', 'Programa', 'Estado', 'Status', 'Última interação'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11,
                  fontFamily: "'Geist Mono', monospace", textTransform: 'uppercase',
                  letterSpacing: '.6px', color: 'var(--ink-4)', fontWeight: 500 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leads.map((lead: any) => {
              const enr = ENROLLMENT_LABELS[lead.enrollmentStatus] ?? ENROLLMENT_LABELS.LEAD;
              return (
                <tr key={lead.id} onClick={() => setSelectedId(lead.id)}
                  style={{ borderBottom: '1px solid var(--line)', cursor: 'pointer',
                    background: selectedId === lead.id ? 'var(--accent-soft)' : 'transparent' }}>
                  <td style={{ padding: '11px 12px', fontSize: 13, fontWeight: 500, color: 'var(--ink-1)' }}>
                    {lead.name ?? '—'}
                  </td>
                  <td style={{ padding: '11px 12px', fontSize: 12, color: 'var(--ink-3)',
                    fontFamily: "'Geist Mono', monospace" }}>
                    {lead.phoneNumber}
                  </td>
                  <td style={{ padding: '11px 12px', fontSize: 12, color: 'var(--ink-3)' }}>
                    {lead.currentProgramId ?? '—'}
                  </td>
                  <td style={{ padding: '11px 12px' }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4,
                      background: FSM_COLORS[lead.conversationState] + '15',
                      color: FSM_COLORS[lead.conversationState], fontFamily: "'Geist Mono', monospace" }}>
                      {lead.conversationState}
                    </span>
                  </td>
                  <td style={{ padding: '11px 12px' }}>
                    <span style={{ fontSize: 11, color: enr.color, fontWeight: 500 }}>
                      {enr.label}
                    </span>
                  </td>
                  <td style={{ padding: '11px 12px', fontSize: 12, color: 'var(--ink-4)' }}>
                    {lead.lastInteraction ? new Date(lead.lastInteraction).toLocaleDateString('pt-BR') : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Sidebar de detalhe */}
      {selectedId && detail && (
        <div style={{ width: 340, flexShrink: 0, borderLeft: '1px solid var(--line)',
          background: 'var(--paper-2)', overflow: 'auto', padding: '24px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink-1)', marginBottom: 4 }}>
                {detail.name ?? 'Sem nome'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: "'Geist Mono', monospace" }}>
                {detail.phoneNumber}
              </div>
            </div>
            <button onClick={() => setSelectedId(null)} style={{
              padding: '4px 8px', borderRadius: 6, border: '1px solid var(--line-2)',
              background: 'var(--paper)', color: 'var(--ink-4)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12,
            }}>✕</button>
          </div>

          {/* Campos do perfil */}
          {[
            ['Idade', detail.age],
            ['Email', detail.email],
            ['Objetivo', detail.goal],
            ['Programa', detail.currentProgramId],
            ['Estado FSM', detail.conversationState],
            ['Matrícula', ENROLLMENT_LABELS[detail.enrollmentStatus]?.label],
            ['LGPD', detail.lgpdConsent ? 'Consentiu' : 'Não consentiu'],
            ['Interações', detail.interactionCount],
          ].map(([label, value]) => value != null && (
            <div key={label as string} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)',
              display: 'grid', gridTemplateColumns: '110px 1fr', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: "'Geist Mono', monospace",
                textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</span>
              <span style={{ fontSize: 13, color: 'var(--ink-1)' }}>{String(value)}</span>
            </div>
          ))}

          {/* Ações */}
          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={() => updateState.mutate({ id: selectedId, state: 'HUMAN_HANDOFF' })}
              style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid var(--amber)',
                background: 'var(--amber-soft)', color: 'var(--amber)', cursor: 'pointer',
                fontSize: 13, fontFamily: 'inherit' }}>
              Forçar transferência para humano
            </button>
            <button onClick={() => { if (confirm('Excluir lead e histórico? Ação irreversível.'))
              deleteLead.mutate(selectedId); }}
              style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid var(--danger)',
                background: 'var(--danger-soft)', color: 'var(--danger)', cursor: 'pointer',
                fontSize: 13, fontFamily: 'inherit' }}>
              Excluir lead (LGPD)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

**2. Registre nas rotas**
Substitua placeholder de `leads` por `<Leads />`.

## Verificação
1. Abra Leads → tabela com todos os leads
2. Busca filtra em tempo real
3. Click num lead → sidebar desliza com todos os campos
4. "Forçar transferência" → estado muda para HUMAN_HANDOFF na tabela
