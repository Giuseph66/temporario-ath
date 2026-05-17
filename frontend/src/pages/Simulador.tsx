import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

// ─── Types ────────────────────────────────────────────────────────────────────

type AgentType = 'atendente' | 'orientador';
type SimMode   = 'cliente'   | 'dono';
type ConvState =
    | 'GREETING' | 'QUALIFICATION' | 'PROGRAM_PRESENTATION'
    | 'OBJECTION_HANDLING' | 'CLOSING';

type TraceData = {
    toolsUsed: string[];
    state: string;
    modelId: string;
    ragUsed?: { chars: number; snippet: string };
};

type SimMessage = {
    id: string;
    role: 'user' | 'model';
    content: string;
    trace?: TraceData | null;
};

type Session = {
    id: string;
    title: string;
    agentType: string;
    convState: string;
    simMode: string;
    createdAt: string;
    updatedAt: string;
    messages?: SimMessage[];
};

// Per-tab isolated state — lives in cacheRef, never shared between tabs
type TabState = {
    messages: SimMessage[];
    agentType: AgentType;
    convState: ConvState;
    simMode: SimMode;
    lastTrace: TraceData | null;
    isPending: boolean;
    loaded: boolean;
    error: string | null;
};

function defaultTab(): TabState {
    return { messages: [], agentType: 'atendente', convState: 'GREETING', simMode: 'cliente', lastTrace: null, isPending: false, loaded: false, error: null };
}

// ─── LocalStorage (24h TTL) ───────────────────────────────────────────────────

const LS_KEY = 'artemis_sim_tabs';
const LS_TTL = 24 * 60 * 60 * 1000;

function lsSave(activeId: string, tabOrder: string[]) {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ activeId, tabOrder, ts: Date.now() })); } catch {}
}
function lsLoad(): { activeId: string; tabOrder: string[] } | null {
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (Date.now() - data.ts > LS_TTL) { localStorage.removeItem(LS_KEY); return null; }
        return data;
    } catch { return null; }
}
function lsClear() { try { localStorage.removeItem(LS_KEY); } catch {} }

// ─── Unique title ─────────────────────────────────────────────────────────────

function uniqueTitle(text: string, sessions: Session[]): string {
    const base = text.slice(0, 40) + (text.length > 40 ? '…' : '');
    const taken = new Set(sessions.map(s => s.title));
    if (!taken.has(base)) return base;
    let i = 2;
    while (taken.has(`${base} (${i})`)) i++;
    return `${base} (${i})`;
}

