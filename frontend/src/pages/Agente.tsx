import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

type Program = {
    id: string;
    name: string;
    price_value: number;
    price_type: 'monthly' | 'per_session';
    installments: number;
    duration_weeks: number;
    verbatim_intro: string;
    full_text: string;
};

type AgentData = {
    id: string;
    name: string;
    role: string;
    language: string;
    isActive: boolean;
    whatsappNumber: string | null;
    geminiModel: string;
    // Relational lists (from new schema)
    programs: Program[];
    protocols: Record<string, string>;
    restrictions: string[];
    whitelistPhones: string[];
    whitelistEnabled: boolean;
    ignoreGroups: boolean;
    adminChatEnabled: boolean;
    ownerPhone: string | null;
    // Editorial blobs
    toneJson: unknown;
    qualificationJson: unknown;
    objectionHandlingJson: unknown;
    knowledgeContractsJson: unknown;
};

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

function SaveButton({ onClick, saving, dirty }: { onClick: () => void; saving: boolean; dirty: boolean }) {
    return (
        <button onClick={onClick} disabled={saving || !dirty} style={{
            padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 500,
            border: '1px solid var(--accent-ink)', background: dirty ? 'var(--accent)' : 'var(--paper-3)',
            color: dirty ? '#fff' : 'var(--ink-5)', cursor: dirty ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit', opacity: saving ? .6 : 1, transition: 'all .15s',
        }}>
            {saving ? 'Salvando…' : 'Salvar'}
        </button>
    );
}

type KnowledgeDoc = {
    id: string;
    title: string;
    charCount: number;
    createdAt: string;
    _count: { chunks: number };
};

type KnowledgeDetail = KnowledgeDoc & {
    content: string;
};

const FILE_MIME_BY_EXT: Record<string, string> = {
    txt: 'text/plain',
    md: 'text/markdown',
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asTextLines(value: unknown): string {
    return Array.isArray(value) ? value.map(String).filter(Boolean).join('\n') : '';
}

function lines(value: string): string[] {
    return value.split('\n').map(s => s.trim()).filter(Boolean);
}

function mutationError(error: unknown): string {
    return axios.isAxiosError(error)
        ? (error.response?.data?.error ?? 'Falha ao salvar.')
        : 'Falha ao salvar.';
}

function inferMimeType(file: File): string | null {
    if (file.type && Object.values(FILE_MIME_BY_EXT).includes(file.type)) return file.type;
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    return FILE_MIME_BY_EXT[ext] || null;
}

function readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = String(reader.result || '');
            const index = result.indexOf(',');
            resolve(index >= 0 ? result.slice(index + 1) : result);
        };
        reader.onerror = () => reject(new Error('Falha ao ler arquivo.'));
        reader.readAsDataURL(file);
    });
}

