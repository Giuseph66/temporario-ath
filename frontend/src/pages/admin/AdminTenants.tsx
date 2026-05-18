import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAdminTheme } from '../../hooks/useAdminTheme';
import type { AdminTheme } from '../../hooks/useAdminTheme';

type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'OVERDUE' | 'SUSPENDED' | 'CANCELLED';

type TenantSummary = {
    id: string; name: string; slug: string; plan: string; isActive: boolean; createdAt: string;
    subscription: { status: SubscriptionStatus; planName: string; priceMonthly: number; trialEndsAt: string | null; currentPeriodEnd: string | null; asaasCustomerId: string | null } | null;
    tenantUsers: { email: string; role: string; lastLoginAt: string | null }[];
    _count: { users: number; agents: number };
};

type TenantDetail = TenantSummary & {
    evolutionInstance: string | null;
    tenantUsers: { id: string; email: string; role: string; lastLoginAt: string | null; createdAt: string }[];
    aiUsage30d: { tokens: number; costBrl: string; events: number };
    recentLeads: { id: string; name: string | null; phoneNumber: string; conversationState: string | null; lastInteraction: string; enrollmentStatus: string }[];
};

function adminAxios() {
    const token = localStorage.getItem('adminAccessToken');
    return axios.create({ headers: { Authorization: `Bearer ${token}` } });
}

const STATUS_COLORS: Record<SubscriptionStatus, { text: string; bg: string; label: string }> = {
    TRIAL:     { text: '#7b8fe8', bg: '#1a1a2e', label: 'Trial' },
    ACTIVE:    { text: '#5fb878', bg: '#0f1f14', label: 'Ativo' },
    OVERDUE:   { text: '#d4a43a', bg: '#1f1500', label: 'Atrasado' },
    SUSPENDED: { text: '#c85a5a', bg: '#1f0a0a', label: 'Suspenso' },
    CANCELLED: { text: '#888',    bg: '#1a1a1a', label: 'Cancelado' },
};

function StatusBadge({ status }: { status: SubscriptionStatus | null }) {
    if (!status) return <span style={{ fontSize: 11, color: '#888' }}>—</span>;
    const c = STATUS_COLORS[status];
    return (
        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: c.bg, color: c.text, fontFamily: "'Geist Mono', monospace", letterSpacing: 0.5, textTransform: 'uppercase' }}>
            {c.label}
        </span>
    );
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

function Section({ title, children, t }: { title: string; children: React.ReactNode; t: AdminTheme }) {
    return (
        <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, color: t.textSub, fontFamily: "'Geist Mono', monospace", letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>{title}</div>
            <div style={{ background: t.cardInner, borderRadius: 8, padding: '10px 14px' }}>{children}</div>
        </div>
    );
}

function Row({ label, value, t }: { label: string; value: string; t: AdminTheme }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: t.textSub }}>{label}</span>
            <span style={{ fontSize: 12, color: t.textMuted, fontFamily: "'Geist Mono', monospace" }}>{value}</span>
        </div>
    );
}

