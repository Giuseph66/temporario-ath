import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

type Automation = {
    id: string;
    name: string;
    type: string;
    status: string;
    triggerType: string;
    scheduleJson: Record<string, unknown>;
    targetJson: Record<string, unknown>;
    conditionsJson: Record<string, unknown>;
    actionJson: Record<string, unknown>;
    limitsJson: Record<string, unknown>;
    requiresApproval: boolean;
    nextRunAt: string | null;
    lastRunAt: string | null;
    lastRun?: AutomationRun | null;
    responseStats?: { sentTotal: number; responseCount: number; responseRate: number | null };
    _count?: { runs: number; targetRuns: number };
};

type AutomationRun = {
    id: string;
    status: string;
    startedAt: string;
    finishedAt: string | null;
    sentCount: number;
    skippedCount: number;
    failedCount: number;
    error?: string | null;
    targets?: AutomationTargetRun[];
};

type AutomationTargetRun = {
    id: string;
    status: string;
    reason?: string | null;
    message?: string | null;
    createdAt: string;
    user?: { id: string; name: string | null; phoneNumber: string; enrollmentStatus: string } | null;
};

type AutomationDetail = Automation & { runs: AutomationRun[] };

const STATUS_STYLE: Record<string, { label: string; bg: string; color: string }> = {
    ACTIVE: { label: 'Ativa', bg: 'var(--accent-soft)', color: 'var(--accent-ink)' },
    PAUSED: { label: 'Pausada', bg: 'var(--paper-3)', color: 'var(--ink-4)' },
    DRAFT: { label: 'Rascunho', bg: 'var(--paper-3)', color: 'var(--ink-3)' },
    PENDING_APPROVAL: { label: 'Aprovação', bg: 'var(--amber-soft)', color: 'var(--amber)' },
    RUNNING: { label: 'Rodando', bg: 'var(--amber-soft)', color: 'var(--amber)' },
    COMPLETED: { label: 'Concluída', bg: 'var(--accent-soft)', color: 'var(--accent-ink)' },
    FAILED: { label: 'Falhou', bg: 'var(--danger-soft)', color: 'var(--danger)' },
};

const TYPE_LABEL: Record<string, string> = {
    INACTIVITY: 'Recuperação',
    MANUAL: 'Campanha',
    EVENT: 'Evento',
    RECURRING: 'Recorrente',
    ONE_OFF: 'Única',
};

function Chip({ value }: { value: string }) {
    const s = STATUS_STYLE[value] ?? STATUS_STYLE.DRAFT;
    return (
        <span style={{
            background: s.bg, color: s.color,
            fontFamily: "'Geist Mono', monospace", fontSize: 10,
            letterSpacing: .5, textTransform: 'uppercase',
            padding: '3px 8px', borderRadius: 4, whiteSpace: 'nowrap',
        }}>{s.label}</span>
    );
}

