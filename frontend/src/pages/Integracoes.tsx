import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

type IntegrationStatus = {
    asaas: { configured: boolean; baseUrl: string; sandbox: boolean; apiKey: string | null; webhookSecret: string | null };
    calendar: { configured: boolean; calendarId: string | null };
};

// ─── Icons ───────────────────────────────────────────────────────────────────

function AsaasIcon({ size = 20 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="3"/>
            <path d="M2 10h20"/>
            <path d="M6 15h4"/>
            <path d="M14 15h4"/>
        </svg>
    );
}

function CalendarIcon({ size = 20 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
            <line x1="8" y1="14" x2="8" y2="14"/>
            <line x1="12" y1="14" x2="12" y2="14"/>
            <line x1="16" y1="14" x2="16" y2="14"/>
            <line x1="8" y1="18" x2="8" y2="18"/>
            <line x1="12" y1="18" x2="12" y2="18"/>
        </svg>
    );
}

function CheckIcon() {
    return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
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

// ─── Shared field components ──────────────────────────────────────────────────

function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '0 32px', padding: '20px 0', borderBottom: '1px solid var(--line)', alignItems: 'start' }}>
            <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-1)', marginBottom: 3 }}>{label}</div>
                {hint && <div style={{ fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.5 }}>{hint}</div>}
            </div>
            <div>{children}</div>
        </div>
    );
}

function SecretField({ savedMask, onSave, placeholder = 'Cole aqui…' }: {
    savedMask: string | null;
    onSave: (val: string) => Promise<void>;
    placeholder?: string;
}) {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState('');
    const [saving, setSaving] = useState(false);

    async function handleSave() {
        if (!value.trim()) return;
        setSaving(true);
        await onSave(value.trim());
        setValue(''); setEditing(false); setSaving(false);
    }

    if (!editing) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {savedMask ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            fontFamily: "'Geist Mono', monospace", fontSize: 11,
                            color: 'var(--accent-ink)', background: 'var(--accent-soft)',
                            padding: '4px 10px', borderRadius: 6, letterSpacing: .3,
                        }}>
                            <CheckIcon /> configurada
                        </span>
                        <button onClick={() => setEditing(true)} style={btnStyle}>Trocar</button>
                    </div>
                ) : (
                    <button onClick={() => setEditing(true)} style={{ ...btnStyle, borderColor: 'var(--accent-ink)', color: 'var(--accent-ink)' }}>
                        Configurar
                    </button>
                )}
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', gap: 8 }}>
            <input
                type="password" autoFocus value={value} onChange={e => setValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                placeholder={placeholder}
                style={inputStyle}
            />
            <button onClick={handleSave} disabled={saving || !value.trim()} style={{
                ...btnStyle, background: 'var(--accent)', color: '#fff',
                borderColor: 'var(--accent-ink)', opacity: (!value.trim() || saving) ? .5 : 1,
            }}>
                {saving ? '…' : 'Salvar'}
            </button>
            <button onClick={() => { setEditing(false); setValue(''); }} style={{ ...btnStyle, padding: '7px 10px' }}>✕</button>
        </div>
    );
}

function TextField({ value, onSave, placeholder }: {
    value: string; onSave: (val: string) => Promise<void>; placeholder?: string;
}) {
    const [local, setLocal] = useState(value);
    const [saving, setSaving] = useState(false);
    const dirty = local !== value && local.trim() !== '';

    // sync when parent updates
    if (value !== '' && local === '') setLocal(value);

    async function handleSave() {
        setSaving(true);
        await onSave(local.trim());
        setSaving(false);
    }

    return (
        <div style={{ display: 'flex', gap: 8 }}>
            <input value={local} onChange={e => setLocal(e.target.value)} placeholder={placeholder} style={inputStyle} />
            <button onClick={handleSave} disabled={!dirty || saving} style={{
                ...btnStyle,
                background: dirty ? 'var(--accent)' : 'var(--paper-3)',
                color: dirty ? '#fff' : 'var(--ink-5)',
                borderColor: dirty ? 'var(--accent-ink)' : 'var(--line)',
                opacity: saving ? .6 : 1,
            }}>
                {saving ? '…' : 'Salvar'}
            </button>
        </div>
    );
}

