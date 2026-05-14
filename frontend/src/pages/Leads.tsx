import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

type Lead = {
    id: string;
    name: string | null;
    phoneNumber: string;
    conversationState: string | null;
    currentProgramId: string | null;
    enrollmentStatus: 'LEAD' | 'PAYMENT_PENDING' | 'ENROLLED' | 'CANCELLED';
    lastInteraction: string;
    interactionCount: number;
    lgpdConsent: boolean;
};

type LeadDetail = Lead & {
    cpf?: string;
    email?: string;
    goal?: string;
    age?: number;
    messages: { id: string; role: string; content: string; createdAt: string }[];
};

const STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
    LEAD:            { bg: 'var(--paper-3)',   color: 'var(--ink-3)',     label: 'Lead'              },
    PAYMENT_PENDING: { bg: 'var(--amber-soft)', color: 'var(--amber)',    label: 'Aguard. pagamento' },
    ENROLLED:        { bg: 'var(--accent-soft)',color: 'var(--accent-ink)',label: 'Matriculado'      },
    CANCELLED:       { bg: 'var(--danger-soft)', color: 'var(--danger)',  label: 'Cancelado'         },
};

function StatusBadge({ status }: { status: string }) {
    const s = STATUS_COLORS[status] ?? STATUS_COLORS.LEAD;
    return (
        <span style={{
            background: s.bg, color: s.color,
            fontFamily: "'Geist Mono', monospace", fontSize: 10,
            letterSpacing: .5, textTransform: 'uppercase',
            padding: '3px 8px', borderRadius: 4, whiteSpace: 'nowrap',
        }}>{s.label}</span>
    );
}

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m atrás`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h atrás`;
    return `${Math.floor(hrs / 24)}d atrás`;
}

