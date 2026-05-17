import type { CSSProperties, ReactNode } from 'react';

export type ChartMode = 'cost' | 'tokens' | 'calls';

export function money(n?: number | null) {
  if (n == null) return '—';
  const decimals = Math.abs(n) > 0 && Math.abs(n) < 10
    ? { minimumFractionDigits: 2, maximumFractionDigits: 4 }
    : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', ...decimals });
}

export function usd(n?: number | null) {
  if (n == null) return '—';
  if (n > 0 && n < 0.01) {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 4, maximumFractionDigits: 6 });
  }
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function pct(n?: number | null) {
  if (n == null) return '0%';
  return `${n.toFixed(1)}%`;
}

export function formatDateVisual(dateStr: string): string {
  if (!dateStr) return dateStr;
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }
  return dateStr;
}

export function sectionTitle(label: string) {
  return (
    <div style={{
      fontFamily: "'Geist Mono', monospace",
      textTransform: 'uppercase',
      letterSpacing: 1,
      fontSize: 10,
      color: 'var(--ink-4)',
      marginBottom: 16,
      padding: '0 4px',
    }}>{label}</div>
  );
}

function metricValue(row: any, mode: ChartMode): number {
  if (mode === 'tokens') return Number(row.tokens ?? 0);
  if (mode === 'calls') return Number(row.calls ?? 0);
  return Number(row.costBrl ?? 0);
}

function formatMetricValue(value: number, mode: ChartMode): string {
  if (mode === 'tokens' || mode === 'calls') return value.toLocaleString('pt-BR');
  return money(value);
}

function chartModeLabel(mode: ChartMode): string {
  if (mode === 'tokens') return 'tokens';
  if (mode === 'calls') return 'chamadas';
  return 'custo BRL';
}

function formatYAxisLabel(val: number, mode: ChartMode): string {
  if (mode === 'tokens') {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
    return val.toLocaleString('pt-BR');
  }
  if (mode === 'calls') {
    if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
    return val.toString();
  }
  if (val === 0) return 'R$ 0';
  if (val < 0.1) return `R$ ${val.toFixed(4)}`;
  return `R$ ${val.toFixed(2)}`;
}

function chartEmpty() {
  return (
    <div style={{
      height: 180,
      border: '1px dashed var(--line-2)',
      borderRadius: 10,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--ink-4)',
      fontSize: 12,
      background: 'var(--paper-2)',
    }}>
      Sem dados no período selecionado
    </div>
  );
}

