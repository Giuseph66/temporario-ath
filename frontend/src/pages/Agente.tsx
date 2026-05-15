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

const GEMINI_MODELS = [
    'gemini-2.5-flash-preview-05-20',
    'gemini-2.0-flash',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
];

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

function KnowledgeSection() {
    const qc = useQueryClient();
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [adding, setAdding] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const fileRef = useRef<HTMLInputElement>(null);
    const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const { data: docs = [], isLoading } = useQuery<KnowledgeDoc[]>({
        queryKey: ['knowledge'],
        queryFn: () => axios.get('/api/knowledge').then(r => r.data),
    });

    const deleteDoc = useMutation({
        mutationFn: (id: string) => axios.delete(`/api/knowledge/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['knowledge'] }),
    });

    function startProgress(estimatedChunks: number) {
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
        const estimatedChunks = Math.ceil(content.length / 700);
        setUploading(true);
        startProgress(estimatedChunks);
        try {
            await axios.post('/api/knowledge', { title: title.trim(), content: content.trim() });
            finishProgress();
            setTitle(''); setContent(''); setAdding(false);
            qc.invalidateQueries({ queryKey: ['knowledge'] });
        } catch {
            if (progressRef.current) clearInterval(progressRef.current);
            setProgress(0);
        } finally { setUploading(false); }
    }

    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        const text = await file.text();
        setTitle(file.name.replace(/\.[^/.]+$/, ''));
        setContent(text);
        setAdding(true);
        if (fileRef.current) fileRef.current.value = '';
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
                    ))}
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
                    {uploading && (
                        <div style={{ marginBottom: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: 'var(--ink-4)' }}>
                                    Fragmentando e indexando chunks…
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
                        <button onClick={() => { setAdding(false); setTitle(''); setContent(''); }} style={{
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
                        + Adicionar texto
                    </button>
                    <button onClick={() => fileRef.current?.click()} style={{
                        padding: '8px 16px', borderRadius: 7, fontSize: 12.5, fontWeight: 500,
                        border: '1px solid var(--line-2)', background: 'var(--paper)',
                        color: 'var(--ink-3)', cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                        Upload arquivo .txt
                    </button>
                    <input ref={fileRef} type="file" accept=".txt,.md" onChange={handleFileUpload} style={{ display: 'none' }} />
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

    // Protocolo state
    const [humanLink, setHumanLink] = useState('');
    const [registrationLink, setRegistrationLink] = useState('');

    // Restrições state
    const [restrictions, setRestrictions] = useState('');


    useEffect(() => {
        if (!agent) return;
        setPersonaName(agent.name ?? '');
        setPersonaRole(agent.role ?? '');
        setWhatsapp(agent.whatsappNumber ?? '');
        setGeminiModel(agent.geminiModel ?? GEMINI_MODELS[0]);
        setHumanLink(agent.protocols?.human_contact_link ?? '');
        setRegistrationLink(agent.protocols?.registration_link ?? agent.protocols?.respondi_form_link ?? '');
        setRestrictions((agent.restrictions ?? []).join('\n'));
    }, [agent]);

    const personaDirty = agent ? (
        personaName !== (agent.name ?? '') ||
        personaRole !== (agent.role ?? '') ||
        whatsapp !== (agent.whatsappNumber ?? '') ||
        geminiModel !== agent.geminiModel
    ) : false;

    const protocolDirty = agent ? (
        humanLink !== (agent.protocols?.human_contact_link ?? '') ||
        registrationLink !== (agent.protocols?.registration_link ?? agent.protocols?.respondi_form_link ?? '')
    ) : false;

    const restrictionsDirty = agent ? (
        restrictions !== (agent.restrictions ?? []).join('\n')
    ) : false;

    const updatePersona = useMutation({
        mutationFn: () => axios.patch('/api/agent/persona', {
            name: personaName,
            role: personaRole,
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
                        Configuração de identidade, programas e comportamento.
                    </div>
                </div>

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
                                placeholder="Ex: Você é Artemis, assistente de vendas especializado em cursos de idiomas..."
                                style={{
                                    width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13,
                                    border: '1px solid var(--line-2)', background: 'var(--paper-2)',
                                    color: 'var(--ink-1)', fontFamily: 'inherit', outline: 'none',
                                    resize: 'vertical', lineHeight: 1.5,
                                }}
                            />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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
                            <div>
                                <label style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--ink-4)', display: 'block', marginBottom: 6 }}>
                                    Modelo Gemini
                                </label>
                                <select
                                    value={geminiModel}
                                    onChange={e => setGeminiModel(e.target.value)}
                                    style={{
                                        width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13,
                                        border: '1px solid var(--line-2)', background: 'var(--paper-2)',
                                        color: 'var(--ink-1)', fontFamily: 'inherit', outline: 'none',
                                    }}
                                >
                                    {GEMINI_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <SaveButton
                                dirty={personaDirty}
                                saving={updatePersona.isPending}
                                onClick={() => updatePersona.mutate()}
                            />
                        </div>
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
                                placeholder="https://form.respondi.app/..."
                                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13, border: '1px solid var(--line-2)', background: 'var(--paper-2)', color: 'var(--ink-1)', fontFamily: 'inherit', outline: 'none' }}
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <SaveButton dirty={protocolDirty} saving={updateProtocol.isPending} onClick={() => updateProtocol.mutate()} />
                        </div>
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
                        <SaveButton dirty={restrictionsDirty} saving={updateRestrictions.isPending} onClick={() => updateRestrictions.mutate()} />
                    </div>
                </div>



                {/* Base de Conhecimento (RAG) */}
                <KnowledgeSection />
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
