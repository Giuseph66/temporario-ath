import { useMemo, useState } from 'react';
import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ChartMode } from '../components/usage/shared';
import { OverviewTab } from '../components/usage/tabs/OverviewTab';
import { EventsTab } from '../components/usage/tabs/EventsTab';
import { ModelsTab } from '../components/usage/tabs/ModelsTab';
import { PricesTab } from '../components/usage/tabs/PricesTab';
import { BudgetTab } from '../components/usage/tabs/BudgetTab';

type Period = 'today' | '7d' | '30d' | 'month';
type Tab = 'overview' | 'events' | 'models' | 'prices' | 'budget';

const tabLabel: Record<Tab, string> = {
  overview: 'Visão geral',
  events: 'Eventos',
  models: 'Modelos',
  prices: 'Preços',
  budget: 'Orçamento',
};

const periodLabel: Record<Period, string> = {
  today: 'hoje',
  '7d': '7d',
  '30d': '30d',
  month: 'mês',
};

export function ConsumoAI() {
  const qc = useQueryClient();
  const [period, setPeriod] = useState<Period>('30d');
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [chartMode, setChartMode] = useState<ChartMode>('cost');
  const [modelFilter, setModelFilter] = useState('');
  const [featureFilter, setFeatureFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [eventCursor, setEventCursor] = useState<string | null>(null);

  const summary = useQuery({
    queryKey: ['ai-usage-summary', period],
    queryFn: () => axios.get('/api/ai-usage/summary', { params: { period } }).then((r) => r.data),
  });
  const status = useQuery({
    queryKey: ['ai-usage-status'],
    queryFn: () => axios.get('/api/ai-usage/status').then((r) => r.data),
  });
  const timeseries = useQuery({
    queryKey: ['ai-usage-timeseries', period],
    queryFn: () => axios.get('/api/ai-usage/timeseries', { params: { period } }).then((r) => r.data),
  });
  const byModel = useQuery({
    queryKey: ['ai-usage-by-model', period],
    queryFn: () => axios.get('/api/ai-usage/by-model', { params: { period } }).then((r) => r.data.data),
  });
  const byFeature = useQuery({
    queryKey: ['ai-usage-by-feature', period],
    queryFn: () => axios.get('/api/ai-usage/by-feature', { params: { period } }).then((r) => r.data.data),
  });
  const byState = useQuery({
    queryKey: ['ai-usage-by-state', period],
    queryFn: () => axios.get('/api/ai-usage/by-state', { params: { period } }).then((r) => r.data.data),
  });
  const byLead = useQuery({
    queryKey: ['ai-usage-by-lead', period],
    queryFn: () => axios.get('/api/ai-usage/by-lead', { params: { period, limit: 20 } }).then((r) => r.data.data),
  });
  const models = useQuery({
    queryKey: ['ai-usage-models'],
    queryFn: () => axios.get('/api/ai-usage/models').then((r) => r.data),
  });
  const prices = useQuery({
    queryKey: ['ai-usage-prices'],
    queryFn: () => axios.get('/api/ai-usage/prices').then((r) => r.data),
  });
  const budget = useQuery({
    queryKey: ['ai-usage-budget'],
    queryFn: () => axios.get('/api/ai-usage/budget').then((r) => r.data),
  });
  const events = useQuery({
    queryKey: ['ai-usage-events', period, modelFilter, featureFilter, statusFilter, sourceFilter, eventCursor],
    queryFn: () => axios.get('/api/ai-usage/events', {
      params: {
        period,
        model: modelFilter || undefined,
        feature: featureFilter || undefined,
        status: statusFilter || undefined,
        source: sourceFilter || undefined,
        take: 30,
        cursor: eventCursor || undefined,
      },
    }).then((r) => r.data),
  });

  const syncModels = useMutation({
    mutationFn: () => axios.post('/api/ai-usage/models/sync'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-usage-models'] });
    },
  });

  const saveBudget = useMutation({
    mutationFn: (payload: any) => axios.patch('/api/ai-usage/budget', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-usage-budget'] });
      qc.invalidateQueries({ queryKey: ['ai-usage-status'] });
    },
  });

  const updatePrice = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => axios.patch(`/api/ai-usage/prices/${id}`, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-usage-prices'] }),
  });

  const addPrice = useMutation({
    mutationFn: (payload: any) => axios.post('/api/ai-usage/prices', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-usage-prices'] }),
  });

  const modelRows = useMemo(() => ((models.data?.models ?? []) as any[]).filter((m) => m.hasPrice), [models.data?.models]);
  const deprecatedCount = useMemo(() => modelRows.filter((m) => m.isDeprecated).length, [modelRows]);
  const dailyRows = (timeseries.data?.data ?? []) as any[];
  const modelUsageRows = (byModel.data ?? []) as any[];
  const featureUsageRows = (byFeature.data ?? []) as any[];
  const stateUsageRows = (byState.data ?? []) as any[];
  const leadUsageRows = (byLead.data ?? []) as any[];

  const groupedPrices = useMemo(() => {
    const list = (prices.data ?? []).filter((item: any) => item.modality !== 'image' && item.modality !== 'video');
    const groups: Record<string, any> = {};

    for (const item of list) {
      const key = `${item.model}::${item.modality}`;
      if (!groups[key]) {
        groups[key] = {
          model: item.model,
          modality: item.modality,
          inputPrice: null,
          outputPrice: null,
        };
      }
      if (item.direction === 'input') groups[key].inputPrice = item;
      if (item.direction === 'output') groups[key].outputPrice = item;
    }

    return Object.values(groups);
  }, [prices.data]);

  const exchangeRateUsdBrl = useMemo(() => {
    const fixed = Number(budget.data?.fixedExchangeRateUsdBrl ?? 0);
    if (fixed > 0) return fixed;
    const usedUsd = Number(status.data?.usedUsd ?? summary.data?.totalCostUsd ?? 0);
    const usedBrl = Number(status.data?.usedBrl ?? summary.data?.totalCostBrl ?? 0);
    if (usedUsd > 0 && usedBrl > 0) return usedBrl / usedUsd;
    return null;
  }, [budget.data?.fixedExchangeRateUsdBrl, status.data?.usedUsd, status.data?.usedBrl, summary.data?.totalCostUsd, summary.data?.totalCostBrl]);

  return (
    <div style={{ padding: '34px 42px', height: '100%', overflowY: 'auto' }}>
      <style>{`
        .chart-panel-premium {
          transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.22s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.22s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }
        .chart-panel-premium:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.03) !important;
          border-color: var(--accent-soft) !important;
        }
      `}</style>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 38, color: 'var(--ink-1)', marginBottom: 6 }}>Consumo IA</div>
        <div style={{ fontSize: 13, color: 'var(--ink-4)' }}>Tracking estimado de custo/tokens Gemini por tenant.</div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24, alignItems: 'center' }}>
        <div style={{ display: 'flex', background: 'var(--paper-2)', padding: 4, borderRadius: 10, gap: 4 }}>
          {(['today', '7d', '30d', 'month'] as Period[]).map((p) => (
            <button key={p} onClick={() => { setEventCursor(null); setPeriod(p); }} style={{
              padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: p === period ? 'var(--paper)' : 'transparent',
              color: p === period ? 'var(--ink-1)' : 'var(--ink-4)',
              fontSize: 12, fontFamily: 'inherit', fontWeight: p === period ? 500 : 400,
              boxShadow: p === period ? '0 2px 4px rgba(0,0,0,0.05), 0 0 0 1px var(--line)' : 'none',
              transition: 'all 0.15s ease',
            }}>{periodLabel[p]}</button>
          ))}
        </div>
        <button onClick={() => {
          qc.invalidateQueries({ queryKey: ['ai-usage-summary'] });
          qc.invalidateQueries({ queryKey: ['ai-usage-timeseries'] });
          qc.invalidateQueries({ queryKey: ['ai-usage-by-model'] });
          qc.invalidateQueries({ queryKey: ['ai-usage-by-feature'] });
          qc.invalidateQueries({ queryKey: ['ai-usage-by-state'] });
          qc.invalidateQueries({ queryKey: ['ai-usage-by-lead'] });
          qc.invalidateQueries({ queryKey: ['ai-usage-events'] });
          qc.invalidateQueries({ queryKey: ['ai-usage-status'] });
        }} style={{
          padding: '6px 14px', borderRadius: 8, border: '1px solid var(--line-2)',
          background: 'var(--paper)', color: 'var(--ink-2)', fontSize: 12, cursor: 'pointer',
          fontFamily: 'inherit', fontWeight: 500, transition: 'all 0.15s ease',
        }}>Atualizar</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid var(--line)', paddingBottom: 0 }}>
        {(['overview', 'events', 'models', 'prices', 'budget'] as Tab[]).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '10px 16px', border: 'none', cursor: 'pointer',
            background: 'transparent',
            color: tab === activeTab ? 'var(--accent-ink)' : 'var(--ink-4)',
            fontSize: 13, fontFamily: 'inherit', fontWeight: tab === activeTab ? 500 : 400,
            borderBottom: tab === activeTab ? '2px solid var(--accent-ink)' : '2px solid transparent',
            marginBottom: -1,
            transition: 'all 0.15s ease',
          }}>
            {tabLabel[tab]}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <OverviewTab
          status={status.data}
          summary={summary.data}
          chartMode={chartMode}
          setChartMode={setChartMode}
          dailyRows={dailyRows}
          modelUsageRows={modelUsageRows}
          featureUsageRows={featureUsageRows}
          stateUsageRows={stateUsageRows}
          leadUsageRows={leadUsageRows}
          deprecatedCount={deprecatedCount}
        />
      )}

      {activeTab === 'events' && (
        <EventsTab
          events={events.data}
          modelFilter={modelFilter}
          featureFilter={featureFilter}
          statusFilter={statusFilter}
          sourceFilter={sourceFilter}
          onModelFilterChange={(value) => { setEventCursor(null); setModelFilter(value); }}
          onFeatureFilterChange={(value) => { setEventCursor(null); setFeatureFilter(value); }}
          onStatusFilterChange={(value) => { setEventCursor(null); setStatusFilter(value); }}
          onSourceFilterChange={(value) => { setEventCursor(null); setSourceFilter(value); }}
          onResetCursor={() => setEventCursor(null)}
          onNextPage={() => setEventCursor(events.data?.nextCursor ?? null)}
        />
      )}

      {activeTab === 'models' && (
        <ModelsTab
          models={models.data}
          modelRows={modelRows}
          syncing={syncModels.isPending}
          onSync={() => syncModels.mutate()}
        />
      )}

      {activeTab === 'prices' && (
        <PricesTab
          groupedPrices={groupedPrices}
          updating={updatePrice.isPending}
          adding={addPrice.isPending}
          exchangeRateUsdBrl={exchangeRateUsdBrl}
          onToggleDeprecated={(group, targetState) => {
            if (group.inputPrice) updatePrice.mutate({ id: group.inputPrice.id, payload: { isDeprecated: targetState } });
            if (group.outputPrice) updatePrice.mutate({ id: group.outputPrice.id, payload: { isDeprecated: targetState } });
          }}
          onAddBasePrice={() => addPrice.mutate({
            model: 'gemini-2.5-flash',
            modality: 'text',
            direction: 'input',
            pricePerMillion: 0.30,
            sourceUrl: 'https://ai.google.dev/gemini-api/docs/pricing',
          })}
        />
      )}

      {activeTab === 'budget' && (
        <BudgetTab
          budget={budget.data}
          status={status.data}
          onSave={(payload) => saveBudget.mutate(payload)}
          saving={saveBudget.isPending}
        />
      )}
    </div>
  );
}

export default ConsumoAI;
