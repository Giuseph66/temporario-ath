import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

// ─── Types ────────────────────────────────────────────────────────────────────

type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'OVERDUE' | 'SUSPENDED' | 'CANCELLED';

type TenantSummary = {
    id: string;
    name: string;
    slug: string;
    plan: string;
    isActive: boolean;
    createdAt: string;
    subscription: {
        status: SubscriptionStatus;
        planName: string;
        priceMonthly: number;
        trialEndsAt: string | null;
        currentPeriodEnd: string | null;
    } | null;
    tenantUsers: { email: string; role: string; lastLoginAt: string | null }[];
    _count: { users: number; agents: number };
};

type AdminMetrics = {
    tenants: { total: number; newThisMonth: number };
    subscriptions: { active: number; trial: number; suspended: number; cancelled: number };
    mrr: string;
    leads: { total: number };
    ai: { totalTokens: number; totalCostBrl: string };
    planBreakdown: { plan: string; count: number; revenue: string }[];
};

type TenantDetail = TenantSummary & {
    evolutionInstance: string | null;
    aiUsage30d: { tokens: number; costBrl: string; events: number };
    recentLeads: { id: string; name: string | null; phoneNumber: string; conversationState: string | null; lastInteraction: string; enrollmentStatus: string }[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function adminAxios() {
    const token = localStorage.getItem('adminAccessToken');
    return axios.create({ headers: { Authorization: `Bearer ${token}` } });
}

const STATUS_COLORS: Record<SubscriptionStatus, { bg: string; text: string; label: string }> = {
    TRIAL:     { bg: '#1a1a2e', text: '#7b8fe8', label: 'Trial' },
    ACTIVE:    { bg: '#0f1f14', text: '#5fb878', label: 'Ativo' },
    OVERDUE:   { bg: '#1f1500', text: '#d4a43a', label: 'Atrasado' },
    SUSPENDED: { bg: '#1f0a0a', text: '#c85a5a', label: 'Suspenso' },
    CANCELLED: { bg: '#141414', text: '#555', label: 'Cancelado' },
};

function StatusBadge({ status }: { status: SubscriptionStatus | null }) {
    if (!status) return <span style={{ fontSize: 11, color: '#444' }}>—</span>;
    const c = STATUS_COLORS[status];
    return (
        <span style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 10,
            background: c.bg, color: c.text, fontFamily: "'Geist Mono', monospace",
            letterSpacing: 0.5, textTransform: 'uppercase',
        }}>{c.label}</span>
    );
}

function MetricCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
    return (
        <div style={{
            background: '#131210', border: '1px solid #1e1c18', borderRadius: 12,
            padding: '16px 20px', flex: 1, minWidth: 140,
        }}>
            <div style={{ fontSize: 11, color: '#55524a', fontFamily: "'Geist Mono', monospace", letterSpacing: 0.8, marginBottom: 6 }}>
                {label}
            </div>
            <div style={{ fontSize: 26, color: accent ?? '#f1ecdc', fontWeight: 600, fontFamily: "'Fraunces', serif", lineHeight: 1 }}>
                {value}
            </div>
            {sub && <div style={{ fontSize: 11, color: '#55524a', marginTop: 4 }}>{sub}</div>}
        </div>
    );
}

// ─── Tenant Row ───────────────────────────────────────────────────────────────

