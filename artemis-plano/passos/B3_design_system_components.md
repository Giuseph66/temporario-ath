# Passo B3 — Frontend: Componentes Base do Design System

## Contexto
Painel em `packages/dashboard/`. Criando os componentes reutilizáveis baseados nos estilos exatos dos arquivos `exemplo_telas/v1-cockpit.jsx` e `exemplo_telas/v3-composer.jsx`. Não inventar estilos novos — extrair do que já existe nos exemplos.

**Pré-requisito:** Passo B2 concluído (projeto React criado com tokens.css).

## O que Fazer

**1. Leia os arquivos de exemplo**
Abra e leia `exemplo_telas/v1-cockpit.jsx` e `exemplo_telas/v3-composer.jsx`. Os estilos inline dos componentes são a referência direta.

**2. Crie `src/components/Button.tsx`**
Baseado em `v1c.btn` e `v1c.btnPrimary` dos exemplos:

```tsx
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'danger';
  children: React.ReactNode;
}

export function Button({ variant = 'default', children, style, ...props }: ButtonProps) {
  const base: React.CSSProperties = {
    padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
    fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex',
    alignItems: 'center', gap: 6,
  };
  const variants: Record<string, React.CSSProperties> = {
    default:  { border: '1px solid var(--line-2)', background: 'var(--paper)', color: 'var(--ink-1)' },
    primary:  { border: '1px solid var(--accent-ink)', background: 'var(--accent)', color: '#fff' },
    danger:   { border: '1px solid var(--danger)', background: 'var(--danger-soft)', color: 'var(--danger)' },
  };
  return <button style={{ ...base, ...variants[variant], ...style }} {...props}>{children}</button>;
}
```

**3. Crie `src/components/Toggle.tsx`**
Baseado em `Toggle` dos exemplos:

```tsx
interface ToggleProps { on: boolean; onChange?: () => void; }

export function Toggle({ on, onChange }: ToggleProps) {
  return (
    <div onClick={onChange} style={{
      width: 38, height: 22, borderRadius: 999,
      background: on ? 'var(--accent)' : 'var(--ink-5)',
      position: 'relative', cursor: 'pointer', flexShrink: 0,
      transition: 'background .15s',
    }}>
      <div style={{
        position: 'absolute', top: 2, left: on ? 18 : 2,
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        boxShadow: '0 1px 2px rgba(0,0,0,.15)', transition: 'left .15s',
      }} />
    </div>
  );
}
```

**4. Crie `src/components/Badge.tsx`**
Baseado em `v1c.badge` dos exemplos:

```tsx
type BadgeColor = 'default' | 'green' | 'amber' | 'danger' | 'blue';

export function Badge({ children, color = 'default' }: { children: React.ReactNode; color?: BadgeColor }) {
  const colors: Record<BadgeColor, React.CSSProperties> = {
    default: { background: 'var(--paper-2)', color: 'var(--ink-3)', borderColor: 'var(--line-2)' },
    green:   { background: 'var(--accent-soft)', color: 'var(--accent-ink)', borderColor: '#c9d8d0' },
    amber:   { background: 'var(--amber-soft)', color: 'var(--amber)', borderColor: '#e0c090' },
    danger:  { background: 'var(--danger-soft)', color: 'var(--danger)', borderColor: '#e0a090' },
    blue:    { background: '#e0eaf8', color: '#1a4d8f', borderColor: '#aac0e0' },
  };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 999, border: '1px solid',
      fontFamily: "'Geist Mono', monospace", fontSize: 11,
      fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5,
      ...colors[color],
    }}>
      {children}
    </span>
  );
}
```

**5. Crie `src/components/Input.tsx`**
```tsx
export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input style={{
      width: '100%', padding: '9px 12px',
      border: '1px solid var(--line-2)', borderRadius: 8,
      background: 'var(--paper)', color: 'var(--ink-1)',
      fontSize: 14, fontFamily: 'inherit', outline: 'none',
    }} {...props} />
  );
}
```

## Verificação
Importe um componente em `App.tsx` e renderize para confirmar que os estilos aparecem corretamente.
```bash
npm run dev
```
Sem erros de TypeScript no terminal.
