import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { MediaBubble, type MediaMeta } from '../components/MediaBubble';

// ─── Types ────────────────────────────────────────────────────────────────────

type ConversaItem = {
    id: string;
    name: string | null;
    phoneNumber: string;
    conversationState: string | null;
    lastInteraction: string;
    enrollmentStatus: string;
    isGroup: boolean;
    messages: { content: string; role: string; createdAt: string }[];
};

type LeadDetail = {
    id: string;
    name: string | null;
    phoneNumber: string;
    conversationState: string | null;
    enrollmentStatus: string;
    lastInteraction: string;
    interactionCount: number;
    isGroup: boolean;
    age?: number | null;
    goal?: string | null;
    currentProgramId?: string | null;
    email?: string | null;
    cpf?: string | null;
    lgpdConsent: boolean;
    asaasCustomerId?: string | null;
    lastPaymentUrl?: string | null;
    messages: { id: string; role: string; content: string; createdAt: string; trace?: { toolsUsed: string[]; state: string; modelId: string; programsInjected?: { key: string; name: string; price: number }[]; ragUsed?: { chars: number; snippet: string } | null; audioTranscription?: string } | null; media?: MediaMeta | null }[];
};

// ─── Mock data (used when no real conversations exist) ────────────────────────

// ─── State machine metadata ───────────────────────────────────────────────────

const STATE_META: Record<string, { label: string; color: string; bg: string; desc: string }> = {
    GREETING:             { label: 'Saudação',           color: 'var(--purple)',      bg: 'var(--purple-soft)', desc: 'Agente coletando consentimento LGPD' },
    QUALIFICATION:        { label: 'Qualificação',       color: 'var(--blue)',        bg: 'var(--blue-soft)',   desc: 'Coletando perfil: idade e objetivo' },
    PROGRAM_PRESENTATION: { label: 'Apresentação',       color: 'var(--purple)',      bg: 'var(--purple-soft)', desc: 'Apresentando programas disponíveis' },
    OBJECTION_HANDLING:   { label: 'Objeções',           color: 'var(--amber)',       bg: 'var(--amber-soft)',  desc: 'Respondendo dúvidas e objeções' },
    CLOSING:              { label: 'Fechamento',          color: 'var(--accent)',      bg: 'var(--accent-soft)', desc: 'Enviando link de pagamento' },
    HUMAN_HANDOFF:        { label: 'Atendimento humano', color: 'var(--danger)',      bg: 'var(--danger-soft)', desc: 'Transferido para equipe humana' },
    ORIENTADOR:           { label: 'Orientador',          color: 'var(--teal)',        bg: 'var(--teal-soft)',   desc: 'Assistente interno do sistema' },
};

const ENROLLMENT_META: Record<string, { label: string; color: string; bg: string }> = {
    LEAD:            { label: 'Lead',               color: 'var(--ink-3)',  bg: 'var(--paper-3)'    },
    PAYMENT_PENDING: { label: 'Aguard. pagamento',  color: 'var(--amber)', bg: 'var(--amber-soft)' },
    ENROLLED:        { label: 'Matriculado',         color: 'var(--accent)', bg: 'var(--accent-soft)' },
    CANCELLED:       { label: 'Cancelado',           color: 'var(--danger)', bg: 'var(--danger-soft)' },
};