export function KnowledgeSection() {
    const qc = useQueryClient();
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [adding, setAdding] = useState(false);
    const [addingUrl, setAddingUrl] = useState(false);
    const [urlTitle, setUrlTitle] = useState('');
    const [urlValue, setUrlValue] = useState('');
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [sourceError, setSourceError] = useState('');
    const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const { data: docs = [], isLoading } = useQuery<KnowledgeDoc[]>({
        queryKey: ['knowledge'],
        queryFn: () => axios.get('/api/knowledge').then(r => r.data),
    });

    const { data: selectedDoc, isFetching: loadingDoc } = useQuery<KnowledgeDetail>({
        queryKey: ['knowledge', selectedDocId],
        queryFn: () => axios.get(`/api/knowledge/${selectedDocId}`).then(r => r.data),
        enabled: Boolean(selectedDocId),
    });

    const deleteDoc = useMutation({
        mutationFn: (id: string) => axios.delete(`/api/knowledge/${id}`),
        onSuccess: (_, id) => {
            if (selectedDocId === id) setSelectedDocId(null);
            qc.invalidateQueries({ queryKey: ['knowledge'] });
        },
    });

    useEffect(() => {
        return () => {
            if (progressRef.current) clearInterval(progressRef.current);
        };
    }, []);

    function startProgress(estimatedChunks: number) {
        if (progressRef.current) clearInterval(progressRef.current);
        setProgress(0);
        const totalMs = Math.max(estimatedChunks * 180, 2000);
        const tickMs = 120;
        const target = 88;
        const increment = (target / (totalMs / tickMs));
        let current = 0;
        progressRef.current = setInterval(() => {
            current = Math.min(current + increment, target);
            setProgress(current);
        }, tickMs);
    }

    function finishProgress() {
        if (progressRef.current) clearInterval(progressRef.current);
        setProgress(100);
        setTimeout(() => setProgress(0), 900);
    }

    async function handleAdd() {
        if (!title.trim() || !content.trim()) return;
        setSourceError('');
        const estimatedChunks = Math.ceil(content.length / 700);
        setUploading(true);
        startProgress(estimatedChunks);
        try {
            await axios.post('/api/knowledge', { title: title.trim(), content: content.trim() });
            finishProgress();
            setTitle(''); setContent(''); setAdding(false);
            qc.invalidateQueries({ queryKey: ['knowledge'] });
        } catch (err) {
            if (progressRef.current) clearInterval(progressRef.current);
            setProgress(0);
            setSourceError(
                axios.isAxiosError(err)
                    ? (err.response?.data?.error ?? 'Falha ao indexar texto.')
                    : 'Falha ao indexar texto.'
            );
        } finally { setUploading(false); }
    }

    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setSourceError('');
        const mimeType = inferMimeType(file);

        if (!mimeType) {
            setSourceError('Formato não suportado. Use PDF, DOC, DOCX, TXT ou MD.');
            if (fileRef.current) fileRef.current.value = '';
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setSourceError('Arquivo acima de 5 MB. Envie um arquivo menor.');
            if (fileRef.current) fileRef.current.value = '';
            return;
        }

        setUploading(true);
        startProgress(Math.max(3, Math.ceil(file.size / 180_000)));

        try {
            const base64Data = await readFileAsBase64(file);
            await axios.post('/api/knowledge', {
                title: file.name.replace(/\.[^/.]+$/, '').trim() || 'Documento',
                sourceType: 'file',
                mimeType,
                base64Data,
            });
            finishProgress();
            qc.invalidateQueries({ queryKey: ['knowledge'] });
        } catch (err) {
            if (progressRef.current) clearInterval(progressRef.current);
            setProgress(0);
            setSourceError(
                axios.isAxiosError(err)
                    ? (err.response?.data?.error ?? 'Falha ao processar arquivo.')
                    : 'Falha ao processar arquivo.'
            );
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    }

    async function handleUrlAdd() {
        if (!urlValue.trim()) return;
        setSourceError('');
        setUploading(true);
        startProgress(8);

        try {
            const parsed = new URL(urlValue.trim());
            await axios.post('/api/knowledge', {
                title: urlTitle.trim() || parsed.hostname,
                sourceType: 'url',
                url: urlValue.trim(),
            });
            finishProgress();
            setAddingUrl(false);
            setUrlTitle('');
            setUrlValue('');
            qc.invalidateQueries({ queryKey: ['knowledge'] });
        } catch (err) {
            if (progressRef.current) clearInterval(progressRef.current);
            setProgress(0);
            setSourceError(
                axios.isAxiosError(err)
                    ? (err.response?.data?.error ?? 'Falha ao indexar URL.')
                    : 'Falha ao indexar URL.'
            );
        } finally {
            setUploading(false);
        }
    }

    const totalChunks = docs.reduce((s, d) => s + d._count.chunks, 0);

    return (
        <div style={{ marginBottom: 40 }}>
            <SectionLabel>Base de Conhecimento (RAG)</SectionLabel>
            <div style={{
                fontSize: 12, color: 'var(--ink-4)', marginBottom: 14, lineHeight: 1.6,
                padding: '10px 14px', background: 'var(--paper-2)',
                borderRadius: 8, border: '1px solid var(--line)',
            }}>
                Documentos aqui são fragmentados, embutidos via <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11 }}>gemini-embedding-2</span> e recuperados automaticamente durante conversas via similaridade semântica.
                {totalChunks > 0 && (
                    <span style={{ display: 'block', marginTop: 4, fontFamily: "'Geist Mono', monospace", fontSize: 11, color: 'var(--accent-ink)' }}>
                        {totalChunks} chunks indexados em {docs.length} documento{docs.length !== 1 ? 's' : ''}
                    </span>
                )}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-5)', marginBottom: 12 }}>
                Fontes aceitas: PDF, DOC, DOCX, TXT, MD, URL/página web, conversa/manual em texto.
            </div>

            {/* Document list */}
            {isLoading ? (
                <div style={{ fontSize: 13, color: 'var(--ink-4)', padding: '8px 0' }}>Carregando…</div>
            ) : docs.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--ink-4)', padding: '8px 0' }}>Nenhum documento ainda.</div>
            ) : (
                <div style={{ marginBottom: 12 }}>
                    {docs.map(doc => (
                        <div key={doc.id} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '10px 0', borderBottom: '1px solid var(--line)',
                        }}>
                            <div>
                                <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink-1)', marginBottom: 2 }}>{doc.title}</div>
                                <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: 'var(--ink-4)' }}>
                                    {doc._count.chunks} chunks · {(doc.charCount / 1000).toFixed(1)}k chars
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                                <button
                                    onClick={() => setSelectedDocId(doc.id)}
                                    style={{
                                        padding: '4px 10px', borderRadius: 6, fontSize: 11,
                                        border: '1px solid var(--line-2)', background: selectedDocId === doc.id ? 'var(--accent-soft)' : 'transparent',
                                        color: selectedDocId === doc.id ? 'var(--accent-ink)' : 'var(--ink-4)',
                                        cursor: 'pointer', fontFamily: 'inherit',
                                    }}
                                >
                                    Ver
                                </button>
                                <button
                                    onClick={() => deleteDoc.mutate(doc.id)}
                                    disabled={deleteDoc.isPending}
                                    style={{
                                        padding: '4px 10px', borderRadius: 6, fontSize: 11,
                                        border: '1px solid var(--danger)', background: 'transparent',
                                        color: 'var(--danger)', cursor: 'pointer', fontFamily: 'inherit',
                                    }}
                                >
                                    Remover
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {sourceError && (
                <div style={{
                    marginBottom: 12, padding: '10px 12px',
                    borderRadius: 8, border: '1px solid #e1c3c3',
                    background: '#fff4f4', color: '#a04d4d', fontSize: 12.5,
                }}>
                    {sourceError}
                </div>
            )}
            {uploading && (
                <div style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: 'var(--ink-4)' }}>
                            Processando e indexando memória…
                        </span>
                        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: 'var(--accent-ink)' }}>
                            {Math.round(progress)}%
                        </span>
                    </div>
                    <div style={{ height: 5, borderRadius: 99, background: 'var(--line)', overflow: 'hidden' }}>
                        <div style={{
                            height: '100%', borderRadius: 99,
                            background: progress === 100 ? '#3d7a5e' : 'var(--accent)',
                            width: `${progress}%`,
                            transition: progress === 100 ? 'width .3s ease, background .3s' : 'width .12s linear',
                        }} />
                    </div>
                </div>
            )}

            {/* Add form */}
            {adding ? (
                <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '16px', background: 'var(--paper)' }}>
                    <input
                        value={title} onChange={e => setTitle(e.target.value)}
                        placeholder="Título do documento"
                        style={{
                            width: '100%', padding: '8px 12px', borderRadius: 7, fontSize: 13,
                            border: '1px solid var(--line-2)', background: 'var(--paper-2)',
                            color: 'var(--ink-1)', fontFamily: 'inherit', outline: 'none',
                            marginBottom: 10, boxSizing: 'border-box',
                        }}
                    />
                    <textarea
                        value={content} onChange={e => setContent(e.target.value)}
                        placeholder="Cole o conteúdo aqui (FAQ, manual, descrição de cursos, políticas…)"
                        rows={8}
                        style={{
                            width: '100%', padding: '8px 12px', borderRadius: 7, fontSize: 12.5,
                            border: '1px solid var(--line-2)', background: 'var(--paper-2)',
                            color: 'var(--ink-1)', fontFamily: 'inherit', outline: 'none',
                            resize: 'vertical', lineHeight: 1.5, marginBottom: 10,
                            boxSizing: 'border-box',
                        }}
                    />
                    <div style={{ fontSize: 11, color: 'var(--ink-5)', marginBottom: 10, fontFamily: "'Geist Mono', monospace" }}>
                        {content.length.toLocaleString()} chars → ~{Math.ceil(content.length / 700)} chunks estimados
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            onClick={handleAdd}
                            disabled={uploading || !title.trim() || !content.trim()}
                            style={{
                                padding: '8px 18px', borderRadius: 7, fontSize: 12.5, fontWeight: 500,
                                border: '1px solid var(--accent-ink)', background: 'var(--accent)',
                                color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
                                opacity: (uploading || !title.trim() || !content.trim()) ? .5 : 1,
                            }}
                        >
                            {uploading ? 'Indexando…' : 'Indexar documento'}
                        </button>
                        <button onClick={() => { setAdding(false); setTitle(''); setContent(''); setSourceError(''); }} style={{
                            padding: '8px 14px', borderRadius: 7, fontSize: 12.5,
                            border: '1px solid var(--line-2)', background: 'transparent',
                            color: 'var(--ink-4)', cursor: 'pointer', fontFamily: 'inherit',
                        }}>Cancelar</button>
                    </div>
                </div>
            ) : addingUrl ? (
                <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '16px', background: 'var(--paper)' }}>
                    <input
                        value={urlTitle}
                        onChange={e => setUrlTitle(e.target.value)}
                        placeholder="Título da memória (opcional)"
                        style={{
                            width: '100%', padding: '8px 12px', borderRadius: 7, fontSize: 13,
                            border: '1px solid var(--line-2)', background: 'var(--paper-2)',
                            color: 'var(--ink-1)', fontFamily: 'inherit', outline: 'none',
                            marginBottom: 10, boxSizing: 'border-box',
                        }}
                    />
                    <input
                        value={urlValue}
                        onChange={e => setUrlValue(e.target.value)}
                        placeholder="https://site.com/manual-ou-pagina"
                        style={{
                            width: '100%', padding: '8px 12px', borderRadius: 7, fontSize: 13,
                            border: '1px solid var(--line-2)', background: 'var(--paper-2)',
                            color: 'var(--ink-1)', fontFamily: 'inherit', outline: 'none',
                            marginBottom: 10, boxSizing: 'border-box',
                        }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            onClick={handleUrlAdd}
                            disabled={uploading || !urlValue.trim()}
                            style={{
                                padding: '8px 18px', borderRadius: 7, fontSize: 12.5, fontWeight: 500,
                                border: '1px solid var(--accent-ink)', background: 'var(--accent)',
                                color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
                                opacity: (uploading || !urlValue.trim()) ? .5 : 1,
                            }}
                        >
                            {uploading ? 'Indexando…' : 'Indexar URL'}
                        </button>
                        <button onClick={() => { setAddingUrl(false); setUrlTitle(''); setUrlValue(''); setSourceError(''); }} style={{
                            padding: '8px 14px', borderRadius: 7, fontSize: 12.5,
                            border: '1px solid var(--line-2)', background: 'transparent',
                            color: 'var(--ink-4)', cursor: 'pointer', fontFamily: 'inherit',
                        }}>Cancelar</button>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setAdding(true)} style={{
                        padding: '8px 16px', borderRadius: 7, fontSize: 12.5, fontWeight: 500,
                        border: '1px solid var(--accent-ink)', background: 'var(--accent)',
                        color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                        + Memória em texto
                    </button>
                    <button onClick={() => fileRef.current?.click()} style={{
                        padding: '8px 16px', borderRadius: 7, fontSize: 12.5, fontWeight: 500,
                        border: '1px solid var(--line-2)', background: 'var(--paper)',
                        color: 'var(--ink-3)', cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                        Upload arquivo
                    </button>
                    <button onClick={() => setAddingUrl(true)} style={{
                        padding: '8px 16px', borderRadius: 7, fontSize: 12.5, fontWeight: 500,
                        border: '1px solid var(--line-2)', background: 'var(--paper)',
                        color: 'var(--ink-3)', cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                        + URL / site
                    </button>
                    <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt,.md" onChange={handleFileUpload} style={{ display: 'none' }} />
                </div>
            )}

            {selectedDocId && (
                <div
                    onClick={() => setSelectedDocId(null)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(12, 16, 24, 0.54)',
                        zIndex: 1200,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 20,
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            width: 'min(980px, 100%)',
                            maxHeight: '86vh',
                            borderRadius: 10,
                            background: 'var(--paper)',
                            border: '1px solid var(--line)',
                            overflow: 'hidden',
                            boxShadow: '0 24px 60px rgba(0,0,0,.25)',
                            display: 'flex',
                            flexDirection: 'column',
                        }}
                    >
                        <div style={{
                            padding: '12px 14px',
                            borderBottom: '1px solid var(--line)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 12,
                            flexShrink: 0,
                        }}>
                            <div>
                                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-1)', marginBottom: 2 }}>
                                    {selectedDoc?.title ?? 'Carregando memória...'}
                                </div>
                                <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: 'var(--ink-5)' }}>
                                    {selectedDoc
                                        ? `${selectedDoc._count.chunks} chunks · ${selectedDoc.charCount.toLocaleString()} chars`
                                        : loadingDoc ? 'Buscando conteúdo...' : ''}
                                </div>
                            </div>
                            <button onClick={() => setSelectedDocId(null)} style={{
                                padding: '5px 10px', borderRadius: 6, fontSize: 11,
                                border: '1px solid var(--line-2)', background: 'transparent',
                                color: 'var(--ink-4)', cursor: 'pointer', fontFamily: 'inherit',
                            }}>
                                Fechar
                            </button>
                        </div>
                        <pre style={{
                            margin: 0,
                            padding: 14,
                            overflow: 'auto',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            fontFamily: "'Geist Mono', monospace",
                            fontSize: 11.5,
                            lineHeight: 1.6,
                            color: 'var(--ink-2)',
                            background: 'var(--paper-2)',
                            flex: 1,
                            minHeight: 240,
                        }}>
                            {loadingDoc ? 'Carregando conteúdo...' : selectedDoc?.content ?? 'Conteúdo não encontrado.'}
                        </pre>
                    </div>
                </div>
            )}
        </div>
    );
}

