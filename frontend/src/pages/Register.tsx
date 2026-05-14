import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

function EyeIcon({ open }: { open: boolean }) {
    return open ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
        </svg>
    ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
    );
}

export function Register() {
    const [form, setForm] = useState({ companyName: '', agentName: '', email: '', password: '' });
    const [showPass, setShowPass] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuth();

    function set(field: string) {
        return (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [field]: e.target.value }));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await axios.post('/auth/register', form);
            login(res.data.accessToken, res.data.refreshToken);
            navigate('/onboarding');
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
            setError(msg ?? 'Erro ao criar conta.');
        } finally {
            setLoading(false);
        }
    }

    const fieldStyle: React.CSSProperties = {
        width: '100%', padding: '9px 12px', borderRadius: 8,
        border: '1px solid #2a2823', background: '#111110',
        color: '#f1ecdc', fontSize: 14, fontFamily: 'inherit', outline: 'none',
    };
    const labelStyle: React.CSSProperties = {
        fontSize: 12, color: '#8a8579', display: 'block', marginBottom: 5,
    };

    return (
        <div style={{ minHeight: '100vh', background: '#0f0f0e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 420, padding: '0 20px' }}>
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: 42, color: '#f1ecdc', fontWeight: 400, letterSpacing: -1.5, marginBottom: 8 }}>
                        Agentes Zap
                    </div>
                    <div style={{ fontSize: 15, color: '#55524a' }}>
                        Crie sua conta e conecte seu agente de WhatsApp com IA em minutos.
                    </div>
                </div>
                <div style={{ background: '#1a1917', border: '1px solid #2a2823', borderRadius: 16, padding: '32px 28px' }}>
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div>
                            <label style={labelStyle}>Nome da empresa</label>
                            <input value={form.companyName} onChange={set('companyName')} placeholder="Confluence Treinamento" required style={fieldStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>Nome do agente</label>
                            <input value={form.agentName} onChange={set('agentName')} placeholder="Artemis" required style={fieldStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>Email</label>
                            <input type="email" value={form.email} onChange={set('email')} placeholder="admin@empresa.com" required style={fieldStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>Senha (mín. 8 caracteres)</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPass ? 'text' : 'password'}
                                    value={form.password} onChange={set('password')}
                                    required minLength={8}
                                    style={{ ...fieldStyle, paddingRight: 38, boxSizing: 'border-box' }}
                                />
                                <button type="button" onClick={() => setShowPass(v => !v)} style={{
                                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: '#55524a', padding: 0, display: 'flex', alignItems: 'center',
                                }}>
                                    <EyeIcon open={showPass} />
                                </button>
                            </div>
                        </div>
                        {error && (
                            <div style={{ fontSize: 12, color: '#f87171', padding: '8px 12px', background: '#200a08', borderRadius: 6, border: '1px solid #a83a2a' }}>
                                {error}
                            </div>
                        )}
                        <button type="submit" disabled={loading} style={{ marginTop: 4, padding: '11px', borderRadius: 8, fontSize: 14, fontWeight: 500, border: '1px solid #0d4a36', background: '#1b6b4d', color: '#fff', cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
                            {loading ? 'Criando conta...' : 'Criar conta grátis →'}
                        </button>
                    </form>
                    <div style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: '#55524a' }}>
                        Já tem conta?{' '}
                        <Link to="/login" style={{ color: '#5ec88a', textDecoration: 'none' }}>
                            Entrar
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
