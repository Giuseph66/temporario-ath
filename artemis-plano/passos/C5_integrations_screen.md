# Passo C5 — Frontend: Tela de Integrações (QR Code + Status)

## Contexto
Painel em `packages/dashboard/`. Primeira tela com dados reais do backend. Mostra status da instância WhatsApp e permite conectar via QR Code. Ao fim deste passo você consegue conectar o WhatsApp pelo painel, visualmente.

**Pré-requisito:** Passos C1–C4 concluídos (endpoints de instância funcionando).

## O que Fazer

**1. Crie `src/pages/Integrations.tsx`**

```tsx
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

type Status = 'not_created' | 'connecting' | 'open' | 'close';

export function Integrations() {
  const [status, setStatus] = useState<Status>('not_created');
  const [instance, setInstance] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    const res = await axios.get('/api/instances/status');
    setStatus(res.data.status);
    setInstance(res.data.instance ?? null);
  }, []);

  // Polling de status enquanto conectando
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Polling do QR Code enquanto modal aberto e status != open
  useEffect(() => {
    if (!showQr || status === 'open') return;
    const fetchQr = async () => {
      const res = await axios.get('/api/instances/qrcode');
      if (res.data.qr) setQr(res.data.qr);
      if (res.data.status === 'open') { setShowQr(false); fetchStatus(); }
    };
    fetchQr();
    const interval = setInterval(fetchQr, 3000);
    return () => clearInterval(interval);
  }, [showQr, status, fetchStatus]);

  async function handleConnect() {
    setLoading(true);
    try {
      if (status === 'not_created') await axios.post('/api/instances/create');
      setShowQr(true);
    } finally { setLoading(false); }
  }

  async function handleDisconnect() {
    if (!confirm('Desconectar o WhatsApp?')) return;
    await axios.delete('/api/instances/disconnect');
    setStatus('not_created');
    setInstance(null);
  }

  const statusColor: Record<Status, string> = {
    open: 'var(--accent)', connecting: 'var(--amber)',
    close: 'var(--danger)', not_created: 'var(--ink-5)',
  };
  const statusLabel: Record<Status, string> = {
    open: 'Conectado', connecting: 'Conectando…',
    close: 'Desconectado', not_created: 'Não configurado',
  };

  return (
    <div style={{ padding: '32px 40px', maxWidth: 760 }}>
      <div style={{ fontFamily: "'Fraunces', serif", fontSize: 28, color: 'var(--ink-1)', marginBottom: 6 }}>
        Integrações
      </div>
      <div style={{ fontSize: 14, color: 'var(--ink-4)', marginBottom: 32 }}>
        Conecte seu WhatsApp e configure as integrações de pagamento e agendamento.
      </div>

      {/* Card WhatsApp */}
      <div style={{
        background: 'var(--paper)', border: '1px solid var(--line)',
        borderRadius: 14, padding: '24px 28px', marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink-1)', marginBottom: 6 }}>
              WhatsApp via Evolution API
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: statusColor[status],
              }} />
              <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>{statusLabel[status]}</span>
              {instance && (
                <span style={{ fontSize: 11, color: 'var(--ink-5)', fontFamily: "'Geist Mono', monospace" }}>
                  · {instance}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {status === 'open' ? (
              <button onClick={handleDisconnect} style={{
                padding: '8px 14px', borderRadius: 8, fontSize: 13,
                border: '1px solid var(--danger)', background: 'var(--danger-soft)',
                color: 'var(--danger)', cursor: 'pointer', fontFamily: 'inherit',
              }}>Desconectar</button>
            ) : (
              <button onClick={handleConnect} disabled={loading} style={{
                padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                border: '1px solid var(--accent-ink)', background: 'var(--accent)',
                color: '#fff', cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit',
              }}>
                {loading ? 'Aguarde...' : 'Conectar WhatsApp'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal QR Code */}
      {showQr && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
          <div style={{
            background: 'var(--paper)', borderRadius: 16, padding: 36,
            textAlign: 'center', maxWidth: 380,
          }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink-1)', marginBottom: 8 }}>
              Escaneie o QR Code
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 24 }}>
              Abra o WhatsApp → Aparelhos conectados → Conectar aparelho
            </div>
            {qr ? (
              <img src={`data:image/png;base64,${qr}`} alt="QR Code"
                style={{ width: 240, height: 240, borderRadius: 8 }} />
            ) : (
              <div style={{ width: 240, height: 240, background: 'var(--paper-3)',
                borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--ink-4)', fontSize: 13, margin: '0 auto' }}>
                Gerando QR Code...
              </div>
            )}
            <button onClick={() => setShowQr(false)} style={{
              marginTop: 20, padding: '8px 20px', borderRadius: 8, fontSize: 13,
              border: '1px solid var(--line-2)', background: 'var(--paper-2)',
              color: 'var(--ink-2)', cursor: 'pointer', fontFamily: 'inherit',
            }}>Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
}
```

**2. Registre a tela nas rotas de `App.tsx`**
Substitua o placeholder de `integracoes` por `<Integrations />`.

## Verificação
1. Abra o painel → Integrações
2. Status aparece como "Não configurado"
3. Clique "Conectar WhatsApp" → modal abre com QR Code
4. Escaneie com WhatsApp → status muda para "Conectado" automaticamente
5. Envie mensagem para o número → bot responde via Evolution
