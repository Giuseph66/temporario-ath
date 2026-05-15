import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

type Program = {
    id: string;
    programKey: string;
    name: string;
    priceValue: number;
    priceType: 'monthly' | 'per_session';
    installments: number;
    durationWeeks: number;
    verbatimIntro: string;
    fullText: string;
};

const EMPTY_PROGRAM: Omit<Program, 'id' | 'programKey'> = {
    name: '',
    priceValue: 0,
    priceType: 'monthly',
    installments: 6,
    durationWeeks: 24,
    verbatimIntro: 'Vou te enviar o informativo que responde às principais dúvidas. No final, me diz se encaixa no que você está procurando, ok?',
    fullText: '',
};

type AgentData = { programs: Program[] };

// ─── Modal de edição ──────────────────────────────────────────────────────────
function ProgramModal({ prog, isNew, onSave, onClose }: {
    prog: Program;
    isNew: boolean;
    onSave: (p: Program) => void;
    onClose: () => void;
}) {
    const [form, setForm] = useState<Program>({ ...prog });

    const set = (key: keyof Program, val: unknown) =>
        setForm(f => ({ ...f, [key]: val }));

    const valid = form.name.trim() && form.fullText.trim();

    return (
        <>
            <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 40, backdropFilter: 'blur(3px)' }} />
            <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 660, maxHeight: '92vh', overflowY: 'auto', background: 'var(--paper)', borderRadius: 18, border: '1px solid var(--line)', boxShadow: '0 24px 64px rgba(0,0,0,.18)', zIndex: 50, padding: '36px 40px' }}>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, color: 'var(--ink-1)', marginBottom: 28 }}>
                    {isNew ? 'Novo produto' : 'Editar produto'}
                </div>

                {/* Campos simples */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                    {[
                        { label: 'Nome do produto', key: 'name', type: 'text', span: 2 },
                        { label: 'Preço (R$)', key: 'priceValue', type: 'number', span: 1 },
                        { label: 'Parcelas', key: 'installments', type: 'number', span: 1 },
                        { label: 'Duração (semanas)', key: 'durationWeeks', type: 'number', span: 1 },
                    ].map(({ label, key, type, span }) => (
                        <div key={key} style={{ gridColumn: `span ${span}` }}>
                            <label style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--ink-5)', display: 'block', marginBottom: 5 }}>{label}</label>
                            <input
                                type={type}
                                value={(form as any)[key] ?? ''}
                                onChange={e => set(key as keyof Program, type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
                                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13, border: '1px solid var(--line-2)', background: 'var(--paper-2)', color: 'var(--ink-1)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                            />
                        </div>
                    ))}
                    <div>
                        <label style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--ink-5)', display: 'block', marginBottom: 5 }}>Tipo de cobrança</label>
                        <select value={form.priceType} onChange={e => set('priceType', e.target.value)}
                            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13, border: '1px solid var(--line-2)', background: 'var(--paper-2)', color: 'var(--ink-1)', fontFamily: 'inherit', outline: 'none' }}>
                            <option value="monthly">Mensal</option>
                            <option value="per_session">Por sessão</option>
                        </select>
                    </div>
                </div>

                {/* Intro */}
                <div style={{ marginBottom: 16 }}>
                    <label style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--ink-5)', display: 'block', marginBottom: 5 }}>
                        Mensagem de introdução
                        <span style={{ marginLeft: 6, color: 'var(--ink-5)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>enviada antes do texto completo</span>
                    </label>
                    <textarea value={form.verbatimIntro} onChange={e => set('verbatimIntro', e.target.value)} rows={2}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13, border: '1px solid var(--line-2)', background: 'var(--paper-2)', color: 'var(--ink-1)', fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                </div>

                {/* Full text */}
                <div style={{ marginBottom: 28 }}>
                    <label style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--ink-5)', display: 'block', marginBottom: 5 }}>
                        Texto completo do produto
                        <span style={{ marginLeft: 6, color: 'var(--ink-5)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>enviado ao lead — suporta *negrito*</span>
                    </label>
                    <textarea value={form.fullText} onChange={e => set('fullText', e.target.value)} rows={14}
                        placeholder="*Nome do Produto*&#10;&#10;Descrição, valores, diferenciais..."
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 12.5, border: '1px solid var(--line-2)', background: 'var(--paper-2)', color: 'var(--ink-1)', fontFamily: "'Geist Mono', monospace", outline: 'none', resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box' }} />
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 8, fontSize: 13, border: '1px solid var(--line-2)', background: 'transparent', color: 'var(--ink-3)', cursor: 'pointer', fontFamily: 'inherit' }}>
                        Cancelar
                    </button>
                    <button onClick={() => valid && onSave(form)} disabled={!valid}
                        style={{ padding: '10px 24px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', background: valid ? 'var(--accent)' : 'var(--line-2)', color: valid ? '#fff' : 'var(--ink-5)', cursor: valid ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
                        {isNew ? 'Criar produto' : 'Salvar'}
                    </button>
                </div>
            </div>
        </>
    );
}

// ─── Card de produto ──────────────────────────────────────────────────────────
function ProductCard({ prog, onEdit, onDelete }: { prog: Program; onEdit: () => void; onDelete: () => void }) {
    const monthly = prog.priceType === 'monthly';
    return (
        <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 14, padding: '24px', display: 'flex', flexDirection: 'column', gap: 12, transition: 'box-shadow .15s' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-1)', marginBottom: 4 }}>{prog.name}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, fontWeight: 600, color: 'var(--accent-ink)' }}>
                            {prog.installments}x R$ {prog.priceValue.toFixed(2)}
                        </span>
                        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: 'var(--ink-4)', padding: '2px 7px', borderRadius: 4, background: 'var(--paper-2)', border: '1px solid var(--line)' }}>
                            {monthly ? 'mensal' : 'por sessão'}
                        </span>
                        {prog.durationWeeks > 0 && (
                            <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: 'var(--ink-4)', padding: '2px 7px', borderRadius: 4, background: 'var(--paper-2)', border: '1px solid var(--line)' }}>
                                {prog.durationWeeks}sem
                            </span>
                        )}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 12 }}>
                    <button onClick={onEdit} style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, border: '1px solid var(--line-2)', background: 'transparent', color: 'var(--ink-3)', cursor: 'pointer', fontFamily: 'inherit' }}>Editar</button>
                    <button onClick={onDelete} style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, border: '1px solid var(--danger)', background: 'transparent', color: 'var(--danger)', cursor: 'pointer', fontFamily: 'inherit' }}>Remover</button>
                </div>
            </div>

            {/* Preview do texto */}
            {prog.fullText && (
                <div style={{ fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.55, borderTop: '1px solid var(--line)', paddingTop: 12, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {prog.fullText.replace(/\*/g, '')}
                </div>
            )}
        </div>
    );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function Produtos() {
    const qc = useQueryClient();
    const [editing, setEditing] = useState<Program | null>(null);
    const [isNew, setIsNew] = useState(false);

    const { data: agent, isLoading } = useQuery<AgentData>({
        queryKey: ['agent'],
        queryFn: () => axios.get('/api/agent').then(r => r.data),
    });

    const programs = agent?.programs ?? [];

    const saveMutation = useMutation({
        mutationFn: (progs: Program[]) => axios.patch('/api/agent/programs', { programs: progs }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['agent'] }),
    });

    function openNew() {
        setIsNew(true);
        setEditing({ id: `prog_${Date.now()}`, programKey: '', ...EMPTY_PROGRAM });
    }

    function handleSave(prog: Program) {
        const exists = programs.find(p => p.id === prog.id);
        const next = exists
            ? programs.map(p => p.id === prog.id ? prog : p)
            : [...programs, prog];
        saveMutation.mutate(next);
        setEditing(null);
        setIsNew(false);
    }

    function handleDelete(id: string) {
        if (!confirm('Remover este produto?')) return;
        saveMutation.mutate(programs.filter(p => p.id !== id));
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

            {/* Header */}
            <div style={{ padding: '32px 48px 24px', borderBottom: '1px solid var(--line)', background: 'var(--paper)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div>
                        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 36, fontWeight: 400, color: 'var(--ink-1)', letterSpacing: -0.5, lineHeight: 1, marginBottom: 8 }}>Produtos</div>
                        <div style={{ fontSize: 13.5, color: 'var(--ink-4)' }}>
                            {isLoading ? 'Carregando…' : `${programs.length} produto${programs.length !== 1 ? 's' : ''} configurado${programs.length !== 1 ? 's' : ''} · o agente usa esses dados para apresentar opções aos leads`}
                        </div>
                    </div>
                    <button onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 20px', borderRadius: 10, fontSize: 13.5, fontWeight: 600, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                        Novo produto
                    </button>
                </div>
            </div>

            {/* Grid */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '32px 48px 48px' }}>
                {isLoading ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--ink-4)', fontSize: 13 }}>Carregando…</div>
                ) : programs.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 260, gap: 16, color: 'var(--ink-4)' }}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                        </svg>
                        <div style={{ fontSize: 15, fontWeight: 500 }}>Nenhum produto cadastrado</div>
                        <div style={{ fontSize: 13 }}>Crie um produto para o agente poder apresentar aos leads</div>
                        <button onClick={openNew} style={{ padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 500, border: '1px solid var(--accent-ink)', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                            Criar primeiro produto
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
                        {programs.map(p => (
                            <ProductCard
                                key={p.id}
                                prog={p}
                                onEdit={() => { setIsNew(false); setEditing({ ...p }); }}
                                onDelete={() => handleDelete(p.id)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Modal */}
            {editing && (
                <ProgramModal
                    prog={editing}
                    isNew={isNew}
                    onSave={handleSave}
                    onClose={() => { setEditing(null); setIsNew(false); }}
                />
            )}
        </div>
    );
}