// Infer state transitions from message sequence (simplified heuristic)
function inferStateTransitions(messages: LeadDetail['messages']): { at: string; state: string; msgIndex: number }[] {
    const transitions: { at: string; state: string; msgIndex: number }[] = [];
    let lastState = '';

    const keywordMap: [RegExp, string][] = [
        [/LGPD|autorização|dados/i, 'GREETING'],
        [/objetivo|idade|perfil/i, 'QUALIFICATION'],
        [/programa|curso|valor|mensalidade/i, 'PROGRAM_PRESENTATION'],
        [/tempo leva|garantia|resultado|dúvid/i, 'OBJECTION_HANDLING'],
        [/link|matrícula|pagamento/i, 'CLOSING'],
        [/humano|equipe|atendente/i, 'HUMAN_HANDOFF'],
    ];

    messages.forEach((msg, i) => {
        if (msg.role !== 'model') return;
        for (const [regex, state] of keywordMap) {
            if (regex.test(msg.content) && state !== lastState) {
                transitions.push({ at: msg.createdAt, state, msgIndex: i });
                lastState = state;
                break;
            }
        }
    });

    return transitions;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'agora';
    if (mins < 60) return `${mins}m atrás`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h atrás`;
    return `há ${Math.floor(hrs / 24)}d`;
}

function formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function initials(name: string | null, phone: string): string {
    if (name) return name.trim().slice(0, 2).toUpperCase();
    return phone.slice(-2);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Avatar({ name, phone, size = 38, active = false }: { name: string | null; phone: string; size?: number; active?: boolean }) {
    return (
        <div style={{
            width: size, height: size, borderRadius: '50%', flexShrink: 0,
            background: active ? 'var(--accent)' : 'var(--paper-3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Fraunces', serif", fontSize: size * .4,
            color: active ? '#fff' : 'var(--ink-3)', fontWeight: 400,
            border: active ? 'none' : '1px solid var(--line)',
        }}>
            {initials(name, phone)}
        </div>
    );
}

function StatePill({ state }: { state: string }) {
    const meta = STATE_META[state];
    if (!meta) return null;
    return (
        <span style={{
            fontFamily: "'Geist Mono', monospace", fontSize: 10, letterSpacing: .6,
            textTransform: 'uppercase', padding: '3px 9px', borderRadius: 20,
            background: meta.bg, color: meta.color, border: `1px solid ${meta.color}22`,
        }}>
            {meta.label}
        </span>
    );
}

function EnrollPill({ status }: { status: string }) {
    const meta = ENROLLMENT_META[status] ?? ENROLLMENT_META.LEAD;
    return (
        <span style={{
            fontFamily: "'Geist Mono', monospace", fontSize: 10, letterSpacing: .6,
            textTransform: 'uppercase', padding: '3px 9px', borderRadius: 20,
            background: meta.bg, color: meta.color,
        }}>
            {meta.label}
        </span>
    );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
            <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--ink-5)', flexShrink: 0 }}>
                {label}
            </span>
            <span style={{ fontSize: 12.5, color: 'var(--ink-2)', textAlign: 'right', wordBreak: 'break-all' }}>
                {value ?? <span style={{ color: 'var(--ink-5)' }}>—</span>}
            </span>
        </div>
    );
}

function StateTransitionChip({ state }: { state: string }) {
    const meta = STATE_META[state];
    if (!meta) return null;
    return (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 8, margin: '12px 0',
        }}>
            <div style={{ flex: 1, height: 1, background: `${meta.color}33` }} />
            <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '4px 12px', borderRadius: 20,
                background: meta.bg, border: `1px solid ${meta.color}44`,
                fontSize: 11, color: meta.color, fontFamily: "'Geist Mono', monospace",
                letterSpacing: .5, textTransform: 'uppercase',
            }}>
                <span style={{ opacity: .7 }}>→</span>
                {meta.label}
            </div>
            <div style={{ flex: 1, height: 1, background: `${meta.color}33` }} />
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

// ─── Editable inline field ────────────────────────────────────────────────────
function EditableField({ label, value, onSave, type = 'text', mono = false }: {
    label: string;
    value: string | number | null | undefined;
    onSave: (v: string) => Promise<void>;
    type?: string;
    mono?: boolean;
}) {
    const [editing, setEditing] = useState(false);
    const [val, setVal] = useState(String(value ?? ''));
    const [saving, setSaving] = useState(false);

    async function save() {
        setSaving(true);
        await onSave(val);
        setSaving(false);
        setEditing(false);
    }

    if (editing) {
        return (
            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--line)', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--ink-4)', fontWeight: 500 }}>{label}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                    <input autoFocus type={type} value={val} onChange={e => setVal(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && save()}
                        style={{ flex: 1, padding: '4px 8px', borderRadius: 6, fontSize: 12, border: '1px solid var(--line-2)', background: 'var(--paper-2)', color: 'var(--ink-1)', fontFamily: mono ? "'Geist Mono', monospace" : 'inherit', outline: 'none' }} />
                    <button onClick={save} disabled={saving} style={{ padding: '4px 8px', borderRadius: 6, fontSize: 11, background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer' }}>{saving ? '…' : '✓'}</button>
                    <button onClick={() => setEditing(false)} style={{ padding: '4px 6px', borderRadius: 6, fontSize: 11, background: 'transparent', border: '1px solid var(--line-2)', color: 'var(--ink-4)', cursor: 'pointer' }}>✕</button>
                </div>
            </div>
        );
    }

    return (
        <div onClick={() => { setVal(String(value ?? '')); setEditing(true); }} style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--line)', alignItems: 'baseline', cursor: 'pointer' }}
            title="Clique para editar">
            <span style={{ fontSize: 12, color: 'var(--ink-4)', fontWeight: 500 }}>{label}</span>
            <span style={{ fontSize: 12, color: value ? 'var(--ink-2)' : 'var(--ink-5)', fontFamily: mono ? "'Geist Mono', monospace" : 'inherit', fontStyle: value ? 'normal' : 'italic' }}>
                {value !== null && value !== undefined && value !== '' ? String(value) : '—'}
            </span>
        </div>
    );
}

// ─── Editable name in header ──────────────────────────────────────────────────
function EditableName({ name, onSave }: { name: string | null; onSave: (v: string) => Promise<void> }) {
    const [editing, setEditing] = useState(false);
    const [val, setVal] = useState(name ?? '');
    const [saving, setSaving] = useState(false);

    async function save() {
        if (!val.trim()) return;
        setSaving(true);
        await onSave(val.trim());
        setSaving(false);
        setEditing(false);
    }

    if (editing) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input autoFocus value={val} onChange={e => setVal(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && save()}
                    style={{ fontSize: 15, fontWeight: 600, padding: '2px 8px', borderRadius: 6, border: '1px solid var(--line-2)', background: 'var(--paper-2)', color: 'var(--ink-1)', fontFamily: 'inherit', outline: 'none', width: 180 }} />
                <button onClick={save} disabled={saving} style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer' }}>{saving ? '…' : '✓'}</button>
                <button onClick={() => setEditing(false)} style={{ padding: '3px 6px', borderRadius: 6, fontSize: 11, background: 'transparent', border: '1px solid var(--line-2)', color: 'var(--ink-4)', cursor: 'pointer' }}>✕</button>
            </div>
        );
    }

    return (
        <div onClick={() => { setVal(name ?? ''); setEditing(true); }} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', borderRadius: 4, padding: '1px 4px', transition: 'background .1s' }}
            title="Clique para editar nome">
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-1)' }}>{name ?? 'Sem nome'}</span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--ink-5)', flexShrink: 0 }}>
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
        </div>
    );
}

// ─── Tool metadata ─────────────────────────────────────────────────────────────

const TOOL_META: Record<string, { label: string; icon: string; color: string }> = {
    check_available_slots:  { label: 'Verificar disponibilidade',   icon: '📅', color: 'var(--blue)'   },
    create_appointment:     { label: 'Criar agendamento',            icon: '✅', color: 'var(--teal)'   },
    find_appointments:      { label: 'Buscar agendamentos',          icon: '🔍', color: 'var(--purple)' },
    cancel_appointment:     { label: 'Cancelar agendamento',         icon: '🗑️', color: 'var(--amber)'  },
    generate_payment:       { label: 'Gerar cobrança',               icon: '💳', color: 'var(--purple)' },
    cancel_asaas_payment:   { label: 'Cancelar cobrança',            icon: '🚫', color: 'var(--danger)' },
    admin_check_calendar_availability: { label: 'Verificar agenda',  icon: '📅', color: 'var(--blue)'   },
    admin_create_calendar_event:       { label: 'Criar evento',      icon: '✅', color: 'var(--teal)'   },
    admin_find_calendar_events:        { label: 'Buscar eventos',    icon: '🔍', color: 'var(--purple)' },
    admin_cancel_calendar_event:       { label: 'Cancelar evento',   icon: '🗑️', color: 'var(--amber)'  },
    admin_create_asaas_customer:       { label: 'Criar cliente Asaas',   icon: '👤', color: 'var(--teal)'   },
    admin_list_asaas_customers:        { label: 'Listar clientes Asaas', icon: '📋', color: 'var(--blue)'   },
    admin_create_asaas_payment:        { label: 'Criar cobrança Asaas',  icon: '💳', color: 'var(--purple)' },
    admin_list_asaas_payments:         { label: 'Listar cobranças Asaas',icon: '📄', color: 'var(--amber)'  },
    admin_update_asaas_payment:        { label: 'Atualizar cobrança Asaas', icon: '✏️', color: 'var(--purple)' },
};

type TraceData = { toolsUsed: string[]; state: string; modelId: string; programsInjected?: { key: string; name: string; price: number }[]; ragUsed?: { chars: number; snippet: string } | null; audioTranscription?: string };

function TraceModal({ trace, onClose }: { trace: TraceData; onClose: () => void }) {
    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, zIndex: 1000,
                background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(2px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    background: 'var(--paper)', borderRadius: 16,
                    border: '1px solid var(--line)', boxShadow: '0 24px 64px rgba(0,0,0,.18)',
                    width: 440, maxWidth: '90vw', padding: '24px 28px',
                    display: 'flex', flexDirection: 'column', gap: 18,
                }}
            >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: 17, color: 'var(--ink-1)' }}>
                        Trace da resposta
                    </div>
                    <button
                        onClick={onClose}
                        style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--line)', background: 'var(--paper-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'var(--ink-4)' }}
                    >
                        ✕
                    </button>
                </div>

                {/* Badges */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'var(--purple-soft)', color: 'var(--purple)', border: '1px solid var(--purple)' }}>
                        {trace.modelId}
                    </span>
                    {(() => {
                        const meta = STATE_META[trace.state];
                        return meta ? (
                            <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, padding: '3px 10px', borderRadius: 20, background: meta.bg, color: meta.color, border: `1px solid ${meta.color}33` }}>
                                {meta.label}
                            </span>
                        ) : (
                            <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'var(--paper-3)', color: 'var(--ink-4)' }}>
                                {trace.state}
                            </span>
                        );
                    })()}
                </div>

                {/* Divider */}
                <div style={{ height: 1, background: 'var(--line)' }} />

                {/* Tools */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9.5, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--ink-5)' }}>
                        Ferramentas chamadas
                    </div>
                    {trace.toolsUsed.length > 0 ? trace.toolsUsed.map(tool => {
                        const meta = TOOL_META[tool] ?? { label: tool, icon: '🔧', color: '#555' };
                        return (
                            <div key={tool} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: 'var(--paper-2)', border: '1px solid var(--line)' }}>
                                <span style={{ fontSize: 18 }}>{meta.icon}</span>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: meta.color }}>{meta.label}</div>
                                    <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: 'var(--ink-5)', marginTop: 1 }}>{tool}</div>
                                </div>
                            </div>
                        );
                    }) : (
                        <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--paper-2)', border: '1px solid var(--line)', fontSize: 13, color: 'var(--ink-4)', fontStyle: 'italic' }}>
                            Sem ferramentas — resposta direta do modelo.
                        </div>
                    )}
                </div>

                {/* Programs injected */}
                {trace.programsInjected && trace.programsInjected.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ height: 1, background: 'var(--line)' }} />
                        <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9.5, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--ink-5)' }}>
                            Programas no contexto ({trace.programsInjected.length})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 180, overflowY: 'auto' }}>
                            {trace.programsInjected.map(p => (
                                <div key={p.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 12px', borderRadius: 8, background: 'var(--paper-2)', border: '1px solid var(--line)' }}>
                                    <span style={{ fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 500 }}>{p.name}</span>
                                    <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: 'var(--accent-ink)' }}>
                                        R$ {p.price?.toLocaleString('pt-BR') ?? '—'}/mês
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* RAG context */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ height: 1, background: 'var(--line)' }} />
                    <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9.5, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--ink-5)' }}>
                        Contexto RAG
                    </div>
                    {trace.ragUsed ? (
                        <div style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--amber-soft)', border: '1px solid var(--amber)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--amber)' }}>RAG ativo</span>
                                <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: 'var(--amber)' }}>{trace.ragUsed.chars.toLocaleString()} chars</span>
                            </div>
                            <div style={{ fontSize: 11.5, color: 'var(--ink-2)', lineHeight: 1.5, fontStyle: 'italic', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                "{trace.ragUsed.snippet}{trace.ragUsed.chars > 300 ? '…' : ''}"
                            </div>
                        </div>
                    ) : (
                        <div style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--paper-2)', border: '1px solid var(--line)', fontSize: 13, color: 'var(--ink-4)', fontStyle: 'italic' }}>
                            Sem contexto RAG — base de conhecimento não consultada.
                        </div>
                    )}
                </div>

                {/* Transcrição de áudio — visível apenas se o input veio de PTT/voice note */}
                {trace.audioTranscription && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{
                            fontFamily: "'Geist Mono', monospace", fontSize: 10,
                            color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: 0.5,
                        }}>
                            Transcrição do áudio (input)
                        </div>
                        <div style={{
                            padding: '10px 14px', borderRadius: 10,
                            background: 'var(--accent-soft)', border: '1px solid var(--accent)',
                            fontSize: 13, color: 'var(--ink-1)', fontStyle: 'italic', lineHeight: 1.6,
                            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        }}>
                            "{trace.audioTranscription}"
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function Conversas() {
    const qc = useQueryClient();
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [tab, setTab] = useState<'contacts' | 'groups'>('contacts');
    const [msgText, setMsgText] = useState('');
    const [traceModal, setTraceModal] = useState<TraceData | null>(null);
    const [mediaPreview, setMediaPreview] = useState<{ base64: string; mediatype: 'image' | 'audio' | 'video' | 'document'; mimetype: string; name: string; previewUrl: string } | null>(null);
    const [mediaSendError, setMediaSendError] = useState<string | null>(null);
    const [recording, setRecording] = useState(false);
    const [recSeconds, setRecSeconds] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef   = useRef<Blob[]>([]);
    const recTimerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    const { data: list = [], isLoading: listLoading } = useQuery<ConversaItem[]>({
        queryKey: ['conversations'],
        queryFn: () => axios.get('/api/conversations').then(r => r.data),
        refetchInterval: 3000,
    });

    const { data: detail } = useQuery<LeadDetail>({
        queryKey: ['lead-detail', selectedId],
        queryFn: () => axios.get(`/api/leads/${selectedId}`).then(r => r.data),
        enabled: !!selectedId,
        refetchInterval: 2000,
        staleTime: 0,
    });

    const sendMsg = useMutation({
        mutationFn: (text: string) => axios.post(`/api/leads/${selectedId}/send`, { text }),
        onSuccess: () => {
            setMsgText('');
            qc.invalidateQueries({ queryKey: ['lead-detail', selectedId] });
            qc.invalidateQueries({ queryKey: ['conversations'] });
        },
    });

    const sendMedia = useMutation({
        mutationFn: (payload: { base64: string; mediatype: string; mimetype: string; caption?: string; fileName?: string }) =>
            axios.post(`/api/leads/${selectedId}/send-media`, payload),
        onSuccess: () => {
            setMediaPreview(null);
            setMediaSendError(null);
            setMsgText('');
            qc.invalidateQueries({ queryKey: ['lead-detail', selectedId] });
            qc.invalidateQueries({ queryKey: ['conversations'] });
        },
        onError: (err: any) => {
            // Clear preview so user doesn't accidentally resend
            setMediaPreview(null);
            const isTimeout = err?.message?.includes('timeout') ||
                err?.response?.data?.error?.includes('timeout');
            setMediaSendError(
                isTimeout
                    ? 'A mídia pode ter sido enviada mas demorou demais para confirmar. Verifique o WhatsApp do contato antes de reenviar.'
                    : `Falha ao enviar mídia: ${err?.response?.data?.error ?? err?.message ?? 'erro desconhecido'}`
            );
            // Auto-dismiss after 12s
            setTimeout(() => setMediaSendError(null), 12_000);
        },
    });

    function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        // 75MB original → ~100MB base64 → hits server limit
        if (file.size > 75 * 1024 * 1024) {
            alert(`Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(0)}MB). Limite: 75MB.`);
            e.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result as string;
            // Strip "data:mime;base64," prefix → raw base64
            const base64 = dataUrl.split(',')[1];
            const mime = file.type;
            let mediatype: 'image' | 'audio' | 'video' | 'document' = 'document';
            if (mime.startsWith('image/'))  mediatype = 'image';
            else if (mime.startsWith('audio/')) mediatype = 'audio';
            else if (mime.startsWith('video/')) mediatype = 'video';
            setMediaPreview({ base64, mediatype, mimetype: mime, name: file.name, previewUrl: dataUrl });
        };
        reader.readAsDataURL(file);
        // Reset so same file can be selected again
        e.target.value = '';
    }

    function fmtRecTime(s: number) {
        return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    }

    async function startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioChunksRef.current = [];

            // Pick best supported mime
            const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
                .find(m => MediaRecorder.isTypeSupported(m)) ?? '';

            const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
            mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
            mr.onstop = () => {
                stream.getTracks().forEach(t => t.stop());
                const blob = new Blob(audioChunksRef.current, { type: mr.mimeType });
                const reader = new FileReader();
                reader.onload = () => {
                    const base64 = (reader.result as string).split(',')[1];
                    sendMedia.mutate({ base64, mediatype: 'audio', mimetype: blob.type });
                };
                reader.readAsDataURL(blob);
            };

            mr.start(200); // collect chunks every 200ms
            mediaRecorderRef.current = mr;
            setRecording(true);
            setRecSeconds(0);
            recTimerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000);
        } catch {
            alert('Permissão de microfone negada ou não disponível.');
        }
    }

    function stopRecording(send: boolean) {
        if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null; }
        const mr = mediaRecorderRef.current;
        if (!mr) return;
        if (!send) {
            // Discard — detach onstop before stopping
            mr.onstop = () => mr.stream?.getTracks().forEach(t => t.stop());
        }
        mr.stop();
        mediaRecorderRef.current = null;
        setRecording(false);
        setRecSeconds(0);
    }

    async function patchLead(fields: Record<string, unknown>) {
        await axios.patch(`/api/leads/${selectedId}`, fields);
        qc.invalidateQueries({ queryKey: ['lead-detail', selectedId] });
        qc.invalidateQueries({ queryKey: ['conversations'] });
    }

    const { data: whitelist } = useQuery<{ groupWhitelistEnabled: boolean; allowedGroups: string[] }>({
        queryKey: ['whitelist'],
        queryFn: () => axios.get('/api/contacts/whitelist').then(r => r.data),
        enabled: tab === 'groups',
    });

    async function toggleGroupWhitelist(groupId: string, currently: boolean) {
        const allowedGroups = whitelist?.allowedGroups ?? [];
        const next = currently
            ? allowedGroups.filter(g => g !== groupId)
            : [...allowedGroups, groupId];
        await axios.put('/api/contacts/whitelist', { allowedGroups: next });
        qc.invalidateQueries({ queryKey: ['whitelist'] });
    }

    async function toggleGroupWhitelistEnabled(enabled: boolean) {
        await axios.put('/api/contacts/whitelist', { groupWhitelistEnabled: enabled });
        qc.invalidateQueries({ queryKey: ['whitelist'] });
    }

    // Auto-scroll para última mensagem
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [detail?.messages?.length]);

    const filtered = list.filter(c => {
        if (tab === 'contacts' && c.isGroup) return false;
        if (tab === 'groups' && !c.isGroup) return false;
        if (!search) return true;
        const q = search.toLowerCase();
        return (c.name ?? '').toLowerCase().includes(q) || c.phoneNumber.includes(q);
    });

    const groupCount = list.filter(c => c.isGroup).length;
    const contactCount = list.filter(c => !c.isGroup).length;

    // Backend retorna desc (mais recente primeiro), reverter para ordem cronológica
    const sortedMessages = detail ? [...detail.messages].reverse() : [];

    const transitions = detail ? inferStateTransitions(sortedMessages) : [];

    // Build annotated message list with state transition markers
    type MsgOrTransition =
        | { type: 'msg'; msg: LeadDetail['messages'][number]; idx: number }
        | { type: 'transition'; state: string; idx: number };

    const annotated: MsgOrTransition[] = [];
    if (detail) {
        const transitionByIndex = new Map(transitions.map(t => [t.msgIndex, t.state]));
        sortedMessages.forEach((msg, i) => {
            const t = transitionByIndex.get(i);
            if (t) annotated.push({ type: 'transition', state: t, idx: i });
            annotated.push({ type: 'msg', msg, idx: i });
        });
    }

    return (
        <>
        <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

            {/* ── 1. Conversation list ── */}
            <div style={{
                width: 280, flexShrink: 0, borderRight: '1px solid var(--line)',
                display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--paper)',
            }}>
                <div style={{ padding: '16px 12px 10px', borderBottom: '1px solid var(--line)' }}>
                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, color: 'var(--ink-1)', marginBottom: 10, padding: '0 4px' }}>
                        Conversas
                    </div>
                    {/* Tabs */}
                    <div style={{ display: 'flex', marginBottom: 10, borderRadius: 8, border: '1px solid var(--line)', overflow: 'hidden', background: 'var(--paper-2)' }}>
                        {([['contacts', `Contatos (${contactCount})`, false], ['groups', `Grupos (${groupCount})`, true]] as const).map(([t, label]) => (
                            <button key={t} onClick={() => { setTab(t); setSelectedId(null); }} style={{
                                flex: 1, padding: '6px 4px', border: 'none', fontSize: 11.5, fontWeight: 500,
                                cursor: 'pointer', fontFamily: 'inherit', transition: 'background .1s',
                                background: tab === t ? 'var(--paper)' : 'transparent',
                                color: tab === t ? 'var(--ink-1)' : 'var(--ink-4)',
                                borderRight: t === 'contacts' ? '1px solid var(--line)' : 'none',
                            }}>{label}</button>
                        ))}
                    </div>
                    <input
                        value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar…"
                        style={{
                            width: '100%', padding: '7px 12px', borderRadius: 8, fontSize: 12.5,
                            border: '1px solid var(--line-2)', background: 'var(--paper-2)',
                            color: 'var(--ink-1)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                        }}
                    />
                </div>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {filtered.map(c => {
                        const isSelected = c.id === selectedId;
                        const lastMsg = c.messages?.[0];
                        return (
                            <div key={c.id} onClick={() => setSelectedId(c.id)} style={{
                                display: 'flex', gap: 10, alignItems: 'flex-start',
                                padding: '12px 16px', cursor: 'pointer',
                                borderBottom: '1px solid var(--line)',
                                background: isSelected ? 'var(--accent-soft)' : 'transparent',
                                transition: 'background .1s',
                            }}
                            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--paper-2)'; }}
                            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                            >
                                <Avatar name={c.name} phone={c.phoneNumber} active={isSelected} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {c.name ?? c.phoneNumber}
                                        </span>
                                        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9.5, color: 'var(--ink-5)', flexShrink: 0, marginLeft: 4 }}>
                                            {timeAgo(c.lastInteraction)}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: 11.5, color: 'var(--ink-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 5 }}>
                                        {lastMsg?.content ?? '—'}
                                    </div>
                                    <div style={{ display: 'flex', gap: 5 }}>
                                        <EnrollPill status={c.enrollmentStatus} />
                                        {c.conversationState && <StatePill state={c.conversationState} />}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {!listLoading && list.length === 0 && (
                    <div style={{ padding: '20px 16px', fontSize: 13, color: 'var(--ink-4)', textAlign: 'center' }}>
                        Nenhuma conversa ainda.
                    </div>
                )}
                {listLoading && (
                    <div style={{ padding: '20px 16px', fontSize: 13, color: 'var(--ink-4)' }}>Carregando…</div>
                )}
            </div>

            {/* ── 2. Chat timeline ── */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
                {!detail ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-4)', fontSize: 14 }}>
                        Selecione uma conversa.
                    </div>
                ) : (
                    <>
                        {/* Chat header */}
                        <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 14, background: 'var(--paper)', flexShrink: 0 }}>
                            <Avatar name={detail.name} phone={detail.phoneNumber} size={42} active />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <EditableName
                                    name={detail.name}
                                    onSave={v => patchLead({ name: v })}
                                />
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 3 }}>
                                    <EnrollPill status={detail.enrollmentStatus} />
                                    {detail.conversationState && <StatePill state={detail.conversationState} />}
                                    <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: 'var(--ink-5)' }}>{detail.interactionCount} msgs</span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: 'var(--ink-4)' }}>{detail.phoneNumber}</div>
                                <button
                                    onClick={async () => {
                                        if (!confirm('Iniciar nova sessão? O agente vai cumprimentar como novo contato, mas o histórico é mantido.')) return;
                                        await axios.post(`/api/leads/${selectedId}/clear-session`);
                                        qc.invalidateQueries({ queryKey: ['lead-detail', selectedId] });
                                        qc.invalidateQueries({ queryKey: ['conversations'] });
                                    }}
                                    title="Iniciar nova sessão"
                                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 6, fontSize: 11, fontWeight: 500, border: '1px solid var(--line-2)', background: 'var(--paper-2)', color: 'var(--ink-4)', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                                >
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                                    Nova sessão
                                </button>
                            </div>
                        </div>

                        {/* Messages */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {annotated.map((item, i) => {
                                if (item.type === 'transition') {
                                    return <StateTransitionChip key={`t-${i}`} state={item.state} />;
                                }

                                const msg = item.msg;

                                // Marcador de nova sessão
                                if (msg.role === 'system') {
                                    return (
                                        <div key={msg.id} style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0' }}>
                                            <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
                                            <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: 'var(--ink-5)', whiteSpace: 'nowrap' }}>{msg.content}</span>
                                            <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
                                        </div>
                                    );
                                }

                                const isAgent = msg.role === 'model';
                                const isOperator = msg.role === 'operator';
                                const isRight = isAgent || isOperator;
                                const isUrl = msg.content.startsWith('http');

                                const hasTrace = isAgent && msg.trace;
                                const isOrientador = msg.trace?.state === 'ORIENTADOR';

                                return (
                                    <div key={msg.id} style={{ display: 'flex', flexDirection: isRight ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8, marginBottom: 4 }}>
                                        {isRight && (
                                            <div style={{ width: 26, height: 26, borderRadius: '50%', background: isOperator ? '#6366f1' : isOrientador ? '#0f766e' : 'var(--accent)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Fraunces', serif", fontSize: 11, color: '#fff' }}>
                                                {isOperator ? 'Op' : isOrientador ? 'O' : 'A'}
                                            </div>
                                        )}
                                        <div
                                            onClick={() => hasTrace && msg.trace && setTraceModal(msg.trace)}
                                            style={{
                                                maxWidth: '68%',
                                                background: isOperator ? 'var(--bubble-operator-bg)' : isAgent ? 'var(--bubble-agent-bg)' : isUrl ? 'var(--paper-2)' : 'var(--paper)',
                                                border: `1px solid ${isOperator ? 'var(--purple)' : isAgent ? (hasTrace ? 'var(--purple)' : 'transparent') : 'var(--line)'}`,
                                                borderRadius: isRight ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                                padding: '10px 14px',
                                                cursor: hasTrace ? 'pointer' : 'default',
                                            }}
                                            title={hasTrace ? 'Clique para ver trace' : undefined}
                                        >
                                            {msg.media ? (
                                                <MediaBubble messageId={msg.id} media={msg.media} isAgent={isAgent} />
                                            ) : isUrl ? (
                                                <a href={msg.content} target="_blank" rel="noreferrer" style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12, color: 'var(--accent-ink)', wordBreak: 'break-all', textDecoration: 'underline' }}>
                                                    {msg.content}
                                                </a>
                                            ) : (
                                                <div style={{ fontSize: 13.5, lineHeight: 1.55, color: isAgent ? 'var(--bubble-agent-color)' : isOperator ? 'var(--bubble-operator-color)' : 'var(--ink-1)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                                    {msg.content}
                                                </div>
                                            )}
                                            <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9.5, color: isAgent ? 'var(--bubble-agent-color)' : 'var(--ink-5)', marginTop: 5, textAlign: 'right', display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center', opacity: isAgent ? 0.45 : 1 }}>
                                                {isOperator && <span style={{ color: 'var(--purple)', fontSize: 9 }}>operador</span>}
                                                {isOrientador && <span style={{ color: 'var(--teal)', fontSize: 9 }}>orientador</span>}
                                                {hasTrace && <span style={{ fontSize: 9, opacity: .6 }}>🔍</span>}
                                                {formatTime(msg.createdAt)}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={bottomRef} />
                        </div>

                        {/* Send input */}
                        <div style={{ flexShrink: 0, borderTop: '1px solid var(--line)', background: 'var(--paper)' }}>
                            {/* Media send error banner */}
                            {mediaSendError && (
                                <div style={{ padding: '8px 16px', background: 'var(--amber-soft)', borderBottom: '1px solid var(--amber)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                    <span style={{ fontSize: 15, flexShrink: 0 }}>⚠</span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--amber)', marginBottom: 1 }}>Atenção</div>
                                        <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.4 }}>{mediaSendError}</div>
                                    </div>
                                    <button onClick={() => setMediaSendError(null)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-4)', fontSize: 14, flexShrink: 0, paddingTop: 2 }}>✕</button>
                                </div>
                            )}

                            {/* Media preview bar */}
                            {mediaPreview && (
                                <div style={{ padding: '10px 16px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
                                    {mediaPreview.mediatype === 'image' ? (
                                        <img src={mediaPreview.previewUrl} alt="preview"
                                            style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)' }} />
                                    ) : (
                                        <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--paper-3)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                                            {mediaPreview.mediatype === 'audio' ? '🎤' : mediaPreview.mediatype === 'video' ? '▶' : '📄'}
                                        </div>
                                    )}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {mediaPreview.name}
                                        </div>
                                        <div style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: "'Geist Mono', monospace", textTransform: 'uppercase', marginTop: 2 }}>
                                            {mediaPreview.mediatype}
                                        </div>
                                    </div>
                                    <button onClick={() => setMediaPreview(null)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--ink-4)', padding: '4px 6px' }}>
                                        ✕
                                    </button>
                                </div>
                            )}

                            <div style={{ padding: '10px 16px 12px', display: 'flex', gap: 8, alignItems: 'center' }}>
                                {/* Hidden file input */}
                                <input ref={fileInputRef} type="file"
                                    accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.zip"
                                    onChange={handleFileSelect} style={{ display: 'none' }} />

                                {recording ? (
                                    /* ── Recording mode ── */
                                    <>
                                        {/* Pulsing dot + timer */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, padding: '0 6px' }}>
                                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--danger)', flexShrink: 0, animation: 'rec-pulse 1s ease-in-out infinite' }} />
                                            <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 14, color: 'var(--ink-1)', fontWeight: 600 }}>
                                                {fmtRecTime(recSeconds)}
                                            </span>
                                            <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>Gravando…</span>
                                        </div>
                                        {/* Discard */}
                                        <button onClick={() => stopRecording(false)} title="Cancelar gravação"
                                            style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--line-2)', background: 'var(--paper-2)', color: 'var(--ink-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                                            </svg>
                                        </button>
                                        {/* Send */}
                                        <button onClick={() => stopRecording(true)} title="Enviar áudio"
                                            style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="20 6 9 17 4 12"/>
                                            </svg>
                                        </button>
                                    </>
                                ) : (
                                    /* ── Normal mode ── */
                                    <>
                                        {/* Attach */}
                                        <button onClick={() => fileInputRef.current?.click()}
                                            disabled={sendMsg.isPending || sendMedia.isPending}
                                            title="Anexar arquivo"
                                            style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--line-2)', background: 'var(--paper-2)', color: 'var(--ink-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.41 17.41a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                                            </svg>
                                        </button>

                                        <input
                                            value={msgText}
                                            onChange={e => setMsgText(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key !== 'Enter' || e.shiftKey) return;
                                                if (mediaPreview) {
                                                    sendMedia.mutate({ base64: mediaPreview.base64, mediatype: mediaPreview.mediatype, mimetype: mediaPreview.mimetype, caption: msgText.trim() || undefined, fileName: mediaPreview.name });
                                                } else if (msgText.trim()) {
                                                    sendMsg.mutate(msgText);
                                                }
                                            }}
                                            placeholder={mediaPreview ? 'Legenda (opcional)…' : 'Enviar mensagem como operador…'}
                                            disabled={sendMsg.isPending || sendMedia.isPending}
                                            style={{ flex: 1, padding: '9px 14px', borderRadius: 20, fontSize: 13, border: '1px solid var(--line-2)', background: 'var(--paper-2)', color: 'var(--ink-1)', fontFamily: 'inherit', outline: 'none' }}
                                        />

                                        {/* Mic — shows when input empty and no media preview */}
                                        {!msgText.trim() && !mediaPreview ? (
                                            <button onClick={startRecording}
                                                disabled={sendMsg.isPending || sendMedia.isPending}
                                                title="Gravar áudio"
                                                style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--line-2)', background: 'var(--paper-2)', color: 'var(--ink-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>
                                                </svg>
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    if (mediaPreview) {
                                                        sendMedia.mutate({ base64: mediaPreview.base64, mediatype: mediaPreview.mediatype, mimetype: mediaPreview.mimetype, caption: msgText.trim() || undefined, fileName: mediaPreview.name });
                                                    } else if (msgText.trim()) {
                                                        sendMsg.mutate(msgText);
                                                    }
                                                }}
                                                disabled={(!msgText.trim() && !mediaPreview) || sendMsg.isPending || sendMedia.isPending}
                                                style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'var(--purple)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'opacity .15s' }}>
                                                {sendMsg.isPending || sendMedia.isPending
                                                    ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                                                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                                                }
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                            <style>{`@keyframes rec-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(0.8)} }`}</style>
                        </div>
                    </>
                )}
            </div>

            {/* ── 3. Lead profile panel ── */}
            {detail && (
                <div style={{
                    width: 300, flexShrink: 0, borderLeft: '1px solid var(--line)',
                    overflowY: 'auto', background: 'var(--paper-2)',
                    display: 'flex', flexDirection: 'column',
                }}>
                    {/* Profile header */}
                    <div style={{ padding: '24px 20px', borderBottom: '1px solid var(--line)', background: 'var(--paper)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                            <Avatar name={detail.name} phone={detail.phoneNumber} size={48} active />
                            <div>
                                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 17, color: 'var(--ink-1)', lineHeight: 1.2, marginBottom: 2 }}>
                                    {detail.name ?? 'Sem nome'}
                                </div>
                                <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: 'var(--ink-4)' }}>
                                    {detail.phoneNumber}
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                            <EnrollPill status={detail.enrollmentStatus} />
                            {detail.conversationState && <StatePill state={detail.conversationState} />}
                        </div>
                    </div>

                    {/* Profile data — editável */}
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
                        <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9.5, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--ink-5)', marginBottom: 4 }}>
                            Perfil <span style={{ color: 'var(--ink-5)', fontSize: 9, marginLeft: 4 }}>clique para editar</span>
                        </div>
                        {!detail.isGroup && <>
                            <EditableField label="Idade" value={detail.age ?? null} type="number" onSave={v => patchLead({ age: v ? Number(v) : null })} />
                            <EditableField label="Email" value={detail.email} type="email" onSave={v => patchLead({ email: v || null })} mono />
                            <EditableField label="Objetivo" value={detail.goal} onSave={v => patchLead({ goal: v || null })} />
                            <EditableField label="Programa" value={detail.currentProgramId?.replace(/_/g, ' ')} onSave={v => patchLead({ currentProgramId: v || null })} />
                            <EditableField label="LGPD" value={detail.lgpdConsent ? 'Consentido' : 'Pendente'} onSave={v => patchLead({ lgpdConsent: v.toLowerCase().includes('consent') })} />
                        </>}
                        <InfoRow label="Mensagens" value={detail.interactionCount} />
                        <InfoRow label="Última ativ." value={timeAgo(detail.lastInteraction)} />
                    </div>

                    {/* Whitelist de grupo */}
                    {detail.isGroup && (
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
                            <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9.5, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--ink-5)', marginBottom: 10 }}>
                                Whitelist
                            </div>
                            {/* Toggle global de whitelist de grupos */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Filtro de grupos ativo</span>
                                <button onClick={() => toggleGroupWhitelistEnabled(!(whitelist?.groupWhitelistEnabled))} style={{ width: 32, height: 18, borderRadius: 9, border: 'none', padding: 2, cursor: 'pointer', background: whitelist?.groupWhitelistEnabled ? 'var(--accent)' : 'var(--line-2)', transition: 'background .15s' }}>
                                    <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'transform .15s', transform: whitelist?.groupWhitelistEnabled ? 'translateX(14px)' : 'translateX(0)' }} />
                                </button>
                            </div>
                            {/* Toggle deste grupo */}
                            {(() => {
                                const inWl = whitelist?.allowedGroups?.includes(detail.phoneNumber) ?? false;
                                return (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 8, border: `1px solid ${inWl ? '#c9d8d0' : 'var(--line)'}`, background: inWl ? 'var(--accent-soft)' : 'var(--paper-2)' }}>
                                        <span style={{ fontSize: 12, fontWeight: 500, color: inWl ? 'var(--accent-ink)' : 'var(--ink-3)' }}>{inWl ? 'Bot responde este grupo' : 'Bot não responde'}</span>
                                        <button onClick={() => toggleGroupWhitelist(detail.phoneNumber, inWl)} style={{ width: 32, height: 18, borderRadius: 9, border: 'none', padding: 2, cursor: 'pointer', background: inWl ? 'var(--accent)' : 'var(--line-2)', transition: 'background .15s' }}>
                                            <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'transform .15s', transform: inWl ? 'translateX(14px)' : 'translateX(0)' }} />
                                        </button>
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {/* Payment */}
                    {(detail.asaasCustomerId || detail.lastPaymentUrl) && (
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
                            <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9.5, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--ink-5)', marginBottom: 8 }}>
                                Pagamento
                            </div>
                            <InfoRow label="Asaas ID" value={
                                <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11 }}>
                                    {detail.asaasCustomerId}
                                </span>
                            } />
                            {detail.lastPaymentUrl && (
                                <div style={{ marginTop: 10 }}>
                                    <a href={detail.lastPaymentUrl} target="_blank" rel="noreferrer" style={{
                                        display: 'block', padding: '8px 12px', borderRadius: 8,
                                        background: 'var(--accent-soft)', border: '1px solid #c9d8d0',
                                        fontSize: 12, color: 'var(--accent-ink)', textDecoration: 'none',
                                        textAlign: 'center', fontWeight: 500,
                                    }}>
                                        Ver link de pagamento →
                                    </a>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Agent decisions */}
                    <div style={{ padding: '16px 20px' }}>
                        <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9.5, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--ink-5)', marginBottom: 12 }}>
                            Decisões do agente
                        </div>
                        {transitions.length === 0 ? (
                            <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>Sem transições detectadas.</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {transitions.map((t, i) => {
                                    const meta = STATE_META[t.state];
                                    if (!meta) return null;
                                    return (
                                        <div key={i} style={{
                                            display: 'flex', alignItems: 'flex-start', gap: 10,
                                            padding: '8px 10px', borderRadius: 8,
                                            background: meta.bg, border: `1px solid ${meta.color}22`,
                                        }}>
                                            <div style={{
                                                width: 6, height: 6, borderRadius: '50%',
                                                background: meta.color, flexShrink: 0, marginTop: 4,
                                            }} />
                                            <div>
                                                <div style={{ fontSize: 12, fontWeight: 600, color: meta.color, marginBottom: 1 }}>
                                                    {meta.label}
                                                </div>
                                                <div style={{ fontSize: 11, color: meta.color, opacity: .75 }}>
                                                    {meta.desc}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>

        {traceModal && <TraceModal trace={traceModal} onClose={() => setTraceModal(null)} />}
        </>
    );
}
