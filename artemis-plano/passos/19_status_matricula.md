# Passo 19 — Adicionar Status de Matrícula/Pagamento no Banco

## Contexto do Projeto
O Artemis Bot está em `/home/jesus/Neurelix/Artemis-Bot`. Quando o Asaas confirma um pagamento, o bot envia mensagem ao aluno. Porém, o banco de dados não registra que aquele aluno se tornou efetivamente matriculado. Não é possível saber quem pagou sem olhar diretamente no Asaas.

## O que Fazer

### Parte 1 — Alterar o schema do banco

**1. Leia o schema atual**
Abra `prisma/schema.prisma`.

**2. Adicione campos ao modelo `User`**
Dentro do modelo `User`, adicione os dois campos novos:
```prisma
enrollmentStatus  String   @default("LEAD")
enrollmentDate    DateTime?
```

O campo `enrollmentStatus` pode ter os valores:
- `"LEAD"` — aluno em negociação (padrão)
- `"PAYMENT_PENDING"` — link de pagamento enviado mas não confirmado
- `"ENROLLED"` — pagamento confirmado pelo Asaas
- `"CANCELLED"` — matrícula cancelada

**3. Crie a migration**
Execute no terminal dentro de `/home/jesus/Neurelix/Artemis-Bot`:
```bash
npx prisma migrate dev --name add_enrollment_status
```

**4. Regenere o Prisma Client**
```bash
npx prisma generate
```

### Parte 2 — Atualizar o status quando o link é enviado

**5. Leia `src/services/AIService.ts`**
Localize o método que processa a tool call `generate_payment`. É onde o link de pagamento é gerado e enviado ao usuário.

**6. Após gerar o link, atualizar o status para `PAYMENT_PENDING`**
```typescript
await prisma.user.update({
  where: { id: user.id },
  data: { enrollmentStatus: 'PAYMENT_PENDING' },
});
```

### Parte 3 — Atualizar o status quando o pagamento é confirmado

**7. Leia `src/controllers/AsaasWebhookController.ts`**
Localize onde o evento `PAYMENT_CONFIRMED` ou `PAYMENT_RECEIVED` é processado e a mensagem de confirmação é enviada ao usuário.

**8. Após localizar o usuário no banco, atualizar o status**
```typescript
await prisma.user.update({
  where: { phoneNumber: phoneNumber }, // ou pelo ID, conforme a lógica existente
  data: {
    enrollmentStatus: 'ENROLLED',
    enrollmentDate: new Date(),
  },
});
```

**Posicionamento:** Esta atualização deve acontecer depois de encontrar o usuário no banco e antes (ou junto) de enviar a mensagem de confirmação.

## Verificação
Simule um fluxo de pagamento em sandbox:
1. Gere um link de pagamento → verifique no banco que `enrollmentStatus = 'PAYMENT_PENDING'`
2. Confirme o pagamento via webhook → verifique que `enrollmentStatus = 'ENROLLED'` e `enrollmentDate` foi preenchido

```bash
npx prisma studio
```
Use o Prisma Studio para inspecionar os registros diretamente no banco.

```bash
npm run build
```
Deve compilar sem erros.
