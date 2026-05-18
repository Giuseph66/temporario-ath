import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAdminTheme } from '../../hooks/useAdminTheme';
import type { AdminTheme } from '../../hooks/useAdminTheme';

function adminAxios() {
    const token = localStorage.getItem('adminAccessToken');
    return axios.create({ headers: { Authorization: `Bearer ${token}` } });
}

type Cfg = {
    asaasApiKey: string | null; asaasBaseUrl: string; asaasWebhookSecret: string | null;
    billingEnabled: boolean; billingDayOfMonth: number; billingDueDaysAhead: number;
    billingBillingType: string; billingWhatsappTemplate: string | null;
    billingEvolutionInstance: string | null; billingEvolutionApiKey: string | null; billingEvolutionBaseUrl: string | null;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ title, status, children, t }: {
    title: string; status?: { ok: boolean; label: string };
    children: React.ReactNode; t: AdminTheme;
}) {
    return (
        <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '16px 22px', borderBottom: `1px solid ${t.border}`,
            }}>
                <span style={{ fontFamily: "'Fraunces', serif", fontSize: 16, color: t.textMuted }}>{title}</span>
                {status && (
                    <span style={{
                        fontSize: 11, padding: '3px 10px', borderRadius: 20,
                        background: status.ok ? `${t.success}22` : `${t.textSub}18`,
                        color: status.ok ? t.success : t.textSub,
                        fontFamily: "'Geist Mono', monospace", letterSpacing: 0.5,
                    }}>
                        {status.ok ? '● ' : '○ '}{status.label}
                    </span>
                )}
            </div>
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                {children}
            </div>
        </div>
    );
}

function FieldRow({ label, hint, children, t }: { label: string; hint?: string; children: React.ReactNode; t: AdminTheme }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24, alignItems: 'flex-start' }}>
            <div>
                <div style={{ fontSize: 13, color: t.textMuted, fontWeight: 500, marginBottom: 3 }}>{label}</div>
                {hint && <div style={{ fontSize: 11, color: t.textSub, lineHeight: 1.4 }}>{hint}</div>}
            </div>
            <div>{children}</div>
        </div>
    );
}

function SecretInput({ value, onChange, placeholder, t }: { value: string; onChange: (v: string) => void; placeholder?: string; t: AdminTheme }) {
    const [show, setShow] = useState(false);
    return (
        <div style={{ position: 'relative' }}>
            <input
                type={show ? 'text' : 'password'} value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                style={{
                    width: '100%', padding: '9px 40px 9px 12px', borderRadius: 8, boxSizing: 'border-box',
                    border: `1px solid ${t.border}`, background: t.inputBg,
                    color: t.text, fontSize: 13, fontFamily: 'inherit', outline: 'none',
                }}
            />
            <button type="button" onClick={() => setShow(s => !s)} style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: t.textSub, padding: 0, display: 'flex',
            }}>
                {show ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                    </svg>
                ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                )}
            </button>
        </div>
    );
}

