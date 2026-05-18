import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAdminTheme } from '../../hooks/useAdminTheme';

type BillingRun = {
    id: string; tenantId: string; month: string; value: number; dueDate: string;
    asaasChargeId: string | null; invoiceUrl: string | null; bankSlipUrl: string | null;
    status: string; whatsappSent: boolean; emailSent: boolean; error: string | null; createdAt: string;
    tenant: { name: string; slug: string };
};

function adminAxios() {
    const token = localStorage.getItem('adminAccessToken');
    return axios.create({ headers: { Authorization: `Bearer ${token}` } });
}

const STATUS_COLORS: Record<string, { text: string; label: string }> = {
    PENDING:   { text: '#d4a43a', label: 'Pendente' },
    PAID:      { text: '#5fb878', label: 'Pago' },
    FAILED:    { text: '#c85a5a', label: 'Falhou' },
    CANCELLED: { text: '#888', label: 'Cancelado' },
};

export function AdminBilling() {
    const t = useAdminTheme();
    const navigate = useNavigate();
    const [runs, setRuns] = useState<BillingRun[]>([]);
    const [loading, setLoading] = useState(true);
    const [triggering, setTriggering] = useState(false);
    const [triggerResult, setTriggerResult] = useState<{ processed: number; failed: number; skipped: number } | null>(null);
    const [filterStatus, setFilterStatus] = useState('');
    const [search, setSearch] = useState('');
    const [forceMonth, setForceMonth] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });

    const load = useCallback(async () => {
        try {
            const data = await adminAxios().get('/api/zeruela/billing/runs').then(r => r.data);
            setRuns(data);
        } catch { navigate('/zeruela/login'); }
        finally { setLoading(false); }
    }, [navigate]);

    useEffect(() => { load(); }, [load]);

    async function handleTrigger() {
        if (!confirm(`Disparar ciclo de cobrança para ${forceMonth}? Serão geradas cobranças para todos os clientes Ativos que ainda não foram cobrados neste mês.`)) return;
        setTriggering(true); setTriggerResult(null);
        try {
            const res = await adminAxios().post('/api/zeruela/billing/trigger', { forceMonth });
            setTriggerResult(res.data);
            load();
        } catch (err: any) {
            alert(err.response?.data?.error ?? 'Erro ao disparar ciclo.');
        } finally { setTriggering(false); }
    }

    const filtered = runs.filter(r => {
        const q = search.toLowerCase();
        const matchSearch = !q || r.tenant.name.toLowerCase().includes(q) || r.month.includes(q);
        const matchStatus = !filterStatus || r.status === filterStatus;
        return matchSearch && matchStatus;
    });

    const inp: React.CSSProperties = { padding: '8px 12px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 12, outline: 'none' };
    const totalMrr = runs.filter(r => r.status === 'PAID').reduce((s, r) => s + r.value, 0);
    const pending = runs.filter(r => r.status === 'PENDING').length;
    const failed = runs.filter(r => r.status === 'FAILED').length;

    return (
        <div style={{ padding: 28, background: t.bg, minHeight: '100vh', color: t.text }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, color: t.accent, marginBottom: 4 }}>Cobranças</div>
                    <div style={{ fontSize: 12, color: t.textSub, fontFamily: "'Geist Mono', monospace" }}>Histórico de cobranças geradas pelo cron</div>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <input type="month" value={forceMonth} onChange={e => setForceMonth(e.target.value)} style={{ ...inp, colorScheme: 'dark' }} />
                    <button onClick={handleTrigger} disabled={triggering} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: triggering ? t.border : t.accent, color: triggering ? t.textSub : '#1a1510', fontSize: 13, fontWeight: 600, cursor: triggering ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                        {triggering ? 'Disparando...' : '▶ Disparar ciclo'}
                    </button>
                </div>
            </div>

            {/* Trigger result */}
            {triggerResult && (
                <div style={{ background: `${t.success}18`, border: `1px solid ${t.success}44`, borderRadius: 10, padding: '12px 18px', marginBottom: 20, fontSize: 13 }}>
                    Ciclo concluído — <span style={{ color: t.success }}>✓ {triggerResult.processed} processados</span>
                    {triggerResult.failed > 0 && <span style={{ color: t.danger }}> · ✗ {triggerResult.failed} falhas</span>}
                    {triggerResult.skipped > 0 && <span style={{ color: t.textSub }}> · {triggerResult.skipped} pulados (já cobrados)</span>}
                </div>
            )}

            {/* Summary */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
                {[
                    { label: 'Total recebido', value: `R$ ${totalMrr.toFixed(2)}`, accent: t.accent },
                    { label: 'Pendentes', value: pending, accent: pending > 0 ? '#d4a43a' : undefined },
                    { label: 'Falhas', value: failed, accent: failed > 0 ? t.danger : undefined },
                    { label: 'Total registros', value: runs.length },
                ].map(c => (
                    <div key={c.label} style={{ flex: 1, minWidth: 140, background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: '14px 18px' }}>
                        <div style={{ fontSize: 10, color: t.textSub, fontFamily: "'Geist Mono', monospace", letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>{c.label}</div>
                        <div style={{ fontSize: 24, color: c.accent ?? t.text, fontFamily: "'Fraunces', serif", lineHeight: 1 }}>{c.value}</div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                <input placeholder="Buscar cliente ou mês..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, flex: 1 }} />
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={inp}>
                    <option value="">Todos os status</option>
                    <option value="PENDING">Pendente</option>
                    <option value="PAID">Pago</option>
                    <option value="FAILED">Falhou</option>
                    <option value="CANCELLED">Cancelado</option>
                </select>
                <button onClick={load} style={{ ...inp, cursor: 'pointer', fontSize: 14 }}>↻</button>
            </div>

            {/* Table */}
            <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'hidden' }}>
                {loading ? <div style={{ padding: 32, textAlign: 'center', color: t.textSub }}>Carregando...</div> : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                                {['Cliente', 'Mês', 'Valor', 'Status', 'WhatsApp', 'Vencimento', 'Link'].map(h => (
                                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, color: t.textSub, fontFamily: "'Geist Mono', monospace", letterSpacing: 0.8, textTransform: 'uppercase', fontWeight: 500 }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(r => {
                                const sc = STATUS_COLORS[r.status] ?? { text: t.textSub, label: r.status };
                                const link = r.invoiceUrl ?? r.bankSlipUrl;
                                return (
                                    <tr key={r.id} style={{ borderBottom: `1px solid ${t.borderSub}` }}>
                                        <td style={{ padding: '11px 16px' }}>
                                            <div style={{ fontSize: 13, color: t.textMuted, fontWeight: 500 }}>{r.tenant.name}</div>
                                            <div style={{ fontSize: 10, color: t.textSub, fontFamily: "'Geist Mono', monospace" }}>{r.tenant.slug}</div>
                                        </td>
                                        <td style={{ padding: '11px 16px', fontSize: 12, color: t.textSub, fontFamily: "'Geist Mono', monospace" }}>{r.month}</td>
                                        <td style={{ padding: '11px 16px', fontSize: 13, color: t.accent, fontFamily: "'Fraunces', serif" }}>R$ {r.value.toFixed(2)}</td>
                                        <td style={{ padding: '11px 16px' }}>
                                            <span style={{ fontSize: 11, color: sc.text }}>{sc.label}</span>
                                            {r.error && <div style={{ fontSize: 10, color: t.danger, marginTop: 2 }} title={r.error}>⚠ erro</div>}
                                        </td>
                                        <td style={{ padding: '11px 16px', fontSize: 12, color: r.whatsappSent ? t.success : t.textSub }}>
                                            {r.whatsappSent ? '✓ Enviado' : '—'}
                                        </td>
                                        <td style={{ padding: '11px 16px', fontSize: 11, color: t.textSub }}>
                                            {new Date(r.dueDate).toLocaleDateString('pt-BR')}
                                        </td>
                                        <td style={{ padding: '11px 16px' }}>
                                            {link ? <a href={link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: `1px solid ${t.accent}44`, color: t.accent, textDecoration: 'none' }}>Link</a> : <span style={{ color: t.textSub, fontSize: 11 }}>—</span>}
                                        </td>
                                    </tr>
                                );
                            })}
                            {filtered.length === 0 && <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: t.textSub }}>Nenhum registro encontrado.</td></tr>}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
