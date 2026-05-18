import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAdminTheme } from '../../hooks/useAdminTheme';
import type { AdminTheme } from '../../hooks/useAdminTheme';

type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'OVERDUE' | 'SUSPENDED' | 'CANCELLED';

type ClienteSummary = {
    id: string; name: string; slug: string; isActive: boolean; createdAt: string;
    subscription: { status: SubscriptionStatus; planName: string; priceMonthly: number; trialEndsAt: string | null; currentPeriodEnd: string | null; asaasCustomerId: string | null } | null;
    company: { id: string; name: string } | null;
    tenantUsers: { email: string; role: string; lastLoginAt: string | null }[];
    _count: { users: number };
};

type ClienteDetail = ClienteSummary & {
    evolutionInstance: string | null;
    tenantUsers: { id: string; email: string; role: string; lastLoginAt: string | null; createdAt: string }[];
    aiUsage30d: { tokens: number; costBrl: string; events: number };
    recentLeads: { id: string; name: string | null; phoneNumber: string; conversationState: string | null; lastInteraction: string }[];
};

function adminAxios() {
    const token = localStorage.getItem('adminAccessToken');
    return axios.create({ headers: { Authorization: `Bearer ${token}` } });
}

const STATUS_COLORS: Record<SubscriptionStatus, { text: string; bg: string; label: string }> = {
    TRIAL:     { text: '#7b8fe8', bg: '#1a1a2e', label: 'Trial' },
    ACTIVE:    { text: '#5fb878', bg: '#0f1f14', label: 'Ativo' },
    OVERDUE:   { text: '#d4a43a', bg: '#1f1500', label: 'Atrasado' },
    SUSPENDED: { text: '#c85a5a', bg: '#1f0a0a', label: 'Suspenso' },
    CANCELLED: { text: '#888',    bg: '#1a1a1a', label: 'Cancelado' },
};

function StatusBadge({ status }: { status: SubscriptionStatus | null }) {
    if (!status) return <span style={{ fontSize: 11, color: '#888' }}>—</span>;
    const c = STATUS_COLORS[status];
    return <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: c.bg, color: c.text, fontFamily: "'Geist Mono', monospace", letterSpacing: 0.5, textTransform: 'uppercase' }}>{c.label}</span>;
}

// ─── Drawer detalhe ───────────────────────────────────────────────────────────

function Sec({ title, children, t }: { title: string; children: React.ReactNode; t: AdminTheme }) {
    return (
        <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, color: t.textSub, fontFamily: "'Geist Mono', monospace", letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>{title}</div>
            <div style={{ background: t.cardInner, borderRadius: 8, padding: '10px 14px' }}>{children}</div>
        </div>
    );
}

function InfoRow({ label, value, t }: { label: string; value: string; t: AdminTheme }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: t.textSub }}>{label}</span>
            <span style={{ fontSize: 12, color: t.textMuted, fontFamily: "'Geist Mono', monospace" }}>{value}</span>
        </div>
    );
}

