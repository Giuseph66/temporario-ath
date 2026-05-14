import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await axios.post('/auth/login', { email, password });
            localStorage.setItem('accessToken', res.data.accessToken);
            localStorage.setItem('refreshToken', res.data.refreshToken);
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
                        <input
                            type="password" value={password} onChange={e => setPassword(e.target.value)}
                            required
                            style={{
                                width: '100%', padding: '9px 12px', borderRadius: 8,
                                border: '1px solid #2a2823', background: '#111110',
                                color: '#f1ecdc', fontSize: 14, fontFamily: 'inherit', outline: 'none',
                            }}
                        />
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
