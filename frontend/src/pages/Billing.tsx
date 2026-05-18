import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

type BillingInfo = {
    status: string;
    planName: string;
    priceMonthly: number;
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
    createdAt: string;
};

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
    TRIAL:     { label: 'Período de teste', color: '#7b8fe8', bg: '#1a1a2e' },
    ACTIVE:    { label: 'Ativo', color: '#5fb878', bg: '#0f1f14' },
    OVERDUE:   { label: 'Pagamento em atraso', color: '#d4a43a', bg: '#1f1500' },
    SUSPENDED: { label: 'Suspenso', color: '#c85a5a', bg: '#1f0a0a' },
    CANCELLED: { label: 'Cancelado', color: '#555', bg: '#141414' },
    TRIAL_EXPIRED: { label: 'Trial expirado', color: '#c85a5a', bg: '#1f0a0a' },
};

function daysUntil(date: string) {
    const diff = new Date(date).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function Billing() {
    const { data, isLoading, error } = useQuery<BillingInfo>({
        queryKey: ['billing'],
        queryFn: () => axios.get('/api/billing').then(r => r.data),
        staleTime: 60_000,
    });

    const st = data ? (STATUS_LABELS[data.status] ?? STATUS_LABELS.ACTIVE) : null;

    return (
        <div style={{ padding: 24, maxWidth: 560 }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, color: 'var(--ink-1)', marginBottom: 4 }}>
                Assinatura
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 28 }}>
                Status da sua conta e informações de cobrança.
            </div>

            {isLoading && (
                <div style={{ color: 'var(--ink-4)', fontSize: 13 }}>Carregando...</div>
            )}

            {error && (
                <div style={{ color: '#c85a5a', fontSize: 13, background: '#1f0a0a', borderRadius: 8, padding: '12px 16px' }}>
                    Não foi possível carregar as informações de assinatura.
                </div>
            )}

            {data && st && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Status card */}
                    <div style={{
                        background: st.bg, borderRadius: 12, padding: '20px 24px',
                        border: `1px solid ${st.color}22`,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                            <div style={{
                                width: 10, height: 10, borderRadius: '50%',
                                background: st.color, boxShadow: `0 0 6px ${st.color}88`,
                            }} />
                            <span style={{ fontSize: 14, color: st.color, fontWeight: 500 }}>{st.label}</span>
                        </div>
                        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 28, color: 'var(--ink-1)' }}>
                            {data.planName.charAt(0).toUpperCase() + data.planName.slice(1)}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--ink-4)', marginTop: 4 }}>
                            {data.priceMonthly > 0
                                ? `R$ ${data.priceMonthly.toFixed(2)}/mês`
                                : 'Gratuito'}
                        </div>
                    </div>

                    {/* Dates */}
                    <div style={{ background: 'var(--paper-2)', borderRadius: 12, padding: '16px 20px', border: '1px solid var(--line)' }}>
                        {data.status === 'TRIAL' && data.trialEndsAt && (
                            <Row
                                label="Trial termina em"
                                value={`${new Date(data.trialEndsAt).toLocaleDateString('pt-BR')} (${daysUntil(data.trialEndsAt)} dias)`}
                                highlight={daysUntil(data.trialEndsAt) <= 3}
                            />
                        )}
                        {data.currentPeriodEnd && data.status === 'ACTIVE' && (
                            <Row
                                label="Próxima renovação"
                                value={new Date(data.currentPeriodEnd).toLocaleDateString('pt-BR')}
                            />
                        )}
                        <Row
                            label="Membro desde"
                            value={new Date(data.createdAt).toLocaleDateString('pt-BR')}
                        />
                    </div>

                    {/* Suspended/overdue message */}
                    {(data.status === 'SUSPENDED' || data.status === 'OVERDUE') && (
                        <div style={{
                            background: '#1f0a0a', borderRadius: 10, padding: '14px 18px',
                            border: '1px solid #c85a5a33', fontSize: 13, color: '#c88a8a',
                            lineHeight: 1.5,
                        }}>
                            Sua conta está com acesso restrito por falta de pagamento. Entre em contato com o suporte para regularizar.
                        </div>
                    )}

                    {data.status === 'TRIAL' && data.trialEndsAt && daysUntil(data.trialEndsAt) <= 5 && (
                        <div style={{
                            background: '#1f1500', borderRadius: 10, padding: '14px 18px',
                            border: '1px solid #d4a43a33', fontSize: 13, color: '#d4c08a',
                            lineHeight: 1.5,
                        }}>
                            Seu trial expira em breve. Fale com a equipe para ativar sua assinatura e manter o acesso.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--ink-4)' }}>{label}</span>
            <span style={{ fontSize: 13, color: highlight ? '#d4a43a' : 'var(--ink-2)', fontFamily: "'Geist Mono', monospace" }}>
                {value}
            </span>
        </div>
    );
}
