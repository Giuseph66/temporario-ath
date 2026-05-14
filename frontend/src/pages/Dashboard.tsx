import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

type Metrics = {
    totalLeads: number;
    conversas24h: number;
    enrolledCount: number;
    paymentPending: number;
    conversionRate: number;
    recentEnrollments: { name: string | null; phoneNumber: string; enrollmentDate: string | null; currentProgramId: string | null }[];
};

type Agent = { name: string; isActive: boolean; geminiModel: string };

function MetricCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
    return (
        <div style={{
            background: 'var(--paper)', border: '1px solid var(--line)',
            borderRadius: 12, padding: '20px 24px',
        }}>
            <div style={{
                fontFamily: "'Geist Mono', monospace", fontSize: 10, letterSpacing: 1.2,
                textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 10,
            }}>{label}</div>
            <div style={{
                fontFamily: "'Fraunces', serif", fontSize: 36, fontWeight: 400,
                color: 'var(--ink-1)', letterSpacing: -1, lineHeight: 1,
            }}>{value}</div>
            {sub && <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 6 }}>{sub}</div>}
        </div>
    );
}

function timeAgo(dateStr: string | null): string {
    if (!dateStr) return '—';
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'hoje';
    if (days === 1) return 'ontem';
    return `há ${days} dias`;
}

export function Dashboard() {
    const qc = useQueryClient();

    const { data: metrics, isLoading: loadingMetrics } = useQuery<Metrics>({
        queryKey: ['metrics'],
        queryFn: () => axios.get('/api/metrics').then(r => r.data),
        refetchInterval: 30000,
    });

    const { data: agent } = useQuery<Agent>({
        queryKey: ['agent'],
        queryFn: () => axios.get('/api/agent').then(r => r.data),
    });

    const toggleAgent = useMutation({
        mutationFn: () => axios.patch('/api/agent/toggle'),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['agent'] }),
    });

    if (loadingMetrics) {
        return (
            <div style={{ padding: 40 }}>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 28, color: 'var(--ink-4)' }}>
                    Carregando…
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: '40px 48px', overflowY: 'auto', height: '100%' }}>
            <div style={{ marginBottom: 40 }}>
                <div style={{
                    fontFamily: "'Fraunces', serif", fontSize: 40, fontWeight: 400,
                    color: 'var(--ink-1)', letterSpacing: -1, lineHeight: 1, marginBottom: 8,
                }}>Dashboard</div>
                <div style={{ fontSize: 14, color: 'var(--ink-4)' }}>
                    Métricas em tempo real do seu agente.
                </div>
            </div>

            {/* Metric cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
                <MetricCard label="Total de leads" value={metrics?.totalLeads ?? 0} />
                <MetricCard label="Matriculados" value={metrics?.enrolledCount ?? 0} />
                <MetricCard
                    label="Conversas 24h"
                    value={metrics?.conversas24h ?? 0}
                    sub="leads ativos nas últimas 24h"
                />
                <MetricCard
                    label="Taxa de conversão"
                    value={`${metrics?.conversionRate ?? 0}%`}
                    sub={`${metrics?.paymentPending ?? 0} aguardando pagamento`}
                />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
                {/* Recent enrollments */}
                <div style={{
                    background: 'var(--paper)', border: '1px solid var(--line)',
                    borderRadius: 12, padding: '24px',
                }}>
                    <div style={{
                        fontFamily: "'Geist Mono', monospace", fontSize: 10, letterSpacing: 1.2,
                        textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 16,
                    }}>Últimas matrículas</div>

                    {(metrics?.recentEnrollments?.length ?? 0) === 0 ? (
                        <div style={{ fontSize: 13, color: 'var(--ink-4)', padding: '20px 0' }}>
                            Nenhuma matrícula registrada ainda.
                        </div>
                    ) : (
                        metrics?.recentEnrollments.map((e, i) => (
                            <div key={i} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '12px 0',
                                borderBottom: i < (metrics.recentEnrollments.length - 1) ? '1px solid var(--line)' : 'none',
                            }}>
                                <div>
                                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-1)', marginBottom: 2 }}>
                                        {e.name ?? e.phoneNumber}
                                    </div>
                                    <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: 'var(--ink-4)' }}>
                                        {e.currentProgramId ?? '—'}
                                    </div>
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>
                                    {timeAgo(e.enrollmentDate)}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Agent card */}
                <div style={{
                    background: 'var(--paper)', border: '1px solid var(--line)',
                    borderRadius: 12, padding: '24px',
                    display: 'flex', flexDirection: 'column', gap: 16,
                }}>
                    <div style={{
                        fontFamily: "'Geist Mono', monospace", fontSize: 10, letterSpacing: 1.2,
                        textTransform: 'uppercase', color: 'var(--ink-4)',
                    }}>Agente</div>

                    <div>
                        <div style={{
                            width: 44, height: 44, borderRadius: '50%',
                            background: agent?.isActive ? 'var(--accent)' : 'var(--ink-5)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: "'Fraunces', serif", fontSize: 22, color: '#fff',
                            marginBottom: 10, transition: 'background .2s',
                        }}>
                            {agent?.name?.[0] ?? 'A'}
                        </div>
                        <div style={{
                            fontFamily: "'Fraunces', serif", fontSize: 20,
                            color: 'var(--ink-1)', letterSpacing: -.3,
                        }}>
                            {agent?.name ?? '—'}
                        </div>
                        <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: 'var(--ink-4)', marginTop: 2 }}>
                            {agent?.geminiModel ?? '—'}
                        </div>
                    </div>

                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 12px', borderRadius: 8,
                        background: agent?.isActive ? 'var(--accent-soft)' : 'var(--paper-2)',
                        border: `1px solid ${agent?.isActive ? '#c9d8d0' : 'var(--line)'}`,
                    }}>
                        <span style={{
                            fontFamily: "'Geist Mono', monospace", fontSize: 10,
                            textTransform: 'uppercase', letterSpacing: .5,
                            color: agent?.isActive ? 'var(--accent-ink)' : 'var(--ink-4)',
                        }}>
                            {agent?.isActive ? '● ativo' : '○ inativo'}
                        </span>
                        <button
                            onClick={() => toggleAgent.mutate()}
                            disabled={toggleAgent.isPending}
                            style={{
                                padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500,
                                border: '1px solid var(--line-2)', background: 'var(--paper)',
                                color: 'var(--ink-3)', cursor: 'pointer', fontFamily: 'inherit',
                                opacity: toggleAgent.isPending ? .5 : 1,
                            }}
                        >
                            {agent?.isActive ? 'Pausar' : 'Ativar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
