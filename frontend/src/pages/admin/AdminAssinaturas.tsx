import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAdminTheme } from '../../hooks/useAdminTheme';
import type { AdminTheme } from '../../hooks/useAdminTheme';

type SubStatus = 'TRIAL' | 'ACTIVE' | 'OVERDUE' | 'SUSPENDED' | 'CANCELLED';
type Adjustment = { id: string; type: 'discount' | 'increment'; value: number; description: string };
type Plan = { id: string; name: string; description: string | null; basePrice: number; billingCycle: string; isActive: boolean; _count?: { subscriptions: number } };
type SubRow = {
    id: string; name: string; slug: string;
    tenantUsers: { email: string }[];
    subscription: {
        id: string; status: SubStatus; planName: string; priceMonthly: number;
        planId: string | null;
        trialEndsAt: string | null; currentPeriodEnd: string | null;
        asaasCustomerId: string | null; asaasSubscriptionId: string | null;
    } | null;
};

function adminAxios() {
    const token = localStorage.getItem('adminAccessToken');
    return axios.create({ headers: { Authorization: `Bearer ${token}` } });
}

const STATUS_COLORS: Record<SubStatus, { text: string; label: string }> = {
    TRIAL:     { text: '#7b8fe8', label: 'Trial' },
    ACTIVE:    { text: '#5fb878', label: 'Ativo' },
    OVERDUE:   { text: '#d4a43a', label: 'Atrasado' },
    SUSPENDED: { text: '#c85a5a', label: 'Suspenso' },
    CANCELLED: { text: '#888',   label: 'Cancelado' },
};
const CYCLES: Record<string, string> = { monthly: 'Mensal', quarterly: 'Trimestral', yearly: 'Anual' };
const PLAN_NAMES = ['starter', 'basic', 'pro', 'enterprise'];

// ─── Modal Criar Plano ────────────────────────────────────────────────────────

function PlanModal({ plan, onClose, onSaved, t }: { plan: Plan | null; onClose: () => void; onSaved: () => void; t: AdminTheme }) {
    const [form, setForm] = useState({ name: plan?.name ?? '', description: plan?.description ?? '', basePrice: plan?.basePrice?.toString() ?? '0', billingCycle: plan?.billingCycle ?? 'monthly' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault(); setError(''); setLoading(true);
        try {
            if (plan) await adminAxios().patch(`/api/zeruela/plans/${plan.id}`, { ...form, basePrice: parseFloat(form.basePrice) });
            else await adminAxios().post('/api/zeruela/plans', { ...form, basePrice: parseFloat(form.basePrice) });
            onSaved(); onClose();
        } catch (err: any) { setError(err.response?.data?.error ?? 'Erro.'); }
        finally { setLoading(false); }
    }

    const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 8, boxSizing: 'border-box', border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 13, fontFamily: 'inherit', outline: 'none' };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.65)' }} onClick={onClose} />
            <div style={{ position: 'relative', background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 28, width: 440 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, color: t.accent }}>{plan ? 'Editar Plano' : 'Novo Plano'}</div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.textSub, fontSize: 18, cursor: 'pointer' }}>✕</button>
                </div>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                    {[
                        { label: 'Nome do plano *', key: 'name', type: 'text', placeholder: 'Ex: Pro Mensal' },
                        { label: 'Descrição', key: 'description', type: 'text', placeholder: 'Descreva o plano...' },
                        { label: 'Preço base (R$)', key: 'basePrice', type: 'number', placeholder: '0.00' },
                    ].map(f => (
                        <div key={f.key}>
                            <label style={{ fontSize: 12, color: t.textSub, display: 'block', marginBottom: 5 }}>{f.label}</label>
                            <input type={f.type} value={(form as any)[f.key]} onChange={e => setForm(x => ({ ...x, [f.key]: e.target.value }))} placeholder={f.placeholder} required={f.key === 'name'} min={f.type === 'number' ? 0 : undefined} step={f.type === 'number' ? '0.01' : undefined} style={inp} />
                        </div>
                    ))}
                    <div>
                        <label style={{ fontSize: 12, color: t.textSub, display: 'block', marginBottom: 5 }}>Ciclo de cobrança</label>
                        <select value={form.billingCycle} onChange={e => setForm(x => ({ ...x, billingCycle: e.target.value }))} style={inp}>
                            <option value="monthly">Mensal</option>
                            <option value="quarterly">Trimestral</option>
                            <option value="yearly">Anual</option>
                        </select>
                    </div>
                    {error && <div style={{ fontSize: 12, color: t.danger, background: `${t.danger}18`, borderRadius: 8, padding: '8px 12px' }}>{error}</div>}
                    <button type="submit" disabled={loading} style={{ padding: '10px', borderRadius: 8, border: 'none', background: loading ? t.border : t.accent, color: loading ? t.textSub : '#1a1510', fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}>
                        {loading ? 'Salvando...' : plan ? 'Salvar' : 'Criar Plano'}
                    </button>
                </form>
            </div>
        </div>
    );
}

function Lbl({ children, t }: { children: string; t: AdminTheme }) {
    return <label style={{ fontSize: 11, color: t.textSub, display: 'block', marginBottom: 5, fontFamily: "'Geist Mono', monospace", letterSpacing: 0.4, textTransform: 'uppercase' }}>{children}</label>;
}

