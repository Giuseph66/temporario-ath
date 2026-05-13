# Passo 23 — Adicionar Enum de Estado FSM no Schema Prisma

## Contexto do Projeto
O Artemis Bot está em `/home/jesus/Neurelix/Artemis-Bot`. O campo `conversationState` na tabela `User` armazena o estado atual da conversa de cada aluno. Atualmente é do tipo `String?`, o que significa que qualquer string inválida pode ser salva sem erro (ex: `"GRETING"` com erro de digitação seria aceito silenciosamente).

**Este passo deve ser executado depois do Passo 22** (migrations já configuradas).

## O que Fazer

**1. Leia os arquivos necessários**
Abra e leia:
- `prisma/schema.prisma` — schema atual do banco
- `src/types/user.ts` — onde o enum `ConversationState` está definido em TypeScript

**2. Adicione o enum no `prisma/schema.prisma`**
No arquivo `prisma/schema.prisma`, adicione o enum **antes** do modelo `User`:

```prisma
enum ConversationState {
  GREETING
  QUALIFICATION
  PROGRAM_PRESENTATION
  OBJECTION_HANDLING
  CLOSING
  HUMAN_HANDOFF
}
```

**3. Altere o campo `conversationState` no modelo `User`**
Localize o campo atual:
```prisma
conversationState String?  @default("GREETING")
```

Substitua por:
```prisma
conversationState ConversationState @default(GREETING)
```

**Observação:** O campo deixa de ser opcional (`?` removido) porque agora tem um valor default garantido pelo enum.

**4. Crie a migration**
```bash
npx prisma migrate dev --name add_conversation_state_enum
```

**5. Regenere o Prisma Client**
```bash
npx prisma generate
```

**6. Atualize `src/types/user.ts` para usar o enum do Prisma**
Abra `src/types/user.ts`. Ele provavelmente define o enum assim:
```typescript
export enum ConversationState {
  GREETING = 'GREETING',
  QUALIFICATION = 'QUALIFICATION',
  // ...
}
```

Após a migration, o Prisma Client exporta o mesmo enum. Você pode:
- **Opção A (mais simples):** Manter o enum TypeScript como está e garantir que os valores são idênticos ao enum do Prisma.
- **Opção B (mais rigorosa):** Importar o enum diretamente do Prisma Client e re-exportá-lo:
  ```typescript
  export { ConversationState } from '@prisma/client';
  ```

Escolha a opção que causar menos mudanças no restante do código.

**7. Corrija erros de compilação que aparecerem**
Após a migration, execute `npm run build`. Se houver erros de tipo relacionados ao `conversationState`, corrija-os usando o enum correto em vez de strings literais.

## Verificação
```bash
npx prisma migrate status
```
A migration do enum deve aparecer como `Applied`.

Tente inserir um valor inválido diretamente pelo Prisma Studio (`npx prisma studio`) no campo `conversationState`. O banco deve rejeitar com erro de constraint.

```bash
npm run build
```
Deve compilar sem erros.
