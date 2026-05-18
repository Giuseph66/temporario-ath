import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

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

export function AdminLogin() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await axios.post('/api/zeruela/login', { email, password });
            localStorage.setItem('adminAccessToken', res.data.accessToken);
            localStorage.setItem('adminRefreshToken', res.data.refreshToken);
            navigate('/zeruela/dashboard');
        } catch {
            setError('Credenciais inválidas.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{
            minHeight: '100vh', background: '#0a0a09',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
            <div style={{
                background: '#131210', border: '1px solid #1e1c18',
                borderRadius: 16, padding: '40px 36px', width: 360,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                    <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: 'linear-gradient(135deg, #c8a96e, #8b6b3d)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, fontWeight: 700, color: '#fff',
                    }}>A</div>
                    <div>
                        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, color: '#f1ecdc', fontWeight: 400 }}>
                            Admin
                        </div>
                        <div style={{ fontSize: 11, color: '#3a3830' }}>Painel de gestão da plataforma</div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                        <label style={{ fontSize: 12, color: '#8a8579', display: 'block', marginBottom: 6 }}>Email</label>
                        <input
                            type="email" value={email} onChange={e => setEmail(e.target.value)}
                            required autoFocus
                            style={{
                                width: '100%', padding: '9px 12px', borderRadius: 8, boxSizing: 'border-box',
                                border: '1px solid #1e1c18', background: '#0d0c0a',
                                color: '#f1ecdc', fontSize: 14, fontFamily: 'inherit', outline: 'none',
                            }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: 12, color: '#8a8579', display: 'block', marginBottom: 6 }}>Senha</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                                required
                                style={{
                                    width: '100%', padding: '9px 36px 9px 12px', borderRadius: 8, boxSizing: 'border-box',
                                    border: '1px solid #1e1c18', background: '#0d0c0a',
                                    color: '#f1ecdc', fontSize: 14, fontFamily: 'inherit', outline: 'none',
                                }}
                            />
                            <button
                                type="button" onClick={() => setShowPass(s => !s)}
                                style={{
                                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: '#55524a', padding: 0, display: 'flex',
                                }}
                            >
                                <EyeIcon open={showPass} />
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div style={{ fontSize: 12, color: '#c85a5a', background: '#1f1010', borderRadius: 6, padding: '8px 12px' }}>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit" disabled={loading}
                        style={{
                            marginTop: 4, padding: '10px', borderRadius: 8,
                            border: 'none', background: '#c8a96e', color: '#1a1510',
                            fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                            opacity: loading ? 0.7 : 1,
                        }}
                    >
                        {loading ? 'Entrando...' : 'Entrar como Admin'}
                    </button>
                </form>
            </div>
        </div>
    );
}
