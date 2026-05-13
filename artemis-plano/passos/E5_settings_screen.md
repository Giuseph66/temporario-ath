# Passo E5 — Frontend: Tela de Configurações (Conta + Perigo)

## Contexto
Painel em `packages/dashboard/`. Configurações da conta do tenant: dados, admins, troca de senha. Zona de perigo: desativar agente, exportar dados LGPD.

**Pré-requisito:** Sprint E configurado.

## O que Fazer

**1. Crie `src/pages/Settings.tsx`**

```tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

export function Settings() {
  const { logout } = useAuth();
  const [confirmDelete, setConfirmDelete] = useState('');

  const { data: agent } = useQuery({
    queryKey: ['agent'],
    queryFn: () => axios.get('/api/agent').then(r => r.data),
  });

  function section(title: string) {
    return (
      <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, color: 'var(--ink-1)',
        margin: '32px 0 16px', letterSpacing: -.3 }}>
        {title}
      </div>
    );
  }

  function row(label: string, value: React.ReactNode) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16,
        padding: '12px 0', borderBottom: '1px solid var(--line)', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: "'Geist Mono', monospace",
          textTransform: 'uppercase', letterSpacing: .5 }}>{label}</span>
        <span style={{ fontSize: 13, color: 'var(--ink-1)' }}>{value}</span>
      </div>
    );
  }

  return (
    <div style={{ padding: '28px 40px', maxWidth: 720, overflowY: 'auto' }}>
      <div style={{ fontFamily: "'Fraunces', serif", fontSize: 28, color: 'var(--ink-1)',
        marginBottom: 4 }}>Configurações</div>
      <div style={{ fontSize: 14, color: 'var(--ink-4)', marginBottom: 28 }}>
        Gerencie sua conta e integrações.
      </div>

      {section('Sua conta')}
      <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 12, padding: '0 20px' }}>
        {row('Agente', agent?.name ?? '—')}
        {row('Plano', 'Pro')}
        {row('Status', <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Ativo</span>)}
      </div>

      {section('Troca de senha')}
      <div style={{ background: 'var(--paper)', border: '1px solid var(--line)',
        borderRadius: 12, padding: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 340 }}>
          {['Senha atual', 'Nova senha', 'Confirmar nova senha'].map(label => (
            <div key={label}>
              <label style={{ fontSize: 12, color: 'var(--ink-4)', display: 'block', marginBottom: 5 }}>
                {label}
              </label>
              <input type="password" style={{
                width: '100%', padding: '9px 12px', borderRadius: 8,
                border: '1px solid var(--line-2)', background: 'var(--paper)',
                fontSize: 13, fontFamily: 'inherit', outline: 'none', color: 'var(--ink-1)',
              }} />
            </div>
          ))}
          <button style={{ marginTop: 4, padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
            border: '1px solid var(--accent-ink)', background: 'var(--accent)',
            color: '#fff', cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'flex-start' }}>
            Alterar senha
          </button>
        </div>
      </div>

      {/* Zona de perigo */}
      {section('Zona de perigo')}
      <div style={{ background: 'var(--danger-soft)', border: '1px solid var(--danger)',
        borderRadius: 12, padding: '20px 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Exportar dados LGPD */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-1)', marginBottom: 3 }}>
                Exportar dados (LGPD Art. 15)
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                Baixar todos os dados de leads em JSON
              </div>
            </div>
            <button onClick={async () => {
              const res = await axios.get('/api/leads?limit=9999');
              const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url;
              a.download = `leads-export-${Date.now()}.json`; a.click();
            }} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 13,
              border: '1px solid var(--danger)', background: 'var(--paper)',
              color: 'var(--danger)', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              Exportar JSON
            </button>
          </div>

          <div style={{ height: 1, background: '#e0b0a8' }} />

          {/* Sair */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-1)', marginBottom: 3 }}>
                Sair da conta
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Encerrar sessão atual</div>
            </div>
            <button onClick={logout} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 13,
              border: '1px solid var(--danger)', background: 'var(--paper)',
              color: 'var(--danger)', cursor: 'pointer', fontFamily: 'inherit' }}>
              Sair
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**2. Registre nas rotas**
Substitua placeholder de `config` por `<Settings />`.

## Verificação
1. Tela abre com dados da conta
2. "Exportar JSON" faz download do arquivo com todos os leads
3. "Sair" desloga e redireciona para login
