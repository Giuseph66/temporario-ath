import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

// ─── Icons ───────────────────────────────────────────────────────────────────

function EyeIcon({ open }: { open: boolean }) {
    return open ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
        </svg>
    ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
    );
}

function CopyIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
    );
}

// ─── Shared components ────────────────────────────────────────────────────────

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
            gap: 16, padding: '11px 0', borderBottom: '1px solid var(--line)', alignItems: 'baseline',
        }}>
            <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10.5, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: .6 }}>{label}</span>
            <span style={{ fontSize: 13, color: 'var(--ink-1)' }}>{value}</span>
        </div>
    );
}

function KeyField({ label, description, savedMask, onSave }: {
    label: string; description: string;
    savedMask: string | null;
    onSave: (val: string) => Promise<void>;
}) {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState('');
    const [show, setShow] = useState(false);
    const [saving, setSaving] = useState(false);
    const isConfigured = !!savedMask;

    async function handleSave() {
        if (!value.trim()) return;
        setSaving(true);
        await onSave(value.trim());
        setValue(''); setEditing(false); setSaving(false);
    }

    return (
        <div style={{ padding: '16px 0', borderBottom: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: isConfigured ? 'var(--accent)' : 'var(--ink-5)', flexShrink: 0 }} />
                        <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink-1)' }}>{label}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-4)', paddingLeft: 14 }}>{description}</div>
                </div>
                {!editing && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        {isConfigured && (
                            <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: 'var(--accent-ink)', background: 'var(--accent-soft)', padding: '2px 8px', borderRadius: 4 }}>
                                configurada
                            </span>
                        )}
                        <button onClick={() => setEditing(true)} style={{ padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 500, border: '1px solid var(--line-2)', background: 'var(--paper)', color: 'var(--ink-2)', cursor: 'pointer', fontFamily: 'inherit' }}>
                            {isConfigured ? 'Trocar' : 'Configurar'}
                        </button>
                    </div>
                )}
            </div>
            {editing && (
                <div style={{ display: 'flex', gap: 8, marginTop: 10, paddingLeft: 14 }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                        <input
                            type={show ? 'text' : 'password'} autoFocus value={value}
                            onChange={e => setValue(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSave()}
                            placeholder="Cole a chave aqui"
                            style={{ width: '100%', padding: '8px 38px 8px 12px', borderRadius: 7, fontSize: 13, border: '1px solid var(--line-2)', background: 'var(--paper-2)', color: 'var(--ink-1)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                        />
                        <button type="button" onClick={() => setShow(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-4)', padding: 0, display: 'flex', alignItems: 'center' }}>
                            <EyeIcon open={show} />
                        </button>
                    </div>
                    <button onClick={handleSave} disabled={saving || !value.trim()} style={{ padding: '8px 14px', borderRadius: 7, fontSize: 12.5, fontWeight: 500, border: '1px solid var(--accent-ink)', background: 'var(--accent)', color: '#fff', cursor: value.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit', opacity: (!value.trim() || saving) ? .55 : 1 }}>
                        {saving ? '…' : 'Salvar'}
                    </button>
                    <button onClick={() => { setEditing(false); setValue(''); }} style={{ padding: '8px 10px', borderRadius: 7, fontSize: 12.5, border: '1px solid var(--line-2)', background: 'transparent', color: 'var(--ink-4)', cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
                </div>
            )}
        </div>
    );
}

// ─── WhatsApp provider tabs ───────────────────────────────────────────────────

type EvolutionStatus = { status: 'open' | 'close' | 'connecting' | 'not_created'; instance?: string };
type QRData = { status: string; qr: string | null };
type WebhookStatus = { configured: boolean; url: string | null; enabled: boolean };

function EvolutionTab() {
    const qc = useQueryClient();

    const { data: statusData } = useQuery<EvolutionStatus>({
        queryKey: ['instance-status'],
        queryFn: () => axios.get('/api/instances/status').then(r => r.data),
        refetchInterval: (q) => {
            const s = q.state.data?.status;
            return s === 'connecting' ? 3000 : 15000;
        },
    });

    const { data: qrData } = useQuery<QRData>({
        queryKey: ['instance-qr'],
        queryFn: () => axios.get('/api/instances/qrcode').then(r => r.data),
        enabled: statusData?.status === 'connecting',
        refetchInterval: 4000,
    });

    const { data: webhookData } = useQuery<WebhookStatus>({
        queryKey: ['instance-webhook-status'],
        queryFn: () => axios.get('/api/instances/webhook-status').then(r => r.data),
        enabled: statusData?.status === 'open',
        refetchInterval: 30000,
    });

    const createInstance = useMutation({
        mutationFn: () => axios.post('/api/instances/create'),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['instance-status'] });
            qc.invalidateQueries({ queryKey: ['instance-webhook-status'] });
        },
    });

    const disconnect = useMutation({
        mutationFn: () => axios.delete('/api/instances/disconnect'),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['instance-status'] });
            qc.invalidateQueries({ queryKey: ['instance-webhook-status'] });
        },
    });

    const configureWh = useMutation({
        mutationFn: () => axios.post('/api/instances/webhook'),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['instance-webhook-status'] }),
    });

    const status = statusData?.status ?? 'not_created';
    const instance = statusData?.instance;

    const STATUS_COLOR: Record<string, string> = {
        open: 'var(--accent)', connecting: '#b45309', close: 'var(--danger)', not_created: 'var(--ink-5)',
    };
    const STATUS_LABEL: Record<string, string> = {
        open: 'Conectado', connecting: 'Conectando…', close: 'Desconectado', not_created: 'Não criado',
    };

    return (
        <div>
            {/* WhatsApp status bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--paper)', marginBottom: status === 'open' ? 12 : 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_COLOR[status], flexShrink: 0 }} />
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-1)' }}>{STATUS_LABEL[status]}</div>
                        {instance && (
                            <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10.5, color: 'var(--ink-4)', marginTop: 1 }}>{instance}</div>
                        )}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    {status === 'not_created' && (
                        <button onClick={() => createInstance.mutate()} disabled={createInstance.isPending} style={btnGreen}>
                            {createInstance.isPending ? 'Criando…' : 'Criar instância'}
                        </button>
                    )}
                    {status === 'close' && (
                        <button onClick={() => createInstance.mutate()} disabled={createInstance.isPending} style={btnGreen}>
                            {createInstance.isPending ? 'Reconectando…' : 'Reconectar'}
                        </button>
                    )}
                    {(status === 'open' || status === 'connecting') && (
                        <button onClick={() => { if (confirm('Desconectar instância WhatsApp?')) disconnect.mutate(); }} disabled={disconnect.isPending} style={btnDanger}>
                            {disconnect.isPending ? 'Desconectando…' : 'Desconectar'}
                        </button>
                    )}
                </div>
            </div>

            {/* Webhook status bar — só aparece quando WhatsApp conectado */}
            {status === 'open' && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderRadius: 10, border: `1px solid ${webhookData?.configured ? '#c9d8d0' : 'var(--line)'}`, background: webhookData?.configured ? 'var(--accent-soft)' : 'var(--paper-2)', marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: webhookData?.configured ? 'var(--accent)' : 'var(--ink-5)', flexShrink: 0 }} />
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: webhookData?.configured ? 'var(--accent-ink)' : 'var(--ink-3)' }}>
                                {webhookData?.configured ? 'Webhook configurado' : 'Webhook não configurado'}
                            </div>
                            {webhookData?.url && (
                                <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: 'var(--ink-4)', marginTop: 1 }}>{webhookData.url}</div>
                            )}
                        </div>
                    </div>
                    {!webhookData?.configured && (
                        <button onClick={() => configureWh.mutate()} disabled={configureWh.isPending} style={btnGreen}>
                            {configureWh.isPending ? 'Configurando…' : 'Configurar webhook'}
                        </button>
                    )}
                </div>
            )}

            {/* QR Code */}
            {status === 'connecting' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px', border: '1px solid var(--line)', borderRadius: 12, background: 'var(--paper)', marginBottom: 20 }}>
                    <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 16 }}>
                        Escaneie o QR Code com o WhatsApp
                    </div>
                    {qrData?.qr ? (
                        <img src={qrData.qr} alt="QR Code WhatsApp" style={{ width: 220, height: 220, borderRadius: 8 }} />
                    ) : (
                        <div style={{ width: 220, height: 220, borderRadius: 8, background: 'var(--paper-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
                            Aguardando QR…
                        </div>
                    )}
                    <div style={{ marginTop: 12, fontSize: 12, color: 'var(--ink-4)', textAlign: 'center' }}>
                        Abra o WhatsApp → Dispositivos vinculados → Vincular dispositivo
                    </div>
                </div>
            )}
        </div>
    );
}

