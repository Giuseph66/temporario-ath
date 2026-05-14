import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

type Contact = {
    id: string;
    phone: string;
    name: string | null;
    originalName: string | null;
    customName: string | null;
    profilePicUrl: string | null;
    whitelisted: boolean;
    syncedAt: string;
};

type WhitelistData = { enabled: boolean; phones: string[] };
type ContactsResponse = { contacts: Contact[]; whitelist: WhitelistData; syncing: boolean; total: number; page: number; pages: number };

// ─── Icons ────────────────────────────────────────────────────────────────────
function SyncIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
        </svg>
    );
}

function CloseIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
    );
}

function EditIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
    );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function Avatar({ name, url, size = 36 }: { name: string | null; url: string | null; size?: number }) {
    const initials = name ? name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() : '?';
    const [imgErr, setImgErr] = useState(false);
    if (url && !imgErr) {
        return <img src={url} alt={name ?? ''} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} onError={() => setImgErr(true)} />;
    }
    return (
        <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--accent-soft)', color: 'var(--accent-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.33, fontWeight: 600, flexShrink: 0 }}>
            {initials}
        </div>
    );
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
    return (
        <button onClick={() => !disabled && onChange(!checked)} style={{ width: 36, height: 20, borderRadius: 10, border: 'none', padding: 2, cursor: disabled ? 'not-allowed' : 'pointer', background: checked ? 'var(--accent)' : 'var(--line-2)', transition: 'background .15s', flexShrink: 0, opacity: disabled ? 0.5 : 1 }}>
            <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'transform .15s', transform: checked ? 'translateX(16px)' : 'translateX(0)' }} />
        </button>
    );
}

