import { useEffect, useState } from 'react';
import { BudgetField, BudgetMeter, BudgetStat, BudgetToggle, budgetHero, budgetInput, budgetPanel, miniBtn, money, pct, sectionTitle } from '../shared';

type Props = {
  budget: any;
  status: any;
  saving: boolean;
  onSave: (payload: any) => void;
};

export function BudgetTab({ budget, status, onSave, saving }: Props) {
  const [form, setForm] = useState<any>({
    monthlyLimitBrl: budget?.monthlyLimitBrl ?? '',
    warning50Enabled: budget?.warning50Enabled ?? true,
    warning80Enabled: budget?.warning80Enabled ?? true,
    warning90Enabled: budget?.warning90Enabled ?? true,
    hardLimitEnabled: budget?.hardLimitEnabled ?? false,
    blockOnLimit: budget?.blockOnLimit ?? false,
    preciseEmbeddingCount: budget?.preciseEmbeddingCount ?? false,
    alertWhatsapp: budget?.alertWhatsapp ?? '',
  });

  useEffect(() => {
    setForm({
      monthlyLimitBrl: budget?.monthlyLimitBrl ?? '',
      warning50Enabled: budget?.warning50Enabled ?? true,
      warning80Enabled: budget?.warning80Enabled ?? true,
      warning90Enabled: budget?.warning90Enabled ?? true,
      hardLimitEnabled: budget?.hardLimitEnabled ?? false,
      blockOnLimit: budget?.blockOnLimit ?? false,
      preciseEmbeddingCount: budget?.preciseEmbeddingCount ?? false,
      alertWhatsapp: budget?.alertWhatsapp ?? '',
    });
  }, [budget]);

  return (
    <div style={{ maxWidth: 1120 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: 16, marginBottom: 16 }}>
        <div style={budgetHero}>
          <div>
            <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10.5, letterSpacing: .8, color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 8 }}>Status financeiro da IA</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
              <span style={{ fontFamily: "'Fraunces', serif", fontSize: 34, color: 'var(--ink-1)' }}>{status?.state ?? 'OK'}</span>
              <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: 'var(--ink-4)' }}>{pct(status?.usedPercent ?? 0)} usado</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6 }}>
              Defina limites e proteção para controlar o consumo estimado da Gemini sem interrupções inesperadas.
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(120px, 1fr))', gap: 10, marginTop: 18 }}>
            <BudgetStat label="Usado R$" value={money(status?.usedBrl ?? 0)} />
            <BudgetStat label="Limite R$" value={status?.monthlyLimitBrl ? money(status.monthlyLimitBrl) : 'Sem limite'} />
            <BudgetStat label="Uso do limite" value={pct(status?.usedPercent ?? 0)} />
          </div>
        </div>

        <BudgetMeter
          usedPercent={status?.usedPercent ?? 0}
          usedBrl={status?.usedBrl ?? 0}
          limitBrl={status?.monthlyLimitBrl ?? null}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 16 }}>
        <div style={budgetPanel}>
          {sectionTitle('Limite e alerta')}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, .75fr) minmax(260px, 1fr)', gap: 12 }}>
            <BudgetField label="Limite mensal R$" hint="Valor principal para leitura do painel">
              <input value={form.monthlyLimitBrl} onChange={(e) => setForm({ ...form, monthlyLimitBrl: e.target.value })} placeholder="Ex: 250" style={budgetInput} />
            </BudgetField>
            <BudgetField label="WhatsApp para alerta">
              <input value={form.alertWhatsapp} onChange={(e) => setForm({ ...form, alertWhatsapp: e.target.value })} placeholder="5566999999999" style={budgetInput} />
            </BudgetField>
          </div>
        </div>
      </div>

      <div style={{ ...budgetPanel, marginTop: 16 }}>
        {sectionTitle('Regras de proteção')}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(180px, 1fr))', gap: 10 }}>
          <BudgetToggle label="Alerta 50%" hint="Primeiro aviso de consumo" checked={form.warning50Enabled} onChange={(checked) => setForm({ ...form, warning50Enabled: checked })} />
          <BudgetToggle label="Alerta 80%" hint="Atenção operacional" checked={form.warning80Enabled} onChange={(checked) => setForm({ ...form, warning80Enabled: checked })} />
          <BudgetToggle label="Alerta 90%" hint="Zona crítica" checked={form.warning90Enabled} onChange={(checked) => setForm({ ...form, warning90Enabled: checked })} />
          <BudgetToggle label="Contagem precisa embeddings" hint="Mais precisão, mais chamadas" checked={form.preciseEmbeddingCount} onChange={(checked) => setForm({ ...form, preciseEmbeddingCount: checked })} />
          <BudgetToggle label="Hard limit ativo" hint="Habilita política de limite" checked={form.hardLimitEnabled} onChange={(checked) => setForm({ ...form, hardLimitEnabled: checked })} />
          <BudgetToggle label="Bloquear ao atingir limite" hint="Impede novas chamadas em 100%" checked={form.blockOnLimit} onChange={(checked) => setForm({ ...form, blockOnLimit: checked })} />
        </div>
      </div>

      {form.hardLimitEnabled && form.blockOnLimit && (
        <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 10, border: '1px solid #f0d2d2', background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: 12 }}>
          Bloqueio automático ativo: ao atingir 100%, chamadas Gemini serão bloqueadas.
        </div>
      )}

      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button onClick={() => onSave({
          monthlyLimitBrl: form.monthlyLimitBrl,
          warning50Enabled: form.warning50Enabled,
          warning80Enabled: form.warning80Enabled,
          warning90Enabled: form.warning90Enabled,
          hardLimitEnabled: form.hardLimitEnabled,
          blockOnLimit: form.blockOnLimit,
          preciseEmbeddingCount: form.preciseEmbeddingCount,
          alertWhatsapp: form.alertWhatsapp,
        })} disabled={saving} style={{ ...miniBtn, padding: '9px 18px', background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent-ink)', opacity: saving ? .65 : 1 }}>
          {saving ? 'Salvando…' : 'Salvar orçamento'}
        </button>
      </div>
    </div>
  );
}
