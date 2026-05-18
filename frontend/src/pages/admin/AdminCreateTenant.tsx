import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAdminTheme } from '../../hooks/useAdminTheme';

function adminAxios() {
    const token = localStorage.getItem('adminAccessToken');
    return axios.create({ headers: { Authorization: `Bearer ${token}` } });
}

const PLANS = [
    { value: 'starter',    label: 'Starter — R$ 0,00' },
    { value: 'basic',      label: 'Basic — R$ 97,00' },
    { value: 'pro',        label: 'Pro — R$ 197,00' },
    { value: 'enterprise', label: 'Enterprise — Customizado' },
];

export function AdminCreateTenant() {
    const t = useAdminTheme();
    const [form, setForm] = useState({ companyName: '', agentName: '', email: '', password: '', planName: 'starter', priceMonthly: '0', trialDays: '14' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const navigate = useNavigate();

    function set(field: string, value: string) { setForm(f => ({ ...f, [field]: value })); }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(''); setSuccess(''); setLoading(true);
        try {
            const res = await axios.post('/auth/register', { companyName: form.companyName, agentName: form.agentName, email: form.email, password: form.password });
            const tenantId = res.data.tenant?.id;
            if (tenantId && (form.planName !== 'starter' || parseFloat(form.priceMonthly) > 0)) {
                const trialEndsAt = new Date();
                trialEndsAt.setDate(trialEndsAt.getDate() + parseInt(form.trialDays, 10));
                await adminAxios().patch(`/api/zeruela/tenants/${tenantId}/subscription`, { status: 'TRIAL', planName: form.planName, priceMonthly: parseFloat(form.priceMonthly), trialEndsAt: trialEndsAt.toISOString() });
            }
            setSuccess(`Tenant "${form.companyName}" criado com sucesso!`);
            setTimeout(() => navigate('/zeruela/tenants'), 1500);
        } catch (err: any) {
            setError(err.response?.data?.error ?? 'Erro ao criar tenant.');
        } finally { setLoading(false); }
    }

    const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 8, boxSizing: 'border-box', border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 13, fontFamily: 'inherit', outline: 'none' };

    function Field({ label, children }: { label: string; children: React.ReactNode }) {
        return (
            <div>
                <label style={{ fontSize: 12, color: t.textSub, display: 'block', marginBottom: 6 }}>{label}</label>
                {children}
            </div>
        );
    }

    function CardSection({ title, children }: { title: string; children: React.ReactNode }) {
        return (
            <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ fontSize: 10, color: t.textSub, fontFamily: "'Geist Mono', monospace", letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 2 }}>{title}</div>
                {children}
            </div>
        );
    }

    return (
        <div style={{ padding: 28, background: t.bg, minHeight: '100vh', color: t.text }}>
            <div style={{ marginBottom: 28, maxWidth: 560 }}>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, color: t.accent, marginBottom: 4 }}>Criar Tenant</div>
                <div style={{ fontSize: 12, color: t.textSub, fontFamily: "'Geist Mono', monospace" }}>Novo cliente na plataforma</div>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560 }}>
                <CardSection title="Dados do tenant">
                    <Field label="Nome da empresa"><input value={form.companyName} onChange={e => set('companyName', e.target.value)} required style={inputStyle} /></Field>
                    <Field label="Nome do agente"><input value={form.agentName} onChange={e => set('agentName', e.target.value)} required style={inputStyle} /></Field>
                </CardSection>

                <CardSection title="Acesso do owner">
                    <Field label="Email"><input type="email" value={form.email} onChange={e => set('email', e.target.value)} required style={inputStyle} /></Field>
                    <Field label="Senha inicial (mín. 8 caracteres)"><input type="password" value={form.password} onChange={e => set('password', e.target.value)} required minLength={8} style={inputStyle} /></Field>
                </CardSection>

                <CardSection title="Plano e cobrança">
                    <Field label="Plano">
                        <select value={form.planName} onChange={e => set('planName', e.target.value)} style={inputStyle}>
                            {PLANS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                        </select>
                    </Field>
                    <div style={{ display: 'flex', gap: 12 }}>
                        <Field label="Valor mensal (R$)"><input type="number" min="0" step="0.01" value={form.priceMonthly} onChange={e => set('priceMonthly', e.target.value)} style={inputStyle} /></Field>
                        <Field label="Dias de trial"><input type="number" min="0" max="365" value={form.trialDays} onChange={e => set('trialDays', e.target.value)} style={inputStyle} /></Field>
                    </div>
                </CardSection>

                {error && <div style={{ fontSize: 12, color: t.danger, background: `${t.danger}18`, borderRadius: 8, padding: '10px 14px' }}>{error}</div>}
                {success && <div style={{ fontSize: 12, color: t.success, background: `${t.success}18`, borderRadius: 8, padding: '10px 14px' }}>{success}</div>}

                <button type="submit" disabled={loading} style={{ padding: '11px', borderRadius: 8, border: 'none', background: loading ? t.border : t.accent, color: loading ? t.textSub : '#1a1510', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}>
                    {loading ? 'Criando tenant...' : 'Criar Tenant'}
                </button>
            </form>
        </div>
    );
}
