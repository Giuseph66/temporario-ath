import { BudgetMeter, DailyUsageChart, HorizontalBarChart, type ChartMode, money, pct } from '../shared';

type Props = {
  status: any;
  summary: any;
  chartMode: ChartMode;
  setChartMode: (mode: ChartMode) => void;
  dailyRows: any[];
  modelUsageRows: any[];
  featureUsageRows: any[];
  stateUsageRows: any[];
  leadUsageRows: any[];
  deprecatedCount: number;
};

export function OverviewTab({
  status,
  summary,
  chartMode,
  setChartMode,
  dailyRows,
  modelUsageRows,
  featureUsageRows,
  stateUsageRows,
  leadUsageRows,
  deprecatedCount,
}: Props) {
  const totalCalls = Number(summary?.totalCalls ?? 0);
  const avgCostPerCallBrl = totalCalls > 0 ? Number(summary?.totalCostBrl ?? 0) / totalCalls : 0;
  const overviewCards = [
    { label: 'Custo estimado (R$)', value: money(summary?.totalCostBrl) },
    { label: 'Tokens totais', value: (summary?.totalTokens ?? 0).toLocaleString('pt-BR') },
    { label: 'Chamadas Gemini', value: (summary?.totalCalls ?? 0).toLocaleString('pt-BR') },
    { label: 'Custo médio/chamada', value: money(avgCostPerCallBrl) },
    { label: 'Tokens em cache', value: (summary?.cachedTokens ?? 0).toLocaleString('pt-BR') },
    { label: 'Orçamento usado', value: pct(status?.usedPercent ?? 0) },
    { label: 'Status', value: status?.state ?? 'OK' },
  ];
  const hasMissingPrices = Boolean(summary?.hasMissingPrices || status?.hasMissingPrices);

  return (
    <div>
      <div style={{
        marginBottom: 20, padding: '16px 20px', borderRadius: 12,
        border: `1px solid ${status?.state === 'ERROR' ? 'var(--danger-soft)' : 'var(--line)'}`,
        background: status?.state === 'ERROR' ? 'var(--danger-soft)' : 'var(--paper-2)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 14, color: 'var(--ink-1)', fontWeight: 500, marginBottom: 4 }}>
            Estado do serviço: <span style={{ color: status?.state === 'ERROR' ? 'var(--danger)' : 'var(--accent-ink)', fontWeight: 600 }}>{status?.state ?? 'OK'}</span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{status?.reason ?? 'Sem alertas críticos no momento.'}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        {overviewCards.map((card) => (
          <div key={card.label} style={{
            border: '1px solid var(--line)', borderRadius: 12, background: 'var(--paper)',
            padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
          }}>
            <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10.5, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 12 }}>{card.label}</div>
            <div style={{ fontSize: 26, color: 'var(--ink-1)', fontFamily: "'Fraunces', serif" }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {([
          { key: 'cost', label: 'custo' },
          { key: 'tokens', label: 'tokens' },
          { key: 'calls', label: 'chamadas' },
        ] as const).map((mode) => (
          <button key={mode.key} onClick={() => setChartMode(mode.key)} style={{
            padding: '6px 12px', borderRadius: 8, border: '1px solid var(--line-2)', fontSize: 12, cursor: 'pointer',
            background: mode.key === chartMode ? 'var(--accent-soft)' : 'var(--paper)',
            color: mode.key === chartMode ? 'var(--accent-ink)' : 'var(--ink-3)',
            fontWeight: mode.key === chartMode ? 500 : 400,
            transition: 'all 0.15s ease',
          }}>{mode.label}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.65fr) minmax(280px, .75fr)', gap: 16, marginBottom: 16 }}>
        <DailyUsageChart rows={dailyRows} mode={chartMode} />
        <BudgetMeter
          usedPercent={status?.usedPercent ?? 0}
          usedBrl={status?.usedBrl ?? 0}
          limitBrl={status?.monthlyLimitBrl ?? null}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
        <HorizontalBarChart title="Consumo por modelo" rows={modelUsageRows} mode={chartMode} />
        <HorizontalBarChart title="Consumo por recurso" rows={featureUsageRows} mode={chartMode} />
        <HorizontalBarChart title="Consumo por estado FSM" rows={stateUsageRows} mode={chartMode} labelFor={(row) => String(row.key || '—')} />
        <HorizontalBarChart title="Leads com maior consumo" rows={leadUsageRows.map((row) => ({ ...row, costBrl: row.costBrl ?? 0, tokens: row.tokens ?? 0, calls: row.calls ?? 0 }))} mode={chartMode} labelFor={(row) => String(row.userName || row.maskedPhone || 'Lead')} />
      </div>

      {hasMissingPrices && (
        <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 10, border: '1px solid #e8d2a3', background: 'var(--amber-soft)', color: 'var(--amber)', fontSize: 12 }}>
          Há modelo em uso sem preço no catálogo. Status: <strong>MISSING_PRICES</strong>.
        </div>
      )}
      {(deprecatedCount > 0) && (
        <div style={{ marginTop: 10, padding: '12px 14px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--paper-2)', fontSize: 12, color: 'var(--ink-3)' }}>
          Modelos obsoletos: {deprecatedCount}
        </div>
      )}
    </div>
  );
}
