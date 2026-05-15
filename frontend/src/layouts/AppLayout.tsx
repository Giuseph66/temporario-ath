import { NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const BASE_NAV = [
    { to: '/dashboard',    label: 'Dashboard' },
    { to: '/conversas',    label: 'Conversas' },
    { to: '/leads',        label: 'Leads' },
    { to: '/contatos',     label: 'Contatos' },
    { to: '/integracoes',  label: 'Integrações' },
    { to: '/agente',       label: 'Agente' },
    { to: '/produtos',     label: 'Produtos' },
    { to: '/config',       label: 'Configurações' },
    { to: '/logs',         label: 'Logs' },
];

export function AppLayout() {
    const { logout } = useAuth();

    const { data: integs } = useQuery<{ asaas?: { configured: boolean } }>({
        queryKey: ['integrations'],
        queryFn: () => axios.get('/api/integrations').then(r => r.data),
        staleTime: 60_000,
    });

    const asaasConfigured = integs?.asaas?.configured ?? false;

    const navItems = asaasConfigured
        ? [...BASE_NAV.slice(0, 4), { to: '/asaas', label: 'Asaas' }, ...BASE_NAV.slice(4)]
        : BASE_NAV;

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
            {/* Main content */}
            <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
                <Outlet />
            </div>
        </div>
    );
}