function TenantDrawer({ tenantId, onClose, onRefresh, t }: { tenantId: string; onClose: () => void; onRefresh: () => void; t: AdminTheme }) {
    const [detail, setDetail] = useState<TenantDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [editStatus, setEditStatus] = useState('');
    const [savingStatus, setSavingStatus] = useState(false);
    const [impersonating, setImpersonating] = useState(false);

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
            window.location.href = '/dashboard';
        } catch { alert('Falha ao impersonar.'); }
        finally { setImpersonating(false); }
    }

    async function handleStatusChange() {
        if (!editStatus) return;
        setSavingStatus(true);
        try {
            await adminAxios().patch(`/api/zeruela/tenants/${tenantId}/subscription`, { status: editStatus });
            const r = await adminAxios().get(`/api/zeruela/tenants/${tenantId}`);
            setDetail(r.data);
            setEditStatus('');
            onRefresh();
        } catch { alert('Falha ao atualizar.'); }
        finally { setSavingStatus(false); }
    }

    async function handleToggleActive() {
        if (!detail) return;
        await adminAxios().patch(`/api/zeruela/tenants/${tenantId}/active`, { isActive: !detail.isActive });
        setDetail(d => d ? { ...d, isActive: !d.isActive } : d);
        onRefresh();
    }

    const sub = detail?.subscription;

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex' }}>
            <div style={{ flex: 1, background: 'rgba(0,0,0,.5)' }} onClick={onClose} />
            <div style={{ width: 500, background: t.card, borderLeft: `1px solid ${t.border}`, overflowY: 'auto', padding: 24 }}>
                {loading ? (
                    <div style={{ color: t.textSub, margin: 'auto', fontSize: 13 }}>Carregando...</div>
                ) : !detail ? (
                    <div style={{ color: t.danger }}>Erro ao carregar tenant.</div>
                ) : <>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                        <div>
                            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, color: t.accent }}>{detail.name}</div>
                            <div style={{ fontSize: 11, color: t.textSub, fontFamily: "'Geist Mono', monospace" }}>{detail.slug}</div>
                        </div>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.textSub, fontSize: 20, cursor: 'pointer' }}>✕</button>
                    </div>

                    {/* Status bar */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: t.cardInner, borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
                        <StatusBadge status={sub?.status ?? null} />
                        <span style={{ fontSize: 12, color: t.textSub }}>{sub?.planName} · R$ {sub?.priceMonthly?.toFixed(2) ?? '0,00'}/mês</span>
                        <div style={{ flex: 1 }} />
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: detail.isActive ? t.success : t.danger }} />
                        <span style={{ fontSize: 11, color: t.textSub }}>{detail.isActive ? 'Ativo' : 'Suspenso'}</span>
                    </div>

                    {/* Quick actions */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                        <button onClick={handleImpersonate} disabled={impersonating} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.cardInner, color: t.accent, fontSize: 12, cursor: 'pointer' }}>
                            {impersonating ? 'Entrando...' : '🔑 Entrar como tenant'}
                        </button>
                        <button onClick={handleToggleActive} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.cardInner, color: detail.isActive ? t.danger : t.success, fontSize: 12, cursor: 'pointer' }}>
                            {detail.isActive ? '🚫 Suspender' : '✅ Reativar'}
                        </button>
                    </div>

                    {/* Change status */}
                    <Section title="Alterar status da assinatura" t={t}>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <select value={editStatus} onChange={e => setEditStatus(e.target.value)} style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 12, outline: 'none' }}>
                                <option value="">Selecionar novo status...</option>
                                <option value="TRIAL">Trial</option>
                                <option value="ACTIVE">Ativo</option>
                                <option value="OVERDUE">Atrasado</option>
                                <option value="SUSPENDED">Suspenso</option>
                                <option value="CANCELLED">Cancelado</option>
                            </select>
                            <button onClick={handleStatusChange} disabled={!editStatus || savingStatus} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: editStatus ? t.accent : t.border, color: editStatus ? '#1a1510' : t.textSub, fontSize: 12, cursor: editStatus ? 'pointer' : 'not-allowed' }}>
                                Salvar
                            </button>
                        </div>
                    </Section>

                    <Section title="Assinatura" t={t}>
                        <Row label="Plano" value={sub?.planName ?? '—'} t={t} />
                        <Row label="Valor" value={sub ? `R$ ${sub.priceMonthly.toFixed(2)}/mês` : '—'} t={t} />
                        <Row label="Trial até" value={sub?.trialEndsAt ? new Date(sub.trialEndsAt).toLocaleDateString('pt-BR') : '—'} t={t} />
                        <Row label="Período atual" value={sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString('pt-BR') : '—'} t={t} />
                        <Row label="Asaas Customer" value={sub?.asaasCustomerId ?? '—'} t={t} />
                        <Row label="Evolution" value={detail.evolutionInstance ?? '—'} t={t} />
                    </Section>

                    <Section title="Uso de IA (30 dias)" t={t}>
                        <Row label="Tokens" value={detail.aiUsage30d.tokens.toLocaleString('pt-BR')} t={t} />
                        <Row label="Custo estimado" value={`R$ ${detail.aiUsage30d.costBrl}`} t={t} />
                        <Row label="Eventos" value={detail.aiUsage30d.events.toString()} t={t} />
                    </Section>

                    <Section title="Usuários" t={t}>
                        {detail.tenantUsers.map(u => (
                            <div key={u.email} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                <span style={{ fontSize: 12, color: t.textMuted }}>{u.email}</span>
                                <span style={{ fontSize: 11, color: t.textSub, fontFamily: "'Geist Mono', monospace" }}>{u.role}</span>
                            </div>
                        ))}
                    </Section>

                    <Section title="Leads recentes" t={t}>
                        {detail.recentLeads.map(l => (
                            <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${t.borderSub}` }}>
                                <div>
                                    <div style={{ fontSize: 12, color: t.textMuted }}>{l.name ?? 'Sem nome'}</div>
                                    <div style={{ fontSize: 10, color: t.textSub, fontFamily: "'Geist Mono', monospace" }}>{l.phoneNumber}</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: 10, color: t.textSub }}>{l.conversationState}</div>
                                    <div style={{ fontSize: 10, color: t.textSub }}>{new Date(l.lastInteraction).toLocaleDateString('pt-BR')}</div>
                                </div>
                            </div>
                        ))}
                    </Section>
                    <div style={{ height: 40 }} />
                </>}
            </div>
        </div>
    );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function AdminTenants() {
    const t = useAdminTheme();
    const [tenants, setTenants] = useState<TenantSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<SubscriptionStatus | ''>('');
    const navigate = useNavigate();

    const load = useCallback(async () => {
        try {
            const data = await adminAxios().get('/api/zeruela/tenants').then(r => r.data);
            setTenants(data);
        } catch { navigate('/zeruela/login'); }
        finally { setLoading(false); }
    }, [navigate]);

    useEffect(() => { load(); }, [load]);

    const filtered = tenants.filter(t2 => {
        const q = search.toLowerCase();
        const matchSearch = !q || t2.name.toLowerCase().includes(q) || t2.slug.includes(q) || (t2.tenantUsers[0]?.email ?? '').toLowerCase().includes(q);
        const matchStatus = !filterStatus || t2.subscription?.status === filterStatus;
        return matchSearch && matchStatus;
    });

    const inputStyle: React.CSSProperties = { padding: '8px 12px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 12, outline: 'none' };

    return (
        <div style={{ padding: 28, background: t.bg, minHeight: '100vh', color: t.text }}>
            <div style={{ marginBottom: 24 }}>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, color: t.accent, marginBottom: 4 }}>Tenants</div>
                <div style={{ fontSize: 12, color: t.textSub, fontFamily: "'Geist Mono', monospace" }}>{tenants.length} tenants cadastrados</div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
                <input placeholder="Buscar nome, slug ou email..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} style={inputStyle}>
                    <option value="">Todos os status</option>
                    <option value="TRIAL">Trial</option>
                    <option value="ACTIVE">Ativos</option>
                    <option value="OVERDUE">Atrasados</option>
                    <option value="SUSPENDED">Suspensos</option>
                    <option value="CANCELLED">Cancelados</option>
                </select>
                <button onClick={load} style={{ ...inputStyle, cursor: 'pointer', fontSize: 14 }}>↻</button>
            </div>

            <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ padding: 32, textAlign: 'center', color: t.textSub, fontSize: 13 }}>Carregando...</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                                {['Tenant', 'Owner', 'Status', 'Valor/mês', 'Criado em', 'Leads'].map(h => (
                                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, color: t.textSub, fontFamily: "'Geist Mono', monospace", letterSpacing: 0.8, textTransform: 'uppercase', fontWeight: 500 }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(row => (
                                <tr key={row.id} onClick={() => setSelectedId(row.id)} style={{ cursor: 'pointer', borderBottom: `1px solid ${t.borderSub}` }}>
                                    <td style={{ padding: '12px 16px' }}>
                                        <div style={{ color: t.textMuted, fontSize: 13, fontWeight: 500 }}>{row.name}</div>
                                        <div style={{ color: t.textSub, fontSize: 11, fontFamily: "'Geist Mono', monospace" }}>{row.slug}</div>
                                    </td>
                                    <td style={{ padding: '12px 16px', color: t.textSub, fontSize: 12 }}>{row.tenantUsers[0]?.email ?? '—'}</td>
                                    <td style={{ padding: '12px 16px' }}><StatusBadge status={row.subscription?.status ?? null} /></td>
                                    <td style={{ padding: '12px 16px', color: t.accent, fontSize: 12, fontFamily: "'Geist Mono', monospace" }}>
                                        {row.subscription?.priceMonthly ? `R$ ${row.subscription.priceMonthly.toFixed(2)}` : '—'}
                                    </td>
                                    <td style={{ padding: '12px 16px', color: t.textSub, fontSize: 11 }}>{new Date(row.createdAt).toLocaleDateString('pt-BR')}</td>
                                    <td style={{ padding: '12px 16px', color: t.textSub, fontSize: 11 }}>{row._count.users}</td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: t.textSub, fontSize: 13 }}>Nenhum tenant encontrado.</td></tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {selectedId && <TenantDrawer tenantId={selectedId} onClose={() => setSelectedId(null)} onRefresh={load} t={t} />}
        </div>
    );
}