function SubCard({ title, children, t }: { title: string; children: React.ReactNode; t: AdminTheme }) {
    return (
        <div style={{ border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', background: t.cardInner, borderBottom: `1px solid ${t.border}`, fontSize: 11, color: t.textSub, fontFamily: "'Geist Mono', monospace", letterSpacing: 0.8, textTransform: 'uppercase' }}>
                {title}
            </div>
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {children}
            </div>
        </div>
    );
}

function NovaCobrancaForm({ tenantId, effectivePrice, t, onCreated, onError }: {
    tenantId: string; effectivePrice: number; t: AdminTheme;
    onCreated: (charge: any) => void; onError: (msg: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const [form, setForm] = useState({ billingType: 'BOLETO', value: effectivePrice.toString(), dueDate: tomorrow.toISOString().slice(0, 10), description: '' });

    const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, boxSizing: 'border-box', border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 12, fontFamily: 'inherit', outline: 'none' };

    async function handleCreate() {
        setLoading(true);
        try {
            const r = await adminAxios().post(`/api/zeruela/tenants/${tenantId}/asaas/charge`, {
                billingType: form.billingType, value: parseFloat(form.value), dueDate: form.dueDate, description: form.description || undefined,
            });
            onCreated(r.data);
            setOpen(false);
        } catch (err: any) {
            onError(err.response?.data?.error ?? 'Erro ao criar cobrança.');
        } finally { setLoading(false); }
    }

    if (!open) return (
        <button type="button" onClick={() => setOpen(true)} style={{ width: '100%', padding: '8px', borderRadius: 8, border: `1px solid ${t.accent}44`, background: `${t.accent}0e`, color: t.accent, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
            + Nova cobrança avulsa
        </button>
    );

    return (
        <div style={{ background: t.cardInner, borderRadius: 10, padding: '12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11, color: t.textSub, fontFamily: "'Geist Mono', monospace" }}>Nova cobrança avulsa</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                    <div style={{ fontSize: 10, color: t.textSub, marginBottom: 4 }}>Tipo</div>
                    <select value={form.billingType} onChange={e => setForm(f => ({ ...f, billingType: e.target.value }))} style={inp}>
                        <option value="BOLETO">Boleto</option>
                        <option value="PIX">Pix</option>
                        <option value="CREDIT_CARD">Cartão</option>
                    </select>
                </div>
                <div>
                    <div style={{ fontSize: 10, color: t.textSub, marginBottom: 4 }}>Valor (R$)</div>
                    <input type="number" min="0.01" step="0.01" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} style={inp} />
                </div>
                <div>
                    <div style={{ fontSize: 10, color: t.textSub, marginBottom: 4 }}>Vencimento</div>
                    <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} style={inp} />
                </div>
                <div>
                    <div style={{ fontSize: 10, color: t.textSub, marginBottom: 4 }}>Descrição (opcional)</div>
                    <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Ex: Mensalidade maio" style={inp} />
                </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => setOpen(false)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1px solid ${t.border}`, background: 'transparent', color: t.textSub, fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
                <button type="button" onClick={handleCreate} disabled={loading || !form.value || !form.dueDate} style={{ flex: 2, padding: '8px', borderRadius: 8, border: 'none', background: t.accent, color: '#1a1510', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    {loading ? 'Gerando...' : `Gerar R$ ${parseFloat(form.value || '0').toFixed(2)}`}
                </button>
            </div>
        </div>
    );
}

// ─── Modal Editar Assinatura (com ajustes) ────────────────────────────────────

function EditSubModal({ row, plans, onClose, onSaved, t }: { row: SubRow; plans: Plan[]; onClose: () => void; onSaved: () => void; t: AdminTheme }) {
    const sub = row.subscription;
    const [form, setForm] = useState({
        status: sub?.status ?? 'TRIAL',
        planId: sub?.planId ?? '',
        trialEndsAt: sub?.trialEndsAt ? sub.trialEndsAt.slice(0, 10) : '',
        currentPeriodEnd: sub?.currentPeriodEnd ? sub.currentPeriodEnd.slice(0, 10) : '',
        asaasCustomerId: sub?.asaasCustomerId ?? '',
        asaasSubscriptionId: sub?.asaasSubscriptionId ?? '',
    });
    const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
    const [adjForm, setAdjForm] = useState({ type: 'increment' as 'discount' | 'increment', value: '', description: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [asaasLoading, setAsaasLoading] = useState<'customer' | 'subscription' | 'charges' | null>(null);
    const [asaasFeedback, setAsaasFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
    const [billingType, setBillingType] = useState('BOLETO');
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const [nextDueDate, setNextDueDate] = useState(tomorrow.toISOString().slice(0, 10));
    const [charges, setCharges] = useState<any[] | null>(null);

    useEffect(() => {
        adminAxios().get(`/api/zeruela/tenants/${row.id}/adjustments`)
            .then(r => setAdjustments(r.data))
            .catch(() => {});
    }, [row.id]);

    // Preço base vem do plano selecionado (readonly)
    const selectedPlan = plans.find(p => p.id === form.planId) ?? null;
    // basePrice = plano selecionado OU priceMonthly do banco (sem ajustes — armazenamos preço base, não efetivo)
    const basePrice = selectedPlan?.basePrice ?? (sub?.priceMonthly ?? 0);
    const totalIncrements = adjustments.filter(a => a.type === 'increment').reduce((s, a) => s + a.value, 0);
    const totalDiscounts = adjustments.filter(a => a.type === 'discount').reduce((s, a) => s + a.value, 0);
    const effectivePrice = basePrice + totalIncrements - totalDiscounts;

    async function handleSave(e: React.FormEvent) {
        e.preventDefault(); setError(''); setLoading(true);
        try {
            await adminAxios().patch(`/api/zeruela/tenants/${row.id}/subscription`, {
                status: form.status,
                planId: form.planId || null,
                planName: selectedPlan?.name ?? 'starter',
                // Salva o preço EFETIVO (base ± ajustes) — base sempre relida do plano na reabertura via planId
                priceMonthly: effectivePrice,
                trialEndsAt: form.trialEndsAt || null,
                currentPeriodEnd: form.currentPeriodEnd || null,
                asaasCustomerId: form.asaasCustomerId || null,
                asaasSubscriptionId: form.asaasSubscriptionId || null,
            });
            onSaved(); onClose();
        } catch (err: any) { setError(err.response?.data?.error ?? 'Erro.'); }
        finally { setLoading(false); }
    }

    async function addAdj() {
        if (!adjForm.value || !adjForm.description) return;
        const res = await adminAxios().post(`/api/zeruela/tenants/${row.id}/adjustments`, {
            type: adjForm.type, value: parseFloat(adjForm.value), description: adjForm.description,
        });
        setAdjustments(a => [...a, res.data]);
        setAdjForm({ type: 'increment', value: '', description: '' });
    }

    async function removeAdj(id: string) {
        await adminAxios().delete(`/api/zeruela/adjustments/${id}`);
        setAdjustments(a => a.filter(x => x.id !== id));
    }

    async function toggleAdj(id: string, currentType: 'discount' | 'increment') {
        const newType = currentType === 'discount' ? 'increment' : 'discount';
        const res = await adminAxios().patch(`/api/zeruela/adjustments/${id}`, { type: newType });
        setAdjustments(a => a.map(x => x.id === id ? { ...x, type: newType } : x));
    }

    const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 8, boxSizing: 'border-box', border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 13, fontFamily: 'inherit', outline: 'none' };
    const sml: React.CSSProperties = { padding: '8px 10px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 12, fontFamily: 'inherit', outline: 'none' };

    const STATUS_OPTS = [
        { value: 'TRIAL', label: 'Trial', color: '#7b8fe8' },
        { value: 'ACTIVE', label: 'Ativo', color: '#5fb878' },
        { value: 'OVERDUE', label: 'Atrasado', color: '#d4a43a' },
        { value: 'SUSPENDED', label: 'Suspenso', color: '#c85a5a' },
        { value: 'CANCELLED', label: 'Cancelado', color: '#888' },
    ];

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.7)' }} onClick={onClose} />
            <div style={{ position: 'relative', background: t.card, border: `1px solid ${t.border}`, borderRadius: 18, width: '100%', maxWidth: 1100, maxHeight: '100%', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,.4)' }}>

                {/* Header */}
                <div style={{ padding: '22px 28px 18px', borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, color: t.accent, marginBottom: 3 }}>Editar Assinatura</div>
                            <div style={{ fontSize: 12, color: t.textSub }}>{row.name} <span style={{ color: t.border }}>·</span> {row.tenantUsers[0]?.email}</div>
                        </div>
                        <button onClick={onClose} style={{ background: t.cardInner, border: `1px solid ${t.border}`, borderRadius: 8, color: t.textSub, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>✕</button>
                    </div>
                </div>

                <form
                    onSubmit={handleSave}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
                            e.preventDefault();
                            const inputs = Array.from(e.currentTarget.querySelectorAll('input:not([disabled]), select:not([disabled])')) as HTMLElement[];
                            const idx = inputs.indexOf(e.target as HTMLElement);
                            if (idx >= 0 && idx < inputs.length - 1) inputs[idx + 1].focus();
                        }
                    }}
                    style={{ padding: '20px 28px 28px', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 16 }}
                >

                    {/* Status — largura total */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {STATUS_OPTS.map(opt => {
                            const active = form.status === opt.value;
                            return (
                                <button key={opt.value} type="button" onClick={() => setForm(f => ({ ...f, status: opt.value as SubStatus }))} style={{
                                    padding: '8px 20px', borderRadius: 20, fontSize: 13, fontWeight: active ? 600 : 400,
                                    border: `1px solid ${active ? opt.color : t.border}`,
                                    background: active ? `${opt.color}22` : 'transparent',
                                    color: active ? opt.color : t.textSub, cursor: 'pointer', fontFamily: 'inherit',
                                }}>{active ? '● ' : '○ '}{opt.label}</button>
                            );
                        })}
                    </div>

                    {/* Corpo em 2 colunas */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, flex: 1 }}>

                        {/* Coluna esquerda: Plano */}
                        <SubCard t={t} title="Plano">
                            <div>
                                <Lbl t={t}>Plano</Lbl>
                                <select value={form.planId} onChange={e => setForm(f => ({ ...f, planId: e.target.value }))} style={inp}>
                                    <option value="">Sem plano vinculado</option>
                                    {plans.filter(p => p.isActive).map(p => (
                                        <option key={p.id} value={p.id}>{p.name} — R$ {p.basePrice.toFixed(2)}/{CYCLES[p.billingCycle] ?? p.billingCycle}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Preços */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div>
                                    <Lbl t={t}>Preço base</Lbl>
                                    <div style={{ padding: '9px 12px', borderRadius: 8, background: t.cardInner, border: `1px solid ${t.border}`, fontSize: 14, color: t.textMuted, fontFamily: "'Geist Mono', monospace" }}>
                                        {selectedPlan ? `R$ ${selectedPlan.basePrice.toFixed(2)}` : '—'}
                                    </div>
                                </div>
                                <div>
                                    <Lbl t={t}>Preço efetivo cobrado</Lbl>
                                    <div style={{ padding: '9px 12px', borderRadius: 8, background: `${t.accent}18`, border: `1px solid ${t.accent}44`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: 11, color: t.textSub }}>
                                            {totalIncrements > 0 && <span style={{ color: '#5fb878' }}>+{totalIncrements.toFixed(2)} </span>}
                                            {totalDiscounts > 0 && <span style={{ color: '#c85a5a' }}>-{totalDiscounts.toFixed(2)} </span>}
                                        </span>
                                        <span style={{ fontFamily: "'Fraunces', serif", fontSize: 18, color: t.accent, fontWeight: 600 }}>R$ {effectivePrice.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>

                            <div style={{ height: 1, background: t.border }} />

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div>
                                    <Lbl t={t}>Trial termina em</Lbl>
                                    <input type="date" value={form.trialEndsAt} onChange={e => setForm(f => ({ ...f, trialEndsAt: e.target.value }))} style={inp} />
                                </div>
                                <div>
                                    <Lbl t={t}>Período termina em</Lbl>
                                    <input type="date" value={form.currentPeriodEnd} onChange={e => setForm(f => ({ ...f, currentPeriodEnd: e.target.value }))} style={inp} />
                                </div>
                            </div>

                            <div style={{ height: 1, background: t.border }} />

                            {/* Asaas integração */}
                            <div style={{ background: t.cardInner, borderRadius: 10, padding: '14px' }}>
                                <div style={{ fontSize: 10, color: t.textSub, fontFamily: "'Geist Mono', monospace", letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 }}>Asaas — Cobrança automática</div>

                                {/* Status dos IDs */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                                    <div style={{ fontSize: 12, padding: '8px 12px', borderRadius: 8, background: t.card, border: `1px solid ${form.asaasCustomerId ? `${t.success}44` : t.border}` }}>
                                        <div style={{ fontSize: 10, color: t.textSub, marginBottom: 3 }}>Cliente</div>
                                        <div style={{ color: form.asaasCustomerId ? t.success : t.textSub, fontFamily: "'Geist Mono', monospace", fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {form.asaasCustomerId || '— não criado'}
                                        </div>
                                    </div>
                                    <div style={{ fontSize: 12, padding: '8px 12px', borderRadius: 8, background: t.card, border: `1px solid ${form.asaasSubscriptionId ? `${t.success}44` : t.border}` }}>
                                        <div style={{ fontSize: 10, color: t.textSub, marginBottom: 3 }}>Assinatura</div>
                                        <div style={{ color: form.asaasSubscriptionId ? t.success : t.textSub, fontFamily: "'Geist Mono', monospace", fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {form.asaasSubscriptionId || '— não criada'}
                                        </div>
                                    </div>
                                </div>

                                {/* Botão criar cliente */}
                                {!form.asaasCustomerId && (
                                    <button
                                        type="button"
                                        disabled={asaasLoading === 'customer'}
                                        onClick={async () => {
                                            setAsaasLoading('customer'); setAsaasFeedback(null);
                                            try {
                                                const r = await adminAxios().post(`/api/zeruela/tenants/${row.id}/asaas/customer`);
                                                setForm(f => ({ ...f, asaasCustomerId: r.data.asaasCustomerId }));
                                                setAsaasFeedback({ ok: true, msg: 'Cliente criado no Asaas.' });
                                            } catch (err: any) {
                                                setAsaasFeedback({ ok: false, msg: err.response?.data?.error ?? 'Erro ao criar cliente.' });
                                            } finally { setAsaasLoading(null); }
                                        }}
                                        style={{ width: '100%', padding: '9px', borderRadius: 8, border: `1px solid ${t.accent}44`, background: `${t.accent}18`, color: t.accent, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 8 }}
                                    >
                                        {asaasLoading === 'customer' ? 'Criando cliente...' : '+ Criar cliente no Asaas'}
                                    </button>
                                )}

                                {/* Criar assinatura — só disponível após ter customer */}
                                {form.asaasCustomerId && !form.asaasSubscriptionId && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                            <div>
                                                <div style={{ fontSize: 11, color: t.textSub, marginBottom: 5 }}>Tipo de cobrança</div>
                                                <select value={billingType} onChange={e => setBillingType(e.target.value)} style={{ ...inp, fontSize: 12 }}>
                                                    <option value="BOLETO">Boleto</option>
                                                    <option value="PIX">Pix</option>
                                                    <option value="CREDIT_CARD">Cartão de crédito</option>
                                                </select>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 11, color: t.textSub, marginBottom: 5 }}>Primeiro vencimento</div>
                                                <input type="date" value={nextDueDate} onChange={e => setNextDueDate(e.target.value)} style={{ ...inp, fontSize: 12 }} />
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            disabled={asaasLoading === 'subscription' || !effectivePrice}
                                            onClick={async () => {
                                                setAsaasLoading('subscription'); setAsaasFeedback(null);
                                                try {
                                                    const r = await adminAxios().post(`/api/zeruela/tenants/${row.id}/asaas/subscription`, { billingType, nextDueDate });
                                                    setForm(f => ({ ...f, asaasSubscriptionId: r.data.asaasSubscriptionId }));
                                                    setAsaasFeedback({ ok: true, msg: 'Assinatura criada no Asaas. Status atualizado para Ativo.' });
                                                } catch (err: any) {
                                                    setAsaasFeedback({ ok: false, msg: err.response?.data?.error ?? 'Erro ao criar assinatura.' });
                                                } finally { setAsaasLoading(null); }
                                            }}
                                            style={{ width: '100%', padding: '9px', borderRadius: 8, border: 'none', background: effectivePrice ? t.accent : t.border, color: effectivePrice ? '#1a1510' : t.textSub, fontSize: 13, fontWeight: 600, cursor: effectivePrice ? 'pointer' : 'not-allowed' }}
                                        >
                                            {asaasLoading === 'subscription' ? 'Criando assinatura...' : `+ Criar assinatura — R$ ${effectivePrice.toFixed(2)}`}
                                        </button>
                                    </div>
                                )}

                                {/* Feedback */}
                                {asaasFeedback && (
                                    <div style={{ marginTop: 8, fontSize: 12, color: asaasFeedback.ok ? t.success : t.danger, background: asaasFeedback.ok ? `${t.success}18` : `${t.danger}18`, borderRadius: 8, padding: '8px 12px' }}>
                                        {asaasFeedback.msg}
                                    </div>
                                )}

                                {/* Cobranças geradas */}
                                {(form.asaasCustomerId || form.asaasSubscriptionId) && (
                                    <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 8 }}>

                                        {/* Nova cobrança avulsa */}
                                        <NovaCobrancaForm tenantId={row.id} effectivePrice={effectivePrice} t={t}
                                            onCreated={(charge) => setCharges(prev => prev ? [charge, ...prev] : [charge])}
                                            onError={(msg) => setAsaasFeedback({ ok: false, msg })}
                                        />

                                        <button
                                            type="button"
                                            disabled={asaasLoading === 'charges'}
                                            onClick={async () => {
                                                setAsaasLoading('charges');
                                                try {
                                                    const r = await adminAxios().get(`/api/zeruela/tenants/${row.id}/asaas/charges`);
                                                    setCharges(r.data?.data ?? r.data ?? []);
                                                } catch (err: any) {
                                                    setAsaasFeedback({ ok: false, msg: err.response?.data?.error ?? 'Erro ao buscar cobranças.' });
                                                } finally { setAsaasLoading(null); }
                                            }}
                                            style={{ width: '100%', padding: '8px', borderRadius: 8, border: `1px solid ${t.border}`, background: 'transparent', color: t.textSub, fontSize: 12, cursor: 'pointer' }}
                                        >
                                            {asaasLoading === 'charges' ? 'Buscando...' : '↻ Ver cobranças geradas'}
                                        </button>

                                        {charges !== null && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                {charges.length === 0 ? (
                                                    <div style={{ fontSize: 12, color: t.textSub, textAlign: 'center', padding: '8px 0' }}>Nenhuma cobrança encontrada.</div>
                                                ) : charges.map((c: any) => {
                                                    const STATUS_MAP: Record<string, { label: string; color: string }> = {
                                                        PENDING:   { label: 'Pendente', color: '#d4a43a' },
                                                        RECEIVED:  { label: 'Pago', color: '#5fb878' },
                                                        CONFIRMED: { label: 'Confirmado', color: '#5fb878' },
                                                        OVERDUE:   { label: 'Vencida', color: '#c85a5a' },
                                                        REFUNDED:  { label: 'Estornado', color: '#888' },
                                                        CANCELLED: { label: 'Cancelada', color: '#555' },
                                                    };
                                                    const st = STATUS_MAP[c.status] ?? { label: c.status, color: t.textSub };
                                                    const canCancel = ['PENDING', 'OVERDUE'].includes(c.status);
                                                    return (
                                                        <div key={c.id} style={{ background: t.card, borderRadius: 8, padding: '8px 12px', border: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <div style={{ fontSize: 12, color: t.textMuted, fontWeight: 500 }}>
                                                                    R$ {Number(c.value).toFixed(2)}
                                                                    <span style={{ marginLeft: 8, fontSize: 10, color: st.color }}>{st.label}</span>
                                                                </div>
                                                                <div style={{ fontSize: 11, color: t.textSub }}>
                                                                    Venc: {c.dueDate} · {c.billingType}
                                                                </div>
                                                            </div>
                                                            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                                                {(c.invoiceUrl || c.bankSlipUrl) && (
                                                                    <a href={c.invoiceUrl ?? c.bankSlipUrl} target="_blank" rel="noopener noreferrer"
                                                                        style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: `1px solid ${t.accent}44`, color: t.accent, textDecoration: 'none' }}>
                                                                        Link
                                                                    </a>
                                                                )}
                                                                {canCancel && (
                                                                    <button type="button" onClick={async () => {
                                                                        if (!confirm('Cancelar esta cobrança no Asaas?')) return;
                                                                        try {
                                                                            await adminAxios().delete(`/api/zeruela/asaas/charges/${c.id}`);
                                                                            setCharges(prev => prev ? prev.map(x => x.id === c.id ? { ...x, status: 'CANCELLED' } : x) : prev);
                                                                        } catch (err: any) {
                                                                            setAsaasFeedback({ ok: false, msg: err.response?.data?.error ?? 'Erro ao cancelar.' });
                                                                        }
                                                                    }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: `1px solid ${t.danger}44`, background: 'transparent', color: t.danger, cursor: 'pointer' }}>
                                                                        Cancelar
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </SubCard>

                        {/* Coluna direita: Descontos e Acréscimos */}
                        <SubCard t={t} title="Descontos e Acréscimos">
                            {adjustments.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {adjustments.map(a => (
                                        <div key={a.id} onContextMenu={(e) => { e.preventDefault(); toggleAdj(a.id, a.type); }} style={{
                                            display: 'grid', gridTemplateColumns: 'auto auto 1fr auto',
                                            alignItems: 'center', gap: 8, cursor: 'context-menu',
                                            background: t.cardInner, borderRadius: 8, padding: '8px 12px',
                                            border: `1px solid ${a.type === 'discount' ? '#c85a5a44' : '#5fb87844'}`,
                                        }}>
                                            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: a.type === 'discount' ? '#c85a5a22' : '#5fb87822', color: a.type === 'discount' ? '#c85a5a' : '#5fb878', fontFamily: "'Geist Mono', monospace", textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                                                {a.type === 'discount' ? '▼ Desc' : '▲ Acrés'}
                                            </span>
                                            <span style={{ fontSize: 14, color: a.type === 'discount' ? '#c85a5a' : '#5fb878', fontFamily: "'Fraunces', serif", whiteSpace: 'nowrap', fontWeight: 600 }}>
                                                {a.type === 'discount' ? '−' : '+'}R$ {a.value.toFixed(2)}
                                            </span>
                                            <span style={{ fontSize: 12, color: t.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.description}</span>
                                            <button type="button" onClick={() => removeAdj(a.id)} style={{ background: 'none', border: 'none', color: t.textSub, cursor: 'pointer', fontSize: 15, padding: 0 }}>✕</button>
                                        </div>
                                    ))}
                                    <div style={{ height: 1, background: t.border }} />
                                </div>
                            )}

                            <div style={{ background: t.cardInner, borderRadius: 10, padding: '14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <div style={{ fontSize: 11, color: t.textSub, fontFamily: "'Geist Mono', monospace" }}>Novo ajuste</div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button type="button" onClick={() => setAdjForm(f => ({ ...f, type: 'increment' }))} style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1px solid ${adjForm.type === 'increment' ? '#5fb878' : t.border}`, background: adjForm.type === 'increment' ? '#5fb87822' : 'transparent', color: adjForm.type === 'increment' ? '#5fb878' : t.textSub, fontSize: 12, cursor: 'pointer', fontWeight: adjForm.type === 'increment' ? 600 : 400 }}>▲ Acréscimo</button>
                                    <button type="button" onClick={() => setAdjForm(f => ({ ...f, type: 'discount' }))} style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1px solid ${adjForm.type === 'discount' ? '#c85a5a' : t.border}`, background: adjForm.type === 'discount' ? '#c85a5a22' : 'transparent', color: adjForm.type === 'discount' ? '#c85a5a' : t.textSub, fontSize: 12, cursor: 'pointer', fontWeight: adjForm.type === 'discount' ? 600 : 400 }}>▼ Desconto</button>
                                </div>
                                <input type="number" min="0" step="0.01" placeholder="Valor (R$)" value={adjForm.value} onChange={e => setAdjForm(f => ({ ...f, value: e.target.value }))} style={sml} />
                                <input placeholder="Descrição (ex: Acréscimo...)" value={adjForm.description} onChange={e => setAdjForm(f => ({ ...f, description: e.target.value }))} style={sml} />
                                <button type="button" onClick={addAdj} disabled={!adjForm.value || !adjForm.description} style={{ padding: '9px', borderRadius: 8, border: 'none', background: adjForm.value && adjForm.description ? t.accent : t.border, color: adjForm.value && adjForm.description ? '#1a1510' : t.textSub, fontSize: 13, fontWeight: 600, cursor: adjForm.value && adjForm.description ? 'pointer' : 'not-allowed' }}>
                                    Adicionar
                                </button>
                            </div>
                        </SubCard>
                    </div>

                    {error && <div style={{ fontSize: 12, color: t.danger, background: `${t.danger}18`, borderRadius: 8, padding: '11px 16px' }}>{error}</div>}

                    <button type="submit" disabled={loading} style={{ padding: '13px', borderRadius: 10, border: 'none', background: loading ? t.border : t.accent, color: loading ? t.textSub : '#1a1510', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}>
                        {loading ? 'Salvando...' : 'Salvar assinatura'}
                    </button>
                </form>
            </div>
        </div>
    );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function AdminAssinaturas() {
    const t = useAdminTheme();
    const [rows, setRows] = useState<SubRow[]>([]);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<SubRow | null>(null);
    const [planModal, setPlanModal] = useState<Plan | 'create' | null>(null);
    const [filterStatus, setFilterStatus] = useState<SubStatus | ''>('');
    const [search, setSearch] = useState('');
    const [tab, setTab] = useState<'assinaturas' | 'planos'>('assinaturas');
    const navigate = useNavigate();

    const load = useCallback(async () => {
        try {
            const [tenants, plansData] = await Promise.all([
                adminAxios().get('/api/zeruela/tenants').then(r => r.data),
                adminAxios().get('/api/zeruela/plans').then(r => r.data),
            ]);
            setRows(tenants);
            setPlans(plansData);
        } catch { navigate('/zeruela/login'); }
        finally { setLoading(false); }
    }, [navigate]);

    useEffect(() => { load(); }, [load]);

    const filteredRows = rows.filter(r => {
        const q = search.toLowerCase();
        const matchSearch = !q || r.name.toLowerCase().includes(q) || (r.tenantUsers[0]?.email ?? '').toLowerCase().includes(q);
        const matchStatus = !filterStatus || r.subscription?.status === filterStatus;
        return matchSearch && matchStatus;
    });

    const mrr = rows.filter(r => r.subscription?.status === 'ACTIVE').reduce((acc, r) => acc + (r.subscription?.priceMonthly ?? 0), 0);
    const overdue = rows.filter(r => r.subscription?.status === 'OVERDUE');

    const inp: React.CSSProperties = { padding: '8px 12px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 12, outline: 'none' };

    return (
        <div style={{ padding: 28, background: t.bg, minHeight: '100vh', color: t.text }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, color: t.accent, marginBottom: 4 }}>Assinaturas</div>
                    <div style={{ fontSize: 12, color: t.textSub, fontFamily: "'Geist Mono', monospace" }}>Clique em qualquer cliente para configurar a assinatura</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    {tab === 'planos' && (
                        <button onClick={() => setPlanModal('create')} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: t.accent, color: '#1a1510', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                            + Criar Plano
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: `1px solid ${t.border}`, paddingBottom: 0 }}>
                {[{ key: 'assinaturas', label: 'Assinaturas' }, { key: 'planos', label: `Planos (${plans.length})` }].map(tb => (
                    <button key={tb.key} onClick={() => setTab(tb.key as any)} style={{
                        padding: '8px 18px', borderRadius: '8px 8px 0 0', fontSize: 13, border: 'none',
                        background: tab === tb.key ? t.card : 'transparent',
                        color: tab === tb.key ? t.accent : t.textSub,
                        borderBottom: tab === tb.key ? `2px solid ${t.accent}` : '2px solid transparent',
                        cursor: 'pointer', fontFamily: 'inherit',
                    }}>{tb.label}</button>
                ))}
            </div>

            {tab === 'assinaturas' && <>
                {/* Summary */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                    {[
                        { label: 'MRR', value: `R$ ${mrr.toFixed(2)}`, accent: t.accent },
                        { label: 'Ativos', value: rows.filter(r => r.subscription?.status === 'ACTIVE').length, accent: t.success },
                        { label: 'Trial', value: rows.filter(r => r.subscription?.status === 'TRIAL').length, accent: '#7b8fe8' },
                        { label: 'Atrasados', value: overdue.length, accent: overdue.length > 0 ? t.danger : undefined },
                        { label: 'Suspensos', value: rows.filter(r => r.subscription?.status === 'SUSPENDED').length },
                    ].map(c => (
                        <div key={c.label} style={{ flex: 1, minWidth: 110, background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: '14px 18px' }}>
                            <div style={{ fontSize: 10, color: t.textSub, fontFamily: "'Geist Mono', monospace", letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>{c.label}</div>
                            <div style={{ fontSize: 24, color: c.accent ?? t.text, fontFamily: "'Fraunces', serif", lineHeight: 1 }}>{c.value}</div>
                        </div>
                    ))}
                </div>

                {overdue.length > 0 && (
                    <div style={{ background: `${t.danger}18`, border: `1px solid ${t.danger}33`, borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
                        <div style={{ fontSize: 12, color: t.danger, fontWeight: 500, marginBottom: 4 }}>⚠ {overdue.length} cliente(s) em atraso</div>
                        {overdue.map(r => <button key={r.id} onClick={() => setEditing(r)} style={{ fontSize: 11, color: t.danger, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'block', marginTop: 2, textDecoration: 'underline' }}>{r.name}</button>)}
                    </div>
                )}

                <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                    <input placeholder="Buscar cliente ou email..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, flex: 1 }} />
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} style={inp}>
                        <option value="">Todos</option>
                        <option value="TRIAL">Trial</option>
                        <option value="ACTIVE">Ativos</option>
                        <option value="OVERDUE">Atrasados</option>
                        <option value="SUSPENDED">Suspensos</option>
                        <option value="CANCELLED">Cancelados</option>
                    </select>
                    <button onClick={load} style={{ ...inp, cursor: 'pointer', fontSize: 14 }}>↻</button>
                </div>

                <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'hidden' }}>
                    {loading ? <div style={{ padding: 32, textAlign: 'center', color: t.textSub }}>Carregando...</div> : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                                    {['Cliente', 'Status', 'Plano', 'Valor/mês', 'Renova em'].map(h => (
                                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, color: t.textSub, fontFamily: "'Geist Mono', monospace", letterSpacing: 0.8, textTransform: 'uppercase', fontWeight: 500 }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRows.map(row => {
                                    const sub = row.subscription;
                                    const sc = sub ? STATUS_COLORS[sub.status] : null;
                                    const renewDate = sub?.trialEndsAt ?? sub?.currentPeriodEnd;
                                    const planName = plans.find(p => p.id === sub?.planId)?.name ?? sub?.planName ?? null;
                                    return (
                                        <tr key={row.id} onClick={() => setEditing(row)} style={{ cursor: 'pointer', borderBottom: `1px solid ${t.borderSub}` }}>
                                            <td style={{ padding: '11px 16px' }}>
                                                <div style={{ fontSize: 13, color: t.textMuted, fontWeight: 500 }}>{row.name}</div>
                                                <div style={{ fontSize: 10, color: t.textSub, fontFamily: "'Geist Mono', monospace" }}>{row.tenantUsers[0]?.email ?? '—'}</div>
                                            </td>
                                            <td style={{ padding: '11px 16px' }}>
                                                {sc ? <span style={{ fontSize: 11, color: sc.text }}>{sc.label}</span> : <span style={{ fontSize: 11, color: t.textSub }}>Sem assinatura</span>}
                                            </td>
                                            <td style={{ padding: '11px 16px', fontSize: 12, color: planName ? t.textMuted : t.textSub }}>
                                                {planName ?? '—'}
                                            </td>
                                            <td style={{ padding: '11px 16px', fontSize: 13, color: t.accent, fontFamily: "'Fraunces', serif" }}>
                                                {sub?.priceMonthly != null && sub.priceMonthly > 0 ? `R$ ${sub.priceMonthly.toFixed(2)}` : '—'}
                                            </td>
                                            <td style={{ padding: '11px 16px', fontSize: 11, color: t.textSub }}>
                                                {renewDate ? new Date(renewDate).toLocaleDateString('pt-BR') : '—'}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredRows.length === 0 && <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: t.textSub }}>Nenhum resultado.</td></tr>}
                            </tbody>
                        </table>
                    )}
                </div>
            </>}

            {tab === 'planos' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {loading ? <div style={{ color: t.textSub }}>Carregando...</div> : plans.length === 0 ? (
                        <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 48, textAlign: 'center' }}>
                            <div style={{ fontSize: 14, color: t.textSub, marginBottom: 12 }}>Nenhum plano criado ainda.</div>
                            <button onClick={() => setPlanModal('create')} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: t.accent, color: '#1a1510', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Criar primeiro plano</button>
                        </div>
                    ) : plans.map(p => (
                        <div key={p.id} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 20 }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                                    <span style={{ fontFamily: "'Fraunces', serif", fontSize: 17, color: p.isActive ? t.textMuted : t.textSub }}>{p.name}</span>
                                    {!p.isActive && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: `${t.danger}22`, color: t.danger, fontFamily: "'Geist Mono', monospace" }}>Inativo</span>}
                                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: `${t.accent}22`, color: t.accent, fontFamily: "'Geist Mono', monospace" }}>{CYCLES[p.billingCycle] ?? p.billingCycle}</span>
                                </div>
                                {p.description && <div style={{ fontSize: 12, color: t.textSub, marginBottom: 4 }}>{p.description}</div>}
                                <div style={{ fontSize: 11, color: t.textSub, fontFamily: "'Geist Mono', monospace" }}>{p._count?.subscriptions ?? 0} cliente(s) vinculado(s)</div>
                            </div>
                            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 24, color: t.accent }}>R$ {p.basePrice.toFixed(2)}</div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={() => setPlanModal(p)} style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, border: `1px solid ${t.border}`, background: 'transparent', color: t.accent, cursor: 'pointer' }}>Editar</button>
                                <button onClick={async () => { if (!confirm('Excluir plano?')) return; await adminAxios().delete(`/api/zeruela/plans/${p.id}`); load(); }} style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, border: `1px solid ${t.danger}44`, background: 'transparent', color: t.danger, cursor: 'pointer' }}>Excluir</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {editing && <EditSubModal row={editing} plans={plans} onClose={() => setEditing(null)} onSaved={load} t={t} />}
            {planModal && <PlanModal plan={planModal === 'create' ? null : planModal} onClose={() => setPlanModal(null)} onSaved={load} t={t} />}
        </div>
    );
}