function LeadModal({ lead, onClose }: { lead: LeadDetail; onClose: () => void }) {
    const qc = useQueryClient();

    const deleteM = useMutation({
        mutationFn: () => axios.delete(`/api/leads/${lead.id}`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['leads'] }); onClose(); },
    });

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            zIndex: 1000,
        }} onClick={onClose}>
            <div style={{
                width: 460, height: '100vh', background: 'var(--paper)',
                borderLeft: '1px solid var(--line)', overflowY: 'auto',
                display: 'flex', flexDirection: 'column',
            }} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={{
                    padding: '24px 28px', borderBottom: '1px solid var(--line)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                }}>
                    <div>
                        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, color: 'var(--ink-1)', marginBottom: 4 }}>
                            {lead.name ?? lead.phoneNumber}
                        </div>
                        <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: 'var(--ink-4)' }}>
                            {lead.phoneNumber}
                        </div>
                    </div>
                    <button onClick={onClose} style={{
                        padding: '6px 10px', borderRadius: 7, border: '1px solid var(--line)',
                        background: 'transparent', color: 'var(--ink-3)', cursor: 'pointer',
                        fontFamily: 'inherit', fontSize: 13,
                    }}>✕</button>
                </div>

                {/* Details */}
                <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--line)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        {[
                            ['Status', <StatusBadge status={lead.enrollmentStatus} />],
                            ['Interações', lead.interactionCount],
                            ['Programa', lead.currentProgramId ?? '—'],
                            ['Idade', lead.age ?? '—'],
                            ['E-mail', lead.email ?? '—'],
                            ['CPF', lead.cpf ?? '—'],
                            ['Objetivo', lead.goal ?? '—'],
                            ['LGPD', lead.lgpdConsent ? '✓ consentido' : '✗ pendente'],
                        ].map(([label, value], i) => (
                            <div key={i}>
                                <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--ink-5)', marginBottom: 3 }}>
                                    {label}
                                </div>
                                <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>{value as any}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Messages */}
                <div style={{ flex: 1, padding: '20px 28px', overflowY: 'auto' }}>
                    <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--ink-5)', marginBottom: 12 }}>
                        Histórico ({lead.messages?.length ?? 0} msgs)
                    </div>
                    {(lead.messages ?? []).map((msg, i) => (
                        <div key={i} style={{
                            display: 'flex', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                            marginBottom: 8,
                        }}>
                            <div style={{
                                maxWidth: '78%',
                                background: msg.role === 'user' ? 'var(--accent-soft)' : 'var(--paper-2)',
                                border: `1px solid ${msg.role === 'user' ? '#c9d8d0' : 'var(--line)'}`,
                                borderRadius: 10, padding: '8px 12px',
                                fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5,
                            }}>
                                {msg.content}
                                <div style={{ fontSize: 10, color: 'var(--ink-5)', marginTop: 4 }}>
                                    {timeAgo(msg.createdAt)}
                                </div>
                            </div>
                        </div>
                    ))}
                    {(lead.messages ?? []).length === 0 && (
                        <div style={{ fontSize: 13, color: 'var(--ink-4)' }}>Sem mensagens.</div>
                    )}
                </div>

                {/* Actions */}
                <div style={{ padding: '16px 28px', borderTop: '1px solid var(--line)', display: 'flex', gap: 8 }}>
                    <button
                        onClick={() => {
                            if (confirm('Deletar lead e todo histórico? Esta ação é irreversível.')) {
                                deleteM.mutate();
                            }
                        }}
                        disabled={deleteM.isPending}
                        style={{
                            flex: 1, padding: '8px', borderRadius: 8, fontSize: 12.5, fontWeight: 500,
                            border: '1px solid var(--danger)', background: 'transparent',
                            color: 'var(--danger)', cursor: 'pointer', fontFamily: 'inherit',
                            opacity: deleteM.isPending ? .5 : 1,
                        }}
                    >
                        {deleteM.isPending ? 'Deletando…' : 'Deletar lead (LGPD)'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export function Leads() {
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const { data, isLoading } = useQuery<{ leads: Lead[]; total: number }>({
        queryKey: ['leads', search, statusFilter],
        queryFn: () => axios.get('/api/leads', {
            params: { search: search || undefined, state: statusFilter || undefined, limit: 50 },
        }).then(r => r.data),
    });

    const { data: detail } = useQuery<LeadDetail>({
        queryKey: ['lead-detail', selectedId],
        queryFn: () => axios.get(`/api/leads/${selectedId}`).then(r => r.data),
        enabled: !!selectedId,
    });

    function exportJSON() {
        axios.get('/api/leads', { params: { limit: 9999 } }).then(r => {
            const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `leads-${Date.now()}.json`;
            a.click();
        });
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* Top bar */}
            <div style={{
                padding: '28px 40px 20px', borderBottom: '1px solid var(--line)',
                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            }}>
                <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: 28, color: 'var(--ink-1)', marginBottom: 2 }}>
                        Leads
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--ink-4)' }}>
                        {data?.total ?? '…'} leads no total
                    </div>
                </div>
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar nome ou telefone…"
                    style={{
                        padding: '8px 14px', borderRadius: 8, fontSize: 13,
                        border: '1px solid var(--line-2)', background: 'var(--paper-2)',
                        color: 'var(--ink-1)', fontFamily: 'inherit', outline: 'none', width: 220,
                    }}
                />
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    style={{
                        padding: '8px 12px', borderRadius: 8, fontSize: 13,
                        border: '1px solid var(--line-2)', background: 'var(--paper-2)',
                        color: 'var(--ink-1)', fontFamily: 'inherit', outline: 'none',
                    }}
                >
                    <option value="">Todos os status</option>
                    <option value="LEAD">Lead</option>
                    <option value="PAYMENT_PENDING">Aguard. pagamento</option>
                    <option value="ENROLLED">Matriculado</option>
                    <option value="CANCELLED">Cancelado</option>
                </select>
                <button onClick={exportJSON} style={{
                    padding: '8px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 500,
                    border: '1px solid var(--line-2)', background: 'var(--paper)',
                    color: 'var(--ink-3)', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                }}>
                    Exportar JSON
                </button>
            </div>

            {/* Table */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
                {isLoading ? (
                    <div style={{ padding: 40, color: 'var(--ink-4)', fontSize: 14 }}>Carregando…</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--paper-2)' }}>
                                {['Nome', 'Telefone', 'Status', 'Interações', 'Última atividade'].map(h => (
                                    <th key={h} style={{
                                        padding: '10px 16px', textAlign: 'left',
                                        fontFamily: "'Geist Mono', monospace", fontSize: 10,
                                        letterSpacing: 1, textTransform: 'uppercase', color: 'var(--ink-4)',
                                        borderBottom: '1px solid var(--line)', fontWeight: 400,
                                    }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {(data?.leads ?? []).map(lead => (
                                <tr
                                    key={lead.id}
                                    onClick={() => setSelectedId(lead.id)}
                                    style={{ cursor: 'pointer', borderBottom: '1px solid var(--line)' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--paper-2)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                >
                                    <td style={{ padding: '12px 16px', fontSize: 13.5, color: 'var(--ink-1)', fontWeight: 500 }}>
                                        {lead.name ?? '—'}
                                    </td>
                                    <td style={{ padding: '12px 16px', fontFamily: "'Geist Mono', monospace", fontSize: 12, color: 'var(--ink-3)' }}>
                                        {lead.phoneNumber}
                                    </td>
                                    <td style={{ padding: '12px 16px' }}>
                                        <StatusBadge status={lead.enrollmentStatus} />
                                    </td>
                                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--ink-3)' }}>
                                        {lead.interactionCount}
                                    </td>
                                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--ink-4)' }}>
                                        {timeAgo(lead.lastInteraction)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                {!isLoading && (data?.leads ?? []).length === 0 && (
                    <div style={{ padding: 40, color: 'var(--ink-4)', fontSize: 14 }}>
                        Nenhum lead encontrado.
                    </div>
                )}
            </div>

            {/* Detail modal */}
            {selectedId && detail && (
                <LeadModal lead={detail} onClose={() => setSelectedId(null)} />
            )}
        </div>
    );
}
