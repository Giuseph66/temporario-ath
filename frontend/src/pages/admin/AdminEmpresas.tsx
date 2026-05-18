import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAdminTheme } from '../../hooks/useAdminTheme';
import type { AdminTheme } from '../../hooks/useAdminTheme';

type Company = {
    id: string; name: string; personType: string; document: string | null;
    email: string | null; phone: string | null; address: string | null;
    city: string | null; state: string | null; zipCode: string | null;
    website: string | null; notes: string | null; createdAt: string;
    _count: { tenants: number };
};

function adminAxios() {
    const token = localStorage.getItem('adminAccessToken');
    return axios.create({ headers: { Authorization: `Bearer ${token}` } });
}

const EMPTY = { name: '', personType: 'PJ', document: '', email: '', phone: '', address: '', city: '', state: '', zipCode: '', website: '', notes: '' };

function Field({ label, children, t, half }: { label: string; children: React.ReactNode; t: AdminTheme; half?: boolean }) {
    return (
        <div style={half ? { flex: 1 } : {}}>
            <label style={{ fontSize: 12, color: t.textSub, display: 'block', marginBottom: 5 }}>{label}</label>
            {children}
        </div>
    );
}

function CardSection({ title, children, t }: { title: string; children: React.ReactNode; t: AdminTheme }) {
    return (
        <div style={{ background: t.cardInner, borderRadius: 10, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 10, color: t.textSub, fontFamily: "'Geist Mono', monospace", letterSpacing: 0.8, textTransform: 'uppercase' }}>{title}</div>
            {children}
        </div>
    );
}

