# Passo F2 — Frontend: Tela de Registro Público

## Contexto
Painel em `packages/dashboard/`. Tela pública (sem login) para novos clientes criarem sua conta. Estilo escuro igual ao hub de `exemplo_telas/index.html`.

**Pré-requisito:** Passo F1 concluído (endpoint `/auth/register`).

## O que Fazer

**1. Crie `src/pages/Register.tsx`**

```tsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

export function Register() {
  const [form, setForm] = useState({ companyName: '', agentName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  function set(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await axios.post('/auth/register', form);
      localStorage.setItem('accessToken', res.data.accessToken);
      localStorage.setItem('refreshToken', res.data.refreshToken);
      navigate('/onboarding');
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Erro ao criar conta.');
    } finally {
      setLoading(false);
    }
  }

  const fieldStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    border: '1px solid #2a2823', background: '#111110',
    color: '#f1ecdc', fontSize: 14, fontFamily: 'inherit', outline: 'none',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 12, color: '#8a8579', display: 'block', marginBottom: 5,
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f0e',
      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 420, padding: '0 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 42, color: '#f1ecdc',
            fontWeight: 400, letterSpacing: -1.5, marginBottom: 8 }}>
            Agentes Zap
          </div>
          <div style={{ fontSize: 15, color: '#55524a' }}>
            Crie sua conta e conecte seu agente de WhatsApp com IA em minutos.
          </div>
        </div>

        <div style={{ background: '#1a1917', border: '1px solid #2a2823',
          borderRadius: 16, padding: '32px 28px' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>Nome da empresa</label>
              <input value={form.companyName} onChange={set('companyName')}
                placeholder="Confluence Treinamento" required style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>Nome do agente</label>
              <input value={form.agentName} onChange={set('agentName')}
                placeholder="Artemis" required style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input type="email" value={form.email} onChange={set('email')}
                placeholder="admin@empresa.com" required style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>Senha (mín. 8 caracteres)</label>
              <input type="password" value={form.password} onChange={set('password')}
                required minLength={8} style={fieldStyle} />
            </div>

            {error && (
              <div style={{ fontSize: 12, color: '#f87171', padding: '8px 12px',
                background: '#200a08', borderRadius: 6, border: '1px solid #a83a2a' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              marginTop: 4, padding: '11px', borderRadius: 8, fontSize: 14, fontWeight: 500,
              border: '1px solid #0d4a36', background: '#1b6b4d', color: '#fff',
              cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit',
            }}>
              {loading ? 'Criando conta...' : 'Criar conta grátis →'}
            </button>
          </form>

          <div style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: '#55524a' }}>
            Já tem conta?{' '}
            <Link to="/login" style={{ color: '#5ec88a', textDecoration: 'none' }}>
              Entrar
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**2. Adicione a rota em `App.tsx`**
```tsx
<Route path="/register" element={<Register />} />
```
E adicione link "Criar conta" na tela de Login.

## Verificação
1. Acesse `/register`
2. Preencha todos os campos e envie
3. Deve redirecionar para `/onboarding` (próximo passo)
4. No `prisma studio`: Tenant + Agent + TenantUser criados corretamente
