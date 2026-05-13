# Passo A1 — Criar modelo Tenant no schema Prisma

## Contexto
Artemis Bot em `/home/jesus/Neurelix/Artemis-Bot`. Transformando de single-tenant para SaaS multi-tenant. Cada empresa cliente é um Tenant. Este é o primeiro passo — sem ele nada mais do plano SaaS funciona.

## O que Fazer

**1. Leia o schema atual**
Abra `prisma/schema.prisma`.

**2. Adicione o modelo Tenant**
Antes do modelo `User`, insira:

```prisma
model Tenant {
  id                  String        @id @default(uuid())
  name                String
  slug                String        @unique
  plan                String        @default("free")
  evolutionInstance   String?
  evolutionApiKey     String?
  evolutionBaseUrl    String?
  isActive            Boolean       @default(true)
  createdAt           DateTime      @default(now())

  users               User[]
  agents              Agent[]
  tenantUsers         TenantUser[]
}
```

**3. Confirme que o modelo `User` existente receberá `tenantId` no passo A3**
Não altere `User` ainda — isso é o passo A3. Por ora só crie `Tenant`.

## Verificação
```bash
npx prisma validate
```
Deve passar sem erros. Não rode migrate ainda — a migration completa é o passo A5.
