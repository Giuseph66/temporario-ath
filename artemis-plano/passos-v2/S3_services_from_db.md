# S3 — Services Lendo do Banco por Tenant

## Objetivo
Remover dependência de ENV para chaves por-tenant. Cada service deve buscar as credenciais do banco usando o tenantId da requisição. ENV vira fallback opcional.

## Mudanças por arquivo

### src/services/AsaasService.ts
- Construtor atual: lê `process.env.ASAAS_API_KEY` e `ASAAS_BASE_URL`
- Novo: aceitar `{ apiKey, baseUrl }` como parâmetro
- Instanciar na requisição: buscar do banco via `prisma.tenant.findUnique`

### src/controllers/AsaasWebhookController.ts
- Webhook Asaas não tem autenticação JWT — precisa identificar tenant pelo `asaasWebhookSecret` no header ou por rota específica por tenant
- Curto prazo: fallback ENV ainda funciona para single-tenant

### src/controllers/WebhookController.ts (Meta)
- `verifyWebhook`: usa `VERIFY_TOKEN` do ENV → ler `tenant.metaVerifyToken` (multi-tenant: precisa de rota por slug ou query param `?tenant=slug`)
- `handleWebhook`: usa `META_PHONE_ID` para identificar tenant → buscar tenant por metaPhoneId
- Implementar `findTenantByPhoneId(phoneId)` helper

### src/services/CalendarService.ts
- Construtor: lê `process.env.GOOGLE_CALENDAR_ID`
- Novo: aceitar calendarId como parâmetro, fallback ENV

## Padrão de implementação
```typescript
// Em cada controller que precisa de credenciais:
const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
const asaas = new AsaasService(
  tenant.asaasApiKey ?? process.env.ASAAS_API_KEY!,
  tenant.asaasBaseUrl ?? process.env.ASAAS_BASE_URL!
);
```

## Critério de conclusão
- Tenant sem ENV configurado mas com chaves no banco consegue processar pagamento
- `npx tsc --noEmit` sem erros