function getBezierPath(points: Array<{ x: number; y: number }>, height: number, padY: number): { linePath: string; areaPath: string } {
  if (points.length === 0) return { linePath: '', areaPath: '' };
  if (points.length === 1) {
    const p = points[0];
    return {
      linePath: `M ${p.x} ${p.y}`,
      areaPath: `M ${p.x} ${p.y} L ${p.x} ${height - padY} Z`,
    };
  }

  let linePath = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const curr = points[i];
    const next = points[i + 1];
    const cpX1 = curr.x + (next.x - curr.x) / 3;
    const cpY1 = curr.y;
    const cpX2 = curr.x + (2 * (next.x - curr.x)) / 3;
    const cpY2 = next.y;
    linePath += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${next.x} ${next.y}`;
  }

  const lastPoint = points[points.length - 1];
  const firstPoint = points[0];
  const areaPath = `${linePath} L ${lastPoint.x} ${height - padY} L ${firstPoint.x} ${height - padY} Z`;
  return { linePath, areaPath };
}

export function DailyUsageChart({ rows, mode }: { rows: any[]; mode: ChartMode }) {
  let data = rows.map((row) => ({
    date: row.date,
    value: mode === 'cost' ? Number(row.costBrl ?? 0) : mode === 'tokens' ? Number(row.tokens ?? 0) : Number(row.calls ?? 0),
  }));

  if (data.length > 0 && (data.length === 1 || data[0].value > 0)) {
    const firstPoint = data[0];
    const parts = firstPoint.date.split('-');
    let prevDateStr = '';
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const prevDate = new Date(year, month, day - 1);
      prevDateStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(prevDate.getDate()).padStart(2, '0')}`;
    } else {
      prevDateStr = 'Início';
    }
    data = [{ date: prevDateStr, value: 0 }, ...data];
  }

  const max = Math.max(...data.map((row) => row.value), 0);
  const total = data.reduce((acc, row) => acc + row.value, 0);
  const width = 760;
  const height = 190;
  const padX = 64;
  const padY = 30;
  const graphW = width - padX * 2;
  const graphH = height - padY * 2;

  if (!data.length || max <= 0) return chartEmpty();

  const points = data.map((row, index) => {
    const x = padX + (index / (data.length - 1)) * graphW;
    const y = padY + graphH - (row.value / max) * graphH;
    return { x, y, ...row };
  });
  const { linePath, areaPath } = getBezierPath(points, height, padY);

  return (
    <div style={chartPanel} className="chart-panel-premium">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 14 }}>
        <div>
          {sectionTitle('Linha de consumo')}
          <div style={{ marginTop: -8, fontSize: 12, color: 'var(--ink-4)' }}>Evolução diária por {chartModeLabel(mode)}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 28, color: 'var(--ink-1)' }}>{formatMetricValue(total, mode)}</div>
          <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10.5, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: .7 }}>Total no período</div>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 200, display: 'block' }} role="img" aria-label="Gráfico diário de consumo Gemini">
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.00" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padY + graphH - ratio * graphH;
          return (
            <line
              key={ratio}
              x1={padX}
              y1={y}
              x2={width - padX}
              y2={y}
              stroke="var(--line)"
              strokeDasharray={ratio === 0 ? '0' : '4 6'}
              opacity={ratio === 0 ? 0.8 : 0.4}
            />
          );
        })}
        {[0, 0.5, 1].map((ratio) => {
          const y = padY + graphH - ratio * graphH;
          const labelVal = max * ratio;
          return (
            <text
              key={`y-label-${ratio}`}
              x={padX - 8}
              y={y + 3.5}
              fill="var(--ink-4)"
              fontSize="9.5"
              fontFamily="Geist Mono"
              textAnchor="end"
            >
              {formatYAxisLabel(labelVal, mode)}
            </text>
          );
        })}
        <path d={areaPath} fill="url(#chartGradient)" />
        <path d={linePath} fill="none" stroke="var(--accent-ink)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) => (
          <g key={`${point.date}-${index}`}>
            {index === points.length - 1 ? (
              <>
                <circle cx={point.x} cy={point.y} r="8" fill="var(--accent-soft)" opacity="0.4" />
                <circle cx={point.x} cy={point.y} r="4.5" fill="var(--accent)" stroke="var(--accent-ink)" strokeWidth="2" />
              </>
            ) : (
              <circle cx={point.x} cy={point.y} r="3.5" fill="var(--paper)" stroke="var(--accent-ink)" strokeWidth="2">
                <title>{`${formatDateVisual(point.date)}: ${formatMetricValue(point.value, mode)}`}</title>
              </circle>
            )}
          </g>
        ))}
        {points.map((point, index) => {
          const showLabel = points.length <= 7 || index === 0 || index === points.length - 1 || index === Math.floor(points.length / 2);
          if (!showLabel) return null;
          return (
            <text
              key={`x-label-${index}`}
              x={point.x}
              y={height - 6}
              fill="var(--ink-4)"
              fontSize="10"
              fontFamily="Geist Mono"
              textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}
            >
              {formatDateVisual(point.date)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export function HorizontalBarChart({ title, rows, mode, labelFor }: { title: string; rows: any[]; mode: ChartMode; labelFor?: (row: any) => string }) {
  const data = rows.slice(0, 8).map((row) => ({
    label: labelFor ? labelFor(row) : String(row.key || '—'),
    value: metricValue(row, mode),
  })).filter((row) => row.value > 0);
  const max = Math.max(...data.map((row) => row.value), 0);

  return (
    <div style={chartPanel} className="chart-panel-premium">
      {sectionTitle(title)}
      {!data.length || max <= 0 ? chartEmpty() : (
        <div style={{ display: 'grid', gap: 12 }}>
          {data.map((row, index) => {
            const width = Math.max(6, (row.value / max) * 100);
            return (
              <div key={`${row.label}-${index}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 0.9fr) 2fr auto', gap: 12, alignItems: 'center' }}>
                <div title={row.label} style={{ fontSize: 12.5, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.label}</div>
                <div style={{ height: 10, borderRadius: 999, background: 'var(--paper-2)', border: '1px solid var(--line)', overflow: 'hidden' }}>
                  <div style={{ width: `${width}%`, height: '100%', background: index === 0 ? 'var(--accent)' : 'var(--accent-ink)', opacity: index === 0 ? 1 : 0.72, borderRadius: 999 }} />
                </div>
                <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: 'var(--ink-3)', textAlign: 'right', minWidth: 72 }}>{formatMetricValue(row.value, mode)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function BudgetMeter({ usedPercent, usedBrl, limitBrl }: { usedPercent?: number | null; usedBrl?: number | null; limitBrl?: number | null }) {
  const used = Math.max(0, Math.min(Number(usedPercent ?? 0), 100));
  const tone = used >= 90 ? 'var(--danger)' : used >= 80 ? 'var(--amber)' : 'var(--accent-ink)';
  const hasBudget = Boolean(limitBrl);
  const usedLabel = money(usedBrl ?? 0);
  const limitLabel = limitBrl ? money(limitBrl) : 'Sem limite';

  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (used / 100) * circumference;

  return (
    <div style={chartPanel} className="chart-panel-premium">
      {sectionTitle('Orçamento')}
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 18 }}>
        <div style={{ flexShrink: 0, position: 'relative', width: 74, height: 74, display: 'grid', placeItems: 'center' }}>
          <svg width="74" height="74" viewBox="0 0 74 74" style={{ display: 'block' }}>
            <circle cx="37" cy="37" r={radius} fill="none" stroke="var(--line-2)" strokeWidth="5.5" />
            <circle
              cx="37"
              cy="37"
              r={radius}
              fill="none"
              stroke={tone}
              strokeWidth="5.5"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform="rotate(-90 37 37)"
              style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }}
            />
          </svg>
          <div style={{ position: 'absolute', fontFamily: "'Fraunces', serif", fontSize: 18, color: 'var(--ink-1)', fontWeight: 600 }}>
            {Math.round(used)}%
          </div>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, color: 'var(--ink-1)', fontWeight: 600, marginBottom: 6 }}>Uso mensal configurado</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.6 }}>
            {hasBudget ? `${usedLabel} consumidos de ${limitLabel}.` : 'Nenhum limite mensal configurado.'}
          </div>
        </div>
      </div>
      <div style={{ height: 12, borderRadius: 999, border: '1px solid var(--line)', background: 'var(--paper-2)', overflow: 'hidden', marginBottom: 10 }}>
        <div style={{ width: `${used}%`, height: '100%', background: tone, borderRadius: 999 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'Geist Mono', monospace", fontSize: 10.5, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: .6 }}>
        <span>0%</span>
        <span>50%</span>
        <span>80%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

export function BudgetStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 10, background: 'var(--paper)', padding: '12px 14px' }}>
      <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, letterSpacing: .7, color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 15, color: 'var(--ink-1)', fontWeight: 600 }}>{value}</div>
    </div>
  );
}

export function BudgetField({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <span style={{ fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 500 }}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: 11.5, color: 'var(--ink-4)', lineHeight: 1.4 }}>{hint}</span>}
    </label>
  );
}

export function BudgetToggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        border: `1px solid ${checked ? '#c9d8d0' : 'var(--line)'}`,
        background: checked ? 'var(--accent-soft)' : 'var(--paper)',
        borderRadius: 10,
        padding: '12px 14px',
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: 'inherit',
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        alignItems: 'center',
      }}
    >
      <span>
        <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: checked ? 'var(--accent-ink)' : 'var(--ink-2)', marginBottom: 3 }}>{label}</span>
        <span style={{ display: 'block', fontSize: 11.5, color: 'var(--ink-4)', lineHeight: 1.35 }}>{hint}</span>
      </span>
      <span style={{ width: 34, height: 20, borderRadius: 999, background: checked ? 'var(--accent)' : 'var(--line-2)', padding: 3, flexShrink: 0 }}>
        <span style={{ display: 'block', width: 14, height: 14, borderRadius: '50%', background: '#fff', transform: checked ? 'translateX(14px)' : 'translateX(0)', transition: 'transform .15s ease' }} />
      </span>
    </button>
  );
}

export const filterInput: CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  borderRadius: 8,
  border: '1px solid var(--line-2)',
  background: 'var(--paper)',
  color: 'var(--ink-1)',
  fontFamily: 'inherit',
  fontSize: 12,
};

export const miniBtn: CSSProperties = {
  padding: '7px 11px',
  borderRadius: 8,
  border: '1px solid var(--line-2)',
  background: 'var(--paper)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 12,
  color: 'var(--ink-2)',
};

export const chartPanel: CSSProperties = {
  border: '1px solid var(--line)',
  borderRadius: 12,
  padding: 20,
  background: 'var(--paper)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
  minWidth: 0,
};

export const budgetHero: CSSProperties = {
  border: '1px solid var(--line)',
  borderRadius: 14,
  padding: 22,
  background: 'var(--paper)',
  minWidth: 0,
};

export const budgetPanel: CSSProperties = {
  border: '1px solid var(--line)',
  borderRadius: 12,
  padding: 20,
  background: 'var(--paper)',
  minWidth: 0,
};

export const budgetInput: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid var(--line-2)',
  background: 'var(--paper-2)',
  color: 'var(--ink-1)',
  fontFamily: 'inherit',
  fontSize: 13,
  outline: 'none',
};