function MetaTab({ metaAccessToken, onSave }: {
    metaAccessToken: string | null;
    onSave: (val: string) => Promise<void>;
}) {
    const [copied, setCopied] = useState(false);
    const webhookUrl = `${window.location.origin.replace(':5173', ':3000')}/webhook`;

    function copy() {
        navigator.clipboard.writeText(webhookUrl).then(() => {
            setCopied(true); setTimeout(() => setCopied(false), 2000);
        });
    }

    return (
        <div>
            <KeyField
                label="Access Token"
                description="Token permanente da Meta Business API. Obtenha em developers.facebook.com → WhatsApp → API Setup."
                savedMask={metaAccessToken}
                onSave={onSave}
            />

            {/* Webhook URL */}
            <div style={{ padding: '16px 0', borderBottom: '1px solid var(--line)' }}>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink-1)', marginBottom: 3 }}>URL do Webhook</div>
                <div style={{ fontSize: 12, color: 'var(--ink-4)', marginBottom: 10 }}>Cole essa URL no painel Meta → Webhooks. Assinar o campo <span style={{ fontFamily: "'Geist Mono', monospace" }}>messages</span>.</div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 12, border: '1px solid var(--line)', background: 'var(--paper-2)', fontFamily: "'Geist Mono', monospace", color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {webhookUrl}
                    </div>
                    <button onClick={copy} style={{ ...btnBase, display: 'flex', alignItems: 'center', gap: 5, color: copied ? 'var(--accent-ink)' : 'var(--ink-3)', background: copied ? 'var(--accent-soft)' : 'var(--paper)' }}>
                        <CopyIcon /> {copied ? 'Copiado' : 'Copiar'}
                    </button>
                </div>
            </div>

        </div>
    );
}