function TenantRow({ tenant, onSelect }: { tenant: TenantSummary; onSelect: () => void }) {
    const status = tenant.subscription?.status ?? null;
    const owner = tenant.tenantUsers[0];

    return (
        <tr
            onClick={onSelect}
            style={{ cursor: 'pointer', borderBottom: '1px solid #1a1814' }}
        >
            <td style={{ padding: '12px 16px' }}>
                <div style={{ color: '#e8e3d8', fontSize: 13, fontWeight: 500 }}>{tenant.name}</div>
                <div style={{ color: '#55524a', fontSize: 11, fontFamily: "'Geist Mono', monospace" }}>{tenant.slug}</div>
            </td>
            <td style={{ padding: '12px 16px', color: '#8a8579', fontSize: 12 }}>
                {owner?.email ?? '—'}
            </td>
            <td style={{ padding: '12px 16px' }}>
                <StatusBadge status={status} />
            </td>
            <td style={{ padding: '12px 16px', color: '#8a8579', fontSize: 12, fontFamily: "'Geist Mono', monospace" }}>
                {tenant.subscription?.priceMonthly
                    ? `R$ ${tenant.subscription.priceMonthly.toFixed(2)}`
                    : '—'}
            </td>
            <td style={{ padding: '12px 16px', color: '#55524a', fontSize: 11 }}>
                {new Date(tenant.createdAt).toLocaleDateString('pt-BR')}
            </td>
            <td style={{ padding: '12px 16px', color: '#55524a', fontSize: 11 }}>
                {tenant._count.users}
            </td>
        </tr>
    );
}

// ─── Tenant Detail Drawer ─────────────────────────────────────────────────────