function fmtDate(value?: string | null) {
    if (!value) return '—';
    return new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function jsonPreview(value: unknown) {
    return JSON.stringify(value ?? {}, null, 2);
}

function CreateAutomationModal({ onClose }: { onClose: () => void }) {
    const qc = useQueryClient();
    const [type, setType] = useState('INACTIVITY');
    const [name, setName] = useState('Recuperação de leads inativos');
    const [audience, setAudience] = useState('LEAD');
    const [userId, setUserId] = useState('');
    const [inactiveDays, setInactiveDays] = useState(3);
    const [dailyAt, setDailyAt] = useState('09:00');
    const [runAt, setRunAt] = useState('');
    const [eventName, setEventName] = useState('PAYMENT_CONFIRMED');
    const [messageTemplate, setMessageTemplate] = useState('Oi, {{firstName}}! Passando rapidinho para saber se ainda faz sentido continuarmos com sua matrícula ou se prefere que eu te explique alguma parte melhor.');
    const [aiPrompt, setAiPrompt] = useState('');
    const [internalNote, setInternalNote] = useState('[AUTOMACAO INTERNA] Recuperacao enviada apos 3 dias de inatividade.');
    const [updateEnrollmentStatus, setUpdateEnrollmentStatus] = useState('');
    const [updateConversationState, setUpdateConversationState] = useState('');
    const [requireLgpd, setRequireLgpd] = useState(true);
    const [windowStart, setWindowStart] = useState('08:00');
    const [windowEnd, setWindowEnd] = useState('18:00');
    const [cooldownHours, setCooldownHours] = useState(72);

    const create = useMutation({
        mutationFn: () => axios.post('/api/automations', buildPayload()),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['automations'] });
            onClose();
        },
    });

    function buildPayload() {
        const triggerType = type === 'EVENT' ? 'EVENT' : type === 'MANUAL' ? 'MANUAL' : 'TIME';
        const enrollmentStatuses =
            audience === 'ALL' ? ['LEAD', 'PAYMENT_PENDING'] :
            audience === 'PAYMENT_PENDING' ? ['PAYMENT_PENDING'] :
            ['LEAD'];
        const updateLead = {
            ...(updateEnrollmentStatus ? { enrollmentStatus: updateEnrollmentStatus } : {}),
            ...(updateConversationState.trim() ? { conversationState: updateConversationState.trim() } : {}),
        };

        return {
            name: name.trim(),
            type,
            triggerType,
            schedule: {
                ...(type === 'INACTIVITY' || type === 'RECURRING' ? { dailyAt } : {}),
                ...(type === 'ONE_OFF' && runAt ? { runAt } : {}),
                ...(type === 'EVENT' ? { eventName } : {}),
            },
            target: {
                ...(userId.trim() ? { userId: userId.trim() } : {}),
                ...(!userId.trim() ? { enrollmentStatuses } : {}),
            },
            conditions: {
                requireLgpd,
                skipGroups: true,
                inactiveDays: type === 'INACTIVITY' ? inactiveDays : undefined,
                excludeEnrollmentStatuses: type === 'EVENT' ? ['CANCELLED'] : ['ENROLLED', 'CANCELLED'],
                sendWindow: { start: windowStart, end: windowEnd },
            },
            action: {
                messageTemplate: messageTemplate.trim(),
                aiPrompt: aiPrompt.trim(),
                internalNote: internalNote.trim(),
                ...(Object.keys(updateLead).length ? { updateLead } : {}),
            },
            limits: { cooldownHours },
        };
    }

    const valid = name.trim() && (messageTemplate.trim() || aiPrompt.trim() || internalNote.trim());

    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div onClick={e => e.stopPropagation()} style={{ width: 760, maxHeight: '92vh', overflowY: 'auto', background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 14, padding: 28 }}>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 26, color: 'var(--ink-1)', marginBottom: 4 }}>Nova automação</div>
                <div style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 22 }}>Configure regra, público, janela e ação automática.</div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <Field label="Nome" span={2}><input value={name} onChange={e => setName(e.target.value)} style={inputStyle} /></Field>
                    <Field label="Tipo">
                        <select value={type} onChange={e => setType(e.target.value)} style={inputStyle}>
                            <option value="INACTIVITY">Recuperação por inatividade</option>
                            <option value="MANUAL">Campanha manual</option>
                            <option value="EVENT">Gatilho por evento</option>
                            <option value="RECURRING">Recorrente</option>
                            <option value="ONE_OFF">Única</option>
                        </select>
                    </Field>
                    <Field label="Público">
                        <select value={audience} onChange={e => setAudience(e.target.value)} disabled={Boolean(userId.trim())} style={inputStyle}>
                            <option value="LEAD">Leads</option>
                            <option value="PAYMENT_PENDING">Pagamento pendente</option>
                            <option value="ALL">Leads + pagamento pendente</option>
                        </select>
                    </Field>
                    <Field label="Lead específico (ID opcional)" span={2}><input value={userId} onChange={e => setUserId(e.target.value)} placeholder="userId para follow-up individual" style={inputStyle} /></Field>

                    {type === 'INACTIVITY' && <Field label="Dias sem resposta"><input type="number" value={inactiveDays} onChange={e => setInactiveDays(Number(e.target.value) || 1)} style={inputStyle} /></Field>}
                    {(type === 'INACTIVITY' || type === 'RECURRING') && <Field label="Horário diário"><input type="time" value={dailyAt} onChange={e => setDailyAt(e.target.value)} style={inputStyle} /></Field>}
                    {type === 'ONE_OFF' && <Field label="Executar em" span={2}><input type="datetime-local" value={runAt} onChange={e => setRunAt(e.target.value)} style={inputStyle} /></Field>}
                    {type === 'EVENT' && <Field label="Evento" span={2}><input value={eventName} onChange={e => setEventName(e.target.value)} style={inputStyle} /></Field>}

                    <Field label="Janela início"><input type="time" value={windowStart} onChange={e => setWindowStart(e.target.value)} style={inputStyle} /></Field>
                    <Field label="Janela fim"><input type="time" value={windowEnd} onChange={e => setWindowEnd(e.target.value)} style={inputStyle} /></Field>
                    <Field label="Cooldown (horas)"><input type="number" value={cooldownHours} onChange={e => setCooldownHours(Number(e.target.value) || 0)} style={inputStyle} /></Field>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 20, fontSize: 13, color: 'var(--ink-2)' }}>
                        <input type="checkbox" checked={requireLgpd} onChange={e => setRequireLgpd(e.target.checked)} />
                        Exigir consentimento LGPD
                    </label>
                    <Field label="Mensagem WhatsApp" span={2}><textarea value={messageTemplate} onChange={e => setMessageTemplate(e.target.value)} rows={4} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} /></Field>
                    <Field label="Prompt de IA (opcional)" span={2}><textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} rows={3} placeholder="Use se quiser gerar a mensagem automaticamente quando não houver template." style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} /></Field>
                    <Field label="Nota interna" span={2}><textarea value={internalNote} onChange={e => setInternalNote(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} /></Field>
                    <Field label="Atualizar status do lead">
                        <select value={updateEnrollmentStatus} onChange={e => setUpdateEnrollmentStatus(e.target.value)} style={inputStyle}>
                            <option value="">Não alterar</option>
                            <option value="LEAD">Lead</option>
                            <option value="PAYMENT_PENDING">Pagamento pendente</option>
                            <option value="ENROLLED">Matriculado</option>
                            <option value="CANCELLED">Cancelado</option>
                        </select>
                    </Field>
                    <Field label="Atualizar estado da conversa">
                        <input value={updateConversationState} onChange={e => setUpdateConversationState(e.target.value)} placeholder="ex: OBJECTION_HANDLING" style={inputStyle} />
                    </Field>
                </div>

                {create.isError && (
                    <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 8, color: 'var(--danger)', background: 'var(--danger-soft)', fontSize: 13 }}>
                        {(create.error as any)?.response?.data?.error ?? 'Falha ao criar automação.'}
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
                    <button onClick={onClose} style={secondaryButton}>Cancelar</button>
                    <button onClick={() => valid && create.mutate()} disabled={!valid || create.isPending} style={{ ...primaryButton, opacity: valid && !create.isPending ? 1 : .55 }}>
                        {create.isPending ? 'Criando...' : 'Criar automação'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function Field({ label, span = 1, children }: { label: string; span?: number; children: ReactNode }) {
    return (
        <div style={{ gridColumn: `span ${span}` }}>
            <label style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--ink-5)', display: 'block', marginBottom: 5 }}>{label}</label>
            {children}
        </div>
    );
}

function DetailModal({ id, onClose }: { id: string; onClose: () => void }) {
    const { data, isLoading } = useQuery<AutomationDetail>({
        queryKey: ['automation-detail', id],
        queryFn: () => axios.get(`/api/automations/${id}`).then(r => r.data),
    });

    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
            <div onClick={e => e.stopPropagation()} style={{ width: 560, height: '100vh', overflowY: 'auto', background: 'var(--paper)', borderLeft: '1px solid var(--line)' }}>
                <div style={{ padding: 24, borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 24, color: 'var(--ink-1)', marginBottom: 4 }}>{data?.name ?? 'Automação'}</div>
                        <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>{data ? TYPE_LABEL[data.type] ?? data.type : 'Carregando...'}</div>
                    </div>
                    <button onClick={onClose} style={secondaryButton}>Fechar</button>
                </div>

                {isLoading || !data ? (
                    <div style={{ padding: 24, color: 'var(--ink-4)', fontSize: 13 }}>Carregando...</div>
                ) : (
                    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
                        <section>
                            <div style={sectionTitle}>Configuração</div>
                            <pre style={preStyle}>{jsonPreview({
                                schedule: data.scheduleJson,
                                target: data.targetJson,
                                conditions: data.conditionsJson,
                                action: data.actionJson,
                                limits: data.limitsJson,
                            })}</pre>
                        </section>
                        <section>
                            <div style={sectionTitle}>Execuções</div>
                            {data.runs.length === 0 ? (
                                <div style={{ fontSize: 13, color: 'var(--ink-4)' }}>Nenhuma execução ainda.</div>
                            ) : data.runs.map(run => (
                                <div key={run.id} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12, marginBottom: 10 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                        <Chip value={run.status} />
                                        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: 'var(--ink-5)' }}>{fmtDate(run.startedAt)}</span>
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 8 }}>
                                        {run.sentCount} enviados · {run.skippedCount} ignorados · {run.failedCount} falhas
                                    </div>
                                    {(run.targets ?? []).slice(0, 8).map(target => (
                                        <div key={target.id} style={{ borderTop: '1px solid var(--line)', paddingTop: 7, marginTop: 7, fontSize: 12, color: 'var(--ink-3)' }}>
                                            <strong>{target.user?.name ?? target.user?.phoneNumber ?? 'Lead'}</strong> · {target.status}
                                            {target.reason ? ` · ${target.reason}` : ''}
                                            {target.message && (
                                                <div style={{ marginTop: 6, color: 'var(--ink-4)', lineHeight: 1.45 }}>{target.message}</div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </section>
                    </div>
                )}
            </div>
        </div>
    );
}

export function Automacoes() {
    const qc = useQueryClient();
    const [creating, setCreating] = useState(false);
    const [detailId, setDetailId] = useState<string | null>(null);

    const { data = [], isLoading } = useQuery<Automation[]>({
        queryKey: ['automations'],
        queryFn: () => axios.get('/api/automations').then(r => r.data),
    });

    const action = useMutation({
        mutationFn: ({ id, op }: { id: string; op: string }) => axios.post(`/api/automations/${id}/${op}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['automations'] });
            if (detailId) qc.invalidateQueries({ queryKey: ['automation-detail', detailId] });
        },
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <div style={{ padding: '32px 48px 24px', borderBottom: '1px solid var(--line)', background: 'var(--paper)', flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18 }}>
                    <div>
                        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 36, fontWeight: 400, color: 'var(--ink-1)', letterSpacing: -0.5, lineHeight: 1, marginBottom: 8 }}>Automações</div>
                        <div style={{ fontSize: 13.5, color: 'var(--ink-4)' }}>
                            {isLoading ? 'Carregando...' : `${data.length} regra${data.length !== 1 ? 's' : ''} configurada${data.length !== 1 ? 's' : ''} para campanhas, follow-ups e recuperação`}
                        </div>
                    </div>
                    <button onClick={() => setCreating(true)} style={primaryButton}>Nova automação</button>
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
                {isLoading ? (
                    <div style={{ padding: 40, color: 'var(--ink-4)', fontSize: 14 }}>Carregando...</div>
                ) : data.length === 0 ? (
                    <div style={{ padding: 48, color: 'var(--ink-4)', fontSize: 14 }}>Nenhuma automação criada.</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--paper-2)' }}>
                                {['Nome', 'Tipo', 'Status', 'Próxima', 'Última', 'Resultado', 'Resposta', 'Ações'].map(h => (
                                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontFamily: "'Geist Mono', monospace", fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--ink-4)', borderBottom: '1px solid var(--line)', fontWeight: 400 }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data.map(auto => (
                                <tr key={auto.id} style={{ borderBottom: '1px solid var(--line)' }}>
                                    <td style={tdStyle}>
                                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-1)' }}>{auto.name}</div>
                                        <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: 'var(--ink-5)' }}>{auto.triggerType}</div>
                                    </td>
                                    <td style={tdStyle}>{TYPE_LABEL[auto.type] ?? auto.type}</td>
                                    <td style={tdStyle}><Chip value={auto.status} /></td>
                                    <td style={tdStyle}>{fmtDate(auto.nextRunAt)}</td>
                                    <td style={tdStyle}>{fmtDate(auto.lastRunAt)}</td>
                                    <td style={tdStyle}>
                                        {auto.lastRun ? `${auto.lastRun.sentCount} env · ${auto.lastRun.skippedCount} skip · ${auto.lastRun.failedCount} falhas` : '—'}
                                    </td>
                                    <td style={tdStyle}>
                                        {auto.responseStats?.responseRate === null || !auto.responseStats ? '—' : `${auto.responseStats.responseRate}%`}
                                    </td>
                                    <td style={tdStyle}>
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                            <button onClick={() => setDetailId(auto.id)} style={miniButton}>Detalhes</button>
                                            {auto.status === 'ACTIVE' ? (
                                                <button onClick={() => action.mutate({ id: auto.id, op: 'pause' })} style={miniButton}>Pausar</button>
                                            ) : auto.status !== 'PENDING_APPROVAL' && (
                                                <button onClick={() => action.mutate({ id: auto.id, op: 'resume' })} style={miniButton}>Ativar</button>
                                            )}
                                            {auto.status === 'PENDING_APPROVAL' && <button onClick={() => action.mutate({ id: auto.id, op: 'approve' })} style={miniButton}>Aprovar</button>}
                                            {auto.status !== 'PENDING_APPROVAL' && <button onClick={() => action.mutate({ id: auto.id, op: 'run' })} style={miniButton}>Executar</button>}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {creating && <CreateAutomationModal onClose={() => setCreating(false)} />}
            {detailId && <DetailModal id={detailId} onClose={() => setDetailId(null)} />}
        </div>
    );
}

const inputStyle: CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    borderRadius: 8,
    fontSize: 13,
    border: '1px solid var(--line-2)',
    background: 'var(--paper-2)',
    color: 'var(--ink-1)',
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
};

const primaryButton: CSSProperties = {
    padding: '10px 18px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    border: '1px solid var(--accent-ink)',
    background: 'var(--accent)',
    color: '#fff',
    cursor: 'pointer',
    fontFamily: 'inherit',
};

const secondaryButton: CSSProperties = {
    padding: '8px 14px',
    borderRadius: 8,
    fontSize: 13,
    border: '1px solid var(--line-2)',
    background: 'transparent',
    color: 'var(--ink-3)',
    cursor: 'pointer',
    fontFamily: 'inherit',
};

const miniButton: CSSProperties = {
    padding: '5px 10px',
    borderRadius: 6,
    fontSize: 11,
    border: '1px solid var(--line-2)',
    background: 'transparent',
    color: 'var(--ink-3)',
    cursor: 'pointer',
    fontFamily: 'inherit',
};

const tdStyle: CSSProperties = {
    padding: '12px 16px',
    fontSize: 13,
    color: 'var(--ink-2)',
    verticalAlign: 'middle',
};

const sectionTitle: CSSProperties = {
    fontFamily: "'Geist Mono', monospace",
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'var(--ink-5)',
    marginBottom: 8,
};

const preStyle: CSSProperties = {
    margin: 0,
    padding: 12,
    borderRadius: 8,
    border: '1px solid var(--line)',
    background: 'var(--paper-2)',
    color: 'var(--ink-2)',
    fontFamily: "'Geist Mono', monospace",
    fontSize: 11,
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
    overflow: 'auto',
};
