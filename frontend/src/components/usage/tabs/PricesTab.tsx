import { useMemo, useState } from 'react';
import { miniBtn, money, usd } from '../shared';

type Props = {
  groupedPrices: any[];
  updating: boolean;
  adding: boolean;
  onToggleDeprecated: (group: any, targetState: boolean) => void;
  onAddBasePrice: () => void;
  exchangeRateUsdBrl: number | null;
};

type CurrencyView = 'BRL' | 'USD';

function formatPrice(value: number | null, currencyView: CurrencyView, rate: number | null) {
  if (value == null) return '—';
  if (currencyView === 'USD') return usd(value);
  if (!rate || rate <= 0) return '—';
  return money(value * rate);
}

export function PricesTab({
  groupedPrices,
  updating,
  adding,
  onToggleDeprecated,
  onAddBasePrice,
  exchangeRateUsdBrl,
}: Props) {
  const [currencyView, setCurrencyView] = useState<CurrencyView>('BRL');

  const rows = useMemo(() => groupedPrices, [groupedPrices]);
  const rateInfo = exchangeRateUsdBrl && exchangeRateUsdBrl > 0
    ? `Cotação usada: 1 USD = ${exchangeRateUsdBrl.toFixed(4)} BRL`
    : 'Cotação indisponível para conversão BRL';

  return (
    <div>
      <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>
          Os preços são mantidos pela plataforma com base na documentação oficial da Gemini. O custo exibido é estimado. Para conciliação oficial, use o Google Cloud Billing.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11.5, color: 'var(--ink-4)', fontFamily: "'Geist Mono', monospace" }}>Visualização</span>
          <div style={{ display: 'inline-flex', background: 'var(--paper-2)', padding: 4, borderRadius: 8, gap: 4 }}>
            {(['BRL', 'USD'] as CurrencyView[]).map((curr) => (
              <button
                key={curr}
                onClick={() => setCurrencyView(curr)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  background: currencyView === curr ? 'var(--paper)' : 'transparent',
                  color: currencyView === curr ? 'var(--ink-1)' : 'var(--ink-4)',
                  fontSize: 11.5,
                  fontFamily: "'Geist Mono', monospace",
                }}
              >
                {curr === 'BRL' ? 'R$' : 'USD'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 12, fontSize: 11.5, color: 'var(--ink-4)', fontFamily: "'Geist Mono', monospace" }}>{rateInfo}</div>

      <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', marginBottom: 24, background: 'var(--paper)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: 'var(--paper-2)', textAlign: 'left', borderBottom: '1px solid var(--line)' }}>
              {['Modelo', 'Modalidade', 'Preço Input / 1M', 'Preço Output / 1M', 'Thinking incluso', 'Limiar', 'Vigente desde', 'Obsoleto', 'Fonte', 'Ações'].map((h) => (
                <th key={h} style={{ padding: '12px 14px', fontFamily: "'Geist Mono', monospace", fontSize: 10.5, letterSpacing: .5, textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((g: any, i: number) => {
              const main = g.inputPrice || g.outputPrice;
              const inputValue = g.inputPrice ? Number(g.inputPrice.pricePerMillion) : null;
              const outputValue = g.outputPrice ? Number(g.outputPrice.pricePerMillion) : null;
              return (
                <tr key={`${g.model}-${g.modality}`} style={{ borderBottom: i === rows.length - 1 ? 'none' : '1px solid var(--line-2)' }}>
                  <td style={{ padding: '12px 14px', fontWeight: 500, color: 'var(--ink-1)' }}>{g.model}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{
                      padding: '3px 8px', borderRadius: 4, fontSize: 10.5, fontFamily: "'Geist Mono', monospace", textTransform: 'uppercase',
                      background: 'var(--paper-2)', color: 'var(--ink-2)',
                    }}>{g.modality}</span>
                  </td>
                  <td style={{ padding: '12px 14px', fontFamily: "'Geist Mono', monospace" }}>
                    {formatPrice(inputValue, currencyView, exchangeRateUsdBrl)}
                  </td>
                  <td style={{ padding: '12px 14px', fontFamily: "'Geist Mono', monospace" }}>
                    {formatPrice(outputValue, currencyView, exchangeRateUsdBrl)}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    {g.outputPrice !== null ? (g.outputPrice.thinkingIncludedInOutput ? 'sim' : 'não') : '—'}
                  </td>
                  <td style={{ padding: '12px 14px', color: 'var(--ink-3)' }}>{main?.contextThreshold ?? '—'}</td>
                  <td style={{ padding: '12px 14px', color: 'var(--ink-3)' }}>
                    {main?.effectiveFrom ? new Date(main.effectiveFrom).toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{
                      padding: '3px 8px', borderRadius: 4, fontSize: 10, fontFamily: "'Geist Mono', monospace", textTransform: 'uppercase',
                      background: main?.isDeprecated ? 'var(--danger-soft)' : 'var(--accent-soft)',
                      color: main?.isDeprecated ? 'var(--danger)' : 'var(--accent-ink)',
                    }}>{main?.isDeprecated ? 'sim' : 'não'}</span>
                  </td>
                  <td style={{ padding: '12px 14px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {main?.sourceUrl ? (
                      <a href={main.sourceUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-ink)', textDecoration: 'none' }} title={main.sourceUrl}>
                        {main.sourceUrl.replace('https://', '')}
                      </a>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <button
                      onClick={() => onToggleDeprecated(g, !main?.isDeprecated)}
                      disabled={updating}
                      style={{ ...miniBtn, background: main?.isDeprecated ? 'var(--accent-soft)' : 'var(--paper-2)' }}
                    >
                      {main?.isDeprecated ? 'Ativar' : 'Deprecar'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 12 }}>
        <button onClick={onAddBasePrice} disabled={adding} style={miniBtn}>
          {adding ? 'Adicionando…' : 'Adicionar preço base (exemplo)'}
        </button>
      </div>
    </div>
  );
}