function CopyField({ value, t }: { value: string; t: AdminTheme }) {
    const [copied, setCopied] = useState(false);
    function copy() {
        navigator.clipboard.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
    }
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
                flex: 1, padding: '9px 12px', borderRadius: 8,
                border: `1px solid ${t.border}`, background: t.cardInner,
                fontFamily: "'Geist Mono', monospace", fontSize: 12, color: t.accent,
                wordBreak: 'break-all',
            }}>
                {value}
            </div>
            <button type="button" onClick={copy} style={{
                padding: '9px 14px', borderRadius: 8, border: `1px solid ${t.border}`,
                background: t.inputBg, color: copied ? t.success : t.textSub,
                fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
            }}>
                {copied ? '✓ Copiado' : 'Copiar'}
            </button>
        </div>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function AdminConfig() {
    const t = useAdminTheme();
    const navigate = useNavigate();
    const [cfg, setCfg] = useState<Cfg>({ asaasApiKey: null, asaasBaseUrl: 'https://sandbox.asaas.com/api/v3', asaasWebhookSecret: null, billingEnabled: false, billingDayOfMonth: 1, billingDueDaysAhead: 5, billingBillingType: 'PIX', billingWhatsappTemplate: null, billingEvolutionInstance: null, billingEvolutionApiKey: null, billingEvolutionBaseUrl: null });
    const [apiKey, setApiKey] = useState('');
    const [webhookSecret, setWebhookSecret] = useState('');
    const [baseUrl, setBaseUrl] = useState('https://sandbox.asaas.com/api/v3');
    const [billing, setBilling] = useState({ enabled: false, dayOfMonth: 1, dueDaysAhead: 5, billingType: 'PIX', template: '', evolutionInstance: '', evolutionApiKey: '', evolutionBaseUrl: '' });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

    useEffect(() => {
        adminAxios().get('/api/zeruela/config')
            .then(r => {
                const d = r.data;
                setCfg(d);
                setBaseUrl(d.asaasBaseUrl ?? 'https://sandbox.asaas.com/api/v3');
                setBilling({
                    enabled: d.billingEnabled ?? false,
                    dayOfMonth: d.billingDayOfMonth ?? 1,
                    dueDaysAhead: d.billingDueDaysAhead ?? 5,
                    billingType: d.billingBillingType ?? 'PIX',
                    template: d.billingWhatsappTemplate ?? '',
                    evolutionInstance: d.billingEvolutionInstance ?? '',
                    evolutionApiKey: '',
                    evolutionBaseUrl: d.billingEvolutionBaseUrl ?? '',
                });
            })
            .catch(() => navigate('/zeruela/login'))
            .finally(() => setLoading(false));
    }, [navigate]);

    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true); setFeedback(null);
        try {
            const payload: Record<string, any> = {
                asaasBaseUrl: baseUrl,
                billingEnabled: billing.enabled,
                billingDayOfMonth: billing.dayOfMonth,
                billingDueDaysAhead: billing.dueDaysAhead,
                billingBillingType: billing.billingType,
                billingWhatsappTemplate: billing.template || null,
                billingEvolutionInstance: billing.evolutionInstance || null,
                billingEvolutionBaseUrl: billing.evolutionBaseUrl || null,
            };
            if (apiKey) payload.asaasApiKey = apiKey;
            if (webhookSecret) payload.asaasWebhookSecret = webhookSecret;
            if (billing.evolutionApiKey) payload.billingEvolutionApiKey = billing.evolutionApiKey;
            await adminAxios().patch('/api/zeruela/config', payload);
            const r = await adminAxios().get('/api/zeruela/config');
            setCfg(r.data);
            setApiKey(''); setWebhookSecret('');
            setFeedback({ ok: true, msg: 'Configurações salvas com sucesso.' });
        } catch {
            setFeedback({ ok: false, msg: 'Erro ao salvar. Verifique e tente novamente.' });
        } finally { setSaving(false); }
    }

    const isSandbox = baseUrl.includes('sandbox');
    const webhookUrl = `${window.location.origin.replace('5173', '3001')}/webhook/asaas`;

    if (loading) return <div style={{ padding: 40, color: t.textSub, background: t.bg, minHeight: '100vh' }}>Carregando...</div>;

    return (
        <div style={{ padding: 28, background: t.bg, minHeight: '100vh', color: t.text }}>
            {/* Header */}
            <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 10, color: t.textSub, fontFamily: "'Geist Mono', monospace", letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 }}>
                    Configurações / Asaas
                </div>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 26, color: t.accent, marginBottom: 6 }}>Asaas</div>
                <div style={{ fontSize: 13, color: t.textSub }}>
                    Gateway de pagamentos brasileiro. Gerencie cobranças e assinaturas dos seus clientes.
                </div>
            </div>

            <form
                onSubmit={handleSave}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
                        e.preventDefault();
                        const inputs = Array.from(e.currentTarget.querySelectorAll('input:not([disabled])')) as HTMLElement[];
                        const idx = inputs.indexOf(e.target as HTMLElement);
                        if (idx >= 0 && idx < inputs.length - 1) inputs[idx + 1].focus();
                    }
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
            >

                {/* Cards lado a lado */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
                    {/* Autenticação */}
                    <SectionCard
                        title="Autenticação"
                        status={{ ok: !!cfg.asaasApiKey, label: cfg.asaasApiKey ? 'Configurada' : 'Pendente' }}
                        t={t}
                    >
                        <FieldRow label="API Key" hint="Encontre em Minha Conta → Integrações no painel Asaas." t={t}>
                            <SecretInput
                                value={apiKey}
                                onChange={setApiKey}
                                placeholder={cfg.asaasApiKey ? '••••••• (deixe em branco para manter)' : '$aact_...'}
                                t={t}
                            />
                        </FieldRow>

                        <div style={{ height: 1, background: t.border }} />

                        <FieldRow label="Ambiente" hint="Sandbox para testes. Produção para cobranças reais." t={t}>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {[
                                    { label: 'Sandbox', value: 'https://sandbox.asaas.com/api/v3', sub: 'Para testes' },
                                    { label: 'Produção', value: 'https://api.asaas.com/api/v3', sub: 'Cobranças reais' },
                                ].map(opt => {
                                    const active = baseUrl === opt.value;
                                    return (
                                        <button key={opt.value} type="button" onClick={() => setBaseUrl(opt.value)} style={{ flex: 1, padding: '11px 14px', borderRadius: 10, textAlign: 'left', border: `1px solid ${active ? t.accent : t.border}`, background: active ? `${t.accent}18` : t.inputBg, cursor: 'pointer', fontFamily: 'inherit' }}>
                                            <div style={{ fontSize: 13, color: active ? t.accent : t.textMuted, fontWeight: active ? 600 : 400, marginBottom: 2 }}>{active ? '● ' : '○ '}{opt.label}</div>
                                            <div style={{ fontSize: 11, color: t.textSub }}>{opt.sub}</div>
                                        </button>
                                    );
                                })}
                            </div>
                            <div style={{ marginTop: 8, fontFamily: "'Geist Mono', monospace", fontSize: 11, color: t.textSub }}>{baseUrl}</div>
                        </FieldRow>
                    </SectionCard>

                    {/* Webhook */}
                    <SectionCard
                        title="Webhook"
                        status={{ ok: !!cfg.asaasWebhookSecret, label: cfg.asaasWebhookSecret ? 'Configurado' : 'Pendente' }}
                        t={t}
                    >
                        <FieldRow label="Webhook Secret" hint="Token para validar eventos. Configure também no painel Asaas em Configurações → Notificações." t={t}>
                            <SecretInput
                                value={webhookSecret}
                                onChange={setWebhookSecret}
                                placeholder={cfg.asaasWebhookSecret ? '••••••• (deixe em branco para manter)' : 'Token secreto...'}
                                t={t}
                            />
                        </FieldRow>

                        <div style={{ height: 1, background: t.border }} />

                        <FieldRow label="URL do Webhook" hint="Cole essa URL no painel Asaas em Configurações → Notificações." t={t}>
                            <CopyField value={webhookUrl} t={t} />
                        </FieldRow>

                        <div style={{ background: `${t.accent}0e`, border: `1px solid ${t.accent}22`, borderRadius: 10, padding: '14px' }}>
                            <div style={{ fontSize: 10, color: t.accent, fontFamily: "'Geist Mono', monospace", letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>Como funciona</div>
                            <div style={{ fontSize: 12, color: t.textSub, lineHeight: 1.6 }}>
                                Artemis escuta <span style={{ color: t.accent, fontFamily: "'Geist Mono', monospace" }}>PAYMENT_RECEIVED</span> e <span style={{ color: t.accent, fontFamily: "'Geist Mono', monospace" }}>PAYMENT_CONFIRMED</span> para atualizar status das assinaturas automaticamente.
                            </div>
                        </div>
                    </SectionCard>
                </div>

                {/* Billing Cron */}
                <SectionCard
                    title="Cobrança Automática"
                    status={{ ok: billing.enabled, label: billing.enabled ? 'Ativa' : 'Desativada' }}
                    t={t}
                >
                    <FieldRow label="Ativar cobrança" hint="Gera cobranças mensais automaticamente para todos os clientes Ativos." t={t}>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {[{ label: '● Ativa', v: true }, { label: '○ Desativada', v: false }].map(opt => (
                                <button key={String(opt.v)} type="button" onClick={() => setBilling(b => ({ ...b, enabled: opt.v }))} style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${billing.enabled === opt.v ? t.accent : t.border}`, background: billing.enabled === opt.v ? `${t.accent}18` : t.inputBg, color: billing.enabled === opt.v ? t.accent : t.textSub, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </FieldRow>

                    <div style={{ height: 1, background: t.border }} />

                    <FieldRow label="Dia de disparo" hint="Dia do mês (1–28) em que o cron gera as cobranças." t={t}>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 11, color: t.textSub, marginBottom: 5 }}>Dia do mês</div>
                                <input type="number" min={1} max={28} value={billing.dayOfMonth} onChange={e => setBilling(b => ({ ...b, dayOfMonth: Number(e.target.value) }))} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, boxSizing: 'border-box', border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 11, color: t.textSub, marginBottom: 5 }}>Dias até vencimento</div>
                                <input type="number" min={1} max={30} value={billing.dueDaysAhead} onChange={e => setBilling(b => ({ ...b, dueDaysAhead: Number(e.target.value) }))} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, boxSizing: 'border-box', border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 11, color: t.textSub, marginBottom: 5 }}>Tipo de cobrança</div>
                                <select value={billing.billingType} onChange={e => setBilling(b => ({ ...b, billingType: e.target.value }))} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}>
                                    <option value="PIX">Pix</option>
                                    <option value="BOLETO">Boleto</option>
                                    <option value="CREDIT_CARD">Cartão</option>
                                </select>
                            </div>
                        </div>
                    </FieldRow>

                    <div style={{ height: 1, background: t.border }} />

                    <FieldRow label="WhatsApp" hint="Instância Evolution para enviar o link de pagamento ao cliente. Variáveis: {name}, {value}, {dueDate}, {link}" t={t}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                <div>
                                    <div style={{ fontSize: 11, color: t.textSub, marginBottom: 5 }}>Instância</div>
                                    <input value={billing.evolutionInstance} onChange={e => setBilling(b => ({ ...b, evolutionInstance: e.target.value }))} placeholder="nome-da-instancia" style={{ width: '100%', padding: '9px 12px', borderRadius: 8, boxSizing: 'border-box', border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: t.textSub, marginBottom: 5 }}>Base URL Evolution</div>
                                    <input value={billing.evolutionBaseUrl} onChange={e => setBilling(b => ({ ...b, evolutionBaseUrl: e.target.value }))} placeholder="http://evolution:8080" style={{ width: '100%', padding: '9px 12px', borderRadius: 8, boxSizing: 'border-box', border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
                                </div>
                            </div>
                            <SecretInput value={billing.evolutionApiKey} onChange={v => setBilling(b => ({ ...b, evolutionApiKey: v }))} placeholder={cfg.billingEvolutionApiKey ? '••••••• (configurada)' : 'API Key Evolution...'} t={t} />
                            <div>
                                <div style={{ fontSize: 11, color: t.textSub, marginBottom: 5 }}>Mensagem (template)</div>
                                <textarea value={billing.template} onChange={e => setBilling(b => ({ ...b, template: e.target.value }))} rows={5} placeholder={`Olá {name}! A sua mensalidade de *{value}* vence em *{dueDate}*.\n\nLink: {link}`} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, boxSizing: 'border-box', border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 12, fontFamily: 'inherit', outline: 'none', resize: 'vertical' }} />
                            </div>
                        </div>
                    </FieldRow>
                </SectionCard>

                {/* Feedback */}
                {feedback && (
                    <div style={{
                        fontSize: 13, color: feedback.ok ? t.success : t.danger,
                        background: feedback.ok ? `${t.success}18` : `${t.danger}18`,
                        borderRadius: 8, padding: '11px 16px',
                    }}>
                        {feedback.msg}
                    </div>
                )}

                <button
                    type="submit" disabled={saving}
                    style={{
                        padding: '12px', borderRadius: 10, border: 'none',
                        background: saving ? t.border : t.accent,
                        color: saving ? t.textSub : '#1a1510',
                        fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
                    }}
                >
                    {saving ? 'Salvando...' : 'Salvar configurações'}
                </button>
            </form>
        </div>
    );
}
