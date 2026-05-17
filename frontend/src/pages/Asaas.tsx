import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

// ─── Types ────────────────────────────────────────────────────────────────────

type Payment = {
    id: string;
    customer: string;
    customerName?: string;
    billingType: string;
    status: string;
    value: number;
    dueDate: string;
    description?: string;
    invoiceUrl?: string;
    dateCreated?: string;
};

type Customer = {
    id: string;
    name: string;
    cpfCnpj?: string;
    email?: string;
    mobilePhone?: string;
    dateCreated?: string;
};

type AsaasPage<T> = {
    data: T[];
    totalCount: number;
    hasMore: boolean;
};

// ─── Shared styles ────────────────────────────────────────────────────────────

const btnPrimary: React.CSSProperties = {
    padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
    border: '1px solid var(--accent-ink)', background: 'var(--accent)',
    color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
    whiteSpace: 'nowrap', transition: 'opacity .12s',
};

const btnSecondary: React.CSSProperties = {
    padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
    border: '1px solid var(--line-2)', background: 'var(--paper)',
    color: 'var(--ink-3)', cursor: 'pointer', fontFamily: 'inherit',
    whiteSpace: 'nowrap',
};

const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13,
    border: '1px solid var(--line-2)', background: 'var(--paper-2)',
    color: 'var(--ink-1)', fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
    fontSize: 11.5, fontWeight: 500, color: 'var(--ink-4)',
    textTransform: 'uppercase', letterSpacing: .7, marginBottom: 4,
    display: 'block',
};

// ─── Status chips ─────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; bg: string; color: string; border: string }> = {
    PENDING:                    { label: 'Pendente',         bg: 'var(--amber-soft)',  color: 'var(--amber)',      border: 'var(--amber)'  },
    CONFIRMED:                  { label: 'Confirmado',       bg: 'var(--accent-soft)', color: 'var(--accent-ink)', border: 'var(--accent)' },
    RECEIVED:                   { label: 'Recebido',         bg: 'var(--accent-soft)', color: 'var(--accent-ink)', border: 'var(--accent)' },
    RECEIVED_IN_CASH:           { label: 'Recebido (caixa)', bg: 'var(--accent-soft)', color: 'var(--accent-ink)', border: 'var(--accent)' },
    OVERDUE:                    { label: 'Vencido',          bg: 'var(--danger-soft)', color: 'var(--danger)',     border: 'var(--danger)' },
    REFUNDED:                   { label: 'Estornado',        bg: 'var(--paper-2)',     color: 'var(--ink-3)',      border: 'var(--line)'   },
    REFUND_REQUESTED:           { label: 'Estorno pend.',    bg: 'var(--amber-soft)',  color: 'var(--amber)',      border: 'var(--amber)'  },
    DELETED:                    { label: 'Excluído',         bg: 'var(--paper-2)',     color: 'var(--ink-4)',      border: 'var(--line)'   },
    CANCELLED:                  { label: 'Cancelado',        bg: 'var(--paper-2)',     color: 'var(--ink-4)',      border: 'var(--line)'   },
    CHARGEBACK_REQUESTED:       { label: 'Chargeback',       bg: 'var(--danger-soft)', color: 'var(--danger)',     border: 'var(--danger)' },
    AWAITING_RISK_ANALYSIS:     { label: 'Análise de risco', bg: 'var(--amber-soft)',  color: 'var(--amber)',      border: 'var(--amber)'  },
};

function StatusChip({ status }: { status: string }) {
    const s = STATUS_MAP[status] ?? { label: status, bg: 'var(--paper-2)', color: 'var(--ink-3)', border: 'var(--line)' };
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontFamily: "'Geist Mono', monospace", fontSize: 10.5, letterSpacing: .5,
            padding: '3px 9px', borderRadius: 4,
            background: s.bg, color: s.color, border: `1px solid ${s.border}`,
        }}>
            {s.label}
        </span>
    );
}