function EmpresaModal({ empresa, onClose, onSaved, t }: { empresa: Company | null; onClose: () => void; onSaved: () => void; t: AdminTheme }) {
    const [form, setForm] = useState(empresa ? {
        name: empresa.name, personType: empresa.personType ?? 'PJ',
        document: empresa.document ?? '', email: empresa.email ?? '',
        phone: empresa.phone ?? '', address: empresa.address ?? '',
        city: empresa.city ?? '', state: empresa.state ?? '',
        zipCode: empresa.zipCode ?? '', website: empresa.website ?? '', notes: empresa.notes ?? '',
    } : { ...EMPTY });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

    async function handleCepChange(e: React.ChangeEvent<HTMLInputElement>) {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 8) val = val.slice(0, 8);
        let masked = val;
        if (val.length > 5) masked = val.replace(/^(\d{5})(\d)/, '$1-$2');
        set('zipCode', masked);

        if (val.length === 8) {
            try {
                const res = await axios.get(`https://viacep.com.br/ws/${val}/json/`);
                if (!res.data.erro) {
                    setForm(f => ({
                        ...f,
                        address: res.data.logradouro + (res.data.bairro ? ` - ${res.data.bairro}` : ''),
                        city: res.data.localidade,
                        state: res.data.uf
                    }));
                }
            } catch (err) {}
        }
    }

    function handleDocumentChange(e: React.ChangeEvent<HTMLInputElement>) {
        let val = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        let isAlpha = /[A-Z]/.test(val);
        
        let pType = 'PJ';
        let masked = '';

        if (val.length <= 11 && !isAlpha) {
            pType = 'PF';
            let p1 = val.slice(0, 3);
            let p2 = val.slice(3, 6);
            let p3 = val.slice(6, 9);
            let p4 = val.slice(9, 11);
            
            masked = p1;
            if (p2) masked += `.${p2}`;
            if (p3) masked += `.${p3}`;
            if (p4) masked += `-${p4}`;
        } else {
            pType = 'PJ';
            if (val.length > 14) val = val.slice(0, 14);
            
            let base = val.slice(0, 12);
            let digits = val.slice(12, 14).replace(/\D/g, '');
            val = base + digits;
            
            let p1 = val.slice(0, 2);
            let p2 = val.slice(2, 5);
            let p3 = val.slice(5, 8);
            let p4 = val.slice(8, 12);
            let p5 = val.slice(12, 14);
            
            masked = p1;
            if (p2) masked += `.${p2}`;
            if (p3) masked += `.${p3}`;
            if (p4) masked += `/${p4}`;
            if (p5) masked += `-${p5}`;
        }
        
        setForm(f => ({ ...f, document: masked, personType: pType }));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(''); setLoading(true);
        try {
            if (empresa) await adminAxios().patch(`/api/zeruela/companies/${empresa.id}`, form);
            else await adminAxios().post('/api/zeruela/companies', form);
            onSaved(); onClose();
        } catch (err: any) {
            setError(err.response?.data?.error ?? 'Erro ao salvar empresa.');
        } finally { setLoading(false); }
    }

    const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 8, boxSizing: 'border-box', border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 13, fontFamily: 'inherit', outline: 'none' };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.65)' }} onClick={onClose} />
            <div style={{
                position: 'relative', background: t.card, border: `1px solid ${t.border}`,
                borderRadius: 16, padding: 32, width: 850, maxHeight: '92vh', overflowY: 'auto',
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, color: t.accent }}>
                        {empresa ? 'Editar Empresa' : 'Nova Empresa'}
                    </div>
                    <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: t.textSub, fontSize: 20, cursor: 'pointer' }}>✕</button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        {/* Coluna Esquerda */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <CardSection title="Identificação" t={t}>
                                <Field label="Nome *" t={t}><input value={form.name} onChange={e => set('name', e.target.value)} required style={inp} placeholder="Nome completo ou Razão social" /></Field>
                                <Field label="CPF / CNPJ" t={t}><input value={form.document} onChange={handleDocumentChange} placeholder="000.000.000-00 ou 00.000.000/0000-00" style={inp} /></Field>
                            </CardSection>

                            <CardSection title="Contato" t={t}>
                                <div style={{ display: 'flex', gap: 12 }}>
                                    <Field label="Email" t={t} half><input type="email" value={form.email} onChange={e => set('email', e.target.value)} style={inp} /></Field>
                                    <Field label="Telefone" t={t} half><input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+55 11 99999-0000" style={inp} /></Field>
                                </div>
                                <Field label="Website" t={t}><input value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://" style={inp} /></Field>
                            </CardSection>
                        </div>

                        {/* Coluna Direita */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <CardSection title="Endereço" t={t}>
                                <div style={{ display: 'flex', gap: 12 }}>
                                    <Field label="CEP" t={t} half><input value={form.zipCode} onChange={handleCepChange} placeholder="00000-000" style={inp} maxLength={9} /></Field>
                                    <Field label="UF" t={t}><input value={form.state} onChange={e => set('state', e.target.value)} maxLength={2} placeholder="SP" style={{ ...inp, width: 70 }} /></Field>
                                </div>
                                <Field label="Logradouro" t={t}><input value={form.address} onChange={e => set('address', e.target.value)} placeholder="Rua, número, complemento" style={inp} /></Field>
                                <Field label="Cidade" t={t}><input value={form.city} onChange={e => set('city', e.target.value)} style={inp} /></Field>
                            </CardSection>

                            <CardSection title="Observações" t={t}>
                                <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} style={{ ...inp, resize: 'vertical' }} placeholder="Informações adicionais..." />
                            </CardSection>
                        </div>
                    </div>

                    {error && <div style={{ fontSize: 12, color: t.danger, background: `${t.danger}18`, borderRadius: 8, padding: '10px 14px' }}>{error}</div>}

                    <button type="submit" disabled={loading} style={{ padding: '12px', borderRadius: 8, border: 'none', background: loading ? t.border : t.accent, color: loading ? t.textSub : '#1a1510', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}>
                        {loading ? 'Salvando...' : empresa ? 'Salvar alterações' : 'Criar Empresa'}
                    </button>
                </form>
            </div>
        </div>
    );
}

