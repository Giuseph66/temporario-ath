# Passo C3 — Backend: Webhook da Evolution API

## Contexto
Artemis Bot em `/home/jesus/Neurelix/Artemis-Bot`. A Evolution API envia eventos de mensagem para um endpoint do backend. Diferente do webhook Meta, o payload da Evolution inclui o nome da instância — que usamos para identificar qual tenant enviou.

**Pré-requisito:** Passos C1, C2 concluídos.

## O que Fazer

**1. Estude o formato de payload da Evolution**
Payload típico de mensagem recebida da Evolution:
```json
{
  "event": "messages.upsert",
  "instance": "artemis-confluence",
  "data": {
    "key": { "remoteJid": "5566999998888@s.whatsapp.net", "fromMe": false },
    "message": { "conversation": "olá" },
    "messageTimestamp": 1716000000
  }
}
```

**2. Crie `src/controllers/EvolutionWebhookController.ts`**

```typescript
import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';

// Reutiliza a lógica de processamento existente no WebhookController
// Importar as funções de processamento (debounce, FSM, AI) do controller atual
import { processUserMessage } from './WebhookController'; // ajustar conforme a estrutura real

export async function evolutionWebhook(req: Request, res: Response) {
  // ACK imediato — igual ao webhook Meta
  res.sendStatus(200);

  try {
    const { event, instance, data } = req.body;

    // Só processar mensagens recebidas (não enviadas pelo bot)
    if (event !== 'messages.upsert') return;
    if (data?.key?.fromMe) return;

    // Extrair número e texto
    const remoteJid: string = data?.key?.remoteJid ?? '';
    const phoneNumber = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
    const messageText: string = data?.message?.conversation
      ?? data?.message?.extendedTextMessage?.text
      ?? '';

    if (!phoneNumber || !messageText) return;

    // Resolver tenant pelo nome da instância
    const tenant = await prisma.tenant.findFirst({
      where: { evolutionInstance: instance },
    });
    if (!tenant || !tenant.isActive) return;

    // Processar com a lógica existente (debounce + FSM + IA)
    await processUserMessage({ phoneNumber, messageText, tenantId: tenant.id });

  } catch (err) {
    console.error('[Evolution Webhook] Erro:', err);
  }
}
```

**3. Registre a rota em `src/index.ts`**
```typescript
import { evolutionWebhook } from './controllers/EvolutionWebhookController';
app.post('/webhook/evolution', evolutionWebhook);
```

**4. Configure o webhook na Evolution API**
No painel da Evolution (ou via API), configure o webhook global apontando para:
```
https://seu-dominio.com/webhook/evolution
```
Eventos para ativar: `messages.upsert`, `connection.update`.

**Nota sobre `processUserMessage`:** A função de processamento existente em `WebhookController.ts` precisa aceeber `tenantId` como parâmetro para buscar o `Agent` correto. Leia o arquivo atual e adapte a assinatura para incluir `tenantId`.

## Verificação
Envie uma mensagem para o número conectado à instância Evolution. O log do servidor deve mostrar `[Evolution Webhook]` sendo chamado com o nome correto da instância e o tenant sendo resolvido.