function normalizeTrace(trace: unknown): TraceData | null {
    if (!trace || typeof trace !== 'object') return null;
    const t = trace as Partial<TraceData>;
    return {
        toolsUsed: Array.isArray(t.toolsUsed) ? t.toolsUsed : [],
        state: typeof t.state === 'string' ? t.state : 'UNKNOWN',
        modelId: typeof t.modelId === 'string' ? t.modelId : 'unknown',
        ...(t.ragUsed ? { ragUsed: t.ragUsed } : {}),
    };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CONV_STATES: { value: ConvState; label: string }[] = [
    { value: 'GREETING',             label: 'Saudação'     },
    { value: 'QUALIFICATION',        label: 'Qualificação' },
    { value: 'PROGRAM_PRESENTATION', label: 'Apresentação' },
    { value: 'OBJECTION_HANDLING',   label: 'Objeções'     },
    { value: 'CLOSING',              label: 'Fechamento'   },
];

const STATE_COLORS: Record<string, { bg: string; color: string }> = {
    GREETING:             { bg: 'var(--paper-3)',     color: 'var(--ink-3)'      },
    QUALIFICATION:        { bg: 'var(--accent-soft)', color: 'var(--accent-ink)' },
    PROGRAM_PRESENTATION: { bg: 'var(--amber-soft)',  color: 'var(--amber)'      },
    OBJECTION_HANDLING:   { bg: 'var(--danger-soft)', color: 'var(--danger)'     },
    CLOSING:              { bg: 'var(--accent-soft)', color: 'var(--accent-ink)' },
    ORIENTADOR:           { bg: 'var(--teal-soft)',   color: 'var(--teal)'       },
};

// ─── Small UI components ──────────────────────────────────────────────────────

function StatePill({ state }: { state: string }) {
    const c = STATE_COLORS[state] ?? { bg: 'var(--paper-2)', color: 'var(--ink-3)' };
    return <span style={{ background: c.bg, color: c.color, fontFamily: "'Geist Mono', monospace", fontSize: 10, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', padding: '2px 7px', borderRadius: 4 }}>{state}</span>;
}

function Label({ children }: { children: React.ReactNode }) {
    return <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{children}</span>;
}

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
    const [v, setV] = useState(false);
    return (
        <div style={{ position: 'relative', display: 'inline-block' }} onMouseEnter={() => setV(true)} onMouseLeave={() => setV(false)}>
            {children}
            {v && <div style={{ position: 'absolute', left: 0, top: 'calc(100% + 6px)', zIndex: 50, width: 220, background: 'var(--bubble-agent-bg)', color: 'var(--bubble-agent-color)', fontSize: 11, lineHeight: 1.5, padding: '8px 10px', borderRadius: 8, pointerEvents: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>{text}</div>}
        </div>
    );
}

function SegmentedToggle<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
    return (
        <div style={{ display: 'flex', background: 'var(--paper-2)', border: '1px solid var(--line)', borderRadius: 8, padding: 2, gap: 2 }}>
            {options.map(opt => (
                <button key={opt.value} onClick={() => onChange(opt.value)} style={{ flex: 1, padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', background: value === opt.value ? 'var(--paper)' : 'transparent', color: value === opt.value ? 'var(--ink-1)' : 'var(--ink-4)', boxShadow: value === opt.value ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

// ─── Trace modal ──────────────────────────────────────────────────────────────

function TraceModal({ trace, onClose }: { trace: TraceData; onClose: () => void }) {
    const toolsUsed = Array.isArray(trace.toolsUsed) ? trace.toolsUsed : [];
    useEffect(() => {
        const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', fn);
        return () => document.removeEventListener('keydown', fn);
    }, [onClose]);

    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,19,15,0.55)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div onClick={e => e.stopPropagation()} style={{ background: 'var(--paper)', border: '1px solid var(--line-2)', borderRadius: 14, padding: '28px 32px', width: 520, maxHeight: '80vh', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 20, boxShadow: '0 8px 40px rgba(0,0,0,0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, color: 'var(--ink-1)' }}>Trace da Resposta</div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--ink-4)' }}>✕</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><Label>Estado</Label><StatePill state={trace.state} /></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <Label>Modelo</Label>
                    <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12, color: 'var(--ink-3)', background: 'var(--paper-2)', padding: '4px 8px', borderRadius: 6, display: 'inline-block' }}>{trace.modelId}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <Label>Ferramentas</Label>
                    {toolsUsed.length === 0
                        ? <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>Nenhuma</span>
                        : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{toolsUsed.map(t => <span key={t} style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, fontWeight: 600, background: 'var(--accent-soft)', color: 'var(--accent-ink)', padding: '3px 8px', borderRadius: 4 }}>{t}</span>)}</div>
                    }
                </div>
                {trace.ragUsed
                    ? <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <Label>RAG — {trace.ragUsed.chars} chars</Label>
                        <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: 'var(--ink-3)', whiteSpace: 'pre-wrap', background: 'var(--paper-2)', borderRadius: 8, padding: '10px 12px', lineHeight: 1.6, maxHeight: 200, overflow: 'auto', border: '1px solid var(--line)' }}>
                            {trace.ragUsed.snippet}{trace.ragUsed.chars > 300 ? '\n…' : ''}
                        </div>
                      </div>
                    : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><Label>RAG</Label><span style={{ fontSize: 12, color: 'var(--ink-4)' }}>Não utilizado</span></div>
                }
            </div>
        </div>
    );
}

// ─── Thinking panel ───────────────────────────────────────────────────────────

function ThinkingPanel({ trace, isPending }: { trace: TraceData | null; isPending: boolean }) {
    if (isPending) return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[80, 60, 100].map((w, i) => <div key={i} style={{ height: 14, borderRadius: 6, background: 'var(--paper-3)', width: `${w}%`, animation: 'pulse 1.4s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />)}
        </div>
    );
    if (!trace) return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, paddingTop: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 22, opacity: 0.3 }}>◎</div>
            <span style={{ fontSize: 11, color: 'var(--ink-5)', lineHeight: 1.5 }}>Aguardando resposta do agente.</span>
        </div>
    );

    const toolsUsed = Array.isArray(trace.toolsUsed) ? trace.toolsUsed : [];
    const steps = [
        { icon: '◈', label: 'Estado detectado', value: <StatePill state={trace.state} /> },
        { icon: '⬡', label: 'Ferramentas', value: toolsUsed.length === 0 ? <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>nenhuma</span> : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{toolsUsed.map(t => <span key={t} style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, fontWeight: 600, background: 'var(--accent-soft)', color: 'var(--accent-ink)', padding: '1px 6px', borderRadius: 4 }}>{t}</span>)}</div> },
        { icon: '◉', label: 'Contexto RAG', value: trace.ragUsed
            ? <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: 'var(--accent-ink)', background: 'var(--accent-soft)', padding: '1px 6px', borderRadius: 4, display: 'inline-block' }}>{trace.ragUsed.chars} chars</span>
                <span style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: "'Geist Mono', monospace", lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>"{trace.ragUsed.snippet}"</span>
              </div>
            : <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>não utilizado</span>
        },
        { icon: '◇', label: 'Modelo', value: <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: 'var(--ink-3)' }}>{trace.modelId}</span> },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            {steps.map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: i < steps.length - 1 ? '1px solid var(--line)' : 'none' }}>
                    <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, color: 'var(--accent)', flexShrink: 0, marginTop: 1 }}>{step.icon}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}><Label>{step.label}</Label>{step.value}</div>
                </div>
            ))}
        </div>
    );
}

