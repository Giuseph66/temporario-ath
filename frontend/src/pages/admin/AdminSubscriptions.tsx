import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAdminTheme } from '../../hooks/useAdminTheme';

type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'OVERDUE' | 'SUSPENDED' | 'CANCELLED';
type TenantSummary = {
    id: string; name: string; slug: string;
    subscription: { status: SubscriptionStatus; planName: string; priceMonthly: number; trialEndsAt: string | null; currentPeriodEnd: string | null } | null;
    tenantUsers: { email: string }[];
};

function adminAxios() {
    const token = localStorage.getItem('adminAccessToken');
    return axios.create({ headers: { Authorization: `Bearer ${token}` } });
}

const STATUS_COLORS: Record<SubscriptionStatus, { text: string; label: string }> = {
    TRIAL:     { text: '#7b8fe8', label: 'Trial' },
    ACTIVE:    { text: '#5fb878', label: 'Ativo' },
    OVERDUE:   { text: '#d4a43a', label: 'Atrasado' },
    SUSPENDED: { text: '#c85a5a', label: 'Suspenso' },
    CANCELLED: { text: '#888',   label: 'Cancelado' },
};

export function AdminSubscriptions() {
    const t = useAdminTheme();
    const [tenants, setTenants] = useState<TenantSummary[]>([]);
    const [loading, setLoading] = useState(true);
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

    const filtered = tenants.filter(t2 => !filterStatus || t2.subscription?.status === filterStatus);
    const mrr = tenants.filter(t2 => t2.subscription?.status === 'ACTIVE').reduce((acc, t2) => acc + (t2.subscription?.priceMonthly ?? 0), 0);
    const overdue = tenants.filter(t2 => t2.subscription?.status === 'OVERDUE');

    const inputStyle: React.CSSProperties = { padding: '8px 10px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 12, outline: 'none' };

    return (
        <div style={{ padding: 28, background: t.bg, minHeight: '100vh', color: t.text }}>
            <div style={{ marginBottom: 24 }}>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, color: t.accent, marginBottom: 4 }}>Assinaturas</div>
                <div style={{ fontSize: 12, color: t.textSub, fontFamily: "'Geist Mono', monospace" }}>Controle financeiro dos tenants</div>
            </div>

            {/* Summary cards */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
                {[
                    { label: 'MRR', value: `R$ ${mrr.toFixed(2)}`, accent: t.accent },
                    { label: 'Ativos', value: tenants.filter(t2 => t2.subscription?.status === 'ACTIVE').length, accent: t.success },
                    { label: 'Trial', value: tenants.filter(t2 => t2.subscription?.status === 'TRIAL').length, accent: '#7b8fe8' },
                    { label: 'Atrasados', value: overdue.length, accent: overdue.length > 0 ? t.danger : undefined },
                    { label: 'Suspensos', value: tenants.filter(t2 => t2.subscription?.status === 'SUSPENDED').length },
                ].map(c => (
                    <div key={c.label} style={{ flex: 1, minWidth: 120, background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: '14px 18px' }}>
                        <div style={{ fontSize: 10, color: t.textSub, fontFamily: "'Geist Mono', monospace", letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>{c.label}</div>
                        <div style={{ fontSize: 24, color: c.accent ?? t.text, fontFamily: "'Fraunces', serif", lineHeight: 1 }}>{c.value}</div>
                    </div>
                ))}
            </div>

            {/* Overdue alert */}
            {overdue.length > 0 && (
                <div style={{ background: `${t.danger}18`, border: `1px solid ${t.danger}33`, borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
                    <div style={{ fontSize: 12, color: t.danger, fontWeight: 500, marginBottom: 6 }}>⚠ {overdue.length} tenant(s) com pagamento em atraso</div>
                    {overdue.map(t2 => (
                        <div key={t2.id} style={{ fontSize: 12, color: t.danger, opacity: 0.7, fontFamily: "'Geist Mono', monospace" }}>{t2.slug} — {t2.tenantUsers[0]?.email}</div>
                    ))}
                </div>
            )}

            {/* Filter */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
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

            {/* Table */}
            <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ padding: 32, textAlign: 'center', color: t.textSub, fontSize: 13 }}>Carregando...</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                                {['Tenant', 'Email', 'Plano', 'Status', 'Valor/mês', 'Renova em'].map(h => (
                                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, color: t.textSub, fontFamily: "'Geist Mono', monospace", letterSpacing: 0.8, textTransform: 'uppercase', fontWeight: 500 }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(row => {
                                const sub = row.subscription;
                                const sc = sub ? STATUS_COLORS[sub.status] : null;
                                const renewDate = sub?.trialEndsAt ?? sub?.currentPeriodEnd;
                                return (
                                    <tr key={row.id} style={{ borderBottom: `1px solid ${t.borderSub}` }}>
                                        <td style={{ padding: '11px 16px' }}>
                                            <div style={{ fontSize: 13, color: t.textMuted, fontWeight: 500 }}>{row.name}</div>
                                            <div style={{ fontSize: 10, color: t.textSub, fontFamily: "'Geist Mono', monospace" }}>{row.slug}</div>
                                        </td>
                                        <td style={{ padding: '11px 16px', fontSize: 12, color: t.textSub }}>{row.tenantUsers[0]?.email ?? '—'}</td>
                                        <td style={{ padding: '11px 16px', fontSize: 12, color: t.textSub, textTransform: 'capitalize' }}>{sub?.planName ?? '—'}</td>
                                        <td style={{ padding: '11px 16px' }}>
                                            {sc ? <span style={{ fontSize: 11, color: sc.text }}>{sc.label}</span> : '—'}
                                        </td>
                                        <td style={{ padding: '11px 16px', fontSize: 12, color: t.accent, fontFamily: "'Geist Mono', monospace" }}>
                                            {sub?.priceMonthly ? `R$ ${sub.priceMonthly.toFixed(2)}` : '—'}
                                        </td>
                                        <td style={{ padding: '11px 16px', fontSize: 11, color: t.textSub }}>
                                            {renewDate ? new Date(renewDate).toLocaleDateString('pt-BR') : '—'}
                                        </td>
                                    </tr>
                                );
                            })}
                            {filtered.length === 0 && (
                                <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: t.textSub, fontSize: 13 }}>Nenhum resultado.</td></tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
