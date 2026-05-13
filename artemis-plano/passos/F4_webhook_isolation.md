# Passo F4 — Backend: Isolamento Total de Webhook por Tenant

## Contexto
Artemis Bot em `/home/jesus/Neurelix/Artemis-Bot`. Com múltiplos tenants ativos, o webhook Evolution precisa garantir isolamento completo: dados de um tenant não vazam para outro, logs são rastreáveis por tenant, e falha de um tenant não derruba os outros.

**Pré-requisito:** Passo C3 concluído (webhook Evolution básico).

## O que Fazer

**1. Leia `src/controllers/EvolutionWebhookController.ts`**
Confirme que o fluxo atual resolve `tenantId` pelo campo `instance`.

**2. Adicione log estruturado por tenant**
Substitua `console.log` genérico por logs com contexto:

```typescript
function log(tenantId: string, msg: string, data?: unknown) {
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    tenant: tenantId,
    msg,
    ...(data ? { data } : {}),
  }));
}
```

Use em todo o webhook: `log(tenant.id, 'Mensagem recebida', { phone: phoneNumber, chars: messageText.length })`.

**3. Wrap cada processamento em try/catch isolado**
Qualquer erro no processamento de um tenant não deve escapar para outros:

```typescript
try {
  await processUserMessage({ phoneNumber, messageText, tenantId: tenant.id });
} catch (err) {
  log(tenant.id, 'Erro no processamento — não afeta outros tenants', {
    error: err instanceof Error ? err.message : String(err),
  });
  // Não re-throw — ACK já foi enviado, erro fica contido
}
```

**4. Garanta que `processUserMessage` recebe e usa `tenantId` em todas as queries**
Leia `src/controllers/WebhookController.ts` ou o arquivo onde `processUserMessage` está implementado. Cada query ao banco dentro dessa função deve ter `where: { ..., tenantId }`. Verifique:
- Busca/criação do usuário: `where: { phoneNumber, tenantId }`
- Busca do agente: `where: { tenantId, isActive: true }`
- Histórico de chat: via relação `userId` (já isolado se o User tem tenantId correto)

**5. Adicione timeout por tenant**
Se o processamento de um tenant travar por mais de 120s, encerra sem bloquear o próximo:

```typescript
await Promise.race([
  processUserMessage({ phoneNumber, messageText, tenantId: tenant.id }),
  new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 120_000)),
]).catch(err => log(tenant.id, 'Timeout ou erro no processamento', { err: err.message }));
```

## Verificação
Com 2 tenants registrados e ativos:

1. Envie mensagem para instância do Tenant A → logs mostram `tenant: id-do-a`
2. Envie mensagem para instância do Tenant B → logs mostram `tenant: id-do-b`
3. Dados do Tenant A não aparecem nas conversas do Tenant B no painel
4. Simule erro no processamento do Tenant A (desligar Gemini temporariamente) → Tenant B continua funcionando

```bash
npm run build
```
Sem erros.