function BillingChip({ type }: { type: string }) {
    const map: Record<string, string> = {
        PIX: 'Pix', BOLETO: 'Boleto', CREDIT_CARD: 'Cartão', DEBIT_CARD: 'Débito', UNDEFINED: 'Livre',
    };
    return (
        <span style={{
            fontFamily: "'Geist Mono', monospace", fontSize: 10.5,
            color: 'var(--ink-4)', background: 'var(--paper-3)',
            border: '1px solid var(--line)', padding: '2px 7px', borderRadius: 4,
        }}>
            {map[type] ?? type}
        </span>
    );
}

function formatBRL(value: number) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(iso: string) {
    try {
        // dueDate comes as YYYY-MM-DD
        const [y, m, d] = iso.split('-');
        if (y && m && d) return `${d}/${m}/${y}`;
        return new Date(iso).toLocaleDateString('pt-BR');
    } catch { return iso; }
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000,
        }} onClick={onClose}>
            <div style={{
                background: 'var(--paper)', borderRadius: 14, width: 480,
                maxHeight: '85vh', overflow: 'auto',
                border: '1px solid var(--line)', boxShadow: '0 20px 60px rgba(0,0,0,.15)',
            }} onClick={e => e.stopPropagation()}>
                <div style={{
                    padding: '18px 22px', borderBottom: '1px solid var(--line)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, color: 'var(--ink-1)' }}>
                        {title}
                    </div>
                    <button onClick={onClose} style={{ ...btnSecondary, padding: '4px 10px', fontSize: 14 }}>✕</button>
                </div>
                <div style={{ padding: '22px' }}>{children}</div>
            </div>
        </div>
    );
}

// ─── Nova Cobrança modal ──────────────────────────────────────────────────────

function NovaCobrancaModal({ onClose, customers }: {
    onClose: () => void;
    customers: Customer[];
}) {
    const qc = useQueryClient();
    const [form, setForm] = useState({
        customer: '', billingType: 'PIX', value: '', dueDate: '', description: '',
    });
    const [error, setError] = useState('');

    const mutation = useMutation({
        mutationFn: (data: any) => axios.post('/api/asaas/payments', data).then(r => r.data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['asaas-payments'] });
            onClose();
        },
        onError: (e: any) => setError(e.response?.data?.error ?? 'Erro ao criar cobrança'),
    });

    function field(key: keyof typeof form) {
        return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
            setForm(f => ({ ...f, [key]: e.target.value }));
    }

    function submit() {
        setError('');
        if (!form.customer || !form.value || !form.dueDate) {
            setError('Preencha cliente, valor e vencimento'); return;
        }
        mutation.mutate({
            customer: form.customer,
            billingType: form.billingType,
            value: parseFloat(form.value.replace(',', '.')),
            dueDate: form.dueDate,
            description: form.description || undefined,
        });
    }

    return (
        <Modal title="Nova Cobrança" onClose={onClose}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                    <label style={labelStyle}>Cliente *</label>
                    {customers.length > 0 ? (
                        <select value={form.customer} onChange={field('customer')} style={inputStyle}>
                            <option value="">Selecione ou busque um cliente…</option>
                            {customers.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.name} {c.cpfCnpj ? `— ${c.cpfCnpj}` : ''}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <input
                            value={form.customer} onChange={field('customer')}
                            placeholder="ID do cliente (cus_...)"
                            style={inputStyle}
                        />
                    )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                        <label style={labelStyle}>Tipo de pagamento *</label>
                        <select value={form.billingType} onChange={field('billingType')} style={inputStyle}>
                            <option value="PIX">Pix</option>
                            <option value="BOLETO">Boleto</option>
                            <option value="CREDIT_CARD">Cartão de Crédito</option>
                            <option value="UNDEFINED">Livre (cliente escolhe)</option>
                        </select>
                    </div>
                    <div>
                        <label style={labelStyle}>Valor (R$) *</label>
                        <input
                            value={form.value} onChange={field('value')}
                            placeholder="0,00" style={inputStyle}
                        />
                    </div>
                </div>

                <div>
                    <label style={labelStyle}>Vencimento *</label>
                    <input
                        type="date" value={form.dueDate} onChange={field('dueDate')}
                        style={inputStyle}
                    />
                </div>

                <div>
                    <label style={labelStyle}>Descrição</label>
                    <input
                        value={form.description} onChange={field('description')}
                        placeholder="Ex: Mensalidade Julho"
                        style={inputStyle}
                    />
                </div>

                {error && (
                    <div style={{
                        padding: '10px 14px', borderRadius: 8, fontSize: 12.5,
                        background: 'var(--danger-soft)', color: 'var(--danger)',
                        border: '1px solid var(--danger)',
                    }}>{error}</div>
                )}

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
                    <button onClick={onClose} style={btnSecondary}>Cancelar</button>
                    <button
                        onClick={submit}
                        disabled={mutation.isPending}
                        style={{ ...btnPrimary, opacity: mutation.isPending ? .6 : 1 }}
                    >
                        {mutation.isPending ? 'Criando…' : 'Criar Cobrança'}
                    </button>
                </div>
            </div>
        </Modal>
    );
}

