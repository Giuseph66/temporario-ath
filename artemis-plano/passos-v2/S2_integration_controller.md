# S2 — IntegrationController + Rotas

## Objetivo
Criar controller dedicado para CRUD de configurações de integração por tenant. Cada provider tem seu próprio endpoint PATCH.

## Arquivo novo
`src/controllers/IntegrationController.ts`

## Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /api/integrations | Status de todas as integrações (campos mascarados) |
| PATCH | /api/integrations/evolution | Salvar evolutionApiKey, evolutionBaseUrl, evolutionInstance |
| PATCH | /api/integrations/asaas | Salvar asaasApiKey, asaasBaseUrl, asaasWebhookSecret |
| PATCH | /api/integrations/meta | Salvar metaAccessToken, metaPhoneId, metaVerifyToken |
| PATCH | /api/integrations/calendar | Salvar googleCalendarId |

## GET /api/integrations — Retorno esperado
```json
{
  "evolution": { "configured": true, "baseUrl": "https://...", "instance": "artemis" },
  "asaas": { "configured": false, "baseUrl": "https://sandbox.asaas.com/api/v3", "sandbox": true },
  "meta": { "configured": false },
  "calendar": { "configured": false }
}
```
Chaves sensíveis NUNCA retornam o valor real — apenas `"configured": true/false`.

## Rotas a adicionar em src/index.ts
```typescript
import { getIntegrations, updateEvolution, updateAsaas, updateMeta, updateCalendar } from './controllers/IntegrationController';

app.get('/api/integrations',             requireAuth, getIntegrations);
app.patch('/api/integrations/evolution', requireAuth, updateEvolution);
app.patch('/api/integrations/asaas',     requireAuth, updateAsaas);
app.patch('/api/integrations/meta',      requireAuth, updateMeta);
app.patch('/api/integrations/calendar',  requireAuth, updateCalendar);
```

## Critério de conclusão
- `npx tsc --noEmit` sem erros
- `curl GET /api/integrations` retorna JSON com status de cada provider