export function Agente() {
    const qc = useQueryClient();

    const { data: agent, isLoading } = useQuery<AgentData>({
        queryKey: ['agent'],
        queryFn: () => axios.get('/api/agent').then(r => r.data),
    });

    // Persona state
    const [personaName, setPersonaName] = useState('');
    const [personaRole, setPersonaRole] = useState('');
    const [whatsapp, setWhatsapp] = useState('');
    const [geminiModel, setGeminiModel] = useState('');

    // Tom state
    const [tonePrimary, setTonePrimary] = useState('');
    const [toneFormatting, setToneFormatting] = useState('');
    const [toneEmojiRules, setToneEmojiRules] = useState('');
    const [toneAiIdentity, setToneAiIdentity] = useState('');

    // Protocolo state
    const [humanLink, setHumanLink] = useState('');
    const [registrationLink, setRegistrationLink] = useState('');

    // Restrições state
    const [restrictions, setRestrictions] = useState('');
    const [activeTab, setActiveTab] = useState<'config' | 'memories'>('config');


    useEffect(() => {
        if (!agent) return;
        setPersonaName(agent.name ?? '');
        setPersonaRole(agent.role ?? '');
        setWhatsapp(agent.whatsappNumber ?? '');
        setGeminiModel(agent.geminiModel || 'gemini-2.5-flash');
        const tone = asRecord(agent.toneJson);
        setTonePrimary(asTextLines(tone.primary));
        setToneFormatting(String(tone.formatting ?? ''));
        setToneEmojiRules(String(tone.emoji_rules ?? ''));
        setToneAiIdentity(String(tone.ai_identity ?? ''));
        setHumanLink(agent.protocols?.human_contact_link ?? '');
        setRegistrationLink(agent.protocols?.registration_link ?? agent.protocols?.respondi_form_link ?? '');
        setRestrictions((agent.restrictions ?? []).join('\n'));
    }, [agent]);

    const personaDirty = agent ? (
        personaName !== (agent.name ?? '') ||
        personaRole !== (agent.role ?? '') ||
        whatsapp !== (agent.whatsappNumber ?? '')
    ) : false;

    const protocolDirty = agent ? (
        humanLink !== (agent.protocols?.human_contact_link ?? '') ||
        registrationLink !== (agent.protocols?.registration_link ?? agent.protocols?.respondi_form_link ?? '')
    ) : false;

    const agentTone = asRecord(agent?.toneJson);
    const toneDirty = agent ? (
        tonePrimary !== asTextLines(agentTone.primary) ||
        toneFormatting !== String(agentTone.formatting ?? '') ||
        toneEmojiRules !== String(agentTone.emoji_rules ?? '') ||
        toneAiIdentity !== String(agentTone.ai_identity ?? '')
    ) : false;

    const personaValid = Boolean(personaName.trim() && personaRole.trim());
    const toneValid = Boolean(lines(tonePrimary).length && toneFormatting.trim() && toneEmojiRules.trim() && toneAiIdentity.trim());
    const protocolValid = Boolean(humanLink.trim() && registrationLink.trim());
    const restrictionsValid = Boolean(lines(restrictions).length);

    const restrictionsDirty = agent ? (
        restrictions !== (agent.restrictions ?? []).join('\n')
    ) : false;

    const updatePersona = useMutation({
        mutationFn: () => axios.patch('/api/agent/persona', {
            name: personaName,
            role: personaRole,
            whatsappNumber: whatsapp.trim(),
        }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['agent'] }),
    });

    const updateTone = useMutation({
        mutationFn: () => axios.patch('/api/agent/persona', {
            toneJson: {
                primary: lines(tonePrimary),
                formatting: toneFormatting.trim(),
                emoji_rules: toneEmojiRules.trim(),
                ai_identity: toneAiIdentity.trim(),
            },
        }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['agent'] }),
    });

    const updateProtocol = useMutation({
        mutationFn: () => axios.patch('/api/agent/persona', {
            protocols: {
                ...(agent?.protocols ?? {}),
                human_contact_link: humanLink.trim(),
                registration_link:  registrationLink.trim(),
                respondi_form_link:  registrationLink.trim(),
            },
        }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['agent'] }),
    });

    const updateRestrictions = useMutation({
        mutationFn: () => axios.patch('/api/agent/persona', {
            absolute_restrictions: restrictions.split('\n').map(s => s.trim()).filter(Boolean),
        }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['agent'] }),
    });

    const toggleAgent = useMutation({
        mutationFn: () => axios.patch('/api/agent/toggle'),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['agent'] }),
    });

    if (isLoading) {
        return <div style={{ padding: 40, color: 'var(--ink-4)', fontSize: 14 }}>Carregando…</div>;
    }

    return (
        <div style={{ display: 'flex', flex: 1, height: '100%', overflow: 'hidden' }}>
            {/* Main form */}
            <div style={{ flex: '1 1 0', overflowY: 'auto', padding: '40px 48px', borderRight: '1px solid var(--line)' }}>
                <div style={{ marginBottom: 40 }}>
                    <div style={{
                        fontFamily: "'Fraunces', serif", fontSize: 40, fontWeight: 400,
                        color: 'var(--ink-1)', letterSpacing: -1, lineHeight: 1, marginBottom: 8,
                    }}>Agente</div>
                    <div style={{ fontSize: 14, color: 'var(--ink-4)' }}>
                        Configuração de identidade e memórias de arquivos do agente.
                    </div>
                </div>

                {activeTab === 'config' && (
                    <>
                        {/* Identidade */}
                        <div style={{ marginBottom: 40 }}>
                            <SectionLabel>Identidade</SectionLabel>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div>
                                    <label style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--ink-4)', display: 'block', marginBottom: 6 }}>
                                        Nome do agente
                                    </label>
                                    <input
                                        value={personaName}
                                        onChange={e => setPersonaName(e.target.value)}
                                        required
                                        style={{
                                            width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13.5,
                                            border: '1px solid var(--line-2)', background: 'var(--paper-2)',
                                            color: 'var(--ink-1)', fontFamily: 'inherit', outline: 'none',
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--ink-4)', display: 'block', marginBottom: 6 }}>
                                        Papel / Descrição da IA
                                    </label>
                                    <textarea
                                        value={personaRole}
                                        onChange={e => setPersonaRole(e.target.value)}
                                        rows={3}
                                        required
                                        placeholder="Ex: Você é Artemis, assistente de vendas especializado em cursos de idiomas..."
                                        style={{
                                            width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13,
                                            border: '1px solid var(--line-2)', background: 'var(--paper-2)',
                                            color: 'var(--ink-1)', fontFamily: 'inherit', outline: 'none',
                                            resize: 'vertical', lineHeight: 1.5,
                                        }}
                                    />
                                </div>
                        <div>
                            <label style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--ink-4)', display: 'block', marginBottom: 6 }}>
                                Número WhatsApp
                            </label>
                            <input
                                value={whatsapp}
                                onChange={e => setWhatsapp(e.target.value)}
                                placeholder="+5511999999999"
                                style={{
                                    width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13,
                                    border: '1px solid var(--line-2)', background: 'var(--paper-2)',
                                    color: 'var(--ink-1)', fontFamily: 'inherit', outline: 'none',
                                }}
                            />
                        </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <SaveButton
                                        dirty={personaDirty && personaValid}
                                        saving={updatePersona.isPending}
                                        onClick={() => updatePersona.mutate()}
                                    />
                                </div>
                                {updatePersona.isError && (
                                    <div style={{ fontSize: 12, color: 'var(--danger)' }}>{mutationError(updatePersona.error)}</div>
                                )}
                            </div>
                        </div>

                        {/* Tom e Formatação */}
                        <div style={{ marginBottom: 40 }}>
                            <SectionLabel>Tom e Formatação</SectionLabel>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div>
                                    <label style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--ink-4)', display: 'block', marginBottom: 6 }}>
                                        Tons principais
                                    </label>
                                    <div style={{ fontSize: 11.5, color: 'var(--ink-5)', marginBottom: 6 }}>
                                        Um tom por linha. Ex: humano, claro, consultivo.
                                    </div>
                                    <textarea
                                        value={tonePrimary}
                                        onChange={e => setTonePrimary(e.target.value)}
                                        rows={3}
                                        required
                                        placeholder={"humano\nclaro\nconsultivo"}
                                        style={{
                                            width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13,
                                            border: '1px solid var(--line-2)', background: 'var(--paper-2)',
                                            color: 'var(--ink-1)', fontFamily: 'inherit', outline: 'none',
                                            resize: 'vertical', lineHeight: 1.5, boxSizing: 'border-box',
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--ink-4)', display: 'block', marginBottom: 6 }}>
                                        Formatação
                                    </label>
                                    <textarea
                                        value={toneFormatting}
                                        onChange={e => setToneFormatting(e.target.value)}
                                        rows={2}
                                        required
                                        placeholder="Mensagens curtas, objetivas e fáceis de ler."
                                        style={{ width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13, border: '1px solid var(--line-2)', background: 'var(--paper-2)', color: 'var(--ink-1)', fontFamily: 'inherit', outline: 'none', resize: 'vertical', lineHeight: 1.5, boxSizing: 'border-box' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--ink-4)', display: 'block', marginBottom: 6 }}>
                                        Regras de emoji
                                    </label>
                                    <textarea
                                        value={toneEmojiRules}
                                        onChange={e => setToneEmojiRules(e.target.value)}
                                        rows={2}
                                        required
                                        placeholder="Use com moderação e apenas quando ajudar o atendimento."
                                        style={{ width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13, border: '1px solid var(--line-2)', background: 'var(--paper-2)', color: 'var(--ink-1)', fontFamily: 'inherit', outline: 'none', resize: 'vertical', lineHeight: 1.5, boxSizing: 'border-box' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--ink-4)', display: 'block', marginBottom: 6 }}>
                                        Identidade da IA
                                    </label>
                                    <textarea
                                        value={toneAiIdentity}
                                        onChange={e => setToneAiIdentity(e.target.value)}
                                        rows={2}
                                        required
                                        placeholder="Não finja ser humano; apresente-se como assistente virtual quando necessário."
                                        style={{ width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13, border: '1px solid var(--line-2)', background: 'var(--paper-2)', color: 'var(--ink-1)', fontFamily: 'inherit', outline: 'none', resize: 'vertical', lineHeight: 1.5, boxSizing: 'border-box' }}
                                    />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: toneValid ? 'var(--ink-5)' : 'var(--danger)' }}>
                                        {toneValid ? 'Campos de tom preenchidos' : 'Preencha todos os campos de tom'}
                                    </span>
                                    <SaveButton dirty={toneDirty && toneValid} saving={updateTone.isPending} onClick={() => updateTone.mutate()} />
                                </div>
                                {updateTone.isError && (
                                    <div style={{ fontSize: 12, color: 'var(--danger)' }}>{mutationError(updateTone.error)}</div>
                                )}
                            </div>
                        </div>

                        {/* Protocolo de Atendimento */}
                        <div style={{ marginBottom: 40 }}>
                            <SectionLabel>Protocolo de Atendimento</SectionLabel>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div>
                                    <label style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--ink-4)', display: 'block', marginBottom: 6 }}>
                                        Link de atendimento humano
                                    </label>
                                    <div style={{ fontSize: 11.5, color: 'var(--ink-5)', marginBottom: 6 }}>
                                        WhatsApp ou link para quando o lead pedir atendimento humano
                                    </div>
                                    <input
                                        value={humanLink}
                                        onChange={e => setHumanLink(e.target.value)}
                                        required
                                        placeholder="https://wa.me/55..."
                                        style={{ width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13, border: '1px solid var(--line-2)', background: 'var(--paper-2)', color: 'var(--ink-1)', fontFamily: 'inherit', outline: 'none' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--ink-4)', display: 'block', marginBottom: 6 }}>
                                        Link de formulário / cadastro
                                    </label>
                                    <div style={{ fontSize: 11.5, color: 'var(--ink-5)', marginBottom: 6 }}>
                                        Formulário de matrícula ou cadastro de alunos
                                    </div>
                                    <input
                                        value={registrationLink}
                                        onChange={e => setRegistrationLink(e.target.value)}
                                        required
                                        placeholder="https://form.respondi.app/..."
                                        style={{ width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13, border: '1px solid var(--line-2)', background: 'var(--paper-2)', color: 'var(--ink-1)', fontFamily: 'inherit', outline: 'none' }}
                                    />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <SaveButton dirty={protocolDirty && protocolValid} saving={updateProtocol.isPending} onClick={() => updateProtocol.mutate()} />
                                </div>
                                {updateProtocol.isError && (
                                    <div style={{ fontSize: 12, color: 'var(--danger)' }}>{mutationError(updateProtocol.error)}</div>
                                )}
                            </div>
                        </div>

                        {/* Restrições absolutas */}
                        <div style={{ marginBottom: 40 }}>
                            <SectionLabel>Restrições Absolutas</SectionLabel>
                            <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginBottom: 10, lineHeight: 1.6 }}>
                                Uma restrição por linha. O agente <strong>nunca</strong> fará nada que contrarie essas regras, independente do que o usuário pedir.
                            </div>
                            <textarea
                                value={restrictions}
                                onChange={e => setRestrictions(e.target.value)}
                                rows={8}
                                required
                                placeholder={"Nunca envie link sem confirmação do usuário.\nNunca saia do assunto da empresa.\nNunca prometa entrar em contato."}
                                style={{
                                    width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 13,
                                    border: '1px solid var(--line-2)', background: 'var(--paper-2)',
                                    color: 'var(--ink-1)', fontFamily: 'inherit', outline: 'none',
                                    resize: 'vertical', lineHeight: 1.7, boxSizing: 'border-box',
                                }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                                <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: 'var(--ink-5)' }}>
                                    {restrictions.split('\n').filter(Boolean).length} restrições
                                </span>
                                <SaveButton dirty={restrictionsDirty && restrictionsValid} saving={updateRestrictions.isPending} onClick={() => updateRestrictions.mutate()} />
                            </div>
                            {updateRestrictions.isError && (
                                <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 8 }}>{mutationError(updateRestrictions.error)}</div>
                            )}
                        </div>
                    </>
                )}
                {activeTab === 'memories' && <KnowledgeSection />}
            </div>

            {/* Right sidebar — status */}
            <div style={{
                width: 280, flexShrink: 0, background: 'var(--paper-2)',
                overflowY: 'auto', padding: '40px 24px',
                display: 'flex', flexDirection: 'column', gap: 28,
            }}>
                <div>
                    <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--ink-5)', marginBottom: 14 }}>
                        Status do agente
                    </div>
                    <div style={{
                        background: 'var(--paper)', border: '1px solid var(--line)',
                        borderRadius: 12, padding: 16,
                    }}>
                        <div style={{
                            width: 44, height: 44, borderRadius: '50%',
                            background: agent?.isActive ? 'var(--accent)' : 'var(--ink-5)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: "'Fraunces', serif", fontSize: 22, color: '#fff', marginBottom: 10,
                        }}>
                            {personaName?.[0] ?? 'A'}
                        </div>
                        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, color: 'var(--ink-1)', marginBottom: 2 }}>
                            {personaName || '—'}
                        </div>
                        <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: 'var(--ink-4)', marginBottom: 14 }}>
                            {geminiModel}
                        </div>
                        <button
                            onClick={() => toggleAgent.mutate()}
                            disabled={toggleAgent.isPending}
                            style={{
                                width: '100%', padding: '8px', borderRadius: 8, fontSize: 12.5, fontWeight: 500,
                                border: `1px solid ${agent?.isActive ? 'var(--danger)' : 'var(--accent-ink)'}`,
                                background: 'transparent',
                                color: agent?.isActive ? 'var(--danger)' : 'var(--accent-ink)',
                                cursor: 'pointer', fontFamily: 'inherit',
                                opacity: toggleAgent.isPending ? .5 : 1,
                            }}
                        >
                            {agent?.isActive ? '⏸ Pausar agente' : '▶ Ativar agente'}
                        </button>
                    </div>
                </div>

                <div style={{
                    padding: '14px 16px', background: 'var(--accent-soft)',
                    border: '1px solid #c9d8d0', borderRadius: 10,
                    fontSize: 12, color: 'var(--accent-ink)', lineHeight: 1.6,
                }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>Dica</div>
                    Programas são usados pela IA para apresentar opções ao lead. Mantenha nomes claros e preços atualizados.
                </div>
            </div>
        </div>
    );
}