// ─── Novo Cliente modal ───────────────────────────────────────────────────────

function NovoClienteModal({ onClose }: { onClose: () => void }) {
    const qc = useQueryClient();
    const [form, setForm] = useState({ name: '', cpfCnpj: '', email: '', mobilePhone: '' });
    const [error, setError] = useState('');

    const mutation = useMutation({
        mutationFn: (data: any) => axios.post('/api/asaas/customers', data).then(r => r.data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['asaas-customers'] });
            onClose();
        },
        onError: (e: any) => setError(e.response?.data?.error ?? 'Erro ao criar cliente'),
    });

    function field(key: keyof typeof form) {
        return (e: React.ChangeEvent<HTMLInputElement>) =>
            setForm(f => ({ ...f, [key]: e.target.value }));
    }

    function submit() {
        setError('');
        if (!form.name.trim()) { setError('Nome é obrigatório'); return; }
        mutation.mutate({
            name: form.name,
            cpfCnpj: form.cpfCnpj.replace(/\D/g, '') || undefined,
            email: form.email || undefined,
            mobilePhone: form.mobilePhone.replace(/\D/g, '') || undefined,
        });
    }

    return (
        <Modal title="Novo Cliente" onClose={onClose}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                    <label style={labelStyle}>Nome completo *</label>
                    <input value={form.name} onChange={field('name')} placeholder="João da Silva" style={inputStyle} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                        <label style={labelStyle}>CPF / CNPJ</label>
                        <input value={form.cpfCnpj} onChange={field('cpfCnpj')} placeholder="000.000.000-00" style={inputStyle} />
                    </div>
                    <div>
                        <label style={labelStyle}>WhatsApp</label>
                        <input value={form.mobilePhone} onChange={field('mobilePhone')} placeholder="47999999999" style={inputStyle} />
                    </div>
                </div>
                <div>
                    <label style={labelStyle}>E-mail</label>
                    <input value={form.email} onChange={field('email')} placeholder="joao@email.com" type="email" style={inputStyle} />
                </div>

                {error && (
                    <div style={{
                        padding: '10px 14px', borderRadius: 8, fontSize: 12.5,
                        background: 'var(--danger-soft)', color: 'var(--danger)',
                        border: '1px solid var(--danger)',
                    }}>{error}</div>
                )}

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
                    <button onClick={onClose} style={btnSecondary}>Cancelar</button>
                    <button
                        onClick={submit}
                        disabled={mutation.isPending}
                        style={{ ...btnPrimary, opacity: mutation.isPending ? .6 : 1 }}
                    >
                        {mutation.isPending ? 'Salvando…' : 'Criar Cliente'}
                    </button>
                </div>
            </div>
        </Modal>
    );
}

// ─── Sandbox action buttons per row ──────────────────────────────────────────