// ─── Sessions drawer ──────────────────────────────────────────────────────────

function SessionsDrawer({ sessions, openIds, onOpen, onDelete, visible }: {
    sessions: Session[];
    openIds: string[];
    onOpen: (s: Session) => void;
    onDelete: (id: string) => void;
    visible: boolean;
}) {
    const [hov, setHov] = useState<string | null>(null);
    function fmtDate(iso: string) {
        const diff = Date.now() - new Date(iso).getTime();
        if (diff < 60_000) return 'agora';
        if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
        if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
        return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    }
    return (
        <div style={{ width: visible ? 220 : 0, flexShrink: 0, overflow: 'hidden', transition: 'width 0.2s ease', background: 'var(--paper-2)', borderRight: visible ? '1px solid var(--line)' : 'none', display: 'flex', flexDirection: 'column' }}>
            <div style={{ width: 220, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
                    <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--ink-4)' }}>Sessões salvas</span>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
                    {sessions.length === 0 && <div style={{ padding: '20px 14px', textAlign: 'center' }}><span style={{ fontSize: 11, color: 'var(--ink-5)', lineHeight: 1.5 }}>Nenhuma sessão.<br />Envie uma mensagem para criar.</span></div>}
                    {sessions.map(s => {
                        const isOpen = openIds.includes(s.id);
                        const isHov = hov === s.id;
                        return (
                            <div key={s.id} onClick={() => onOpen(s)} onMouseEnter={() => setHov(s.id)} onMouseLeave={() => setHov(null)}
                                style={{ display: 'flex', alignItems: 'center', background: isHov ? 'var(--paper-3)' : 'transparent', cursor: 'pointer', transition: 'background 0.1s', borderLeft: `2px solid ${isOpen ? 'var(--accent)' : 'transparent'}` }}>
                                <div style={{ flex: 1, padding: '7px 10px 7px 12px', minWidth: 0 }}>
                                    <div style={{ fontSize: 12, color: isOpen ? 'var(--accent-ink)' : 'var(--ink-2)', fontWeight: isOpen ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</div>
                                    <div style={{ display: 'flex', gap: 5, marginTop: 2 }}>
                                        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase' }}>{s.agentType === 'orientador' ? 'ORI' : 'ATD'}</span>
                                        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, color: 'var(--ink-5)' }}>{fmtDate(s.updatedAt)}</span>
                                    </div>
                                </div>
                                {isHov && (
                                    <button onClick={e => { e.stopPropagation(); onDelete(s.id); }}
                                        style={{ flexShrink: 0, width: 28, alignSelf: 'stretch', background: 'none', border: 'none', color: 'var(--ink-4)', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// ─── Typing bubble ────────────────────────────────────────────────────────────

function TypingBubble({ letter, color }: { letter: string; color: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: color, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Fraunces', serif", fontSize: 13, color: 'white' }}>{letter}</div>
            <div style={{ padding: '10px 14px', background: 'var(--bubble-agent-bg)', borderRadius: '16px 16px 16px 4px', display: 'flex', gap: 5, alignItems: 'center' }}>
                {[0, 1, 2].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--bubble-agent-color)', opacity: 0.4, animation: `typing-dot 1.2s ${i * 0.2}s ease-in-out infinite` }} />)}
            </div>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function Simulador() {
    const qc = useQueryClient();

    // Tab management
    const [tabOrder, setTabOrder]       = useState<string[]>([]);
    const [activeTabId, setActiveTabId] = useState<string | null>(null);
    const [showDrawer, setShowDrawer]   = useState(false);

    // Per-session isolated state (source of truth lives in ref for async safety)
    const cacheRef = useRef<Record<string, TabState>>({});
    const [, forceRender] = useState(0);
    const rerender = useCallback(() => forceRender(n => n + 1), []);

    // Stable sessions ref for async closures
    const sessionsRef = useRef<Session[]>([]);

    // Controlled input (per-tab draft stored here, cleared on send)
    const [input, setInput] = useState('');

    // Title editing
    const [editingTabId, setEditingTabId] = useState<string | null>(null);
    const [titleDraft, setTitleDraft]     = useState('');

    // Trace modal
    const [modalTrace, setModalTrace] = useState<TraceData | null>(null);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const bottomRef   = useRef<HTMLDivElement>(null);
    const titleInputRef = useRef<HTMLInputElement>(null);
    const restoredRef = useRef(false);

    // ── DB sessions query ────────────────────────────────────────────────────

    const { data: sessions = [] } = useQuery<Session[]>({
        queryKey: ['simulator-sessions'],
        queryFn: () => axios.get('/api/simulator/sessions').then(r => r.data),
    });

    // Keep sessionsRef in sync
    useEffect(() => { sessionsRef.current = sessions; }, [sessions]);

    // ── Restore tabs from localStorage on first load ─────────────────────────

    useEffect(() => {
        if (restoredRef.current || sessions.length === 0) return;
        restoredRef.current = true;
        const saved = lsLoad();
        if (!saved) return;
        const validIds = saved.tabOrder.filter(id => sessions.some(s => s.id === id));
        if (validIds.length === 0) return;

        // Fetch full sessions (listSessions select omits messages)
        Promise.all(validIds.map(id =>
            axios.get(`/api/simulator/sessions/${id}`).then(r => r.data as Session)
        )).then(fullSessions => {
            fullSessions.forEach(full => {
                cacheRef.current[full.id] = {
                    messages:  (full.messages as SimMessage[]) ?? [],
                    agentType: (full.agentType as AgentType) ?? 'atendente',
                    convState: (full.convState as ConvState)  ?? 'GREETING',
                    simMode:   (full.simMode   as SimMode)    ?? 'cliente',
                    lastTrace: null, isPending: false, loaded: true, error: null,
                };
            });
            setTabOrder(validIds);
            const active = validIds.includes(saved.activeId) ? saved.activeId : validIds[0];
            setActiveTabId(active);
            rerender();
        }).catch(() => {});
    }, [sessions]);

    // Auto-scroll when active tab's messages change
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [cacheRef.current[activeTabId ?? '']?.messages.length]);

    // ── Cache helpers ────────────────────────────────────────────────────────

    function getTab(id: string): TabState {
        return cacheRef.current[id] ?? defaultTab();
    }

    function patchTab(id: string, patch: Partial<TabState>) {
        cacheRef.current[id] = { ...getTab(id), ...patch };
        rerender();
    }

    // ── Open session as tab ──────────────────────────────────────────────────

    async function openTab(s: Session) {
        // Already open → just activate
        if (tabOrder.includes(s.id)) {
            setActiveTabId(s.id);
            lsSave(s.id, tabOrder);
            return;
        }

        // Load full session from API (includes messages)
        const full: Session = await axios.get(`/api/simulator/sessions/${s.id}`).then(r => r.data);
        cacheRef.current[full.id] = {
            messages:  (full.messages as SimMessage[]) ?? [],
            agentType: (full.agentType as AgentType) ?? 'atendente',
            convState: (full.convState as ConvState)  ?? 'GREETING',
            simMode:   (full.simMode   as SimMode)    ?? 'cliente',
            lastTrace: null, isPending: false, loaded: true, error: null,
        };
        const newOrder = [...tabOrder, full.id];
        setTabOrder(newOrder);
        setActiveTabId(full.id);
        lsSave(full.id, newOrder);
        rerender();
    }

    function closeTab(id: string) {
        const newOrder = tabOrder.filter(x => x !== id);
        delete cacheRef.current[id];
        setTabOrder(newOrder);
        const newActive = id === activeTabId
            ? (newOrder.length > 0 ? newOrder[Math.max(0, tabOrder.indexOf(id) - 1)] : null)
            : activeTabId;
        setActiveTabId(newActive);
        if (newActive && newOrder.length > 0) lsSave(newActive, newOrder);
        else lsClear();
        rerender();
    }

    function switchTab(id: string) {
        setActiveTabId(id);
        lsSave(id, tabOrder);
    }

    // ── Delete session from DB ───────────────────────────────────────────────

    async function deleteSession(id: string) {
        await axios.delete(`/api/simulator/sessions/${id}`);
        qc.invalidateQueries({ queryKey: ['simulator-sessions'] });
        closeTab(id);
    }

    // ── Save to DB ───────────────────────────────────────────────────────────

    function autoSave(id: string, msgs: SimMessage[], extra?: Record<string, unknown>) {
        axios.patch(`/api/simulator/sessions/${id}`, { messages: msgs, ...extra })
            .then(() => qc.invalidateQueries({ queryKey: ['simulator-sessions'] }))
            .catch(e => console.error('[Simulador] autoSave failed:', e?.response?.data ?? e?.message));
    }

    // ── Config changes ───────────────────────────────────────────────────────

    function handleAgentTypeChange(type: AgentType) {
        if (!activeTabId) return;
        patchTab(activeTabId, { agentType: type, convState: 'GREETING', messages: [], lastTrace: null });
        autoSave(activeTabId, [], { agentType: type, convState: 'GREETING' });
    }

    function handleConvStateChange(state: ConvState) {
        if (!activeTabId) return;
        patchTab(activeTabId, { convState: state });
        autoSave(activeTabId, getTab(activeTabId).messages, { convState: state });
    }

    function handleSimModeChange(mode: SimMode) {
        if (!activeTabId) return;
        patchTab(activeTabId, { simMode: mode });
        autoSave(activeTabId, getTab(activeTabId).messages, { simMode: mode });
    }

    function handleClear() {
        if (!activeTabId) return;
        patchTab(activeTabId, { messages: [], lastTrace: null });
        autoSave(activeTabId, []);
    }

    // ── Title editing ────────────────────────────────────────────────────────

    function startEditTitle(id: string) {
        const s = sessions.find(x => x.id === id);
        setTitleDraft(s?.title ?? '');
        setEditingTabId(id);
        setTimeout(() => titleInputRef.current?.select(), 50);
    }

    function commitTitle() {
        const id = editingTabId;
        setEditingTabId(null);
        if (!id || !titleDraft.trim()) return;
        axios.patch(`/api/simulator/sessions/${id}`, { title: titleDraft.trim() })
            .then(() => qc.invalidateQueries({ queryKey: ['simulator-sessions'] }));
    }

    // ── Send message (sessionId captured in closure — safe for concurrent tabs) ──

    async function handleSend() {
        const text = input.trim();
        if (!text) return;

        // Auto-create tab+session if none active
        let sessionId = activeTabId;
        if (!sessionId) {
            try {
                const created: Session = await axios.post('/api/simulator/sessions', {
                    title: uniqueTitle(text, sessionsRef.current),
                    agentType: 'atendente', convState: 'GREETING', simMode: 'cliente',
                }).then(r => r.data);
                qc.invalidateQueries({ queryKey: ['simulator-sessions'] });
                cacheRef.current[created.id] = { ...defaultTab(), loaded: true };
                const newOrder = [...tabOrder, created.id];
                setTabOrder(newOrder);
                setActiveTabId(created.id);
                lsSave(created.id, newOrder);
                sessionId = created.id;
                rerender();
            } catch {
                return;
            }
        }

        const tab = getTab(sessionId);
        if (tab.isPending) return;

        // Clear input immediately
        setInput('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';

        const userMsg: SimMessage = { id: crypto.randomUUID(), role: 'user', content: text };
        const nextMessages = [...tab.messages, userMsg];
        const historyPayload = tab.messages.slice(-20).map(m => ({ role: m.role, content: m.content }));

        // Mark this session as pending + add user message
        patchTab(sessionId, { messages: nextMessages, isPending: true, error: null });

        // Auto-title from first user message (if session was pre-existing with no messages)
        if (tab.messages.length === 0) {
            const newTitle = uniqueTitle(text, sessionsRef.current.filter(s => s.id !== sessionId));
            autoSave(sessionId, nextMessages, { title: newTitle });
        } else {
            autoSave(sessionId, nextMessages);
        }

        // API call — sessionId closed over, safe regardless of tab switches
        try {
            const data = await axios.post('/api/simulate/message', {
                message: text,
                agentType: tab.agentType,
                conversationState: tab.agentType === 'atendente' ? tab.convState : undefined,
                history: historyPayload,
            }).then(r => r.data);

            const trace = normalizeTrace(data.trace);
            const agentMsg: SimMessage = { id: crypto.randomUUID(), role: 'model', content: data.text ?? '', trace };

            // Update THIS session's cache (not whatever tab is active now)
            const currentMsgs = cacheRef.current[sessionId]?.messages ?? nextMessages;
            const finalMsgs = [...currentMsgs, agentMsg];
            patchTab(sessionId, { messages: finalMsgs, isPending: false, lastTrace: trace, error: null });
            autoSave(sessionId, finalMsgs);
        } catch (e: any) {
            const msg = e?.response?.data?.error ?? 'Erro ao processar';
            patchTab(sessionId, { isPending: false, error: msg });
        }
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    }

    function handleTextareaInput(e: React.FormEvent<HTMLTextAreaElement>) {
        const el = e.currentTarget;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 160) + 'px';
    }

    // ── Create blank session in DB, then open as tab ─────────────────────────

    async function newTab() {
        const created: Session = await axios.post('/api/simulator/sessions', {
            title: 'Nova sessão', agentType: 'atendente', convState: 'GREETING', simMode: 'cliente',
        }).then(r => r.data);
        qc.invalidateQueries({ queryKey: ['simulator-sessions'] });
        cacheRef.current[created.id] = { ...defaultTab(), loaded: true };
        const newOrder = [...tabOrder, created.id];
        setTabOrder(newOrder);
        setActiveTabId(created.id);
        lsSave(created.id, newOrder);
        rerender();
    }

    // ── Derived display values ────────────────────────────────────────────────

    const activeTab = activeTabId ? getTab(activeTabId) : null;
    const activeSession = sessions.find(s => s.id === activeTabId);
    const avatarLetter = activeTab?.agentType === 'orientador' ? 'O' : 'A';
    const avatarColor  = activeTab?.agentType === 'orientador' ? 'var(--teal)' : 'var(--accent)';
    const userLabel    = activeTab?.simMode === 'cliente' ? 'Cliente' : 'Dono';

    return (
        <>
            <style>{`
                @keyframes typing-dot { 0%,60%,100%{opacity:.4;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)} }
                @keyframes pulse { 0%,100%{opacity:.4}50%{opacity:.8} }
            `}</style>

            {modalTrace && <TraceModal trace={modalTrace} onClose={() => setModalTrace(null)} />}

            <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: 'var(--paper-2)' }}>

                {/* ── SESSIONS DRAWER ──────────────────────────────────── */}
                <SessionsDrawer
                    sessions={sessions}
                    openIds={tabOrder}
                    onOpen={openTab}
                    onDelete={deleteSession}
                    visible={showDrawer}
                />

                {/* ── CHAT AREA ─────────────────────────────────────────── */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--paper)', borderRight: '1px solid var(--line)' }}>

                    {/* Tab bar — VSCode style */}
                    <div style={{ display: 'flex', alignItems: 'stretch', borderBottom: '1px solid var(--line)', background: 'var(--paper-2)', flexShrink: 0, height: 36, minWidth: 0, overflowX: 'auto', scrollbarWidth: 'none' } as React.CSSProperties}>
                        {/* Drawer toggle */}
                        <button
                            onClick={() => setShowDrawer(v => !v)}
                            title={showDrawer ? 'Ocultar sessões' : 'Ver sessões salvas'}
                            style={{ width: 36, height: 36, flexShrink: 0, background: showDrawer ? 'var(--accent-soft)' : 'transparent', border: 'none', borderRight: '1px solid var(--line)', color: showDrawer ? 'var(--accent-ink)' : 'var(--ink-4)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >☰</button>

                        {/* Tabs */}
                        {tabOrder.map(id => {
                            const tab = getTab(id);
                            const s = sessions.find(x => x.id === id);
                            const isActive = id === activeTabId;
                            const title = s?.title ?? 'Nova sessão';
                            return (
                                <div key={id}
                                    onClick={() => switchTab(id)}
                                    onMouseDown={e => { if (e.button === 1) { e.preventDefault(); closeTab(id); } }}
                                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px 0 14px', cursor: 'pointer', flexShrink: 0, maxWidth: 180, borderRight: '1px solid var(--line)', background: isActive ? 'var(--paper)' : 'transparent', borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent', transition: 'background 0.1s', position: 'relative' }}>
                                    {/* Pending indicator */}
                                    {tab.isPending && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, animation: 'pulse 1s ease-in-out infinite' }} />}
                                    {editingTabId === id ? (
                                        <input ref={titleInputRef} value={titleDraft} onChange={e => setTitleDraft(e.target.value)}
                                            onBlur={commitTitle}
                                            onKeyDown={e => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') setEditingTabId(null); }}
                                            onClick={e => e.stopPropagation()}
                                            style={{ fontSize: 12, width: 100, border: '1px solid var(--accent)', borderRadius: 4, padding: '1px 4px', background: 'var(--paper)', color: 'var(--ink-1)', outline: 'none', fontFamily: 'inherit' }}
                                            autoFocus />
                                    ) : (
                                        <span
                                            onDoubleClick={e => { e.stopPropagation(); startEditTitle(id); }}
                                            title={`${title}\nDuplo clique para renomear`}
                                            style={{ fontSize: 12, color: isActive ? 'var(--ink-1)' : 'var(--ink-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120, userSelect: 'none' }}>
                                            {title}
                                        </span>
                                    )}
                                    {/* Close */}
                                    <button onClick={e => { e.stopPropagation(); closeTab(id); }}
                                        style={{ width: 16, height: 16, borderRadius: 3, background: 'none', border: 'none', color: 'var(--ink-4)', cursor: 'pointer', fontSize: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isActive ? 1 : 0.5 }}>×</button>
                                </div>
                            );
                        })}

                        {/* New tab button */}
                        <button onClick={newTab} title="Nova sessão"
                            style={{ width: 36, height: 36, flexShrink: 0, background: 'transparent', border: 'none', color: 'var(--ink-4)', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>

                        <div style={{ flex: 1 }} />
                    </div>

                    {/* Messages */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {!activeTabId ? (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, paddingBottom: 60 }}>
                                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--paper-2)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Fraunces', serif", fontSize: 20, color: 'var(--ink-3)' }}>A</div>
                                <span style={{ fontSize: 12, color: 'var(--ink-4)', textAlign: 'center' }}>
                                    Digite uma mensagem para começar.<br />
                                    <span style={{ fontSize: 11, color: 'var(--ink-5)' }}>Sessão criada automaticamente.</span>
                                </span>
                            </div>
                        ) : activeTab && activeTab.messages.length === 0 ? (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, paddingBottom: 60 }}>
                                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--paper-2)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Fraunces', serif", fontSize: 20, color: 'var(--ink-3)' }}>{avatarLetter}</div>
                                <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>Envie uma mensagem para começar.</span>
                            </div>
                        ) : activeTab?.messages.map(msg => (
                            <div key={msg.id} style={{ display: 'flex', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8, marginBottom: 6 }}>
                                {msg.role === 'model' && (
                                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: avatarColor, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Fraunces', serif", fontSize: 13, color: 'white' }}>{avatarLetter}</div>
                                )}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: 480 }}>
                                    <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: 'var(--ink-4)', marginBottom: 3, letterSpacing: 0.3 }}>
                                        {msg.role === 'user' ? userLabel : (activeTab.agentType === 'orientador' ? 'Orientador' : 'Atendente')}
                                    </span>
                                    <div
                                        onClick={msg.role === 'model' && msg.trace ? () => setModalTrace(msg.trace!) : undefined}
                                        style={{ padding: '10px 14px', background: msg.role === 'user' ? 'var(--paper-3)' : 'var(--bubble-agent-bg)', color: msg.role === 'user' ? 'var(--ink-1)' : 'var(--bubble-agent-color)', borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px', fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word', cursor: msg.role === 'model' && msg.trace ? 'pointer' : 'default' }}>
                                        {msg.content}
                                    </div>
                                    {msg.role === 'model' && msg.trace && (
                                        <span style={{ fontSize: 10, color: 'var(--ink-5)', marginTop: 3, fontFamily: "'Geist Mono', monospace" }}>clique para ver trace</span>
                                    )}
                                </div>
                            </div>
                        ))}

                        {activeTab?.isPending && <TypingBubble letter={avatarLetter} color={avatarColor} />}
                        {activeTab?.error && (
                            <div style={{ fontSize: 12, color: 'var(--danger)', background: 'var(--danger-soft)', border: '1px solid var(--danger)', borderRadius: 8, padding: '8px 12px' }}>
                                Erro: {activeTab.error}
                            </div>
                        )}
                        <div ref={bottomRef} />
                    </div>

                    {/* Input */}
                    <div style={{ flexShrink: 0, padding: '12px 20px 16px', borderTop: '1px solid var(--line)', display: 'flex', gap: 10, alignItems: 'flex-end', background: 'var(--paper)' }}>
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onInput={handleTextareaInput}
                            placeholder={`Mensagem como ${userLabel}…`}
                            rows={1}
                            disabled={!!activeTab?.isPending}
                            style={{ flex: 1, resize: 'none', padding: '9px 14px', border: '1px solid var(--line-2)', borderRadius: 10, fontSize: 13, fontFamily: 'inherit', lineHeight: 1.5, background: 'var(--paper)', color: 'var(--ink-1)', outline: 'none', minHeight: 38, maxHeight: 160, overflowY: 'auto' }}
                        />
                        <button onClick={handleSend} disabled={!!activeTab?.isPending || !input.trim()}
                            style={{ padding: '0 18px', borderRadius: 10, fontSize: 13, fontWeight: 500, border: '1px solid var(--accent-ink)', background: activeTab?.isPending || !input.trim() ? 'var(--paper-3)' : 'var(--accent)', color: activeTab?.isPending || !input.trim() ? 'var(--ink-4)' : 'white', cursor: activeTab?.isPending || !input.trim() ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', flexShrink: 0, height: 38 }}>
                            Enviar
                        </button>
                    </div>
                </div>

                {/* ── RIGHT PANEL ──────────────────────────────────────── */}
                <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'var(--paper)', overflowY: 'auto' }}>
                    <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--line)' }}>
                        <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 14 }}>Configuração</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <Tooltip text="Atendente usa fluxo de vendas com RAG e ferramentas. Orientador responde com métricas e dados internos.">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'help' }}><Label>Tipo de agente</Label><span style={{ fontSize: 10, color: 'var(--ink-5)' }}>ⓘ</span></div>
                                </Tooltip>
                                <SegmentedToggle options={[{ value: 'atendente', label: 'Atendente' }, { value: 'orientador', label: 'Orientador' }]} value={activeTab?.agentType ?? 'atendente'} onChange={handleAgentTypeChange} />
                            </div>
                            {(activeTab?.agentType ?? 'atendente') === 'atendente' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <Tooltip text="Define o bloco de instruções do agente. Cada estado tem objetivo diferente no funil de vendas.">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'help' }}><Label>Estado da conversa</Label><span style={{ fontSize: 10, color: 'var(--ink-5)' }}>ⓘ</span></div>
                                    </Tooltip>
                                    <select value={activeTab?.convState ?? 'GREETING'} onChange={e => handleConvStateChange(e.target.value as ConvState)}
                                        style={{ padding: '7px 10px', borderRadius: 8, fontSize: 12, border: '1px solid var(--line-2)', background: 'var(--paper)', color: 'var(--ink-2)', cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>
                                        {CONV_STATES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                    </select>
                                </div>
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <Tooltip text="Define o label de quem envia. Não altera o comportamento do agente.">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'help' }}><Label>Simular como</Label><span style={{ fontSize: 10, color: 'var(--ink-5)' }}>ⓘ</span></div>
                                </Tooltip>
                                <SegmentedToggle options={[{ value: 'cliente', label: 'Cliente' }, { value: 'dono', label: 'Dono' }]} value={activeTab?.simMode ?? 'cliente'} onChange={handleSimModeChange} />
                            </div>
                            <button onClick={handleClear}
                                style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500, border: '1px solid var(--line-2)', background: 'var(--paper)', color: 'var(--ink-3)', cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>
                                Limpar conversa
                            </button>
                        </div>
                    </div>
                    <div style={{ padding: '16px 18px', flex: 1 }}>
                        <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 14 }}>Raciocínio do agente</div>
                        <ThinkingPanel trace={activeTab?.lastTrace ?? null} isPending={!!activeTab?.isPending} />
                    </div>
                </div>
            </div>
        </>
    );
}