function ClienteDrawer({ clienteId, onClose, onRefresh, t, companies }: {
    clienteId: string; onClose: () => void; onRefresh: () => void;
    t: AdminTheme; companies: { id: string; name: string }[];
}) {
    const [detail, setDetail] = useState<ClienteDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [editStatus, setEditStatus] = useState('');
    const [savingStatus, setSavingStatus] = useState(false);
    const [impersonating, setImpersonating] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState('');
    const [savingCompany, setSavingCompany] = useState(false);

    useEffect(() => {
        adminAxios().get(`/api/zeruela/tenants/${clienteId}`)
            .then(r => { setDetail(r.data); setSelectedCompany(r.data.company?.id ?? ''); })
            .finally(() => setLoading(false));
    }, [clienteId]);

    async function handleImpersonate() {
        setImpersonating(true);
        try {
            const res = await adminAxios().post(`/api/zeruela/tenants/${clienteId}/impersonate`);
            localStorage.setItem('accessToken', res.data.accessToken);
            localStorage.setItem('refreshToken', '');
            window.location.href = '/dashboard';
        } catch { alert('Falha ao impersonar.'); }
        finally { setImpersonating(false); }
    }

    async function handleStatusChange() {
        if (!editStatus) return;
        setSavingStatus(true);
        try {
            await adminAxios().patch(`/api/zeruela/tenants/${clienteId}/subscription`, { status: editStatus });
            const r = await adminAxios().get(`/api/zeruela/tenants/${clienteId}`);
            setDetail(r.data); setEditStatus(''); onRefresh();
        } catch { alert('Falha ao atualizar.'); }
        finally { setSavingStatus(false); }
    }

    async function handleToggleActive() {
        if (!detail) return;
        await adminAxios().patch(`/api/zeruela/tenants/${clienteId}/active`, { isActive: !detail.isActive });
        setDetail(d => d ? { ...d, isActive: !d.isActive } : d);
        onRefresh();
    }

    async function handleLinkCompany() {
        setSavingCompany(true);
        try {
            await adminAxios().patch(`/api/zeruela/tenants/${clienteId}/company`, { companyId: selectedCompany || null });
            const r = await adminAxios().get(`/api/zeruela/tenants/${clienteId}`);
            setDetail(r.data); onRefresh();
        } catch { alert('Falha ao vincular empresa.'); }
        finally { setSavingCompany(false); }
    }

    const sub = detail?.subscription;
    const sel: React.CSSProperties = { flex: 1, padding: '8px 10px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 12, outline: 'none' };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex' }}>
            <div style={{ flex: 1, background: 'rgba(0,0,0,.5)' }} onClick={onClose} />
            <div style={{ width: 500, background: t.card, borderLeft: `1px solid ${t.border}`, overflowY: 'auto', padding: 24 }}>
                {loading ? <div style={{ color: t.textSub, fontSize: 13 }}>Carregando...</div> : !detail ? <div style={{ color: t.danger }}>Erro.</div> : <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                        <div>
                            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, color: t.accent }}>{detail.name}</div>
                            <div style={{ fontSize: 11, color: t.textSub, fontFamily: "'Geist Mono', monospace" }}>{detail.slug}</div>
                            {detail.company && <div style={{ fontSize: 11, color: t.accent, marginTop: 2 }}>🏢 {detail.company.name}</div>}
                        </div>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.textSub, fontSize: 20, cursor: 'pointer' }}>✕</button>
                    </div>

                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: t.cardInner, borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
                        <StatusBadge status={sub?.status ?? null} />
                        <span style={{ fontSize: 12, color: t.textSub }}>{sub?.planName} · R$ {sub?.priceMonthly?.toFixed(2) ?? '0,00'}/mês</span>
                        <div style={{ flex: 1 }} />
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: detail.isActive ? t.success : t.danger }} />
                        <span style={{ fontSize: 11, color: t.textSub }}>{detail.isActive ? 'Ativo' : 'Suspenso'}</span>
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                        <button onClick={handleImpersonate} disabled={impersonating} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.cardInner, color: t.accent, fontSize: 12, cursor: 'pointer' }}>
                            {impersonating ? 'Entrando...' : '🔑 Entrar como cliente'}
                        </button>
                        <button onClick={handleToggleActive} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.cardInner, color: detail.isActive ? t.danger : t.success, fontSize: 12, cursor: 'pointer' }}>
                            {detail.isActive ? '🚫 Suspender' : '✅ Reativar'}
                        </button>
                    </div>

                    <Sec title="Alterar status da assinatura" t={t}>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <select value={editStatus} onChange={e => setEditStatus(e.target.value)} style={sel}>
                                <option value="">Selecionar novo status...</option>
                                <option value="TRIAL">Trial</option>
                                <option value="ACTIVE">Ativo</option>
                                <option value="OVERDUE">Atrasado</option>
                                <option value="SUSPENDED">Suspenso</option>
                                <option value="CANCELLED">Cancelado</option>
                            </select>
                            <button onClick={handleStatusChange} disabled={!editStatus || savingStatus} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: editStatus ? t.accent : t.border, color: editStatus ? '#1a1510' : t.textSub, fontSize: 12, cursor: editStatus ? 'pointer' : 'not-allowed' }}>
                                Salvar
                            </button>
                        </div>
                    </Sec>

                    <Sec title="Vincular empresa" t={t}>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <select value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)} style={sel}>
                                <option value="">Sem empresa vinculada</option>
                                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <button onClick={handleLinkCompany} disabled={savingCompany} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: t.accent, color: '#1a1510', fontSize: 12, cursor: 'pointer' }}>
                                {savingCompany ? '...' : 'Salvar'}
                            </button>
                        </div>
                    </Sec>

                    <Sec title="Assinatura" t={t}>
                        <InfoRow label="Plano" value={sub?.planName ?? '—'} t={t} />
                        <InfoRow label="Valor" value={sub ? `R$ ${sub.priceMonthly.toFixed(2)}/mês` : '—'} t={t} />
                        <InfoRow label="Trial até" value={sub?.trialEndsAt ? new Date(sub.trialEndsAt).toLocaleDateString('pt-BR') : '—'} t={t} />
                        <InfoRow label="Período atual" value={sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString('pt-BR') : '—'} t={t} />
                        <InfoRow label="Evolution" value={detail.evolutionInstance ?? '—'} t={t} />
                    </Sec>

                    <Sec title="Uso de IA (30 dias)" t={t}>
                        <InfoRow label="Tokens" value={detail.aiUsage30d.tokens.toLocaleString('pt-BR')} t={t} />
                        <InfoRow label="Custo estimado" value={`R$ ${detail.aiUsage30d.costBrl}`} t={t} />
                        <InfoRow label="Eventos" value={detail.aiUsage30d.events.toString()} t={t} />
                    </Sec>

                    <Sec title="Usuários do cliente" t={t}>
                        {detail.tenantUsers.map(u => (
                            <div key={u.email} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                <span style={{ fontSize: 12, color: t.textMuted }}>{u.email}</span>
                                <span style={{ fontSize: 11, color: t.textSub, fontFamily: "'Geist Mono', monospace" }}>{u.role}</span>
                            </div>
                        ))}
                    </Sec>

                    <Sec title="Leads recentes" t={t}>
                        {detail.recentLeads.map(l => (
                            <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${t.borderSub}` }}>
                                <div>
                                    <div style={{ fontSize: 12, color: t.textMuted }}>{l.name ?? 'Sem nome'}</div>
                                    <div style={{ fontSize: 10, color: t.textSub, fontFamily: "'Geist Mono', monospace" }}>{l.phoneNumber}</div>
                                </div>
                                <div style={{ fontSize: 10, color: t.textSub }}>{l.conversationState}</div>
                            </div>
                        ))}
                    </Sec>
                    <div style={{ height: 40 }} />
                </>}
            </div>
        </div>
    );
}

// ─── Modal criar cliente ──────────────────────────────────────────────────────

function NovoClienteModal({ onClose, onCreated, t }: { onClose: () => void; onCreated: () => void; t: AdminTheme }) {
    const [form, setForm] = useState({ companyName: '', agentName: '', email: '', password: '', confirmPassword: '' });
    const [showPass, setShowPass] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (form.password !== form.confirmPassword) { setError('Senhas não coincidem.'); return; }
        if (form.password.length < 8) { setError('Senha mínima: 8 caracteres.'); return; }
        setError(''); setLoading(true);
        try {
            await axios.post('/auth/register', { companyName: form.companyName, agentName: form.agentName, email: form.email, password: form.password });
            onCreated();
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.error ?? 'Erro ao criar cliente.');
        } finally { setLoading(false); }
    }

    const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 8, boxSizing: 'border-box', border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 13, fontFamily: 'inherit', outline: 'none' };
    const inpPad: React.CSSProperties = { ...inp, paddingRight: 36 };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.6)' }} onClick={onClose} />
            <div style={{ position: 'relative', background: t.card, border: `1px solid ${t.border}`, borderRadius: 16, padding: 28, width: 480, maxHeight: '90vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, color: t.accent }}>Novo Cliente</div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.textSub, fontSize: 18, cursor: 'pointer' }}>✕</button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ background: t.cardInner, borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ fontSize: 10, color: t.textSub, fontFamily: "'Geist Mono', monospace", letterSpacing: 0.8, textTransform: 'uppercase' }}>Dados</div>
                        <Field label="Nome da conta" t={t}><input value={form.companyName} onChange={e => set('companyName', e.target.value)} required placeholder="Ex: João Silva Mentoria" style={inp} /></Field>
                        <Field label="Nome do agente" t={t}><input value={form.agentName} onChange={e => set('agentName', e.target.value)} required style={inp} /></Field>
                    </div>

                    <div style={{ background: t.cardInner, borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ fontSize: 10, color: t.textSub, fontFamily: "'Geist Mono', monospace", letterSpacing: 0.8, textTransform: 'uppercase' }}>Acesso</div>
                        <Field label="Email do responsável" t={t}><input type="email" value={form.email} onChange={e => set('email', e.target.value)} required style={inp} /></Field>
                        <Field label="Senha" t={t}>
                            <div style={{ position: 'relative' }}>
                                <input type={showPass ? 'text' : 'password'} value={form.password} onChange={e => set('password', e.target.value)} required style={inpPad} />
                                <EyeBtn open={showPass} toggle={() => setShowPass(s => !s)} t={t} />
                            </div>
                        </Field>
                        <Field label="Confirmar senha" t={t}>
                            <div style={{ position: 'relative' }}>
                                <input type={showConfirm ? 'text' : 'password'} value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)} required style={inpPad} />
                                <EyeBtn open={showConfirm} toggle={() => setShowConfirm(s => !s)} t={t} />
                            </div>
                        </Field>
                    </div>

                    <div style={{ background: `${t.accent}0e`, border: `1px solid ${t.accent}22`, borderRadius: 8, padding: '10px 14px', fontSize: 12, color: t.textSub }}>
                        Após criar o cliente, configure o plano e assinatura em <span style={{ color: t.accent }}>Assinaturas</span>.
                    </div>

                    {error && <div style={{ fontSize: 12, color: t.danger, background: `${t.danger}18`, borderRadius: 8, padding: '10px 14px' }}>{error}</div>}

                    <button type="submit" disabled={loading} style={{ padding: '11px', borderRadius: 8, border: 'none', background: loading ? t.border : t.accent, color: loading ? t.textSub : '#1a1510', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}>
                        {loading ? 'Criando...' : 'Criar Cliente'}
                    </button>
                </form>
            </div>
        </div>
    );
}

function Field({ label, children, t }: { label: string; children: React.ReactNode; t: AdminTheme }) {
    return (
        <div>
            <label style={{ fontSize: 12, color: t.textSub, display: 'block', marginBottom: 5 }}>{label}</label>
            {children}
        </div>
    );
}

function EyeBtn({ open, toggle, t }: { open: boolean; toggle: () => void; t: AdminTheme }) {
    return (
        <button type="button" onClick={toggle} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: t.textSub, padding: 0, display: 'flex' }}>
            {open ? (
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
    );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function AdminClientes() {
    const t = useAdminTheme();
    const [clientes, setClientes] = useState<ClienteSummary[]>([]);
    const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<SubscriptionStatus | ''>('');
    const navigate = useNavigate();

    const load = useCallback(async () => {
        try {
            const [tenants, comps] = await Promise.all([
                adminAxios().get('/api/zeruela/tenants').then(r => r.data),
                adminAxios().get('/api/zeruela/companies').then(r => r.data),
            ]);
            setClientes(tenants);
            setCompanies(comps);
        } catch { navigate('/zeruela/login'); }
        finally { setLoading(false); }
    }, [navigate]);

    useEffect(() => { load(); }, [load]);

    const filtered = clientes.filter(c => {
        const q = search.toLowerCase();
        const matchSearch = !q || c.name.toLowerCase().includes(q) || c.slug.includes(q) || (c.tenantUsers[0]?.email ?? '').toLowerCase().includes(q);
        const matchStatus = !filterStatus || c.subscription?.status === filterStatus;
        return matchSearch && matchStatus;
    });

    const inp: React.CSSProperties = { padding: '8px 12px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 12, outline: 'none' };

    return (
        <div style={{ padding: 28, background: t.bg, minHeight: '100vh', color: t.text }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, color: t.accent, marginBottom: 4 }}>Clientes</div>
                    <div style={{ fontSize: 12, color: t.textSub, fontFamily: "'Geist Mono', monospace" }}>{clientes.length} clientes cadastrados</div>
                </div>
                <button onClick={() => setShowModal(true)} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: t.accent, color: '#1a1510', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    + Novo Cliente
                </button>
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <input placeholder="Buscar nome, slug ou email..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, flex: 1 }} />
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} style={inp}>
                    <option value="">Todos os status</option>
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
                                {['Cliente', 'Empresa', 'Email', 'Status', 'Valor/mês', 'Leads'].map(h => (
                                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, color: t.textSub, fontFamily: "'Geist Mono', monospace", letterSpacing: 0.8, textTransform: 'uppercase', fontWeight: 500 }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(row => (
                                <tr key={row.id} onClick={() => setSelectedId(row.id)} style={{ cursor: 'pointer', borderBottom: `1px solid ${t.borderSub}` }}>
                                    <td style={{ padding: '12px 16px' }}>
                                        <div style={{ color: t.textMuted, fontSize: 13, fontWeight: 500 }}>{row.name}</div>
                                        <div style={{ color: t.textSub, fontSize: 11, fontFamily: "'Geist Mono', monospace" }}>{row.slug}</div>
                                    </td>
                                    <td style={{ padding: '12px 16px', color: t.textSub, fontSize: 12 }}>{row.company?.name ?? '—'}</td>
                                    <td style={{ padding: '12px 16px', color: t.textSub, fontSize: 12 }}>{row.tenantUsers[0]?.email ?? '—'}</td>
                                    <td style={{ padding: '12px 16px' }}><StatusBadge status={row.subscription?.status ?? null} /></td>
                                    <td style={{ padding: '12px 16px', color: t.accent, fontSize: 12, fontFamily: "'Geist Mono', monospace" }}>
                                        {row.subscription?.priceMonthly ? `R$ ${row.subscription.priceMonthly.toFixed(2)}` : '—'}
                                    </td>
                                    <td style={{ padding: '12px 16px', color: t.textSub, fontSize: 11 }}>{row._count.users}</td>
                                </tr>
                            ))}
                            {filtered.length === 0 && <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: t.textSub }}>Nenhum cliente encontrado.</td></tr>}
                        </tbody>
                    </table>
                )}
            </div>

            {selectedId && <ClienteDrawer clienteId={selectedId} onClose={() => setSelectedId(null)} onRefresh={load} t={t} companies={companies} />}
            {showModal && <NovoClienteModal onClose={() => setShowModal(false)} onCreated={load} t={t} />}
        </div>
    );
}
