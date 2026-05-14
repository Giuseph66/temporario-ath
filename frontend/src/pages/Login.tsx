import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

export function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuth();

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await axios.post('/auth/login', { email, password });
            login(res.data.accessToken, res.data.refreshToken);
            navigate('/dashboard');
        } catch {
            setError('Email ou senha incorretos.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{
            minHeight: '100vh', background: '#0f0f0e',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
            <div style={{
                background: '#1a1917', border: '1px solid #2a2823', borderRadius: 16,
                padding: '40px 36px', width: 360,
            }}>
                <div style={{
                    fontFamily: "'Fraunces', serif", fontSize: 28, color: '#f1ecdc',
                    fontWeight: 400, marginBottom: 6, letterSpacing: -0.5,
                }}>
                    Agentes Zap
                </div>
                <div style={{ fontSize: 13, color: '#55524a', marginBottom: 28 }}>
                    Entre na sua conta
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                        <label style={{ fontSize: 12, color: '#8a8579', display: 'block', marginBottom: 6 }}>
                            Email
                        </label>
                        <input
                            type="email" value={email} onChange={e => setEmail(e.target.value)}
                            required autoFocus
                            style={{
                                width: '100%', padding: '9px 12px', borderRadius: 8,
                                border: '1px solid #2a2823', background: '#111110',
                                color: '#f1ecdc', fontSize: 14, fontFamily: 'inherit', outline: 'none',
                            }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: 12, color: '#8a8579', display: 'block', marginBottom: 6 }}>
                            Senha
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                                required
                                style={{
                                    width: '100%', padding: '9px 38px 9px 12px', borderRadius: 8,
                                    border: '1px solid #2a2823', background: '#111110',
                                    color: '#f1ecdc', fontSize: 14, fontFamily: 'inherit', outline: 'none',
                                    boxSizing: 'border-box',
                                }}
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
                        <div style={{
                            fontSize: 12, color: '#f87171', padding: '8px 12px',
                            background: '#200a08', borderRadius: 6, border: '1px solid #a83a2a',
                        }}>
                            {error}
                        </div>
                    )}
                    <button
                        type="submit" disabled={loading}
                        style={{
                            marginTop: 4, padding: '10px', borderRadius: 8,
                            border: '1px solid #0d4a36', background: '#1b6b4d',
                            color: '#fff', fontSize: 14, fontWeight: 500,
                            fontFamily: 'inherit', cursor: loading ? 'wait' : 'pointer',
                        }}
                    >
                        {loading ? 'Entrando...' : 'Entrar'}
                    </button>
                </form>
            </div>
        </div>
    );
}
