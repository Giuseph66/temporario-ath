import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAdminTheme } from '../../hooks/useAdminTheme';

type AdminMetrics = {
    tenants: { total: number; newThisMonth: number };
    subscriptions: { active: number; trial: number; suspended: number; cancelled: number };
    mrr: string;
    leads: { total: number };
    ai: { totalTokens: number; totalCostBrl: string };
    planBreakdown: { plan: string; count: number; revenue: string }[];
};

function adminAxios() {
    const token = localStorage.getItem('adminAccessToken');
    return axios.create({ headers: { Authorization: `Bearer ${token}` } });
}

export function AdminOverview() {
    const t = useAdminTheme();
    const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const load = useCallback(async () => {
        try {
            const data = await adminAxios().get('/api/zeruela/metrics').then(r => r.data);
            setMetrics(data);
        } catch {
            navigate('/zeruela/login');
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    useEffect(() => { load(); }, [load]);

    function Card({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
        return (
            <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: '18px 22px', flex: 1, minWidth: 150 }}>
                <div style={{ fontSize: 10, color: t.textSub, fontFamily: "'Geist Mono', monospace", letterSpacing: 0.8, marginBottom: 8, textTransform: 'uppercase' }}>
                    {label}
                </div>
                <div style={{ fontSize: 28, color: accent ?? t.text, fontWeight: 600, fontFamily: "'Fraunces', serif", lineHeight: 1 }}>
                    {value}
                </div>
                {sub && <div style={{ fontSize: 11, color: t.textSub, marginTop: 6 }}>{sub}</div>}
            </div>
        );
    }

    if (loading) return <div style={{ padding: 40, color: t.textSub, fontSize: 13, background: t.bg, minHeight: '100vh' }}>Carregando...</div>;
    if (!metrics) return null;

    const totalSubs = metrics.subscriptions.active + metrics.subscriptions.trial + metrics.subscriptions.suspended + metrics.subscriptions.cancelled;

    return (
        <div style={{ padding: 28, background: t.bg, minHeight: '100vh', color: t.text }}>
            <div style={{ marginBottom: 24 }}>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, color: t.accent, marginBottom: 4 }}>Visão Geral</div>
                <div style={{ fontSize: 12, color: t.textSub, fontFamily: "'Geist Mono', monospace" }}>Métricas em tempo real da plataforma</div>
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
                <Card label="Tenants" value={metrics.tenants.total} sub={`+${metrics.tenants.newThisMonth} este mês`} />
                <Card label="MRR" value={`R$ ${metrics.mrr}`} sub={`${metrics.subscriptions.active} ativos`} accent={t.accent} />
                <Card label="Leads totais" value={metrics.leads.total.toLocaleString('pt-BR')} />
                <Card label="Custo IA total" value={`R$ ${metrics.ai.totalCostBrl}`} sub={`${(metrics.ai.totalTokens / 1_000_000).toFixed(1)}M tokens`} />
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
                <Card label="Ativos" value={metrics.subscriptions.active} accent={t.success} />
                <Card label="Trial" value={metrics.subscriptions.trial} accent="#7b8fe8" />
                <Card label="Suspensos" value={metrics.subscriptions.suspended} accent={metrics.subscriptions.suspended > 0 ? t.danger : undefined} />
                <Card label="Cancelados" value={metrics.subscriptions.cancelled} />
            </div>

            {metrics.planBreakdown.length > 0 && (
                <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'hidden' }}>
                    <div style={{ padding: '14px 20px', borderBottom: `1px solid ${t.border}`, fontSize: 11, color: t.textSub, fontFamily: "'Geist Mono', monospace", letterSpacing: 0.8, textTransform: 'uppercase' }}>
                        Planos ativos
                    </div>
                    {metrics.planBreakdown.map(p => (
                        <div key={p.plan} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 20px', borderBottom: `1px solid ${t.borderSub}` }}>
                            <span style={{ fontSize: 13, color: t.textMuted, textTransform: 'capitalize' }}>{p.plan}</span>
                            <div style={{ display: 'flex', gap: 32 }}>
                                <span style={{ fontSize: 12, color: t.textSub, fontFamily: "'Geist Mono', monospace" }}>{p.count} tenants</span>
                                <span style={{ fontSize: 12, color: t.accent, fontFamily: "'Geist Mono', monospace" }}>R$ {p.revenue}/mês</span>
                            </div>
                        </div>
                    ))}
                    <div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: t.textSub }}>Total ({totalSubs} tenants)</span>
                        <span style={{ fontSize: 13, color: t.accent, fontFamily: "'Geist Mono', monospace", fontWeight: 600 }}>R$ {metrics.mrr}/mês</span>
                    </div>
                </div>
            )}
        </div>
    );
}