function CopyField({ value }: { value: string }) {
    const [copied, setCopied] = useState(false);
    function copy() {
        navigator.clipboard.writeText(value).then(() => {
            setCopied(true); setTimeout(() => setCopied(false), 2000);
        });
    }
    return (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{
                flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 12,
                border: '1px solid var(--line)', background: 'var(--paper-2)',
                fontFamily: "'Geist Mono', monospace", color: 'var(--ink-3)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{value}</div>
            <button onClick={copy} style={{
                ...btnStyle, display: 'flex', alignItems: 'center', gap: 5,
                color: copied ? 'var(--accent-ink)' : 'var(--ink-3)',
                background: copied ? 'var(--accent-soft)' : 'var(--paper)',
            }}>
                <CopyIcon /> {copied ? 'Copiado' : 'Copiar'}
            </button>
        </div>
    );
}

// Shared styles
const btnStyle: React.CSSProperties = {
    padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
    border: '1px solid var(--line-2)', background: 'var(--paper)',
    color: 'var(--ink-3)', cursor: 'pointer', fontFamily: 'inherit',
    whiteSpace: 'nowrap', transition: 'all .12s',
};
const inputStyle: React.CSSProperties = {
    flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 13,
    border: '1px solid var(--line-2)', background: 'var(--paper-2)',
    color: 'var(--ink-1)', fontFamily: 'inherit', outline: 'none',
};

// ─── Tab panels ───────────────────────────────────────────────────────────────

function AsaasPanel({ data, patch }: {
    data: IntegrationStatus['asaas'] | undefined;
    patch: (fields: Record<string, string>) => Promise<void>;
}) {
    const isSandbox = data?.sandbox ?? true;
    const webhookBase = window.location.origin.replace(':5173', ':3000');

    return (
        <div>
            <div style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                    <div>
                        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 400, color: 'var(--ink-1)', letterSpacing: -.5, marginBottom: 8 }}>
                            Asaas
                        </h2>
                        <p style={{ fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.6, maxWidth: 480 }}>
                            Gateway de pagamentos brasileiro. Gerencia cobranças, assinaturas e notificações de pagamento dos leads matriculados.
                        </p>
                    </div>
                    <StatusBadge ok={data?.configured ?? false} />
                </div>
            </div>

            <SectionHeading>Autenticação</SectionHeading>

            <FieldRow
                label="API Key"
                hint="Chave de acesso da sua conta Asaas. Encontre em Minha Conta → Integrações."
            >
                <SecretField
                    savedMask={data?.apiKey ?? null}
                    onSave={v => patch({ asaasApiKey: v })}
                    placeholder="$aact_..."
                />
            </FieldRow>

            <FieldRow label="Ambiente" hint="Sandbox para testes, Produção para cobranças reais.">
                <div style={{ display: 'flex', gap: 8 }}>
                    {[
                        { key: 'sandbox', label: 'Sandbox', url: 'https://sandbox.asaas.com/api/v3' },
                        { key: 'producao', label: 'Produção', url: 'https://api.asaas.com/api/v3' },
                    ].map(env => {
                        const active = env.key === 'sandbox' ? isSandbox : !isSandbox;
                        return (
                            <button
                                key={env.key}
                                onClick={() => patch({ asaasBaseUrl: env.url })}
                                style={{
                                    padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                                    border: `1px solid ${active ? 'var(--accent-ink)' : 'var(--line-2)'}`,
                                    background: active ? 'var(--accent-soft)' : 'var(--paper)',
                                    color: active ? 'var(--accent-ink)' : 'var(--ink-3)',
                                    cursor: 'pointer', fontFamily: 'inherit', transition: 'all .12s',
                                }}
                            >
                                {env.label}
                            </button>
                        );
                    })}
                </div>
                {data?.baseUrl && (
                    <div style={{ marginTop: 8, fontFamily: "'Geist Mono', monospace", fontSize: 11, color: 'var(--ink-4)' }}>
                        {data.baseUrl}
                    </div>
                )}
            </FieldRow>

            <SectionHeading style={{ marginTop: 32 }}>Webhook</SectionHeading>

            <FieldRow
                label="Webhook Secret"
                hint="Token para validar eventos enviados pelo Asaas. Configure também no painel Asaas."
            >
                <SecretField
                    savedMask={data?.webhookSecret ?? null}
                    onSave={v => patch({ asaasWebhookSecret: v })}
                />
            </FieldRow>

            <FieldRow
                label="URL do Webhook"
                hint="Cole essa URL no painel Asaas em Configurações → Notificações."
            >
                <CopyField value={`${webhookBase}/webhook/asaas`} />
            </FieldRow>

            <InfoBox>
                O Artemis escuta eventos <code>PAYMENT_RECEIVED</code> e <code>PAYMENT_CONFIRMED</code> para atualizar o status de matrícula dos leads automaticamente e enviar mensagem de confirmação via WhatsApp.
            </InfoBox>
        </div>
    );
}