function SandboxActions({ payment }: { payment: Payment }) {
    const qc = useQueryClient();
    const [pending, setPending] = useState<string | null>(null);
    const [error, setError] = useState('');

    // Auto-limpa erro após 5s
    useEffect(() => {
        if (!error) return;
        const t = setTimeout(() => setError(''), 5000);
        return () => clearTimeout(t);
    }, [error]);

    async function run(action: 'confirm' | 'overdue' | 'refund') {
        setError('');
        setPending(action);
        try {
            await axios.post(`/api/asaas/payments/${payment.id}/simulate/${action}`);
            await qc.invalidateQueries({ queryKey: ['asaas-payments'] });
        } catch (e: any) {
            const raw = e.response?.data?.error ?? e.message ?? '';
            try {
                const parsed = JSON.parse(raw);
                setError(parsed?.errors?.[0]?.description ?? parsed?.error ?? raw);
            } catch {
                setError(raw);
            }
        } finally {
            setPending(null);
        }
    }

    const canConfirm = payment.status === 'PENDING';
    const canOverdue = payment.status === 'PENDING';
    const canRefund  = (payment.status === 'RECEIVED' || payment.status === 'RECEIVED_IN_CASH' || payment.status === 'CONFIRMED')
                    && payment.status !== 'REFUND_REQUESTED';

    if (!canConfirm && !canOverdue && !canRefund) return null;

    const sandboxBtn = (action: string): React.CSSProperties => ({
        padding: '3px 9px', borderRadius: 5, fontSize: 11, fontWeight: 500,
        border: '1px solid var(--amber)', background: 'var(--amber-soft)',
        color: 'var(--amber)', cursor: pending ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit', whiteSpace: 'nowrap',
        opacity: pending && pending !== action ? .45 : 1,
        transition: 'opacity .12s',
    });

    return (
        <div style={{
            marginTop: 7, padding: '6px 8px', borderRadius: 7,
            background: 'var(--amber-soft)', border: '1px solid var(--amber)',
            display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
        }}>
            <span style={{
                fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: 1,
                textTransform: 'uppercase', color: 'var(--amber)', flexShrink: 0,
            }}>Sandbox</span>

            {canConfirm && (
                <button onClick={() => run('confirm')} disabled={!!pending} style={sandboxBtn('confirm')}>
                    {pending === 'confirm' ? '…' : 'Confirmar pagamento'}
                </button>
            )}
            {canOverdue && (
                <button onClick={() => run('overdue')} disabled={!!pending} style={sandboxBtn('overdue')}>
                    {pending === 'overdue' ? '…' : 'Forçar vencimento'}
                </button>
            )}
            {canRefund && (
                <button onClick={() => run('refund')} disabled={!!pending} style={sandboxBtn('refund')}>
                    {pending === 'refund' ? '…' : 'Estornar cobrança'}
                </button>
            )}

            {error && (
                <span style={{
                    flex: '1 1 100%', fontSize: 10.5, color: 'var(--amber)',
                    marginTop: 2, lineHeight: 1.4,
                }}>
                    ⚠ {error}
                </span>
            )}
        </div>
    );
}

// ─── Painel de Cobranças ──────────────────────────────────────────────────────

