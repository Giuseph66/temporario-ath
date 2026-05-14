import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

type LogLevel = 'info' | 'warn' | 'error';
type LogCategory = 'webhook' | 'ai' | 'payment' | 'auth' | 'system';

type LogEntry = {
    ts: string;
    level: LogLevel;
    category: LogCategory;
    msg: string;
    data?: Record<string, unknown>;
};

type LogsResponse = { category: LogCategory; entries: LogEntry[]; total: number };

const CATEGORIES: { id: LogCategory; label: string; desc: string }[] = [
    { id: 'webhook', label: 'Webhook',   desc: 'Mensagens recebidas via Evolution/Meta' },
    { id: 'ai',      label: 'IA',        desc: 'Chamadas ao Gemini e RAG' },
    { id: 'payment', label: 'Pagamento', desc: 'Webhooks Asaas' },
    { id: 'auth',    label: 'Auth',      desc: 'Login, registro, tokens' },
    { id: 'system',  label: 'Sistema',   desc: 'Startup, erros críticos' },
];

const LEVEL_STYLE: Record<LogLevel, { color: string; bg: string; label: string }> = {
    info:  { color: '#0891b2', bg: '#ecfeff', label: 'INFO' },
    warn:  { color: '#b45309', bg: '#fef3c7', label: 'WARN' },
    error: { color: '#dc2626', bg: '#fef2f2', label: 'ERR' },
};

function formatTs(ts: string) {
    const d = new Date(ts);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
        '.' + String(d.getMilliseconds()).padStart(3, '0');
}

function formatDate(ts: string) {
    return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function TrashIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6m4-6v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
        </svg>
    );
}

function RefreshIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
    );
}