function CalendarPanel({ data, patch }: {
    data: IntegrationStatus['calendar'] | undefined;
    patch: (fields: Record<string, string>) => Promise<void>;
}) {
    return (
        <div>
            <div style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                    <div>
                        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 400, color: 'var(--ink-1)', letterSpacing: -.5, marginBottom: 8 }}>
                            Google Calendar
                        </h2>
                        <p style={{ fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.6, maxWidth: 480 }}>
                            Permite que o agente consulte disponibilidade e crie agendamentos diretamente no seu calendário durante conversas com leads.
                        </p>
                    </div>
                    <StatusBadge ok={data?.configured ?? false} />
                </div>
            </div>

            <SectionHeading>Calendário</SectionHeading>

            <FieldRow
                label="Calendar ID"
                hint="ID do calendário que o agente usará. Encontre em Google Calendar → Configurações do calendário → ID do calendário."
            >
                <TextField
                    value={data?.calendarId ?? ''}
                    onSave={v => patch({ googleCalendarId: v })}
                    placeholder="exemplo@group.calendar.google.com"
                />
            </FieldRow>

            <SectionHeading style={{ marginTop: 32 }}>Credenciais OAuth</SectionHeading>

            <FieldRow
                label="Arquivo de credenciais"
                hint="As credenciais OAuth do Google devem ser colocadas no servidor manualmente."
            >
                <div>
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '8px 14px', borderRadius: 8,
                        border: '1px solid var(--line)', background: 'var(--paper-2)',
                        fontFamily: "'Geist Mono', monospace", fontSize: 12, color: 'var(--ink-3)',
                    }}>
                        backend/config/google-credentials.json
                    </div>
                </div>
            </FieldRow>

            <FieldRow label="Como obter" hint="">
                <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--ink-3)', lineHeight: 2 }}>
                    <li>Acesse console.cloud.google.com</li>
                    <li>Crie um projeto e ative a Google Calendar API</li>
                    <li>Em Credenciais, crie uma Service Account</li>
                    <li>Baixe o JSON e salve em <code style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12 }}>backend/config/google-credentials.json</code></li>
                    <li>Compartilhe o calendário com o e-mail da Service Account</li>
                </ol>
            </FieldRow>

            <InfoBox>
                O agente usa o Calendar para verificar horários disponíveis e criar eventos de aula experimental ou sessão de orientação durante a conversa com o lead.
            </InfoBox>
        </div>
    );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StatusBadge({ ok }: { ok: boolean }) {
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontFamily: "'Geist Mono', monospace", fontSize: 10, letterSpacing: .8,
            textTransform: 'uppercase', padding: '5px 12px', borderRadius: 20,
            flexShrink: 0, marginTop: 4,
            background: ok ? 'var(--accent-soft)' : 'var(--paper-3)',
            color: ok ? 'var(--accent-ink)' : 'var(--ink-4)',
            border: `1px solid ${ok ? '#c9d8d0' : 'var(--line)'}`,
        }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: ok ? 'var(--accent)' : 'var(--ink-5)', display: 'inline-block' }} />
            {ok ? 'configurado' : 'pendente'}
        </span>
    );
}

