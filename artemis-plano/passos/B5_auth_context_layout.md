# Passo B5 — Frontend: AuthContext + Layout Shell Navegável

## Contexto
Painel em `packages/dashboard/`. Criando o contexto de autenticação global e o layout principal com sidebar + topbar estilo dos exemplos. Ao fim deste passo o painel tem login funcional e shell navegável com páginas placeholder.

**Pré-requisito:** Passo B4 concluído (login funcionando).

## O que Fazer

**1. Crie `src/contexts/AuthContext.tsx`**

```tsx
import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

interface AuthContextType {
  accessToken: string | null;
  tenantId: string | null;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({ accessToken: null, tenantId: null, logout: () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(
    localStorage.getItem('accessToken')
  );

  // Interceptor: adiciona Bearer em toda request
  useEffect(() => {
    const id = axios.interceptors.request.use(config => {
      const token = localStorage.getItem('accessToken');
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
    // Interceptor de resposta: logout automático em 401
    const id2 = axios.interceptors.response.use(
      r => r,
      err => {
        if (err.response?.status === 401) logout();
        return Promise.reject(err);
      }
    );
    return () => { axios.interceptors.request.eject(id); axios.interceptors.response.eject(id2); };
  }, []);

  function logout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setAccessToken(null);
    window.location.href = '/login';
  }

  // Decodifica tenantId do JWT sem dependência externa
  const tenantId = accessToken ? JSON.parse(atob(accessToken.split('.')[1])).tenantId : null;

  return (
    <AuthContext.Provider value={{ accessToken, tenantId, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

**2. Crie `src/layouts/AppLayout.tsx`**
Sidebar + topbar no estilo dos exemplos (`v1-cockpit.jsx`):

```tsx
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const navItems = [
  { to: '/dashboard',    label: 'Dashboard' },
  { to: '/conversas',   label: 'Conversas' },
  { to: '/leads',       label: 'Leads' },
  { to: '/integracoes', label: 'Integrações' },
  { to: '/agente',      label: 'Agente' },
  { to: '/config',      label: 'Configurações' },
];

export function AppLayout() {
  const { logout } = useAuth();
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--paper-2)' }}>
      {/* Sidebar */}
      <div style={{
        width: 200, flexShrink: 0, background: 'var(--paper)',
        borderRight: '1px solid var(--line)', display: 'flex',
        flexDirection: 'column', padding: '20px 0',
      }}>
        <div style={{
          padding: '0 20px 20px', borderBottom: '1px solid var(--line)',
          fontFamily: "'Fraunces', serif", fontSize: 18, color: 'var(--ink-1)',
        }}>
          Agentes Zap
        </div>
        <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} style={({ isActive }) => ({
              padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500,
              textDecoration: 'none',
              background: isActive ? 'var(--accent-soft)' : 'transparent',
              color: isActive ? 'var(--accent-ink)' : 'var(--ink-3)',
            })}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--line)' }}>
          <button onClick={logout} style={{
            width: '100%', padding: '7px 12px', borderRadius: 8, fontSize: 12,
            border: '1px solid var(--line-2)', background: 'var(--paper)',
            color: 'var(--ink-4)', cursor: 'pointer', fontFamily: 'inherit',
          }}>
            Sair
          </button>
        </div>
      </div>
      {/* Main */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        <Outlet />
      </div>
    </div>
  );
}
```

**3. Crie páginas placeholder para cada rota**
Em `src/pages/`, crie arquivos simples:
```tsx
// src/pages/Dashboard.tsx (e repetir para Conversas, Leads, Integracoes, Agente, Config)
export function Dashboard() {
  return <div style={{ padding: 40, fontSize: 24, color: 'var(--ink-3)' }}>Dashboard — em construção</div>;
}
```

**4. Atualize `src/App.tsx` com rotas protegidas**

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppLayout } from './layouts/AppLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
// ... outros imports

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { accessToken } = useAuth();
  return accessToken ? <>{children}</> : <Navigate to="/login" replace />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard"    element={<Dashboard />} />
            <Route path="conversas"    element={<div style={{padding:40}}>Conversas</div>} />
            <Route path="leads"        element={<div style={{padding:40}}>Leads</div>} />
            <Route path="integracoes"  element={<div style={{padding:40}}>Integrações</div>} />
            <Route path="agente"       element={<div style={{padding:40}}>Agente</div>} />
            <Route path="config"       element={<div style={{padding:40}}>Configurações</div>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
```

## Verificação
```bash
npm run dev
```
1. Acesse `http://localhost:5173` sem estar logado → redireciona para `/login`
2. Faça login → redireciona para `/dashboard` com sidebar e topbar visíveis
3. Clique em "Leads" na sidebar → URL muda para `/leads`, item fica destacado em verde
4. Clique em "Sair" → volta para login, token removido do localStorage