// ─── Drawer lateral ───────────────────────────────────────────────────────────
function ContactDrawer({ contact, onClose, onUpdated }: { contact: Contact; onClose: () => void; onUpdated: () => void }) {
    const qc = useQueryClient();
    const [editingName, setEditingName] = useState(false);
    const [nameVal, setNameVal] = useState(contact.customName ?? contact.originalName ?? '');
    const [saving, setSaving] = useState(false);

    const wlMutation = useMutation({
        mutationFn: (add: boolean) => add
            ? axios.post('/api/contacts/whitelist', { phone: contact.phone })
            : axios.delete(`/api/contacts/whitelist/${encodeURIComponent(contact.phone)}`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['contacts'] }); onUpdated(); },
    });

    async function saveName() {
        setSaving(true);
        await axios.patch(`/api/contacts/${contact.id}/name`, { customName: nameVal.trim() });
        qc.invalidateQueries({ queryKey: ['contacts'] });
        setEditingName(false);
        setSaving(false);
        onUpdated();
    }

    const displayName = contact.customName ?? contact.originalName;

    return (
        <>
            {/* Overlay */}
            <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.18)', zIndex: 40, backdropFilter: 'blur(2px)' }} />

            {/* Drawer */}
            <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 360, background: 'var(--paper)', borderLeft: '1px solid var(--line)', zIndex: 50, display: 'flex', flexDirection: 'column', animation: 'slideIn .2s ease' }}>
                <style>{`@keyframes slideIn { from { transform: translateX(100%) } to { transform: translateX(0) } }`}</style>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--line)' }}>
                    <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--ink-4)' }}>Detalhes do contato</div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-4)', padding: 4, display: 'flex', alignItems: 'center' }}><CloseIcon /></button>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '28px 24px' }}>
                    {/* Avatar + name */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28, gap: 12 }}>
                        <Avatar name={displayName} url={contact.profilePicUrl} size={72} />
                        {editingName ? (
                            <div style={{ width: '100%', display: 'flex', gap: 8 }}>
                                <input autoFocus value={nameVal} onChange={e => setNameVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveName()} style={{ flex: 1, padding: '7px 10px', borderRadius: 7, fontSize: 13, border: '1px solid var(--line-2)', background: 'var(--paper-2)', color: 'var(--ink-1)', fontFamily: 'inherit', outline: 'none' }} />
                                <button onClick={saveName} disabled={saving} style={{ padding: '7px 12px', borderRadius: 7, fontSize: 12, background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                                    {saving ? '…' : 'Salvar'}
                                </button>
                                <button onClick={() => setEditingName(false)} style={{ padding: '7px 10px', borderRadius: 7, fontSize: 12, background: 'transparent', border: '1px solid var(--line-2)', color: 'var(--ink-4)', cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink-1)', textAlign: 'center' }}>
                                    {displayName ?? 'Sem nome'}
                                </span>
                                <button onClick={() => setEditingName(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-4)', padding: 2, display: 'flex', alignItems: 'center' }}><EditIcon /></button>
                            </div>
                        )}
                        {contact.customName && contact.originalName && (
                            <div style={{ fontSize: 11, color: 'var(--ink-5)', textAlign: 'center' }}>Nome original: {contact.originalName}</div>
                        )}
                    </div>

                    {/* Info rows */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, borderRadius: 10, border: '1px solid var(--line)', overflow: 'hidden', marginBottom: 24 }}>
                        {[
                            { label: 'Telefone', value: contact.phone },
                            { label: 'Sincronizado', value: new Date(contact.syncedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) },
                        ].map((row, i, arr) => (
                            <div key={row.label} style={{ display: 'grid', gridTemplateColumns: '110px 1fr', padding: '11px 14px', borderBottom: i < arr.length - 1 ? '1px solid var(--line)' : 'none', background: 'var(--paper)' }}>
                                <span style={{ fontSize: 12, color: 'var(--ink-4)', fontWeight: 500 }}>{row.label}</span>
                                <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12, color: 'var(--ink-2)' }}>{row.value}</span>
                            </div>
                        ))}
                    </div>

                    {/* Whitelist toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: 10, border: `1px solid ${contact.whitelisted ? '#c9d8d0' : 'var(--line)'}`, background: contact.whitelisted ? 'var(--accent-soft)' : 'var(--paper-2)' }}>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: contact.whitelisted ? 'var(--accent-ink)' : 'var(--ink-2)' }}>
                                {contact.whitelisted ? 'Na whitelist' : 'Fora da whitelist'}
                            </div>
                            <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 2 }}>
                                {contact.whitelisted ? 'Bot responde para este contato' : 'Bot ignora mensagens deste contato'}
                            </div>
                        </div>
                        <Toggle checked={contact.whitelisted} onChange={v => wlMutation.mutate(v)} disabled={wlMutation.isPending} />
                    </div>
                </div>
            </div>
        </>
    );
}

const pgBtn = (disabled: boolean): React.CSSProperties => ({
    padding: '5px 10px', borderRadius: 6, fontSize: 13, border: '1px solid var(--line-2)',
    background: 'var(--paper)', color: disabled ? 'var(--ink-5)' : 'var(--ink-3)',
    cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: disabled ? 0.4 : 1,
});

// ─── Main page ────────────────────────────────────────────────────────────────
export function Contatos() {
    const qc = useQueryClient();
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [filter, setFilter] = useState<'all' | 'whitelisted'>('all');
    const [page, setPage] = useState(1);
    const [savingPhone, setSavingPhone] = useState<string | null>(null);
    const [selected, setSelected] = useState<Contact | null>(null);

    // Debounce search — só dispara query após 400ms de inatividade
    useState(() => {
        const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
        return () => clearTimeout(t);
    });

    const { data, isLoading, isFetching } = useQuery<ContactsResponse>({
        queryKey: ['contacts', page, debouncedSearch, filter],
        queryFn: () => axios.get('/api/contacts', { params: { page, limit: 50, search: debouncedSearch, filter } }).then(r => r.data),
        staleTime: 120_000,
        placeholderData: prev => prev,
    });

    const sync = useMutation({
        mutationFn: () => axios.post('/api/contacts/sync'),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['contacts'] }); setPage(1); },
    });

    const toggleEnabled = useMutation({
        mutationFn: (enabled: boolean) => axios.put('/api/contacts/whitelist', { enabled }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
    });

    async function toggleContact(phone: string, currentlyWhitelisted: boolean) {
        setSavingPhone(phone);
        try {
            if (currentlyWhitelisted) {
                await axios.delete(`/api/contacts/whitelist/${encodeURIComponent(phone)}`);
            } else {
                await axios.post('/api/contacts/whitelist', { phone });
            }
            qc.invalidateQueries({ queryKey: ['contacts'] });
        } finally {
            setSavingPhone(null);
        }
    }

    function handleSearchChange(val: string) {
        setSearch(val);
        // Debounce via useEffect emulado
        clearTimeout((handleSearchChange as any)._t);
        (handleSearchChange as any)._t = setTimeout(() => { setDebouncedSearch(val); setPage(1); }, 400);
    }

    function handleFilterChange(f: 'all' | 'whitelisted') {
        setFilter(f);
        setPage(1);
    }

    const contacts = data?.contacts ?? [];
    const whitelist = data?.whitelist ?? { enabled: false, phones: [] };
    const total = data?.total ?? 0;
    const pages = data?.pages ?? 1;
    const filtered = contacts; // filtro já aplicado server-side

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

            {/* Header */}
            <div style={{ padding: '32px 40px 24px', borderBottom: '1px solid var(--line)', background: 'var(--paper)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div>
                        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 32, fontWeight: 400, color: 'var(--ink-1)', letterSpacing: -0.5, lineHeight: 1, marginBottom: 6 }}>Contatos</div>
                        <div style={{ fontSize: 13, color: 'var(--ink-4)', display: 'flex', alignItems: 'center', gap: 8 }}>
                            {isLoading ? 'Carregando…' : data?.syncing ? 'Sincronizando da Evolution…' : `${total.toLocaleString()} contatos`}
                            {isFetching && !isLoading && <span style={{ fontSize: 11, color: 'var(--ink-5)' }}>atualizando…</span>}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        {/* Whitelist master toggle */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: `1px solid ${whitelist.enabled ? '#c9d8d0' : 'var(--line)'}`, background: whitelist.enabled ? 'var(--accent-soft)' : 'var(--paper-2)' }}>
                            <div>
                                <div style={{ fontSize: 12.5, fontWeight: 600, color: whitelist.enabled ? 'var(--accent-ink)' : 'var(--ink-2)' }}>Filtro ativo</div>
                                <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{whitelist.enabled ? 'Só whitelist' : 'Todos'}</div>
                            </div>
                            <Toggle checked={whitelist.enabled} onChange={v => toggleEnabled.mutate(v)} disabled={toggleEnabled.isPending} />
                        </div>
                        {/* Sync button */}
                        <button onClick={() => sync.mutate()} disabled={sync.isPending} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 500, border: '1px solid var(--line-2)', background: 'var(--paper)', color: 'var(--ink-3)', cursor: sync.isPending ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                            <span style={{ display: 'flex', animation: sync.isPending ? 'spin 1s linear infinite' : 'none' }}><SyncIcon /></span>
                            {sync.isPending ? 'Sincronizando…' : 'Sincronizar'}
                        </button>
                    </div>
                </div>

                {/* Search + filter */}
                <div style={{ display: 'flex', gap: 10 }}>
                    <input value={search} onChange={e => handleSearchChange(e.target.value)} placeholder="Buscar nome ou número…" style={{ flex: 1, padding: '8px 14px', borderRadius: 8, fontSize: 13, border: '1px solid var(--line-2)', background: 'var(--paper-2)', color: 'var(--ink-1)', fontFamily: 'inherit', outline: 'none' }} />
                    <div style={{ display: 'flex', borderRadius: 8, border: '1px solid var(--line)', overflow: 'hidden', background: 'var(--paper-2)' }}>
                        {(['all', 'whitelisted'] as const).map(f => (
                            <button key={f} onClick={() => handleFilterChange(f)} style={{ padding: '8px 14px', border: 'none', fontSize: 12.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', background: filter === f ? 'var(--paper)' : 'transparent', color: filter === f ? 'var(--ink-1)' : 'var(--ink-4)', borderRight: f === 'all' ? '1px solid var(--line)' : 'none' }}>
                                {f === 'all' ? 'Todos' : 'Whitelist'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 40px 40px' }}>
                <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
                {isLoading ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--ink-4)', fontSize: 13 }}>Carregando contatos…</div>
                ) : data?.syncing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 12, color: 'var(--ink-4)', fontSize: 13 }}>
                        <div style={{ animation: 'spin 1s linear infinite' }}><SyncIcon /></div>
                        Sincronizando contatos da Evolution API pela primeira vez…
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--ink-4)', fontSize: 13 }}>
                        {search ? 'Nenhum contato encontrado' : filter === 'whitelisted' ? 'Nenhum contato na whitelist' : 'Sem contatos — clique em Sincronizar'}
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: 2, marginTop: 12 }}>
                        {filtered.map(contact => (
                            <div key={contact.phone} onClick={() => setSelected(contact)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8, background: contact.whitelisted ? 'var(--accent-soft)' : 'var(--paper)', border: `1px solid ${contact.whitelisted ? '#c9d8d0' : 'var(--line)'}`, cursor: 'pointer', transition: 'background .1s' }}>
                                <Avatar name={contact.name} url={contact.profilePicUrl} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {contact.name ?? 'Sem nome'}
                                        {contact.customName && <span style={{ fontSize: 10.5, color: 'var(--ink-4)', marginLeft: 6, fontWeight: 400 }}>editado</span>}
                                    </div>
                                    <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: 'var(--ink-4)', marginTop: 1 }}>{contact.phone}</div>
                                </div>
                                {contact.whitelisted && (
                                    <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--accent-ink)', background: 'var(--accent-soft)', border: '1px solid #c9d8d0', padding: '2px 7px', borderRadius: 4 }}>WL</span>
                                )}
                                <div onClick={e => { e.stopPropagation(); toggleContact(contact.phone, contact.whitelisted); }}>
                                    <Toggle checked={contact.whitelisted} onChange={() => {}} disabled={savingPhone === contact.phone} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Paginação */}
            {pages > 1 && (
                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 40px', borderTop: '1px solid var(--line)', background: 'var(--paper)' }}>
                    <span style={{ fontSize: 12.5, color: 'var(--ink-4)' }}>
                        Página {page} de {pages} · {total.toLocaleString()} contatos
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => setPage(1)} disabled={page === 1} style={pgBtn(page === 1)}>«</button>
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={pgBtn(page === 1)}>‹</button>
                        {Array.from({ length: Math.min(5, pages) }, (_, i) => {
                            const start = Math.max(1, Math.min(page - 2, pages - 4));
                            const n = start + i;
                            return (
                                <button key={n} onClick={() => setPage(n)} style={{ ...pgBtn(false), background: n === page ? 'var(--accent)' : 'var(--paper)', color: n === page ? '#fff' : 'var(--ink-3)', borderColor: n === page ? 'var(--accent)' : 'var(--line-2)' }}>
                                    {n}
                                </button>
                            );
                        })}
                        <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} style={pgBtn(page === pages)}>›</button>
                        <button onClick={() => setPage(pages)} disabled={page === pages} style={pgBtn(page === pages)}>»</button>
                    </div>
                </div>
            )}

            {/* Drawer */}
            {selected && (
                <ContactDrawer
                    contact={selected}
                    onClose={() => setSelected(null)}
                    onUpdated={() => {
                        const updated = data?.contacts.find(c => c.id === selected.id);
                        if (updated) setSelected(updated);
                    }}
                />
            )}
        </div>
    );
}
