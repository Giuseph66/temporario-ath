# Passo 06 — Validar Webhook Asaas

## Contexto do Projeto
O Artemis Bot está em `/home/jesus/Neurelix/Artemis-Bot`. Ele recebe confirmações de pagamento do Asaas via webhook no endpoint `POST /webhook/asaas`, tratado em `src/controllers/AsaasWebhookController.ts`. Quando o Asaas confirma um pagamento, o bot envia uma mensagem de confirmação para o aluno pelo WhatsApp.

## Problema
O endpoint aceita **qualquer** requisição POST sem validar a origem. Qualquer pessoa que souber a URL do servidor pode fazer um POST simulando um pagamento confirmado, e o bot vai enviar mensagem de confirmação para um aluno sem que nenhum pagamento real tenha ocorrido.

A variável `ASAAS_WEBHOOK_SECRET` deve ser configurada no `.env` (já listada no Passo 04).

## O que Fazer

**1. Leia o arquivo**
Abra e leia `src/controllers/AsaasWebhookController.ts` na íntegra.

**2. Identifique o handler do POST**
Localize o método ou função que processa a requisição POST. Ela começa com algo como:
```typescript
async (req: Request, res: Response) => {
  // processa o evento do Asaas
}
```

**3. Adicione validação do token no início do handler**
Insira estas verificações **antes de qualquer processamento do payload**, logo após o início da função:

```typescript
// Validação de origem: o Asaas envia o secret no header
const receivedToken = req.headers['asaas-access-token'] as string;
const expectedToken = process.env.ASAAS_WEBHOOK_SECRET;

if (!expectedToken || !receivedToken || receivedToken !== expectedToken) {
  return res.status(401).json({ error: 'Unauthorized' });
}
```

**4. Adicione validação mínima de shape do payload**
Logo após a validação do token, antes de usar `req.body`:
```typescript
if (!req.body?.event || !req.body?.payment?.id) {
  return res.status(400).json({ error: 'Payload inválido' });
}
```

**5. Adicione a variável de ambiente ao código de inicialização (opcional mas recomendado)**
Em `src/index.ts`, na seção de validação de variáveis obrigatórias (se existir), adicione uma verificação:
```typescript
if (!process.env.ASAAS_WEBHOOK_SECRET) {
  console.warn('[AVISO] ASAAS_WEBHOOK_SECRET não definido. Webhook Asaas desprotegido.');
}
```

## Verificação
Com o servidor rodando localmente (`npm run dev`):

**Teste sem token — deve retornar 401:**
```bash
curl -X POST http://localhost:3000/webhook/asaas \
  -H "Content-Type: application/json" \
  -d '{"event":"PAYMENT_CONFIRMED","payment":{"id":"fake123"}}'
```

**Teste com token errado — deve retornar 401:**
```bash
curl -X POST http://localhost:3000/webhook/asaas \
  -H "Content-Type: application/json" \
  -H "asaas-access-token: token_errado" \
  -d '{"event":"PAYMENT_CONFIRMED","payment":{"id":"fake123"}}'
```

**Teste sem campo obrigatório — deve retornar 400:**
```bash
curl -X POST http://localhost:3000/webhook/asaas \
  -H "Content-Type: application/json" \
  -H "asaas-access-token: SEU_SECRET_AQUI" \
  -d '{"event":"PAYMENT_CONFIRMED"}'
```

```bash
npm run build
```
Deve compilar sem erros.
