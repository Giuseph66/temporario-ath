# Passo C1 — Backend: EvolutionService

## Contexto
Artemis Bot em `/home/jesus/Neurelix/Artemis-Bot`. A Evolution API é um servidor self-hosted (você já tem rodando em VPS) que expõe uma REST API para enviar/receber mensagens WhatsApp. Este serviço encapsula as chamadas à sua VPS Evolution.

**Pré-requisito:** Sprint B concluído. Evolution API rodando na VPS.

## O que Fazer

**1. Adicione variáveis ao `.env` e `.env.example`**
```
EVOLUTION_BASE_URL="https://sua-vps.com:8080"
EVOLUTION_API_KEY="sua-api-key-da-evolution"
```

**2. Crie `src/services/EvolutionService.ts`**

```typescript
import axios from 'axios';

const baseURL = process.env.EVOLUTION_BASE_URL;
const globalApiKey = process.env.EVOLUTION_API_KEY;

if (!baseURL || !globalApiKey) {
  throw new Error('EVOLUTION_BASE_URL e EVOLUTION_API_KEY são obrigatórios');
}

const client = axios.create({
  baseURL,
  headers: { apikey: globalApiKey },
  timeout: 15000,
});

export const EvolutionService = {
  // Envia mensagem de texto
  async sendText(instance: string, phone: string, text: string): Promise<void> {
    await client.post(`/message/sendText/${instance}`, {
      number: phone,
      text,
    });
  },

  // Retorna QR Code em base64 para exibir no painel
  async getQRCode(instance: string): Promise<string | null> {
    try {
      const res = await client.get(`/instance/connect/${instance}`);
      return res.data?.base64 ?? null;
    } catch {
      return null;
    }
  },

  // Status: 'open' (conectado), 'close' (desconectado), 'connecting' (aguardando QR)
  async getStatus(instance: string): Promise<'open' | 'close' | 'connecting'> {
    try {
      const res = await client.get(`/instance/connectionState/${instance}`);
      return res.data?.instance?.state ?? 'close';
    } catch {
      return 'close';
    }
  },

  // Cria nova instância
  async createInstance(instanceName: string): Promise<void> {
    await client.post('/instance/create', {
      instanceName,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
    });
  },

  // Desconecta instância
  async disconnect(instance: string): Promise<void> {
    await client.delete(`/instance/logout/${instance}`);
  },
};
```

## Verificação
Com o servidor rodando e Evolution na VPS:
```bash
curl http://localhost:3000/api/instances/status \
  -H "Authorization: Bearer SEU_TOKEN"
```
Deve retornar status da instância (configurar o endpoint no próximo passo C4).

```bash
npm run build
```
Sem erros.