export function Logs() {
    const qc = useQueryClient();
    const [category, setCategory] = useState<LogCategory>('webhook');
    const [levelFilter, setLevelFilter] = useState<LogLevel | 'all'>('all');
    const [search, setSearch] = useState('');
    const [autoRefresh, setAutoRefresh] = useState(true);

    const { data, isLoading, isFetching } = useQuery<LogsResponse>({
        queryKey: ['logs', category],
        queryFn: () => axios.get(`/api/logs/${category}?limit=300`).then(r => r.data),
        refetchInterval: autoRefresh ? 3000 : false,
        staleTime: 0,
    });

    const clearMut = useMutation({
        mutationFn: () => axios.delete(`/api/logs/${category}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['logs', category] }),
    });

    const entries = (data?.entries ?? []).filter(e => {
        if (levelFilter !== 'all' && e.level !== levelFilter) return false;
        if (search) {
            const q = search.toLowerCase();
            return e.msg.toLowerCase().includes(q) || JSON.stringify(e.data ?? {}).toLowerCase().includes(q);
        }
        return true;
    });

    const errorCount = data?.entries.filter(e => e.level === 'error').length ?? 0;
    const warnCount  = data?.entries.filter(e => e.level === 'warn').length ?? 0;

    return (
        <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

            {/* Sidebar categorias */}
            <div style={{ width: 200, flexShrink: 0, borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', background: 'var(--paper)', padding: '20px 0' }}>
                <div style={{ padding: '0 16px 16px', borderBottom: '1px solid var(--line)', marginBottom: 8 }}>
                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, color: 'var(--ink-1)', lineHeight: 1 }}>Logs</div>
                </div>
                {CATEGORIES.map(cat => {
                    const active = category === cat.id;
                    return (
                        <button key={cat.id} onClick={() => { setCategory(cat.id); setLevelFilter('all'); setSearch(''); }} style={{
                            display: 'flex', flexDirection: 'column', padding: '10px 16px',
                            border: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                            background: active ? 'var(--accent-soft)' : 'transparent',
                            borderLeft: `3px solid ${active ? 'var(--accent)' : 'transparent'}`,
                            transition: 'background .1s',
                        }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: active ? 'var(--accent-ink)' : 'var(--ink-2)' }}>{cat.label}</span>
                            <span style={{ fontSize: 11, color: 'var(--ink-5)', marginTop: 1 }}>{cat.desc}</span>
                        </button>
                    );
                })}
            </div>

            {/* Main */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                {/* Header */}
                <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--line)', background: 'var(--paper)', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink-1)' }}>
                                {CATEGORIES.find(c => c.id === category)?.label}
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                                {errorCount > 0 && (
                                    <span style={{ fontSize: 11, fontWeight: 600, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '2px 7px', borderRadius: 4 }}>
                                        {errorCount} erros
                                    </span>
                                )}
                                {warnCount > 0 && (
                                    <span style={{ fontSize: 11, fontWeight: 600, color: '#b45309', background: '#fef3c7', border: '1px solid #fde68a', padding: '2px 7px', borderRadius: 4 }}>
                                        {warnCount} avisos
                                    </span>
                                )}
                            </div>
                            {isFetching && <span style={{ fontSize: 11, color: 'var(--ink-5)' }}>atualizando…</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <button onClick={() => setAutoRefresh(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 6, fontSize: 11.5, fontWeight: 500, border: '1px solid var(--line-2)', background: autoRefresh ? 'var(--accent-soft)' : 'var(--paper)', color: autoRefresh ? 'var(--accent-ink)' : 'var(--ink-4)', cursor: 'pointer', fontFamily: 'inherit' }}>
                                <RefreshIcon /> {autoRefresh ? 'Live' : 'Parado'}
                            </button>
                            <button onClick={() => qc.invalidateQueries({ queryKey: ['logs', category] })} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 6, fontSize: 11.5, border: '1px solid var(--line-2)', background: 'var(--paper)', color: 'var(--ink-4)', cursor: 'pointer', fontFamily: 'inherit' }}>
                                <RefreshIcon /> Atualizar
                            </button>
                            <button onClick={() => { if (confirm('Limpar todos os logs desta categoria?')) clearMut.mutate(); }} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 6, fontSize: 11.5, border: '1px solid var(--line-2)', background: 'var(--paper)', color: 'var(--danger)', cursor: 'pointer', fontFamily: 'inherit' }}>
                                <TrashIcon /> Limpar
                            </button>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filtrar mensagens…" style={{ flex: 1, padding: '6px 12px', borderRadius: 7, fontSize: 12.5, border: '1px solid var(--line-2)', background: 'var(--paper-2)', color: 'var(--ink-1)', fontFamily: 'inherit', outline: 'none' }} />
                        <div style={{ display: 'flex', borderRadius: 7, border: '1px solid var(--line)', overflow: 'hidden' }}>
                            {(['all', 'info', 'warn', 'error'] as const).map(l => (
                                <button key={l} onClick={() => setLevelFilter(l)} style={{ padding: '6px 10px', border: 'none', fontSize: 11.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', background: levelFilter === l ? 'var(--accent)' : 'var(--paper)', color: levelFilter === l ? '#fff' : 'var(--ink-4)', borderRight: l !== 'error' ? '1px solid var(--line)' : 'none' }}>
                                    {l === 'all' ? 'Todos' : l.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Log stream */}
                <div style={{ flex: 1, overflowY: 'auto', fontFamily: "'Geist Mono', monospace", fontSize: 12, background: '#0f1117' }}>
                    {isLoading ? (
                        <div style={{ padding: 24, color: '#6b7280' }}>Carregando logs…</div>
                    ) : entries.length === 0 ? (
                        <div style={{ padding: 24, color: '#6b7280' }}>Nenhum log{search ? ' encontrado' : ' registrado ainda'}.</div>
                    ) : (
                        entries.map((e, i) => {
                            const ls = LEVEL_STYLE[e.level];
                            return (
                                <div key={i} style={{ display: 'flex', gap: 0, borderBottom: '1px solid #1e2030', padding: '5px 0', background: e.level === 'error' ? '#1a0a0a' : e.level === 'warn' ? '#1a150a' : 'transparent', alignItems: 'flex-start' }}>
                                    {/* Date */}
                                    <span style={{ width: 42, flexShrink: 0, padding: '0 8px', color: '#4b5563', fontSize: 10, paddingTop: 1 }}>{formatDate(e.ts)}</span>
                                    {/* Time */}
                                    <span style={{ width: 88, flexShrink: 0, color: '#6b7280', paddingTop: 1 }}>{formatTs(e.ts)}</span>
                                    {/* Level */}
                                    <span style={{ width: 42, flexShrink: 0, fontWeight: 700, color: ls.color, paddingTop: 1 }}>{ls.label}</span>
                                    {/* Message */}
                                    <div style={{ flex: 1, minWidth: 0, paddingRight: 16 }}>
                                        <span style={{ color: '#e2e8f0' }}>{e.msg}</span>
                                        {e.data && Object.keys(e.data).length > 0 && (
                                            <span style={{ color: '#4b5563', marginLeft: 8 }}>
                                                {Object.entries(e.data).map(([k, v]) => (
                                                    <span key={k} style={{ marginRight: 10 }}>
                                                        <span style={{ color: '#6b7280' }}>{k}=</span>
                                                        <span style={{ color: '#94a3b8' }}>{String(v)}</span>
                                                    </span>
                                                ))}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer count */}
                <div style={{ flexShrink: 0, padding: '6px 24px', borderTop: '1px solid var(--line)', background: 'var(--paper)', fontSize: 11, color: 'var(--ink-5)', fontFamily: "'Geist Mono', monospace" }}>
                    {entries.length} entradas exibidas · {data?.total ?? 0} total · últimas 300
                </div>
            </div>
        </div>
    );
}
