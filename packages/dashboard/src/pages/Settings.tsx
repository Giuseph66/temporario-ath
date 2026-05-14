import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <div style={{
            fontFamily: "'Geist Mono', monospace", fontSize: 10, letterSpacing: 1.2,
            textTransform: 'uppercase', color: 'var(--ink-5)', marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 10,
        }}>
            <span>{children}</span>
            <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
        </div>
    );
}

function RowField({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div style={{
            display: 'grid', gridTemplateColumns: '140px 1fr',
            gap: 16, padding: '11px 0', borderBottom: '1px solid var(--line)',
            alignItems: 'baseline',
        }}>
            <span style={{
                fontFamily: "'Geist Mono', monospace", fontSize: 10.5,
                color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: .6,
            }}>{label}</span>
            <span style={{ fontSize: 13, color: 'var(--ink-1)' }}>{value}</span>
        </div>
    );
}

function KeyField({
    label, description, savedMask, onSave,
}: {
    label: string;
    description: string;
    savedMask: string | null;
    onSave: (val: string) => Promise<void>;
}) {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState('');
    const [saving, setSaving] = useState(false);

    async function handleSave() {
        setSaving(true);
        await onSave(value);
        setValue('');
        setEditing(false);
        setSaving(false);
    }

    const isConfigured = !!savedMask;

    return (
        <div style={{
            padding: '16px 0', borderBottom: '1px solid var(--line)',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <div style={{
                            width: 6, height: 6, borderRadius: '50%',
                            background: isConfigured ? 'var(--accent)' : 'var(--ink-5)',
                            flexShrink: 0,
                        }} />
                        <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink-1)' }}>{label}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-4)', paddingLeft: 14 }}>
                        {description}
                    </div>
                </div>
                {!editing && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        {isConfigured && (
                            <span style={{
                                fontFamily: "'Geist Mono', monospace", fontSize: 11,
                                color: 'var(--accent-ink)', background: 'var(--accent-soft)',
                                padding: '2px 8px', borderRadius: 4, letterSpacing: .3,
                            }}>configurada</span>
                        )}
                        <button onClick={() => setEditing(true)} style={{
                            padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 500,
                            border: '1px solid var(--line-2)', background: 'var(--paper)',
                            color: 'var(--ink-2)', cursor: 'pointer', fontFamily: 'inherit',
                        }}>
                            {isConfigured ? 'Trocar' : 'Configurar'}
                        </button>
                    </div>
                )}
            </div>
            {editing && (
                <div style={{ display: 'flex', gap: 8, marginTop: 10, paddingLeft: 14 }}>
                    <input
                        type="password"
                        autoFocus
                        placeholder="Cole a chave aqui"
                        value={value}
                        onChange={e => setValue(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && value.trim() && handleSave()}
                        style={{
                            flex: 1, padding: '8px 12px', borderRadius: 7, fontSize: 13,
                            border: '1px solid var(--line-2)', background: 'var(--paper-2)',
                            color: 'var(--ink-1)', fontFamily: 'inherit', outline: 'none',
                        }}
                    />
                    <button onClick={handleSave} disabled={saving || !value.trim()} style={{
                        padding: '8px 14px', borderRadius: 7, fontSize: 12.5, fontWeight: 500,
                        border: '1px solid var(--accent-ink)', background: 'var(--accent)',
                        color: '#fff', cursor: value.trim() ? 'pointer' : 'not-allowed',
                        fontFamily: 'inherit', opacity: (!value.trim() || saving) ? .55 : 1,
                        transition: 'opacity .15s',
                    }}>
                        {saving ? 'Salvando…' : 'Salvar'}
                    </button>
                    <button onClick={() => { setEditing(false); setValue(''); }} style={{
                        padding: '8px 10px', borderRadius: 7, fontSize: 12.5,
                        border: '1px solid var(--line-2)', background: 'transparent',
                        color: 'var(--ink-4)', cursor: 'pointer', fontFamily: 'inherit',
                    }}>✕</button>
                </div>
            )}
        </div>
    );
}