function CobrancasPanel({ isSandbox }: { isSandbox: boolean }) {
    const qc = useQueryClient();
    const [showModal, setShowModal] = useState(false);
    const [statusFilter, setStatusFilter] = useState('');

    const { data: paymentsRes, isLoading } = useQuery<AsaasPage<Payment>>({
        queryKey: ['asaas-payments', statusFilter],
        queryFn: () => axios.get('/api/asaas/payments', {
            params: { limit: 50, ...(statusFilter && { status: statusFilter }) },
        }).then(r => r.data),
    });

    const { data: customersRes } = useQuery<AsaasPage<Customer>>({
        queryKey: ['asaas-customers'],
        queryFn: () => axios.get('/api/asaas/customers', { params: { limit: 100 } }).then(r => r.data),
    });

    const cancelMutation = useMutation({
        mutationFn: (id: string) => axios.post(`/api/asaas/payments/${id}/cancel`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['asaas-payments'] }),
    });

    const payments = paymentsRes?.data ?? [];
    const customers = customersRes?.data ?? [];

    const STATUS_FILTERS = [
        { value: '', label: 'Todos' },
        { value: 'PENDING', label: 'Pendentes' },
        { value: 'RECEIVED', label: 'Recebidos' },
        { value: 'OVERDUE', label: 'Vencidos' },
        { value: 'CONFIRMED', label: 'Confirmados' },
    ];

    return (
        <div>
            {showModal && (
                <NovaCobrancaModal
                    onClose={() => setShowModal(false)}
                    customers={customers}
                />
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                    {STATUS_FILTERS.map(f => (
                        <button
                            key={f.value}
                            onClick={() => setStatusFilter(f.value)}
                            style={{
                                ...btnSecondary, fontSize: 11.5,
                                background: statusFilter === f.value ? 'var(--accent-soft)' : 'var(--paper)',
                                color: statusFilter === f.value ? 'var(--accent-ink)' : 'var(--ink-3)',
                                borderColor: statusFilter === f.value ? 'var(--accent-ink)' : 'var(--line-2)',
                            }}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
                <div style={{ flex: 1 }} />
                <button onClick={() => setShowModal(true)} style={btnPrimary}>
                    + Nova Cobrança
                </button>
            </div>

            {isLoading ? (
                <div style={{ color: 'var(--ink-4)', fontSize: 13, padding: '32px 0' }}>Carregando…</div>
            ) : payments.length === 0 ? (
                <EmptyState
                    icon="💳"
                    title="Nenhuma cobrança"
                    sub={statusFilter ? 'Nenhuma cobrança com este filtro.' : 'Crie a primeira cobrança clicando em "+ Nova Cobrança".'}
                />
            ) : (
                <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--paper-2)', borderBottom: '1px solid var(--line)' }}>
                                {['Descrição', 'Tipo', 'Valor', 'Vencimento', 'Status', ''].map(h => (
                                    <th key={h} style={{
                                        padding: '10px 14px', textAlign: 'left',
                                        fontFamily: "'Geist Mono', monospace",
                                        fontSize: 10, letterSpacing: 1, textTransform: 'uppercase',
                                        color: 'var(--ink-4)', fontWeight: 500,
                                    }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {payments.map((p, i) => (
                                <tr key={p.id} style={{
                                    borderBottom: i < payments.length - 1 ? '1px solid var(--line)' : 'none',
                                    background: 'var(--paper)',
                                }}>
                                    <td style={{ padding: '12px 14px' }}>
                                        <div style={{ fontSize: 13, color: 'var(--ink-1)', fontWeight: 500, marginBottom: 2 }}>
                                            {p.description ?? '—'}
                                        </div>
                                        <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10.5, color: 'var(--ink-5)' }}>
                                            {p.id}
                                        </div>
                                        {isSandbox && <SandboxActions payment={p} />}
                                    </td>
                                    <td style={{ padding: '12px 14px' }}>
                                        <BillingChip type={p.billingType} />
                                    </td>
                                    <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--ink-1)', fontSize: 13.5 }}>
                                        {formatBRL(p.value)}
                                    </td>
                                    <td style={{ padding: '12px 14px', fontFamily: "'Geist Mono', monospace", fontSize: 12, color: 'var(--ink-3)' }}>
                                        {formatDate(p.dueDate)}
                                    </td>
                                    <td style={{ padding: '12px 14px' }}>
                                        <StatusChip status={p.status} />
                                    </td>
                                    <td style={{ padding: '12px 14px' }}>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            {p.invoiceUrl && (
                                                <a
                                                    href={p.invoiceUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{ ...btnSecondary, fontSize: 11, textDecoration: 'none', display: 'inline-block' }}
                                                >
                                                    Ver
                                                </a>
                                            )}
                                            {p.status === 'PENDING' && (
                                                <button
                                                    onClick={() => { if (confirm('Cancelar esta cobrança?')) cancelMutation.mutate(p.id); }}
                                                    disabled={cancelMutation.isPending}
                                                    style={{ ...btnSecondary, fontSize: 11, color: 'var(--danger)', borderColor: 'var(--danger)' }}
                                                >
                                                    Cancelar
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {paymentsRes?.totalCount !== undefined && (
                <div style={{ marginTop: 12, fontSize: 12, color: 'var(--ink-4)' }}>
                    {payments.length} de {paymentsRes.totalCount} cobranças
                </div>
            )}
        </div>
    );
}

// ─── Painel de Clientes ───────────────────────────────────────────────────────

function ClientesPanel() {
    const [showModal, setShowModal] = useState(false);
    const [search, setSearch] = useState('');

    const { data: res, isLoading } = useQuery<AsaasPage<Customer>>({
        queryKey: ['asaas-customers', search],
        queryFn: () => axios.get('/api/asaas/customers', {
            params: { limit: 50, ...(search && { name: search }) },
        }).then(r => r.data),
    });

    const customers = res?.data ?? [];

    return (
        <div>
            {showModal && <NovoClienteModal onClose={() => setShowModal(false)} />}

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar por nome…"
                    style={{ ...inputStyle, width: 280 }}
                />
                <div style={{ flex: 1 }} />
                <button onClick={() => setShowModal(true)} style={btnPrimary}>
                    + Novo Cliente
                </button>
            </div>

            {isLoading ? (
                <div style={{ color: 'var(--ink-4)', fontSize: 13, padding: '32px 0' }}>Carregando…</div>
            ) : customers.length === 0 ? (
                <EmptyState
                    icon="👤"
                    title="Nenhum cliente"
                    sub={search ? 'Nenhum cliente com este nome.' : 'Crie o primeiro cliente clicando em "+ Novo Cliente".'}
                />
            ) : (
                <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--paper-2)', borderBottom: '1px solid var(--line)' }}>
                                {['Nome', 'CPF / CNPJ', 'E-mail', 'Celular', 'ID Asaas'].map(h => (
                                    <th key={h} style={{
                                        padding: '10px 14px', textAlign: 'left',
                                        fontFamily: "'Geist Mono', monospace",
                                        fontSize: 10, letterSpacing: 1, textTransform: 'uppercase',
                                        color: 'var(--ink-4)', fontWeight: 500,
                                    }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {customers.map((c, i) => (
                                <tr key={c.id} style={{
                                    borderBottom: i < customers.length - 1 ? '1px solid var(--line)' : 'none',
                                    background: 'var(--paper)',
                                }}>
                                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 500, color: 'var(--ink-1)' }}>
                                        {c.name}
                                    </td>
                                    <td style={{ padding: '12px 14px', fontFamily: "'Geist Mono', monospace", fontSize: 12, color: 'var(--ink-3)' }}>
                                        {c.cpfCnpj ?? '—'}
                                    </td>
                                    <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--ink-3)' }}>
                                        {c.email ?? '—'}
                                    </td>
                                    <td style={{ padding: '12px 14px', fontFamily: "'Geist Mono', monospace", fontSize: 12, color: 'var(--ink-3)' }}>
                                        {c.mobilePhone ?? '—'}
                                    </td>
                                    <td style={{ padding: '12px 14px' }}>
                                        <span style={{
                                            fontFamily: "'Geist Mono', monospace", fontSize: 10.5,
                                            color: 'var(--ink-5)', background: 'var(--paper-2)',
                                            border: '1px solid var(--line)', padding: '2px 7px', borderRadius: 4,
                                        }}>
                                            {c.id}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {res?.totalCount !== undefined && (
                <div style={{ marginTop: 12, fontSize: 12, color: 'var(--ink-4)' }}>
                    {customers.length} de {res.totalCount} clientes
                </div>
            )}
        </div>
    );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ icon, title, sub }: { icon: string; title: string; sub: string }) {
    return (
        <div style={{
            padding: '60px 0', textAlign: 'center',
            border: '1px solid var(--line)', borderRadius: 12,
            background: 'var(--paper)',
        }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 6 }}>{title}</div>
            <div style={{ fontSize: 13, color: 'var(--ink-4)' }}>{sub}</div>
        </div>
    );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type Tab = 'cobrancas' | 'clientes';

export function Asaas() {
    const [tab, setTab] = useState<Tab>('cobrancas');

    const { data: integs } = useQuery<{ asaas: { configured: boolean; sandbox: boolean; baseUrl: string } }>({
        queryKey: ['integrations'],
        queryFn: () => axios.get('/api/integrations').then(r => r.data),
    });

    const configured = integs?.asaas?.configured ?? false;
    const isSandbox = integs?.asaas?.sandbox ?? true;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{
                padding: '28px 40px 0',
                background: 'var(--paper)',
                borderBottom: '1px solid var(--line)',
                flexShrink: 0,
            }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div>
                        <h1 style={{
                            fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 400,
                            color: 'var(--ink-1)', letterSpacing: -.5, marginBottom: 6,
                        }}>
                            Asaas
                        </h1>
                        <p style={{ fontSize: 13.5, color: 'var(--ink-3)', margin: 0 }}>
                            Gestão de cobranças e clientes
                        </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        {configured ? (
                            <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                fontFamily: "'Geist Mono', monospace", fontSize: 10, letterSpacing: .8,
                                textTransform: 'uppercase', padding: '5px 12px', borderRadius: 20,
                                background: isSandbox ? 'var(--amber-soft)' : 'var(--accent-soft)',
                                color: isSandbox ? 'var(--amber)' : 'var(--accent-ink)',
                                border: `1px solid ${isSandbox ? 'var(--amber)' : 'var(--accent)'}`,
                            }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
                                {isSandbox ? 'Sandbox' : 'Produção'}
                            </span>
                        ) : (
                            <span style={{
                                fontFamily: "'Geist Mono', monospace", fontSize: 10.5, letterSpacing: .5,
                                color: 'var(--danger)', background: 'var(--danger-soft)',
                                border: '1px solid var(--danger)', padding: '5px 12px', borderRadius: 20,
                            }}>
                                Não configurado
                            </span>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 0 }}>
                    {([
                        { id: 'cobrancas', label: 'Cobranças' },
                        { id: 'clientes',  label: 'Clientes' },
                    ] as { id: Tab; label: string }[]).map(t => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            style={{
                                padding: '10px 20px', fontSize: 13, fontWeight: 500,
                                border: 'none', background: 'transparent',
                                color: tab === t.id ? 'var(--accent-ink)' : 'var(--ink-3)',
                                cursor: 'pointer', fontFamily: 'inherit',
                                borderBottom: `2px solid ${tab === t.id ? 'var(--accent)' : 'transparent'}`,
                                transition: 'all .12s',
                            }}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px' }}>
                {!configured ? (
                    <div style={{
                        padding: '48px 32px', textAlign: 'center',
                        border: '1px solid var(--line)', borderRadius: 14,
                        background: 'var(--paper)',
                    }}>
                        <div style={{ fontSize: 40, marginBottom: 16 }}>🔑</div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink-1)', marginBottom: 8 }}>
                            Asaas não configurado
                        </div>
                        <div style={{ fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.6, maxWidth: 400, margin: '0 auto 24px' }}>
                            Adicione sua API key em <strong>Integrações → Asaas</strong> para acessar a gestão financeira.
                        </div>
                        <a href="/integracoes" style={{ ...btnPrimary, textDecoration: 'none', display: 'inline-block' }}>
                            Ir para Integrações
                        </a>
                    </div>
                ) : tab === 'cobrancas' ? (
                    <CobrancasPanel isSandbox={isSandbox} />
                ) : (
                    <ClientesPanel />
                )}
            </div>
        </div>
    );
}