export function AdminEmpresas() {
    const t = useAdminTheme();
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState<'create' | Company | null>(null);
    const [search, setSearch] = useState('');
    const navigate = useNavigate();

    const load = useCallback(async () => {
        try {
            const data = await adminAxios().get('/api/zeruela/companies').then(r => r.data);
            setCompanies(data);
        } catch { navigate('/zeruela/login'); }
        finally { setLoading(false); }
    }, [navigate]);

    useEffect(() => { load(); }, [load]);

    async function handleDelete(id: string, name: string) {
        if (!confirm(`Excluir "${name}"? Os clientes vinculados serão desvinculados.`)) return;
        await adminAxios().delete(`/api/zeruela/companies/${id}`);
        load();
    }

    const filtered = companies.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.document ?? '').includes(search));
    const inp: React.CSSProperties = { padding: '8px 12px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 12, outline: 'none' };

    return (
        <div style={{ padding: 28, background: t.bg, minHeight: '100vh', color: t.text }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, color: t.accent, marginBottom: 4 }}>Empresas</div>
                    <div style={{ fontSize: 12, color: t.textSub, fontFamily: "'Geist Mono', monospace" }}>{companies.length} empresas cadastradas</div>
                </div>
                <button onClick={() => setModal('create')} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: t.accent, color: '#1a1510', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Nova Empresa</button>
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <input placeholder="Buscar nome ou documento..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, flex: 1 }} />
                <button onClick={load} style={{ ...inp, cursor: 'pointer', fontSize: 14 }}>↻</button>
            </div>

            <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'hidden' }}>
                {loading ? <div style={{ padding: 32, textAlign: 'center', color: t.textSub }}>Carregando...</div> : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                                {['Empresa', 'Tipo', 'Documento', 'Contato', 'Cidade', 'Clientes', ''].map(h => (
                                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, color: t.textSub, fontFamily: "'Geist Mono', monospace", letterSpacing: 0.8, textTransform: 'uppercase', fontWeight: 500 }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(c => (
                                <tr key={c.id} style={{ borderBottom: `1px solid ${t.borderSub}` }}>
                                    <td style={{ padding: '12px 16px' }}>
                                        <div style={{ color: t.textMuted, fontSize: 13, fontWeight: 500 }}>{c.name}</div>
                                        {c.website && <div style={{ color: t.textSub, fontSize: 11 }}>{c.website}</div>}
                                    </td>
                                    <td style={{ padding: '12px 16px' }}>
                                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: c.personType === 'PF' ? `${t.accent}18` : `${t.success}18`, color: c.personType === 'PF' ? t.accent : t.success, fontFamily: "'Geist Mono', monospace" }}>
                                            {c.personType === 'PF' ? 'CPF' : 'CNPJ'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px 16px', color: t.textSub, fontSize: 12, fontFamily: "'Geist Mono', monospace" }}>{c.document ?? '—'}</td>
                                    <td style={{ padding: '12px 16px' }}>
                                        <div style={{ color: t.textSub, fontSize: 12 }}>{c.email ?? '—'}</div>
                                        <div style={{ color: t.textSub, fontSize: 11 }}>{c.phone ?? ''}</div>
                                    </td>
                                    <td style={{ padding: '12px 16px', color: t.textSub, fontSize: 12 }}>{c.city ? `${c.city}/${c.state}` : '—'}</td>
                                    <td style={{ padding: '12px 16px', color: t.textSub, fontSize: 12 }}>{c._count.tenants}</td>
                                    <td style={{ padding: '12px 16px' }}>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button onClick={() => setModal(c)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: `1px solid ${t.border}`, background: 'transparent', color: t.accent, cursor: 'pointer' }}>Editar</button>
                                            <button onClick={() => handleDelete(c.id, c.name)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: `1px solid ${t.danger}44`, background: 'transparent', color: t.danger, cursor: 'pointer' }}>Excluir</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: t.textSub }}>Nenhuma empresa encontrada.</td></tr>}
                        </tbody>
                    </table>
                )}
            </div>

            {modal && <EmpresaModal empresa={modal === 'create' ? null : modal} onClose={() => setModal(null)} onSaved={load} t={t} />}
        </div>
    );
}
