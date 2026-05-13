# Passo A2 — Criar modelo TenantUser no schema Prisma

## Contexto
Artemis Bot em `/home/jesus/Neurelix/Artemis-Bot`. `TenantUser` representa administradores que fazem login no painel web. Diferente do `User` (que é o lead/aluno do WhatsApp), o `TenantUser` é o dono/gestor da empresa cliente.

**Pré-requisito:** Passo A1 concluído (modelo `Tenant` existe no schema).

## O que Fazer

**1. Instale bcrypt**
```bash
npm install bcrypt
npm install --save-dev @types/bcrypt
```

**2. Adicione o modelo TenantUser ao schema**
Logo após o modelo `Tenant`:

```prisma
model TenantUser {
  id          String    @id @default(uuid())
  tenantId    String
  email       String    @unique
  passwordHash String
  role        String    @default("admin")
  lastLoginAt DateTime?
  createdAt   DateTime  @default(now())

  tenant      Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
}
```

Valores válidos de `role`: `"owner"`, `"admin"`, `"viewer"`.

**3. Confirme a relação bidirecional**
No modelo `Tenant` (criado no A1), o campo `tenantUsers TenantUser[]` já deve estar declarado. Se não estiver, adicione.

## Verificação
```bash
npx prisma validate
```
Deve passar sem erros. Migration ainda não — será feita no passo A5.
