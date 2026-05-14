import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const TONES = ['Elegante', 'Amigável', 'Direto', 'Formal', 'Bem-humorado', 'Persuasivo'];

export function Onboarding() {
    const [step, setStep] = useState(1);
    const [tone, setTone] = useState<string[]>(['Amigável']);
    const [qr, setQr] = useState<string | null>(null);
    const [whatsStatus, setWhatsStatus] = useState<'not_created' | 'connecting' | 'open'>('not_created');
    const navigate = useNavigate();

    async function handleConnectWhatsApp() {
        await axios.post('/api/instances/create');
        setWhatsStatus('connecting');
        const poll = setInterval(async () => {
            const qrRes = await axios.get('/api/instances/qrcode').catch(() => null);
            if (qrRes?.data?.qr) setQr(qrRes.data.qr);
            const statusRes = await axios.get('/api/instances/status').catch(() => null);
            if (statusRes?.data?.status === 'open') {
                setWhatsStatus('open');
                setQr(null);
                clearInterval(poll);
            }
        }, 3000);
    }

    function stepDot(n: number) {
        const done = n < step;
        const active = n === step;
        return (
            <div key={n} style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600,
                background: done ? 'var(--accent)' : active ? 'var(--accent-soft)' : 'var(--paper-3)',
                color: done ? '#fff' : active ? 'var(--accent-ink)' : 'var(--ink-5)',
                border: active ? '2px solid var(--accent-ink)' : '2px solid transparent',
            }}>
                {done ? '✓' : n}
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--paper-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 520 }}>
                {/* Progress indicator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 32 }}>
                    {[1, 2, 3].map(n => (
                        <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {stepDot(n)}
                            {n < 3 && <div style={{ height: 1, width: 48, background: n < step ? 'var(--accent)' : 'var(--line)' }} />}
                        </div>
                    ))}
                </div>

                <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 16, padding: '36px 36px 28px' }}>
                    {step === 1 && (
                        <>
                            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 26, color: 'var(--ink-1)', marginBottom: 6 }}>Como seu agente se comporta?</div>
                            <div style={{ fontSize: 14, color: 'var(--ink-4)', marginBottom: 24 }}>Selecione os tons de voz. Você pode mudar depois.</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
                                {TONES.map(t => (
                                    <button key={t} onClick={() => setTone(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])} style={{
                                        padding: '8px 16px', borderRadius: 999, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                                        border: tone.includes(t) ? '1px solid var(--accent-ink)' : '1px solid var(--line-2)',
                                        background: tone.includes(t) ? 'var(--accent)' : 'var(--paper)',
                                        color: tone.includes(t) ? '#fff' : 'var(--ink-2)',
                                    }}>{t}</button>
                                ))}
                            </div>
                            <button onClick={async () => {
                                const agentRes = await axios.get('/api/agent');
                                const persona = { ...agentRes.data.personaJson, tone: { ...agentRes.data.personaJson.tone, primary: tone } };
                                await axios.patch('/api/agent/persona', { personaJson: persona });
                                setStep(2);
                            }} style={{ width: '100%', padding: '11px', borderRadius: 8, fontSize: 14, fontWeight: 500, border: '1px solid var(--accent-ink)', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                                Próximo →
                            </button>
                        </>
                    )}

                    {step === 2 && (
                        <>
                            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 26, color: 'var(--ink-1)', marginBottom: 6 }}>Conecte seu WhatsApp</div>
                            <div style={{ fontSize: 14, color: 'var(--ink-4)', marginBottom: 24 }}>Escaneie o QR Code com o WhatsApp do número que o agente vai usar.</div>
                            <div style={{ textAlign: 'center', marginBottom: 24 }}>
                                {whatsStatus === 'open' ? (
                                    <div style={{ padding: '32px 0' }}>
                                        <div style={{ fontSize: 48 }}>✅</div>
                                        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--accent)', marginTop: 12 }}>WhatsApp conectado!</div>
                                    </div>
                                ) : qr ? (
                                    <img src={`data:image/png;base64,${qr}`} alt="QR Code" style={{ width: 220, height: 220, borderRadius: 8 }} />
                                ) : (
                                    <button onClick={handleConnectWhatsApp} style={{ padding: '14px 28px', borderRadius: 10, fontSize: 14, fontWeight: 500, border: '1px solid var(--accent-ink)', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                                        {whatsStatus === 'connecting' ? 'Aguardando QR...' : 'Gerar QR Code'}
                                    </button>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: 10 }}>
                                <button onClick={() => setStep(3)} style={{ flex: 1, padding: '10px', borderRadius: 8, fontSize: 13, border: '1px solid var(--line-2)', background: 'var(--paper-2)', color: 'var(--ink-3)', cursor: 'pointer', fontFamily: 'inherit' }}>Pular por agora</button>
                                {whatsStatus === 'open' && (
                                    <button onClick={() => setStep(3)} style={{ flex: 2, padding: '10px', borderRadius: 8, fontSize: 14, fontWeight: 500, border: '1px solid var(--accent-ink)', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>Próximo →</button>
                                )}
                            </div>
                        </>
                    )}

                    {step === 3 && (
                        <>
                            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 26, color: 'var(--ink-1)', marginBottom: 6 }}>Integrações opcionais</div>
                            <div style={{ fontSize: 14, color: 'var(--ink-4)', marginBottom: 24 }}>Configure Asaas e Google Calendar para cobrança e agendamento automáticos. Pode ser feito depois.</div>
                            {[
                                { name: 'Asaas', desc: 'Cobranças e pagamentos automáticos', icon: '💳' },
                                { name: 'Google Calendar', desc: 'Agendamento de aulas e sessões', icon: '📅' },
                            ].map(i => (
                                <div key={i.name} style={{ padding: '14px 16px', background: 'var(--paper-2)', border: '1px solid var(--line)', borderRadius: 10, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <span style={{ fontSize: 24 }}>{i.icon}</span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-1)' }}>{i.name}</div>
                                        <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>{i.desc}</div>
                                    </div>
                                    <span style={{ fontSize: 12, color: 'var(--ink-5)' }}>Configurar depois →</span>
                                </div>
                            ))}
                            <button onClick={() => navigate('/dashboard')} style={{ width: '100%', marginTop: 16, padding: '12px', borderRadius: 8, fontSize: 14, fontWeight: 600, border: '1px solid var(--accent-ink)', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                                Ir para o painel ✓
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
