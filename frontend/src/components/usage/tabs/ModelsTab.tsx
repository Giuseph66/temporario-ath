import { miniBtn } from '../shared';

type Props = {
  models: any;
  modelRows: any[];
  syncing: boolean;
  onSync: () => void;
};

export function ModelsTab({ models, modelRows, syncing, onSync }: Props) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>Modelos disponíveis para a chave API Gemini do tenant.</div>
        <button onClick={onSync} style={miniBtn}>{syncing ? 'Sincronizando…' : 'Sincronizar modelos da API key'}</button>
      </div>
      <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', background: 'var(--paper)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: 'var(--paper-2)', textAlign: 'left', borderBottom: '1px solid var(--line)' }}>
              {['Nome', 'Exibição', 'Input', 'Output', 'Métodos', 'Prévia', 'Sincronização'].map((h) => (
                <th key={h} style={{ padding: '12px 14px', fontFamily: "'Geist Mono', monospace", fontSize: 10.5, letterSpacing: .5, textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {modelRows.map((m: any, i: number) => (
              <tr key={m.id} style={{ borderBottom: i === modelRows.length - 1 ? 'none' : '1px solid var(--line-2)' }}>
                <td style={{ padding: '12px 14px', fontWeight: 500, color: 'var(--ink-1)' }}>{m.name}</td>
                <td style={{ padding: '12px 14px', color: 'var(--ink-3)' }}>{m.displayName || '—'}</td>
                <td style={{ padding: '12px 14px', fontFamily: "'Geist Mono', monospace" }}>{m.inputTokenLimit ?? '—'}</td>
                <td style={{ padding: '12px 14px', fontFamily: "'Geist Mono', monospace" }}>{m.outputTokenLimit ?? '—'}</td>
                <td style={{ padding: '12px 14px', color: 'var(--ink-3)' }}>{Array.isArray(m.supportedMethodsJson) ? m.supportedMethodsJson.join(', ') : '—'}</td>
                <td style={{ padding: '12px 14px' }}>
                  <span style={{
                    padding: '3px 8px', borderRadius: 4, fontSize: 10.5, fontFamily: "'Geist Mono', monospace", textTransform: 'uppercase',
                    background: m.isPreview ? 'var(--accent-soft)' : 'var(--paper-2)',
                    color: m.isPreview ? 'var(--accent-ink)' : 'var(--ink-2)',
                  }}>{m.isPreview ? 'sim' : 'não'}</span>
                </td>
                <td style={{ padding: '12px 14px', color: 'var(--ink-3)' }}>{m.lastSyncedAt ? new Date(m.lastSyncedAt).toLocaleString('pt-BR') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {models?.currentAgentModel && (
        <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--paper-2)', fontSize: 12, color: 'var(--ink-3)' }}>
          Modelo atual do agente: <strong>{models.currentAgentModel}</strong> · disponível: {models.currentAgentModelAvailability?.available ? 'sim' : 'não'} · obsoleto: {models.currentAgentModelAvailability?.isDeprecated ? 'sim' : 'não'}
        </div>
      )}
    </div>
  );
}
