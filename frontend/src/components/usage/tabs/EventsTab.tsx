import { filterInput, miniBtn, money } from '../shared';

type Props = {
  events: any;
  modelFilter: string;
  featureFilter: string;
  statusFilter: string;
  sourceFilter: string;
  onModelFilterChange: (value: string) => void;
  onFeatureFilterChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onSourceFilterChange: (value: string) => void;
  onResetCursor: () => void;
  onNextPage: () => void;
};

export function EventsTab({
  events,
  modelFilter,
  featureFilter,
  statusFilter,
  sourceFilter,
  onModelFilterChange,
  onFeatureFilterChange,
  onStatusFilterChange,
  onSourceFilterChange,
  onResetCursor,
  onNextPage,
}: Props) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(130px,1fr))', gap: 8, marginBottom: 12 }}>
        <input placeholder="modelo" value={modelFilter} onChange={(e) => onModelFilterChange(e.target.value)} style={filterInput} />
        <input placeholder="recurso" value={featureFilter} onChange={(e) => onFeatureFilterChange(e.target.value)} style={filterInput} />
        <input placeholder="status" value={statusFilter} onChange={(e) => onStatusFilterChange(e.target.value)} style={filterInput} />
        <input placeholder="origem" value={sourceFilter} onChange={(e) => onSourceFilterChange(e.target.value)} style={filterInput} />
      </div>
      <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', background: 'var(--paper)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: 'var(--paper-2)', textAlign: 'left', borderBottom: '1px solid var(--line)' }}>
              {['Data', 'Origem', 'Recurso', 'Fase', 'Modelo', 'FSM', 'Entrada', 'Saída', 'Total', 'Custo (R$)', 'Status', 'Latência', 'Ferramentas'].map((h) => (
                <th key={h} style={{ padding: '12px 14px', fontFamily: "'Geist Mono', monospace", fontSize: 10.5, letterSpacing: .5, textTransform: 'uppercase', color: 'var(--ink-4)', fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(events?.events ?? []).map((item: any, i: number) => (
              <tr key={item.id} style={{ borderBottom: i === (events?.events?.length ?? 0) - 1 ? 'none' : '1px solid var(--line-2)' }}>
                <td style={{ padding: '12px 14px', color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{new Date(item.createdAt).toLocaleString('pt-BR')}</td>
                <td style={{ padding: '12px 14px' }}>{item.source}</td>
                <td style={{ padding: '12px 14px' }}>{item.feature}</td>
                <td style={{ padding: '12px 14px', color: 'var(--ink-3)' }}>{item.phase || '—'}</td>
                <td style={{ padding: '12px 14px', fontFamily: "'Geist Mono', monospace", fontSize: 11 }}>{item.model}</td>
                <td style={{ padding: '12px 14px', color: 'var(--ink-3)' }}>{item.fsmState || '—'}</td>
                <td style={{ padding: '12px 14px', color: 'var(--ink-3)' }}>{item.inputTokens}</td>
                <td style={{ padding: '12px 14px', color: 'var(--ink-3)' }}>{item.outputTokens}</td>
                <td style={{ padding: '12px 14px', fontWeight: 500 }}>{item.totalTokens}</td>
                <td style={{ padding: '12px 14px', color: 'var(--ink-2)' }}>{money(item.estimatedCostBrl)}</td>
                <td style={{ padding: '12px 14px' }}>
                  <span style={{
                    padding: '3px 8px', borderRadius: 4, fontSize: 10, fontFamily: "'Geist Mono', monospace", textTransform: 'uppercase',
                    background: item.status === 'OK' ? 'var(--accent-soft)' : 'var(--danger-soft)',
                    color: item.status === 'OK' ? 'var(--accent-ink)' : 'var(--danger)',
                  }}>{item.status}</span>
                </td>
                <td style={{ padding: '12px 14px', color: 'var(--ink-3)' }}>{item.latencyMs ?? '—'}ms</td>
                <td style={{ padding: '12px 14px', color: 'var(--ink-3)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={(item.toolsUsed ?? []).join(', ')}>
                  {(item.toolsUsed ?? []).join(', ') || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <button onClick={onResetCursor} style={miniBtn}>Primeira página</button>
        <button onClick={onNextPage} disabled={!events?.nextCursor} style={{ ...miniBtn, opacity: events?.nextCursor ? 1 : .5 }}>Próxima página</button>
      </div>
    </div>
  );
}
