import { NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

type NavItem = { to: string; label: string };
type NavCategory = { label: string; items: NavItem[] };

const BASE_CATEGORIES: NavCategory[] = [
    {
        label: 'Visão Geral',
        items: [
            { to: '/dashboard', label: 'Dashboard' },
        ],
    },
    {
        label: 'Atendimento',
        items: [
            { to: '/conversas',  label: 'Conversas' },
            { to: '/simulador',  label: 'Simulador' },
            { to: '/leads',      label: 'Leads' },
            { to: '/contatos',   label: 'Contatos' },
        ],
    },
    {
        label: 'Agente',
        items: [
            { to: '/agente',   label: 'Configuração' },
            { to: '/memorias', label: 'Memórias' },
            { to: '/automacoes', label: 'Automações' },
            { to: '/produtos', label: 'Produtos' },
        ],
    },
    {
        label: 'Sistema',
        items: [
            { to: '/integracoes', label: 'Integrações' },
            { to: '/config',      label: 'Configurações' },
            { to: '/logs',        label: 'Logs' },
        ],
    },
];

export function AppLayout() {
    const { logout } = useAuth();
    const { theme, toggle } = useTheme();

    const { data: integs } = useQuery<{ asaas?: { configured: boolean } }>({
        queryKey: ['integrations'],
        queryFn: () => axios.get('/api/integrations').then(r => r.data),
        staleTime: 60_000,
    });

    const asaasConfigured = integs?.asaas?.configured ?? false;

    // Inject Asaas into Sistema category when configured
    const categories: NavCategory[] = BASE_CATEGORIES.map(cat => {
        if (cat.label === 'Sistema' && asaasConfigured) {
            return {
                ...cat,
                items: [{ to: '/asaas', label: 'Asaas' }, ...cat.items],
            };
        }
        return cat;
    });

    return (
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--paper-2)' }}>
            {/* Sidebar */}
            <div style={{
                width: 200, flexShrink: 0, background: 'var(--paper)',
                borderRight: '1px solid var(--line)', display: 'flex',
                flexDirection: 'column',
            }}>
                {/* Brand */}
                <div style={{
                    padding: '20px 20px 18px',
                    borderBottom: '1px solid var(--line)',
                    fontFamily: "'Fraunces', serif", fontSize: 18, color: 'var(--ink-1)',
                    flexShrink: 0,
                }}>
                    Agentes Zap
                </div>

                {/* Nav */}
                <nav style={{
                    flex: 1, overflowY: 'auto',
                    padding: '12px 8px',
                    display: 'flex', flexDirection: 'column', gap: 18,
                }}>
                    {categories.map(cat => (
                        <div key={cat.label} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            {/* Category label */}
                            <div style={{
                                padding: '2px 12px 6px',
                                fontFamily: "'Geist Mono', monospace",
                                fontSize: 9, fontWeight: 700,
                                letterSpacing: 0.8, textTransform: 'uppercase',
                                color: 'var(--ink-5)',
                            }}>
                                {cat.label}
                            </div>

                            {/* Items */}
                            {cat.items.map(item => (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    style={({ isActive }) => ({
                                        padding: '7px 12px', borderRadius: 8,
                                        fontSize: 13, fontWeight: 500,
                                        textDecoration: 'none',
                                        background: isActive ? 'var(--accent-soft)' : 'transparent',
                                        color: isActive ? 'var(--accent-ink)' : 'var(--ink-3)',
                                        transition: 'background 0.1s, color 0.1s',
                                    })}
                                >
                                    {item.label}
                                </NavLink>
                            ))}
                        </div>
                    ))}
                </nav>

                {/* Theme + Logout */}
                <div style={{
                    padding: '12px 16px',
                    borderTop: '1px solid var(--line)',
                    flexShrink: 0,
                    display: 'flex', flexDirection: 'column', gap: 6,
                }}>
                    {/* Theme toggle */}
                    <button
                        onClick={toggle}
                        style={{
                            width: '100%', padding: '7px 12px', borderRadius: 8,
                            fontSize: 12, border: '1px solid var(--line-2)',
                            background: 'var(--paper-2)', color: 'var(--ink-3)',
                            cursor: 'pointer', fontFamily: 'inherit',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}
                    >
                        <span>{theme === 'dark' ? '☀ Clean' : '◑ Dark'}</span>
                        <span style={{
                            fontFamily: "'Geist Mono', monospace",
                            fontSize: 9, letterSpacing: 0.5,
                            textTransform: 'uppercase',
                            color: 'var(--ink-5)',
                        }}>
                            {theme === 'dark' ? 'DARK' : 'CLEAN'}
                        </span>
                    </button>

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