function SectionHeading({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
    return (
        <div style={{
            fontFamily: "'Geist Mono', monospace", fontSize: 10, letterSpacing: 1.5,
            textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 0,
            display: 'flex', alignItems: 'center', gap: 10, ...style,
        }}>
            <span>{children}</span>
            <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
        </div>
    );
}

function InfoBox({ children }: { children: React.ReactNode }) {
    return (
        <div style={{
            marginTop: 28, padding: '14px 18px',
            background: 'var(--accent-soft)', border: '1px solid #c9d8d0',
            borderRadius: 10, fontSize: 12.5, color: 'var(--accent-ink)', lineHeight: 1.65,
        }}>
            <div style={{ fontWeight: 600, marginBottom: 4, fontFamily: "'Geist Mono', monospace", fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' }}>
                Como funciona
            </div>
            {children}
        </div>
    );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function BotIcon({ size = 20 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="10" rx="2"/>
            <path d="M12 11V7"/><circle cx="12" cy="5" r="2"/>
            <path d="M8 15h.01M12 15h.01M16 15h.01"/>
        </svg>
    );
}

// ─── Admin Chat Panel ─────────────────────────────────────────────────────────
function AdminChatPanel() {
    const qc = useQueryClient();

    const { data: phoneData, isLoading } = useQuery<{ phone: string | null }>({
        queryKey: ['instance-phone'],
        queryFn: () => axios.get('/api/instances/phone').then(r => r.data),
    });

    const { data: agent } = useQuery<{ settingsJson: Record<string, unknown> }>({
        queryKey: ['agent'],
        queryFn: () => axios.get('/api/agent').then(r => r.data),
    });

    const adminEnabled = agent?.settingsJson?.adminChatEnabled !== false;
    const ownerPhone = agent?.settingsJson?.ownerPhone as string | undefined;

    const refreshPhone = useMutation({
        mutationFn: () => axios.get('/api/instances/phone'),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['instance-phone'] });
            qc.invalidateQueries({ queryKey: ['agent'] });
        },
    });

    const toggleAdmin = useMutation({
        mutationFn: (enabled: boolean) =>
            axios.patch('/api/agent/settings', {
                settingsJson: { ...(agent?.settingsJson ?? {}), adminChatEnabled: enabled },
            }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['agent'] }),
    });

    return (
        <div style={{ maxWidth: 600 }}>
            <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink-1)', marginBottom: 6 }}>Agente Interno</div>
                <div style={{ fontSize: 13.5, color: 'var(--ink-4)', lineHeight: 1.6 }}>
                    Quando você envia uma mensagem para o seu próprio número no WhatsApp, o Artemis entende que é você querendo consultar o sistema — e responde com dados operacionais: leads, métricas, status de atendimento.
                </div>
            </div>

            {/* Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderRadius: 12, border: `1px solid ${adminEnabled ? '#c9d8d0' : 'var(--line)'}`, background: adminEnabled ? 'var(--accent-soft)' : 'var(--paper)', marginBottom: 24 }}>
                <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: adminEnabled ? 'var(--accent-ink)' : 'var(--ink-2)', marginBottom: 3 }}>
                        {adminEnabled ? 'Agente Interno ativo' : 'Agente Interno desativado'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>
                        {adminEnabled ? 'Mensagens para si mesmo ativam o modo admin' : 'Mensagens para si mesmo são salvas normalmente'}
                    </div>
                </div>
                <button onClick={() => toggleAdmin.mutate(!adminEnabled)} disabled={toggleAdmin.isPending} style={{ width: 40, height: 22, borderRadius: 11, border: 'none', padding: 3, cursor: 'pointer', background: adminEnabled ? 'var(--accent)' : 'var(--line-2)', transition: 'background .15s', flexShrink: 0 }}>
                    <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'transform .15s', transform: adminEnabled ? 'translateX(18px)' : 'translateX(0)' }} />
                </button>
            </div>

            {/* Número detectado */}
            <div style={{ padding: '20px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--paper)', marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-4)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>Número do operador</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                        {isLoading ? (
                            <div style={{ fontSize: 13, color: 'var(--ink-4)' }}>Detectando…</div>
                        ) : ownerPhone ? (
                            <div>
                                <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 15, color: 'var(--ink-1)', fontWeight: 600 }}>+{ownerPhone}</div>
                                <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 3 }}>Número conectado ao WhatsApp — detecção automática</div>
                            </div>
                        ) : (
                            <div style={{ fontSize: 13, color: 'var(--ink-4)', fontStyle: 'italic' }}>Número não detectado. Conecte o WhatsApp primeiro.</div>
                        )}
                    </div>
                    <button onClick={() => refreshPhone.mutate()} disabled={refreshPhone.isPending} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 500, border: '1px solid var(--line-2)', background: 'var(--paper-2)', color: 'var(--ink-3)', cursor: 'pointer', fontFamily: 'inherit' }}>
                        {refreshPhone.isPending ? 'Detectando…' : 'Detectar número'}
                    </button>
                </div>
            </div>

            {/* Como usar */}
            <div style={{ padding: '20px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--paper-2)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-4)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>Como usar</div>
                {[
                    ['Abra o WhatsApp', 'Vá em "Conversas" e clique no seu próprio contato (ou "Mensagens salvas")'],
                    ['Envie uma pergunta', 'Ex: "Quantos leads temos?", "Quem mandou mensagem hoje?", "Qual a taxa de conversão?"'],
                    ['Receba a resposta', 'O Artemis responde com dados reais do sistema diretamente no WhatsApp'],
                ].map(([title, desc], i) => (
                    <div key={i} style={{ display: 'flex', gap: 12, marginBottom: i < 2 ? 12 : 0 }}>
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-1)', marginBottom: 2 }}>{title}</div>
                            <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>{desc}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

const TABS = [
    { id: 'asaas', label: 'Asaas', sub: 'Pagamentos', Icon: AsaasIcon },
    { id: 'calendar', label: 'Google Calendar', sub: 'Agendamentos', Icon: CalendarIcon },
    { id: 'admin', label: 'Agente Interno', sub: 'Fale com o bot', Icon: BotIcon },
] as const;

type TabId = typeof TABS[number]['id'];

export function Integracoes() {
    const [active, setActive] = useState<TabId>('asaas');
    const qc = useQueryClient();

    const { data: integs, isLoading } = useQuery<IntegrationStatus>({
        queryKey: ['integrations'],
        queryFn: () => axios.get('/api/integrations').then(r => r.data),
    });

    function patcher(provider: string) {
        return (fields: Record<string, string>) =>
            axios.patch(`/api/integrations/${provider}`, fields)
                .then(() => qc.invalidateQueries({ queryKey: ['integrations'] }));
    }

    const configuredMap: Record<TabId, boolean> = {
        asaas: integs?.asaas.configured ?? false,
        calendar: integs?.calendar.configured ?? false,
        admin: false,
    };

    return (
        <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

            {/* ── Tab nav sidebar ── */}
            <div style={{
                width: 240, flexShrink: 0, borderRight: '1px solid var(--line)',
                background: 'var(--paper)', padding: '32px 0', display: 'flex', flexDirection: 'column',
            }}>
                <div style={{ padding: '0 20px 24px', borderBottom: '1px solid var(--line)', marginBottom: 8 }}>
                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, color: 'var(--ink-1)', marginBottom: 4 }}>
                        Integrações
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>
                        Configure APIs externas
                    </div>
                </div>

                <nav style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {TABS.map(({ id, label, sub, Icon }) => {
                        const isActive = active === id;
                        const ok = configuredMap[id];
                        return (
                            <button
                                key={id}
                                onClick={() => setActive(id)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 12,
                                    padding: '10px 12px', borderRadius: 10,
                                    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                                    background: isActive ? 'var(--accent-soft)' : 'transparent',
                                    color: isActive ? 'var(--accent-ink)' : 'var(--ink-3)',
                                    textAlign: 'left', transition: 'all .12s',
                                }}
                            >
                                <div style={{
                                    width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                                    background: isActive ? 'var(--accent)' : 'var(--paper-2)',
                                    border: `1px solid ${isActive ? 'transparent' : 'var(--line)'}`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: isActive ? '#fff' : 'var(--ink-3)',
                                }}>
                                    <Icon size={16} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 1 }}>{label}</div>
                                    <div style={{ fontSize: 11, color: isActive ? 'var(--accent-ink)' : 'var(--ink-5)' }}>{sub}</div>
                                </div>
                                <span style={{
                                    width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                                    background: ok ? 'var(--accent)' : 'var(--ink-5)',
                                }} />
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* ── Content ── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '40px 52px' }}>
                {isLoading ? (
                    <div style={{ color: 'var(--ink-4)', fontSize: 14 }}>Carregando…</div>
                ) : active === 'asaas' ? (
                    <AsaasPanel data={integs?.asaas} patch={patcher('asaas')} />
                ) : active === 'calendar' ? (
                    <CalendarPanel data={integs?.calendar} patch={patcher('calendar')} />
                ) : (
                    <AdminChatPanel />
                )}
            </div>
        </div>
    );
}