function TenantDetailPanel({
    tenantId,
    onClose,
}: {
    tenantId: string;
    onClose: () => void;
}) {
    const [detail, setDetail] = useState<TenantDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [impersonating, setImpersonating] = useState(false);
    const [editStatus, setEditStatus] = useState('');
    const [savingStatus, setSavingStatus] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        adminAxios().get(`/api/zeruela/tenants/${tenantId}`)
            .then(r => setDetail(r.data))
            .finally(() => setLoading(false));
    }, [tenantId]);

    async function handleImpersonate() {
        setImpersonating(true);
        try {
            const res = await adminAxios().post(`/api/zeruela/tenants/${tenantId}/impersonate`);
            localStorage.setItem('accessToken', res.data.accessToken);
            localStorage.setItem('refreshToken', '');
            navigate('/dashboard');
        } catch {
            alert('Falha ao impersonar tenant.');
        } finally {
            setImpersonating(false);
        }
    }

    async function handleStatusChange() {
        if (!editStatus) return;
        setSavingStatus(true);
        try {
            await adminAxios().patch(`/api/zeruela/tenants/${tenantId}/subscription`, { status: editStatus });
            const updated = await adminAxios().get(`/api/zeruela/tenants/${tenantId}`);
            setDetail(updated.data);
            setEditStatus('');
        } catch {
            alert('Falha ao atualizar status.');
        } finally {
            setSavingStatus(false);
        }
    }

    async function handleToggleActive() {
        if (!detail) return;
        try {
            await adminAxios().patch(`/api/zeruela/tenants/${tenantId}/active`, { isActive: !detail.isActive });
            setDetail(d => d ? { ...d, isActive: !d.isActive } : d);
        } catch {
            alert('Falha ao alterar status.');
        }
    }

    const sub = detail?.subscription;

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 1000, display: 'flex',
        }}>
            <div style={{ flex: 1, background: 'rgba(0,0,0,.6)' }} onClick={onClose} />
            <div style={{
                width: 480, background: '#131210', borderLeft: '1px solid #1e1c18',
                overflowY: 'auto', padding: 24,
            }}>
                {loading ? (
                    <div style={{ color: '#55524a', fontSize: 13, marginTop: 40, textAlign: 'center' }}>Carregando...</div>
                ) : !detail ? (
                    <div style={{ color: '#c85a5a', fontSize: 13 }}>Erro ao carregar.</div>
                ) : (
                    <>
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                            <div>
                                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, color: '#f1ecdc', fontWeight: 400 }}>
                                    {detail.name}
                                </div>
                                <div style={{ fontSize: 11, color: '#55524a', fontFamily: "'Geist Mono', monospace" }}>{detail.slug}</div>
                            </div>
                            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#55524a', fontSize: 18, cursor: 'pointer' }}>✕</button>
                        </div>

                        {/* Status bar */}
                        <div style={{
                            display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20,
                            background: '#0f0e0c', borderRadius: 8, padding: '10px 14px',
                        }}>
                            <StatusBadge status={sub?.status ?? null} />
                            <span style={{ fontSize: 12, color: '#55524a' }}>
                                {sub?.planName} · R$ {sub?.priceMonthly?.toFixed(2) ?? '0,00'}/mês
                            </span>
                            <div style={{ flex: 1 }} />
                            <div style={{
                                width: 8, height: 8, borderRadius: '50%',
                                background: detail.isActive ? '#5fb878' : '#c85a5a',
                            }} />
                            <span style={{ fontSize: 11, color: '#55524a' }}>
                                {detail.isActive ? 'Tenant ativo' : 'Suspenso'}
                            </span>
                        </div>

                        {/* Quick actions */}
                        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                            <button
                                onClick={handleImpersonate} disabled={impersonating}
                                style={{
                                    flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #2a2823',
                                    background: '#1a1917', color: '#c8a96e', fontSize: 12, cursor: 'pointer',
                                }}
                            >
                                {impersonating ? 'Entrando...' : '🔑 Impersonar'}
                            </button>
                            <button
                                onClick={handleToggleActive}
                                style={{
                                    flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #2a2823',
                                    background: '#1a1917', color: detail.isActive ? '#c85a5a' : '#5fb878',
                                    fontSize: 12, cursor: 'pointer',
                                }}
                            >
                                {detail.isActive ? '🚫 Suspender' : '✅ Reativar'}
                            </button>
                        </div>

                        {/* Change subscription status */}
                        <div style={{ marginBottom: 24 }}>
                            <div style={{ fontSize: 11, color: '#55524a', fontFamily: "'Geist Mono', monospace", letterSpacing: 0.8, marginBottom: 8 }}>
                                ALTERAR STATUS DA ASSINATURA
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <select
                                    value={editStatus}
                                    onChange={e => setEditStatus(e.target.value)}
                                    style={{
                                        flex: 1, padding: '8px 10px', borderRadius: 8,
                                        border: '1px solid #2a2823', background: '#0f0e0c',
                                        color: '#e8e3d8', fontSize: 12, outline: 'none',
                                    }}
                                >
                                    <option value="">Selecionar...</option>
                                    <option value="TRIAL">Trial</option>
                                    <option value="ACTIVE">Ativo</option>
                                    <option value="OVERDUE">Atrasado</option>
                                    <option value="SUSPENDED">Suspenso</option>
                                    <option value="CANCELLED">Cancelado</option>
                                </select>
                                <button
                                    onClick={handleStatusChange} disabled={!editStatus || savingStatus}
                                    style={{
                                        padding: '8px 16px', borderRadius: 8,
                                        border: 'none', background: editStatus ? '#c8a96e' : '#2a2823',
                                        color: editStatus ? '#1a1510' : '#444', fontSize: 12,
                                        cursor: editStatus ? 'pointer' : 'not-allowed',
                                    }}
                                >
                                    Salvar
                                </button>
                            </div>
                        </div>

                        {/* Subscription details */}
                        <Section title="ASSINATURA">
                            <InfoRow label="Plano" value={sub?.planName ?? '—'} />
                            <InfoRow label="Valor/mês" value={sub ? `R$ ${sub.priceMonthly.toFixed(2)}` : '—'} />
                            <InfoRow label="Trial até" value={sub?.trialEndsAt ? new Date(sub.trialEndsAt).toLocaleDateString('pt-BR') : '—'} />
                            <InfoRow label="Período atual" value={sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString('pt-BR') : '—'} />
                        </Section>

                        {/* AI usage */}
                        <Section title="USO DE IA (30 DIAS)">
                            <InfoRow label="Tokens" value={detail.aiUsage30d.tokens.toLocaleString('pt-BR')} />
                            <InfoRow label="Custo estimado" value={`R$ ${detail.aiUsage30d.costBrl}`} />
                            <InfoRow label="Eventos" value={detail.aiUsage30d.events.toString()} />
                        </Section>

                        {/* Users */}
                        <Section title="USUÁRIOS DO TENANT">
                            {detail.tenantUsers.map(u => (
                                <div key={u.id ?? u.email} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <span style={{ fontSize: 12, color: '#c8c3b8' }}>{u.email}</span>
                                    <span style={{ fontSize: 11, color: '#55524a', fontFamily: "'Geist Mono', monospace" }}>{u.role}</span>
                                </div>
                            ))}
                        </Section>

                        {/* Recent leads */}
                        <Section title="LEADS RECENTES">
                            {detail.recentLeads.map(l => (
                                <div key={l.id} style={{
                                    display: 'flex', justifyContent: 'space-between',
                                    padding: '6px 0', borderBottom: '1px solid #1a1814',
                                }}>
                                    <div>
                                        <div style={{ fontSize: 12, color: '#c8c3b8' }}>{l.name ?? 'Sem nome'}</div>
                                        <div style={{ fontSize: 10, color: '#55524a', fontFamily: "'Geist Mono', monospace" }}>{l.phoneNumber}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: 10, color: '#55524a' }}>{l.conversationState}</div>
                                        <div style={{ fontSize: 10, color: '#3a3830' }}>
                                            {new Date(l.lastInteraction).toLocaleDateString('pt-BR')}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </Section>

                        <div style={{ height: 40 }} />
                    </>
                )}
            </div>
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, color: '#55524a', fontFamily: "'Geist Mono', monospace", letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
                {title}
            </div>
            <div style={{ background: '#0f0e0c', borderRadius: 8, padding: '10px 14px' }}>
                {children}
            </div>
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: '#55524a' }}>{label}</span>
            <span style={{ fontSize: 12, color: '#c8c3b8', fontFamily: "'Geist Mono', monospace" }}>{value}</span>
        </div>
    );
}

