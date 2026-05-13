# Passo E4 — Frontend: Tela de Configuração do Agente (PowerCards)

## Contexto
Painel em `packages/dashboard/`. Tela para editar persona, programas e settings do agente sem tocar no código. Estrutura inspirada diretamente no V3 Composer dos exemplos — PowerCards expansíveis com toggle e campos editáveis.

**Pré-requisito:** Passo E3 concluído (endpoints de config funcionando).

## O que Fazer

**1. Crie o componente `PowerCard` reutilizável em `src/components/PowerCard.tsx`**
Baseado exatamente na implementação do `v3-composer.jsx`:

```tsx
interface PowerCardProps {
  title: string;
  desc: string;
  icon: string;
  active: boolean;
  expanded: boolean;
  onToggle: () => void;
  onExpand: () => void;
  children?: React.ReactNode;
  risk?: 'low' | 'med' | 'high';
}

export function PowerCard({ title, desc, icon, active, expanded, onToggle, onExpand, children, risk = 'low' }: PowerCardProps) {
  const riskColors = {
    low:  { bg: 'var(--accent-soft)',  color: 'var(--accent-ink)' },
    med:  { bg: 'var(--amber-soft)',   color: 'var(--amber)' },
    high: { bg: 'var(--danger-soft)',  color: 'var(--danger)' },
  };
  const riskLabels = { low: 'baixo', med: 'médio', high: 'alto' };

  return (
    <div style={{
      background: 'var(--paper)', borderRadius: 14, marginBottom: 12, overflow: 'hidden',
      border: active ? '1px solid #c9d8d0' : '1px solid var(--line)',
    }}>
      <div onClick={onExpand} style={{ padding: '18px 22px', display: 'flex',
        alignItems: 'center', gap: 16, cursor: 'pointer' }}>
        <div style={{
          width: 44, height: 44, borderRadius: 10, fontSize: 22,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: active ? 'var(--accent)' : 'var(--paper-2)',
          border: active ? '1px solid var(--accent-ink)' : '1px solid var(--line)',
        }}>
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink-1)', marginBottom: 3 }}>{title}</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.45 }}>{desc}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10,
            textTransform: 'uppercase', letterSpacing: .5, padding: '3px 8px', borderRadius: 4,
            background: riskColors[risk].bg, color: riskColors[risk].color }}>
            risco {riskLabels[risk]}
          </span>
          <div onClick={e => { e.stopPropagation(); onToggle(); }}>
            {/* Toggle inline */}
            <div style={{ width: 38, height: 22, borderRadius: 999, cursor: 'pointer',
              background: active ? 'var(--accent)' : 'var(--ink-5)', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 2, left: active ? 18 : 2,
                width: 18, height: 18, borderRadius: '50%', background: '#fff',
                transition: 'left .15s', boxShadow: '0 1px 2px rgba(0,0,0,.15)' }} />
            </div>
          </div>
          <span style={{ color: 'var(--ink-4)', transform: expanded ? 'rotate(180deg)' : 'none',
            transition: 'transform .15s', display: 'inline-block' }}>▾</span>
        </div>
      </div>
      {expanded && active && (
        <div style={{ padding: '4px 22px 22px 82px', borderTop: '1px dashed var(--line)' }}>
          {children}
        </div>
      )}
    </div>
  );
}
```

**2. Crie `src/pages/Agent.tsx`**

```tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { PowerCard } from '../components/PowerCard';

export function Agent() {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>('persona');
  const [dirty, setDirty] = useState(false);
  const [agentName, setAgentName] = useState('');
  const [agentTone, setAgentTone] = useState('');

  const { data: agent } = useQuery({
    queryKey: ['agent'],
    queryFn: () => axios.get('/api/agent').then(r => r.data),
    onSuccess: (d: any) => {
      setAgentName(d.personaJson?.name ?? '');
      setAgentTone(d.personaJson?.tone?.primary?.[0] ?? '');
    },
  });

  const savePersona = useMutation({
    mutationFn: () => axios.patch('/api/agent/persona', {
      personaJson: { ...agent?.personaJson, name: agentName },
    }),
    onSuccess: () => { setDirty(false); qc.invalidateQueries({ queryKey: ['agent'] }); },
  });

  const toggleActive = useMutation({
    mutationFn: () => axios.patch('/api/agent/toggle'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent'] }),
  });

  const isActive = agent?.isActive ?? true;
  const personaJson = agent?.personaJson ?? {};

  function toggle(card: string) { setExpanded(e => e === card ? null : card); }

  return (
    <div style={{ padding: '28px 36px', maxWidth: 820, overflowY: 'auto' }}>
      {/* Topbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12, color: 'var(--ink-4)' }}>
          Agentes · {agent?.name ?? '…'}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {dirty && (
            <button onClick={() => savePersona.mutate()} style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
              border: '1px solid var(--accent-ink)', background: 'var(--accent)',
              color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Publicar alterações
            </button>
          )}
        </div>
      </div>

      {/* Hero */}
      <div style={{ background: 'var(--paper)', border: '1px solid var(--line)',
        borderRadius: 16, padding: '28px 32px', marginBottom: 28 }}>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #2b3a32 0%, #1b6b4d 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Fraunces', serif", fontSize: 30, color: '#fff',
            position: 'relative' }}>
            {agent?.name?.[0]?.toUpperCase() ?? 'A'}
            <div style={{ position: 'absolute', bottom: 3, right: 3, width: 12, height: 12,
              borderRadius: '50%', background: isActive ? '#5ec88a' : '#a83a2a',
              border: '2px solid var(--paper)' }} />
          </div>
          <div style={{ flex: 1 }}>
            <input value={agentName} onChange={e => { setAgentName(e.target.value); setDirty(true); }}
              style={{ fontFamily: "'Fraunces', serif", fontSize: 32, fontWeight: 400,
                letterSpacing: -1, color: 'var(--ink-1)', background: 'transparent',
                border: 'none', outline: 'none', width: '100%', marginBottom: 8 }} />
            <div style={{ fontSize: 13, color: 'var(--ink-4)' }}>
              {personaJson.role ?? 'IA de atendimento'}
            </div>
          </div>
        </div>
      </div>

      <div style={{ fontSize: 22, fontFamily: "'Fraunces', serif", color: 'var(--ink-1)',
        marginBottom: 16 }}>Configurações</div>

      <PowerCard title="Personalidade & Restrições" desc="Tom de voz, emojis autorizados e regras de comportamento"
        icon="🎭" active={isActive} expanded={expanded === 'persona'}
        onToggle={() => toggleActive.mutate()} onExpand={() => toggle('persona')} risk="low">
        <div style={{ paddingTop: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--ink-4)', marginBottom: 6,
            fontFamily: "'Geist Mono', monospace", textTransform: 'uppercase', letterSpacing: .5 }}>
            Tom principal
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(personaJson.tone?.primary ?? []).map((t: string) => (
              <span key={t} style={{ padding: '5px 12px', borderRadius: 999, fontSize: 12,
                border: '1px solid var(--accent-ink)', background: 'var(--accent-soft)',
                color: 'var(--accent-ink)' }}>{t}</span>
            ))}
          </div>
          <div style={{ marginTop: 16, fontSize: 12, color: 'var(--ink-4)',
            fontFamily: "'Geist Mono', monospace", textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>
            Restrições absolutas
          </div>
          {(personaJson.absolute_restrictions ?? []).map((r: string, i: number) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--ink-2)', padding: '6px 0',
              borderBottom: '1px solid var(--line)', lineHeight: 1.5 }}>
              {r}
            </div>
          ))}
        </div>
      </PowerCard>

      <PowerCard title="Programas & Preços" desc="Cursos, terapia e valores configurados"
        icon="📚" active={isActive} expanded={expanded === 'programs'}
        onToggle={() => toggleActive.mutate()} onExpand={() => toggle('programs')} risk="med">
        <div style={{ paddingTop: 12 }}>
          {(agent?.programsJson?.programs ?? []).map((p: any) => (
            <div key={p.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-1)', marginBottom: 4 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                R$ {p.price_value} / {p.price_type === 'monthly' ? 'mês' : 'sessão'} · {p.installments}x
              </div>
            </div>
          ))}
        </div>
      </PowerCard>

      <PowerCard title="Transferência para Humano" desc="Links e mensagens de handoff"
        icon="🤝" active={isActive} expanded={expanded === 'handoff'}
        onToggle={() => toggleActive.mutate()} onExpand={() => toggle('handoff')} risk="low">
        <div style={{ paddingTop: 12, fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>
          <div><strong>Link humano:</strong> {personaJson.protocols?.human_contact_link ?? '—'}</div>
          <div style={{ marginTop: 8 }}><strong>Formulário:</strong> {personaJson.protocols?.registration_link ?? '—'}</div>
        </div>
      </PowerCard>

      {/* Footer */}
      {dirty && (
        <div style={{ marginTop: 24, padding: '16px 20px', background: 'var(--paper)',
          border: '1px solid var(--line)', borderRadius: 12,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>Alterações não publicadas</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setAgentName(agent?.personaJson?.name ?? ''); setDirty(false); }}
              style={{ padding: '8px 14px', borderRadius: 8, fontSize: 13,
                border: '1px solid var(--line-2)', background: 'var(--paper-2)',
                color: 'var(--ink-2)', cursor: 'pointer', fontFamily: 'inherit' }}>
              Descartar
            </button>
            <button onClick={() => savePersona.mutate()}
              style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                border: '1px solid var(--accent-ink)', background: 'var(--accent)',
                color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
              Publicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

## Verificação
1. Tela de Agente abre com PowerCards expansíveis
2. Edite o nome do agente → botão "Publicar" aparece
3. Clique Publicar → nome salvo, bot usa novo nome nas próximas respostas
4. Toggle desliga o agente (killswitch global)
