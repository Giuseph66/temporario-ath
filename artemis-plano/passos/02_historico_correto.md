# Passo 02 — Corrigir Ordem do Histórico de Conversa

## Contexto do Projeto
O Artemis Bot está em `/home/jesus/Neurelix/Artemis-Bot`. Ele salva o histórico de conversas na tabela `ChatHistory` do PostgreSQL via Prisma. A cada interação, busca as últimas mensagens para enviar como contexto ao Gemini (IA).

## Problema
Em `src/services/StateService.ts`, a query que busca o histórico usa `orderBy: { createdAt: 'asc' }` com `take: 20`. Isso retorna as **20 mensagens mais antigas**, não as mais recentes. A IA recebe contexto desatualizado e "esquece" o que foi dito recentemente.

## O que Fazer

**1. Leia o arquivo**
Abra e leia `src/services/StateService.ts` na íntegra.

**2. Localize a query do histórico**
Procure o método que busca mensagens do `ChatHistory` (provavelmente chamado `getSession`, `getUserSession` ou similar). A query atual tem uma estrutura parecida com:
```typescript
const messages = await prisma.chatHistory.findMany({
  where: { userId: user.id },
  orderBy: { createdAt: 'asc' },
  take: 20,
});
```

**3. Corrija a query**
Altere para buscar as 20 mais recentes em ordem decrescente:
```typescript
const messages = await prisma.chatHistory.findMany({
  where: { userId: user.id },
  orderBy: { createdAt: 'desc' },
  take: 20,
});
```

**4. Inverta o array antes de usar**
Depois da query, inverta o array para que fique em ordem cronológica crescente (do mais antigo para o mais recente) antes de montar o histórico para a IA:
```typescript
const orderedMessages = messages.reverse();
```

**5. Use `orderedMessages` no lugar de `messages`**
Substitua todas as referências a `messages` abaixo dessa linha por `orderedMessages` ao montar o `conversationHistory` que vai para o Gemini.

## Verificação
Após a correção, numa conversa com mais de 20 mensagens, a IA deve responder com base nas mensagens mais recentes, não nas mais antigas. Para testar manualmente: envie mais de 20 mensagens numa conversa de teste e confirme que a IA ainda "lembra" o que foi dito nas últimas mensagens.

```bash
npm run build
```
Deve compilar sem erros.