// Shared button styles
const btnBase: React.CSSProperties = {
    padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
    border: '1px solid var(--line-2)', background: 'var(--paper)',
    color: 'var(--ink-3)', cursor: 'pointer', fontFamily: 'inherit',
    whiteSpace: 'nowrap', transition: 'all .12s',
};
const btnGreen: React.CSSProperties = {
    ...btnBase, background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent-ink)',
};
const btnDanger: React.CSSProperties = {
    ...btnBase, border: '1px solid var(--danger)', color: 'var(--danger)',
};

// ─── Main ─────────────────────────────────────────────────────────────────────

export function Settings() {
    const { logout } = useAuth();
    const qc = useQueryClient();
    const [whatsappTab, setWhatsappTab] = useState<'evolution' | 'meta'>('evolution');

    const { data: tenant } = useQuery<{ name: string; slug: string; plan: string; keys: { geminiApiKey: string | null } }>({
        queryKey: ['tenant'],
        queryFn: () => axios.get('/api/tenant').then(r => r.data),
    });

    const { data: agent } = useQuery<{ name: string; isActive: boolean }>({
        queryKey: ['agent'],
        queryFn: () => axios.get('/api/agent').then(r => r.data),
    });

    const { data: integs } = useQuery<{
        meta: { configured: boolean; accessToken: string | null };
    }>({
        queryKey: ['integrations'],
        queryFn: () => axios.get('/api/integrations').then(r => r.data),
    });

    const updateKeys = useMutation({
        mutationFn: (body: Record<string, string>) => axios.patch('/api/tenant/keys', body),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['tenant'] }),
    });

    const patchMeta = (body: Record<string, string>) =>
        axios.patch('/api/integrations/meta', body)
            .then(() => qc.invalidateQueries({ queryKey: ['integrations'] }));

    const geminiOk = !!tenant?.keys?.geminiApiKey;

    const { data: agentSettings } = useQuery<{ settingsJson: Record<string, unknown> }>({
        queryKey: ['agent-settings'],
        queryFn: () => axios.get('/api/agent').then(r => r.data),
    });
    const ignoreGroups = agentSettings?.settingsJson?.ignoreGroups !== false;

    const patchAgentSetting = useMutation({
        mutationFn: (patch: Record<string, unknown>) =>
            axios.patch('/api/agent/settings', { settingsJson: { ...(agentSettings?.settingsJson ?? {}), ...patch } }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['agent-settings'] }),
    });

    const { data: instanceStatus } = useQuery<EvolutionStatus>({
        queryKey: ['instance-status'],
        queryFn: () => axios.get('/api/instances/status').then(r => r.data),
        refetchInterval: 30000,
    });

    const evolutionActive = instanceStatus?.status === 'open' || instanceStatus?.status === 'connecting';
    const metaActive = !!integs?.meta?.configured;

    // Garante que a tab ativa não conflite com um provider já configurado
    const effectiveTab = (whatsappTab === 'meta' && evolutionActive) ? 'evolution'
        : (whatsappTab === 'evolution' && metaActive && !evolutionActive) ? 'meta'
        : whatsappTab;

    return (
        <div style={{ display: 'flex', flex: 1, height: '100%', overflow: 'hidden' }}>

            {/* ── Left column ── */}
            <div style={{ flex: '1 1 0', overflowY: 'auto', padding: '40px 48px', borderRight: '1px solid var(--line)' }}>
                <div style={{ marginBottom: 40 }}>
                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: 40, fontWeight: 400, color: 'var(--ink-1)', letterSpacing: -1, lineHeight: 1, marginBottom: 8 }}>Configurações</div>
                    <div style={{ fontSize: 14, color: 'var(--ink-4)' }}>Conta, IA e conexão WhatsApp.</div>
                </div>

                {/* Conta */}
                <div style={{ marginBottom: 40 }}>
                    <SectionLabel>Conta</SectionLabel>
                    <RowField label="Empresa" value={tenant?.name ?? '—'} />
                    <RowField label="Agente" value={agent?.name ?? '—'} />
                    <RowField label="Plano" value={
                        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, background: 'var(--amber-soft)', color: 'var(--amber)', padding: '2px 8px', borderRadius: 4 }}>
                            {tenant?.plan ?? '—'}
                        </span>
                    } />
                    <RowField label="Slug" value={
                        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12, color: 'var(--ink-3)' }}>{tenant?.slug ?? '—'}</span>
                    } />
                </div>

                {/* IA */}
                <div style={{ marginBottom: 40 }}>
                    <SectionLabel>Inteligência Artificial</SectionLabel>
                    <KeyField
                        label="Google Gemini API Key"
                        description="Motor de IA para geração de respostas. Obtenha em aistudio.google.com/app/apikey"
                        savedMask={tenant?.keys?.geminiApiKey ?? null}
                        onSave={val => updateKeys.mutateAsync({ geminiApiKey: val }).then(() => {})}
                    />
                </div>

                {/* WhatsApp */}
                <div style={{ marginBottom: 40 }}>
                    <SectionLabel>WhatsApp</SectionLabel>

                    {/* Provider selector */}
                    <div style={{ display: 'flex', gap: 0, marginBottom: 24, border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden', background: 'var(--paper-2)' }}>
                        {(['evolution', 'meta'] as const).map(tab => {
                            const active = effectiveTab === tab;
                            const locked = (tab === 'meta' && evolutionActive) || (tab === 'evolution' && metaActive && !evolutionActive);
                            const labels = { evolution: 'Evolution API', meta: 'Meta WhatsApp Business' };
                            const descs = { evolution: 'WhatsApp via servidor próprio', meta: 'API Oficial do WhatsApp' };
                            return (
                                <button key={tab}
                                    onClick={() => !locked && setWhatsappTab(tab)}
                                    title={locked ? `Desconecte o provider ativo antes de configurar ${labels[tab]}` : undefined}
                                    style={{
                                        flex: 1, padding: '14px 20px', textAlign: 'left',
                                        border: 'none', borderRight: tab === 'evolution' ? '1px solid var(--line)' : 'none',
                                        background: active ? 'var(--paper)' : 'transparent',
                                        cursor: locked ? 'not-allowed' : 'pointer',
                                        fontFamily: 'inherit', transition: 'background .15s',
                                        opacity: locked ? 0.45 : 1,
                                    }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: active ? 'var(--ink-1)' : 'var(--ink-4)' }}>{labels[tab]}</span>
                                        {locked && (
                                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--ink-5)' }}>
                                                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                            </svg>
                                        )}
                                    </div>
                                    <div style={{ fontSize: 11.5, color: active ? 'var(--ink-4)' : 'var(--ink-5)', marginTop: 2 }}>{descs[tab]}</div>
                                    {active && <div style={{ width: 24, height: 2, background: 'var(--accent)', borderRadius: 1, marginTop: 8 }} />}
                                </button>
                            );
                        })}
                    </div>

                    {evolutionActive && effectiveTab === 'meta' ? null : effectiveTab === 'evolution' ? (
                        <EvolutionTab />
                    ) : (
                        <MetaTab
                            metaAccessToken={integs?.meta.accessToken ?? null}
                            onSave={val => patchMeta({ metaAccessToken: val })}
                        />
                    )}
                </div>

                {/* Comportamento */}
                <div style={{ marginBottom: 40 }}>
                    <SectionLabel>Comportamento do bot</SectionLabel>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--paper)' }}>
                        <div>
                            <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink-1)', marginBottom: 2 }}>Ignorar mensagens de grupos</div>
                            <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>
                                {ignoreGroups
                                    ? 'Mensagens de grupos são salvas mas o bot não responde'
                                    : 'Bot responde mensagens de grupos (use com cuidado)'}
                            </div>
                        </div>
                        <button onClick={() => patchAgentSetting.mutate({ ignoreGroups: !ignoreGroups })} disabled={patchAgentSetting.isPending} style={{ width: 36, height: 20, borderRadius: 10, border: 'none', padding: 2, cursor: 'pointer', background: ignoreGroups ? 'var(--accent)' : 'var(--line-2)', transition: 'background .15s', flexShrink: 0 }}>
                            <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'transform .15s', transform: ignoreGroups ? 'translateX(16px)' : 'translateX(0)' }} />
                        </button>
                    </div>
                </div>

                {/* Zona de perigo */}
                <div style={{ marginBottom: 60 }}>
                    <SectionLabel>Zona de perigo</SectionLabel>
                    <div style={{ border: '1px solid var(--danger)', borderRadius: 10, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--danger)', background: 'var(--danger-soft)' }}>
                            <div>
                                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-1)', marginBottom: 2 }}>Exportar leads — LGPD Art. 15</div>
                                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Baixar todos os dados em JSON</div>
                            </div>
                            <button onClick={async () => {
                                const res = await axios.get('/api/leads?limit=9999');
                                const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
                                const a = document.createElement('a');
                                a.href = URL.createObjectURL(blob);
                                a.download = `leads-${Date.now()}.json`;
                                a.click();
                            }} style={{ padding: '7px 14px', borderRadius: 7, fontSize: 12.5, whiteSpace: 'nowrap', border: '1px solid var(--danger)', background: 'var(--paper)', color: 'var(--danger)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
                                Exportar JSON
                            </button>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'var(--danger-soft)' }}>
                            <div>
                                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-1)', marginBottom: 2 }}>Sair da conta</div>
                                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Encerrar sessão atual</div>
                            </div>
                            <button onClick={logout} style={{ padding: '7px 14px', borderRadius: 7, fontSize: 12.5, fontWeight: 500, border: '1px solid var(--danger)', background: 'var(--paper)', color: 'var(--danger)', cursor: 'pointer', fontFamily: 'inherit' }}>
                                Sair
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Right column ── */}
            <div style={{ width: 280, flexShrink: 0, background: 'var(--paper-2)', overflowY: 'auto', padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: 28 }}>
                {/* Status */}
                <div>
                    <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--ink-5)', marginBottom: 12 }}>Status</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 8, background: geminiOk ? 'var(--accent-soft)' : 'var(--paper-3)', border: `1px solid ${geminiOk ? '#c9d8d0' : 'var(--line)'}` }}>
                        <span style={{ fontSize: 12.5, color: geminiOk ? 'var(--accent-ink)' : 'var(--ink-4)', fontWeight: 500 }}>Google Gemini</span>
                        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: geminiOk ? 'var(--accent)' : 'var(--ink-5)', textTransform: 'uppercase' }}>{geminiOk ? '● ativo' : '○ pendente'}</span>
                    </div>
                    {!geminiOk && (
                        <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 8, background: 'var(--amber-soft)', border: '1px solid var(--amber)', fontSize: 12, color: 'var(--amber)', lineHeight: 1.55 }}>
                            Configure o Gemini — sem ele o agente não responde.
                        </div>
                    )}
                </div>

                {/* Agent card */}
                <div>
                    <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--ink-5)', marginBottom: 12 }}>Seu agente</div>
                    <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 10, padding: 16 }}>
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Fraunces', serif", fontSize: 20, color: '#fff', marginBottom: 10 }}>
                            {agent?.name?.[0] ?? 'A'}
                        </div>
                        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, color: 'var(--ink-1)', letterSpacing: -.3, marginBottom: 2 }}>{agent?.name ?? '—'}</div>
                        <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>{tenant?.name ?? '—'}</div>
                        <div style={{ marginTop: 12, padding: '6px 10px', background: 'var(--paper-2)', borderRadius: 6, display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: .5 }}>Plano</span>
                            <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: 'var(--amber)', textTransform: 'uppercase', letterSpacing: .5 }}>{tenant?.plan ?? '—'}</span>
                        </div>
                    </div>
                </div>

                <div style={{ padding: '14px 16px', background: 'var(--accent-soft)', border: '1px solid #c9d8d0', borderRadius: 10, fontSize: 12, color: 'var(--accent-ink)', lineHeight: 1.6 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>Dica</div>
                    Chaves de API são armazenadas com segurança e nunca retornam em logs. Configure Gemini primeiro.
                </div>
            </div>
        </div>
    );
}
