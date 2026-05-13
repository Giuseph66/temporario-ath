# Passo 07 — Adicionar Idempotência ao Webhook Asaas

## Contexto do Projeto
O Artemis Bot está em `/home/jesus/Neurelix/Artemis-Bot`. O Asaas pode enviar o mesmo evento de pagamento mais de uma vez (por retentativas automáticas). Sem controle de idempotência, o bot envia a mensagem de confirmação ao aluno múltiplas vezes para o mesmo pagamento.

**Este passo deve ser executado depois do Passo 06** (validação do webhook).

## Problema
Não há registro de quais pagamentos já foram processados. Se o Asaas reenviar um evento `PAYMENT_CONFIRMED` com o mesmo `payment.id`, o bot processa de novo e envia mensagem duplicada.

## O que Fazer

### Parte 1 — Adicionar tabela no banco de dados

**1. Leia o schema atual**
Abra `prisma/schema.prisma`.

**2. Adicione o modelo `ProcessedEvent` ao final do arquivo**
```prisma
model ProcessedEvent {
  id          String   @id
  processedAt DateTime @default(now())
}
```
O campo `id` será o `payment.id` do Asaas, que é único por pagamento.

**3. Crie a migration**
Execute no terminal dentro de `/home/jesus/Neurelix/Artemis-Bot`:
```bash
npx prisma migrate dev --name add_processed_events
```
Isso cria o diretório `prisma/migrations/` se não existir e aplica a migration no banco local.

**4. Regenere o Prisma Client**
```bash
npx prisma generate
```

### Parte 2 — Usar a tabela no controller

**5. Leia o arquivo do controller**
Abra `src/controllers/AsaasWebhookController.ts`.

**6. Adicione a verificação de idempotência**
Logo após as validações do Passo 06 (token e shape), antes de qualquer processamento de negócio, adicione:

```typescript
const paymentId = req.body.payment.id as string;

// Verificar se esse pagamento já foi processado
const alreadyProcessed = await prisma.processedEvent.findUnique({
  where: { id: paymentId },
});
if (alreadyProcessed) {
  console.log(`[Asaas] Evento duplicado ignorado: ${paymentId}`);
  return res.sendStatus(200);
}

// Registrar como processado antes de agir
await prisma.processedEvent.create({
  data: { id: paymentId },
});
```

**Posição exata:** Este bloco deve vir depois da validação do token e do shape, mas antes do código que envia mensagem ao usuário ou atualiza o banco.

## Verificação
Com o servidor rodando e o banco atualizado:

**Envie o mesmo payload duas vezes:**
```bash
curl -X POST http://localhost:3000/webhook/asaas \
  -H "Content-Type: application/json" \
  -H "asaas-access-token: SEU_SECRET_AQUI" \
  -d '{"event":"PAYMENT_CONFIRMED","payment":{"id":"test-payment-001"}}'
```

Na primeira chamada: deve processar normalmente.
Na segunda chamada: deve retornar 200 e imprimir no log `Evento duplicado ignorado: test-payment-001` **sem** enviar mensagem ao usuário.

```bash
npm run build
```
Deve compilar sem erros.
