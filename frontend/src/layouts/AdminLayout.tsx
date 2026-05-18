import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';

type NavItem = { to: string; label: string };
type NavCategory = { label: string; items: NavItem[] };

const ADMIN_CATEGORIES: NavCategory[] = [
    {
        label: 'Visão Geral',
        items: [
            { to: '/zeruela/dashboard', label: 'Dashboard' },
        ],
    },
    {
        label: 'Clientes',
        items: [
            { to: '/zeruela/clientes',  label: 'Todos os Clientes' },
            { to: '/zeruela/empresas',  label: 'Empresas' },
        ],
    },
    {
        label: 'Financeiro',
        items: [
            { to: '/zeruela/assinaturas', label: 'Assinaturas' },
            { to: '/zeruela/cobrancas',   label: 'Cobranças' },
        ],
    },
    {
        label: 'Configurações',
        items: [
            { to: '/zeruela/config/asaas', label: 'Asaas' },
        ],
    },
];

const ACCENT = '#c8a96e';
const ACCENT_SOFT = '#c8a96e18';
const ACCENT_BORDER = '#3a2e18';
const BG = '#0a0908';
const SIDEBAR_BG = '#0e0c09';

export function AdminLayout() {
    const navigate = useNavigate();
    const [darkMode, setDarkMode] = useState(true);

    function handleLogout() {
        localStorage.removeItem('adminAccessToken');
        localStorage.removeItem('adminRefreshToken');
        navigate('/zeruela/login');
    }

    return (
        <div style={{
            display: 'flex', height: '100vh', overflow: 'hidden',
            background: darkMode ? BG : '#f5f0e8',
        }}>
            {/* Sidebar */}
            <div style={{
                width: 210, flexShrink: 0,
                background: darkMode ? SIDEBAR_BG : '#faf8f2',
                borderRight: `1px solid ${darkMode ? ACCENT_BORDER : '#d4b87a55'}`,
                display: 'flex', flexDirection: 'column',
            }}>
                {/* Brand */}
                <div style={{
                    padding: '20px 20px 16px',
                    borderBottom: `1px solid ${darkMode ? ACCENT_BORDER : '#d4b87a55'}`,
                    flexShrink: 0,
                }}>
                    <div style={{
                        fontFamily: "'Fraunces', serif", fontSize: 17, color: ACCENT,
                        fontWeight: 400, marginBottom: 2,
                    }}>
                        Admin
                    </div>
                    <div style={{
                        fontFamily: "'Geist Mono', monospace", fontSize: 9,
                        color: darkMode ? '#55524a' : '#9a8060', letterSpacing: 1, textTransform: 'uppercase',
                    }}>
                        Painel de gestão
                    </div>
                </div>

                {/* Nav */}
                <nav style={{
                    flex: 1, overflowY: 'auto',
                    padding: '12px 8px',
                    display: 'flex', flexDirection: 'column', gap: 18,
                }}>
                    {ADMIN_CATEGORIES.map(cat => (
                        <div key={cat.label} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <div style={{
                                padding: '2px 12px 6px',
                                fontFamily: "'Geist Mono', monospace",
                                fontSize: 9, fontWeight: 700,
                                letterSpacing: 0.8, textTransform: 'uppercase',
                                color: darkMode ? '#3a3024' : '#b8925a',
                            }}>
                                {cat.label}
                            </div>
                            {cat.items.map(item => (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    end={item.to === '/zeruela/dashboard'}
                                    style={({ isActive }) => ({
                                        padding: '7px 12px', borderRadius: 8,
                                        fontSize: 13, fontWeight: 500,
                                        textDecoration: 'none',
                                        background: isActive ? (darkMode ? ACCENT_SOFT : '#c8a96e22') : 'transparent',
                                        color: isActive ? (darkMode ? ACCENT : '#7a5c15') : (darkMode ? '#8a8070' : '#6a5a45'),
                                        transition: 'background 0.1s, color 0.1s',
                                        borderLeft: isActive ? `2px solid ${ACCENT}` : '2px solid transparent',
                                    })}
                                >
                                    {item.label}
                                </NavLink>
                            ))}
                        </div>
                    ))}
                </nav>

                {/* Bottom actions */}
                <div style={{
                    padding: '12px 16px',
                    borderTop: `1px solid ${darkMode ? ACCENT_BORDER : '#d4b87a55'}`,
                    flexShrink: 0,
                    display: 'flex', flexDirection: 'column', gap: 6,
                }}>
                    <button
                        onClick={() => setDarkMode(d => !d)}
                        style={{
                            width: '100%', padding: '7px 12px', borderRadius: 8,
                            fontSize: 12, border: `1px solid ${darkMode ? ACCENT_BORDER : '#d4b87a55'}`,
                            background: darkMode ? '#13110c' : '#f5ede0',
                            color: darkMode ? '#8a8070' : '#9a7520',
                            cursor: 'pointer', fontFamily: 'inherit',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}
                    >
                        <span>{darkMode ? '☀ Claro' : '◑ Escuro'}</span>
                        <span style={{
                            fontFamily: "'Geist Mono', monospace",
                            fontSize: 9, letterSpacing: 0.5, textTransform: 'uppercase',
                            color: darkMode ? '#3a3024' : '#b8925a',
                        }}>
                            {darkMode ? 'DARK' : 'LIGHT'}
                        </span>
                    </button>

                    <button
                        onClick={handleLogout}
                        style={{
                            width: '100%', padding: '7px 12px', borderRadius: 8, fontSize: 12,
                            border: `1px solid ${darkMode ? ACCENT_BORDER : '#d4b87a55'}`,
                            background: 'transparent',
                            color: darkMode ? '#55524a' : '#9a8060',
                            cursor: 'pointer', fontFamily: 'inherit',
                        }}
                    >
                        Sair do Admin
                    </button>
                </div>
            </div>

            {/* Main content */}
            <div style={{
                flex: 1, overflow: 'auto',
                background: darkMode ? BG : '#f5f0e8',
                color: darkMode ? '#e8e3d8' : '#1a1510',
            }}>
                <Outlet context={{ darkMode }} />
            </div>
        </div>
    );
}