function StatusChip({ ok, label }: { ok: boolean; label: string }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', borderRadius: 8,
            background: ok ? 'var(--accent-soft)' : 'var(--paper-3)',
            border: `1px solid ${ok ? '#c9d8d0' : 'var(--line)'}`,
            marginBottom: 8,
        }}>
            <span style={{ fontSize: 12.5, color: ok ? 'var(--accent-ink)' : 'var(--ink-4)', fontWeight: 500 }}>
                {label}
            </span>
            <span style={{
                fontFamily: "'Geist Mono', monospace", fontSize: 10, letterSpacing: .5,
                color: ok ? 'var(--accent)' : 'var(--ink-5)',
                textTransform: 'uppercase',
            }}>
                {ok ? '● ativo' : '○ pendente'}
            </span>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function Settings() {
    const { logout } = useAuth();
    const qc = useQueryClient();
    const [evolutionUrl, setEvolutionUrl] = useState('');

    const { data: tenant } = useQuery<{
        name: string; slug: string; plan: string; evolutionBaseUrl?: string;
        keys: { geminiApiKey: string | null; evolutionApiKey: string | null };
    }>({
        queryKey: ['tenant'],
        queryFn: () => axios.get('/api/tenant').then(r => r.data),
    });

    const { data: agent } = useQuery<{ name: string; isActive: boolean }>({
        queryKey: ['agent'],
        queryFn: () => axios.get('/api/agent').then(r => r.data),
    });

    const updateKeys = useMutation({
        mutationFn: (body: Record<string, string>) =>
            axios.patch('/api/tenant/keys', body),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['tenant'] }),
    });

    const geminiOk    = !!tenant?.keys?.geminiApiKey;
    const evolutionOk = !!tenant?.keys?.evolutionApiKey;
    const urlOk       = !!tenant?.evolutionBaseUrl;

    // Sync URL input with loaded data
    if (tenant?.evolutionBaseUrl && evolutionUrl === '') setEvolutionUrl(tenant.evolutionBaseUrl);

    return (
        <div style={{
            display: 'flex', flex: 1, height: '100%', overflow: 'hidden',
        }}>
            {/* ── Left column — forms ─────────────────────────────────────────── */}
            <div style={{
                flex: '1 1 0', overflowY: 'auto', padding: '40px 48px',
                borderRight: '1px solid var(--line)',
            }}>
                {/* Header */}
                <div style={{ marginBottom: 40 }}>
                    <div style={{
                        fontFamily: "'Fraunces', serif", fontSize: 40, fontWeight: 400,
                        color: 'var(--ink-1)', letterSpacing: -1, lineHeight: 1,
                        marginBottom: 8,
                    }}>
                        Configurações
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--ink-4)', lineHeight: 1.5 }}>
                        Conta, integrações e chaves de API do seu agente.
                    </div>
                </div>

                {/* Conta */}
                <div style={{ marginBottom: 40 }}>
                    <SectionLabel>Conta</SectionLabel>
                    <RowField label="Empresa"  value={tenant?.name   ?? '—'} />
                    <RowField label="Agente"   value={agent?.name    ?? '—'} />
                    <RowField label="Plano"    value={
                        <span style={{
                            fontFamily: "'Geist Mono', monospace", fontSize: 11,
                            background: 'var(--amber-soft)', color: 'var(--amber)',
                            padding: '2px 8px', borderRadius: 4, letterSpacing: .3,
                        }}>
                            {tenant?.plan ?? '—'}
                        </span>
                    } />
                    <RowField label="Slug"     value={
                        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12, color: 'var(--ink-3)' }}>
                            {tenant?.slug ?? '—'}
                        </span>
                    } />
                </div>

                {/* Chaves de API */}
                <div style={{ marginBottom: 40 }}>
                    <SectionLabel>Chaves de API</SectionLabel>
                    <div style={{
                        fontSize: 12, color: 'var(--ink-4)', marginBottom: 16,
                        padding: '10px 14px', background: 'var(--paper-2)',
                        borderRadius: 8, border: '1px solid var(--line)',
                        lineHeight: 1.55,
                    }}>
                        Armazenadas com segurança no banco de dados. Nunca exibidas após salvas.
                    </div>
                    <KeyField
                        label="Google Gemini"
                        description="Motor de IA para geração de respostas. Obtenha em aistudio.google.com/app/apikey"
                        savedMask={tenant?.keys?.geminiApiKey ?? null}
                        onSave={val => updateKeys.mutateAsync({ geminiApiKey: val }).then(() => {})}
                    />
                    <KeyField
                        label="Evolution API Key"
                        description="Autenticação na sua instância Evolution para envio via WhatsApp"
                        savedMask={tenant?.keys?.evolutionApiKey ?? null}
                        onSave={val => updateKeys.mutateAsync({ evolutionApiKey: val }).then(() => {})}
                    />
                    {/* Evolution URL — input com estado controlado */}
                    <div style={{ padding: '16px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <div style={{
                                width: 6, height: 6, borderRadius: '50%',
                                background: urlOk ? 'var(--accent)' : 'var(--ink-5)', flexShrink: 0,
                            }} />
                            <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink-1)' }}>
                                Evolution Base URL
                            </span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--ink-4)', marginBottom: 10, paddingLeft: 14 }}>
                            Endereço da sua VPS com Evolution API (ex: https://evolution.suavps.com)
                        </div>
                        <div style={{ display: 'flex', gap: 8, paddingLeft: 14 }}>
                            <input
                                value={evolutionUrl}
                                onChange={e => setEvolutionUrl(e.target.value)}
                                placeholder="https://evolution.seudominio.com"
                                style={{
                                    flex: 1, padding: '8px 12px', borderRadius: 7, fontSize: 13,
                                    border: '1px solid var(--line-2)', background: 'var(--paper-2)',
                                    color: 'var(--ink-1)', fontFamily: 'inherit', outline: 'none',
                                }}
                            />
                            <button onClick={() => updateKeys.mutate({ evolutionBaseUrl: evolutionUrl })} style={{
                                padding: '8px 14px', borderRadius: 7, fontSize: 12.5, fontWeight: 500,
                                border: '1px solid var(--accent-ink)', background: 'var(--accent)',
                                color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
                            }}>
                                Salvar
                            </button>
                        </div>
                    </div>
                </div>

                {/* Zona de perigo */}
                <div style={{ marginBottom: 60 }}>
                    <SectionLabel>Zona de perigo</SectionLabel>
                    <div style={{
                        border: '1px solid var(--danger)', borderRadius: 10,
                        overflow: 'hidden',
                    }}>
                        {/* Exportar */}
                        <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '16px 20px', borderBottom: '1px solid var(--danger)',
                            background: 'var(--danger-soft)',
                        }}>
                            <div>
                                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-1)', marginBottom: 2 }}>
                                    Exportar leads — LGPD Art. 15
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                                    Baixar todos os dados em JSON
                                </div>
                            </div>
                            <button onClick={async () => {
                                const res = await axios.get('/api/leads?limit=9999');
                                const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
                                const a = document.createElement('a');
                                a.href = URL.createObjectURL(blob);
                                a.download = `leads-${Date.now()}.json`;
                                a.click();
                            }} style={{
                                padding: '7px 14px', borderRadius: 7, fontSize: 12.5, whiteSpace: 'nowrap',
                                border: '1px solid var(--danger)', background: 'var(--paper)',
                                color: 'var(--danger)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
                            }}>
                                Exportar JSON
                            </button>
                        </div>
                        {/* Sair */}
                        <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '16px 20px', background: 'var(--danger-soft)',
                        }}>
                            <div>
                                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-1)', marginBottom: 2 }}>
                                    Sair da conta
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Encerrar sessão atual</div>
                            </div>
                            <button onClick={logout} style={{
                                padding: '7px 14px', borderRadius: 7, fontSize: 12.5, fontWeight: 500,
                                border: '1px solid var(--danger)', background: 'var(--paper)',
                                color: 'var(--danger)', cursor: 'pointer', fontFamily: 'inherit',
                            }}>
                                Sair
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Right column — status panel ──────────────────────────────────── */}
            <div style={{
                width: 300, flexShrink: 0, background: 'var(--paper-2)',
                overflowY: 'auto', padding: '40px 24px',
                display: 'flex', flexDirection: 'column', gap: 32,
            }}>
                {/* Saúde do sistema */}
                <div>
                    <div style={{
                        fontFamily: "'Geist Mono', monospace", fontSize: 10, letterSpacing: 1.2,
                        textTransform: 'uppercase', color: 'var(--ink-5)', marginBottom: 14,
                    }}>
                        Status das integrações
                    </div>
                    <StatusChip ok={geminiOk}   label="Google Gemini" />
                    <StatusChip ok={evolutionOk} label="Evolution API Key" />
                    <StatusChip ok={urlOk}       label="Evolution Base URL" />

                    {(!geminiOk || !evolutionOk || !urlOk) && (
                        <div style={{
                            marginTop: 12, padding: '10px 12px', borderRadius: 8,
                            background: 'var(--amber-soft)', border: '1px solid var(--amber)',
                            fontSize: 12, color: 'var(--amber)', lineHeight: 1.55,
                        }}>
                            {!geminiOk
                                ? '⚠ Configure o Gemini para o agente responder.'
                                : '⚠ Configure a Evolution para enviar mensagens.'}
                        </div>
                    )}
                </div>

                {/* Resumo da conta */}
                <div>
                    <div style={{
                        fontFamily: "'Geist Mono', monospace", fontSize: 10, letterSpacing: 1.2,
                        textTransform: 'uppercase', color: 'var(--ink-5)', marginBottom: 14,
                    }}>
                        Seu agente
                    </div>
                    <div style={{
                        background: 'var(--paper)', border: '1px solid var(--line)',
                        borderRadius: 10, padding: '16px',
                    }}>
                        <div style={{
                            width: 40, height: 40, borderRadius: '50%',
                            background: 'var(--accent)', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            fontFamily: "'Fraunces', serif", fontSize: 20, color: '#fff',
                            marginBottom: 12,
                        }}>
                            {agent?.name?.[0] ?? 'A'}
                        </div>
                        <div style={{
                            fontFamily: "'Fraunces', serif", fontSize: 18,
                            color: 'var(--ink-1)', letterSpacing: -.3, marginBottom: 2,
                        }}>
                            {agent?.name ?? '—'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>
                            {tenant?.name ?? '—'}
                        </div>
                        <div style={{
                            marginTop: 12, padding: '6px 10px', background: 'var(--paper-2)',
                            borderRadius: 6, display: 'flex', justifyContent: 'space-between',
                        }}>
                            <span style={{
                                fontFamily: "'Geist Mono', monospace", fontSize: 10,
                                color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: .5,
                            }}>Plano</span>
                            <span style={{
                                fontFamily: "'Geist Mono', monospace", fontSize: 10,
                                color: 'var(--amber)', textTransform: 'uppercase', letterSpacing: .5,
                            }}>
                                {tenant?.plan ?? '—'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Dica */}
                <div style={{
                    padding: '14px 16px', background: 'var(--accent-soft)',
                    border: '1px solid #c9d8d0', borderRadius: 10,
                    fontSize: 12, color: 'var(--accent-ink)', lineHeight: 1.6,
                }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>💡 Dica</div>
                    As chaves de API são criptografadas no banco e nunca aparecem em logs.
                    Configure o Gemini primeiro — é o único requisito para o agente funcionar.
                </div>
            </div>
        </div>
    );
}