// ─── Main AdminDashboard ──────────────────────────────────────────────────────

export function AdminDashboard() {
    const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
    const [tenants, setTenants] = useState<TenantSummary[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<SubscriptionStatus | ''>('');
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const load = useCallback(async () => {
        try {
            const [m, t] = await Promise.all([
                adminAxios().get('/api/zeruela/metrics').then(r => r.data),
                adminAxios().get('/api/zeruela/tenants').then(r => r.data),
            ]);
            setMetrics(m);
            setTenants(t);
        } catch {
            // Token inválido — volta para login
            navigate('/zeruela/login');
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    useEffect(() => { load(); }, [load]);

    function handleLogout() {
        localStorage.removeItem('adminAccessToken');
        localStorage.removeItem('adminRefreshToken');
        navigate('/zeruela/login');
    }

    const filtered = tenants.filter(t => {
        const q = search.toLowerCase();
        const matchSearch = !q || t.name.toLowerCase().includes(q) || t.slug.includes(q) || (t.tenantUsers[0]?.email ?? '').toLowerCase().includes(q);
        const matchStatus = !filterStatus || t.subscription?.status === filterStatus;
        return matchSearch && matchStatus;
    });

    return (
        <div style={{ minHeight: '100vh', background: '#0a0a09', color: '#f1ecdc' }}>
            {/* Topbar */}
            <div style={{
                height: 52, background: '#0f0e0c', borderBottom: '1px solid #1a1814',
                display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16,
            }}>
                <div style={{
                    width: 26, height: 26, borderRadius: 6,
                    background: 'linear-gradient(135deg, #c8a96e, #8b6b3d)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, color: '#fff',
                }}>A</div>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 16, color: '#c8c3b8' }}>Admin</div>
                <div style={{ flex: 1 }} />
                <button
                    onClick={handleLogout}
                    style={{
                        background: 'none', border: '1px solid #2a2823', borderRadius: 6,
                        color: '#55524a', fontSize: 12, padding: '4px 12px', cursor: 'pointer',
                    }}
                >Sair</button>
            </div>

            <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
                {loading ? (
                    <div style={{ color: '#55524a', textAlign: 'center', marginTop: 80 }}>Carregando...</div>
                ) : (
                    <>
                        {/* Metrics */}
                        {metrics && (
                            <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
                                <MetricCard label="TENANTS TOTAL" value={metrics.tenants.total} sub={`+${metrics.tenants.newThisMonth} este mês`} />
                                <MetricCard label="MRR" value={`R$ ${metrics.mrr}`} sub={`${metrics.subscriptions.active} ativos`} accent="#c8a96e" />
                                <MetricCard label="TRIAL" value={metrics.subscriptions.trial} />
                                <MetricCard label="SUSPENSOS" value={metrics.subscriptions.suspended} accent={metrics.subscriptions.suspended > 0 ? '#c85a5a' : undefined} />
                                <MetricCard label="LEADS TOTAIS" value={metrics.leads.total.toLocaleString('pt-BR')} />
                                <MetricCard label="CUSTO IA (TOTAL)" value={`R$ ${metrics.ai.totalCostBrl}`} sub={`${(metrics.ai.totalTokens / 1_000_000).toFixed(1)}M tokens`} />
                            </div>
                        )}

                        {/* Table header */}
                        <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
                            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, color: '#c8c3b8', flex: 1 }}>
                                Tenants
                            </div>
                            <input
                                placeholder="Buscar nome, slug ou email..."
                                value={search} onChange={e => setSearch(e.target.value)}
                                style={{
                                    padding: '7px 12px', borderRadius: 8, border: '1px solid #1e1c18',
                                    background: '#0f0e0c', color: '#e8e3d8', fontSize: 12, outline: 'none', width: 220,
                                }}
                            />
                            <select
                                value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
                                style={{
                                    padding: '7px 10px', borderRadius: 8, border: '1px solid #1e1c18',
                                    background: '#0f0e0c', color: '#e8e3d8', fontSize: 12, outline: 'none',
                                }}
                            >
                                <option value="">Todos os status</option>
                                <option value="TRIAL">Trial</option>
                                <option value="ACTIVE">Ativos</option>
                                <option value="OVERDUE">Atrasados</option>
                                <option value="SUSPENDED">Suspensos</option>
                                <option value="CANCELLED">Cancelados</option>
                            </select>
                            <button
                                onClick={load}
                                style={{
                                    padding: '7px 12px', borderRadius: 8, border: '1px solid #1e1c18',
                                    background: '#0f0e0c', color: '#55524a', fontSize: 12, cursor: 'pointer',
                                }}
                            >↻</button>
                        </div>

                        {/* Table */}
                        <div style={{ background: '#0f0e0c', border: '1px solid #1a1814', borderRadius: 12, overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid #1a1814' }}>
                                        {['Tenant', 'Owner', 'Status', 'Valor/mês', 'Criado em', 'Leads'].map(h => (
                                            <th key={h} style={{
                                                padding: '10px 16px', textAlign: 'left',
                                                fontSize: 10, color: '#55524a', fontFamily: "'Geist Mono', monospace",
                                                letterSpacing: 0.8, textTransform: 'uppercase', fontWeight: 500,
                                            }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(t => (
                                        <TenantRow key={t.id} tenant={t} onSelect={() => setSelectedId(t.id)} />
                                    ))}
                                    {filtered.length === 0 && (
                                        <tr>
                                            <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#3a3830', fontSize: 13 }}>
                                                Nenhum tenant encontrado.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>

            {selectedId && (
                <TenantDetailPanel
                    tenantId={selectedId}
                    onClose={() => setSelectedId(null)}
                />
            )}
        </div>
    );
}
