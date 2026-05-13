# Passo A3 — Adicionar tenantId ao modelo User e corrigir unicidade

## Contexto
Artemis Bot em `/home/jesus/Neurelix/Artemis-Bot`. O modelo `User` atual armazena leads/alunos. No SaaS, o mesmo número de telefone pode ser lead de empresas diferentes — então a unicidade deixa de ser global e passa a ser por tenant.

**Pré-requisito:** Passos A1 e A2 concluídos.

## O que Fazer

**1. Leia o modelo User atual**
Abra `prisma/schema.prisma` e leia o modelo `User` completo.

**2. Adicione os novos campos**
Dentro do modelo `User`, adicione após o campo `id`:

```prisma
tenantId    String
agentId     String?
```

**3. Corrija a constraint de unicidade do phoneNumber**
Localize a linha:
```prisma
phoneNumber  String  @unique
```
Remova o `@unique` dela e adicione ao final do modelo:
```prisma
@@unique([phoneNumber, tenantId])
```

**4. Adicione a relação com Tenant**
Ainda no modelo `User`, adicione:
```prisma
tenant      Tenant   @relation(fields: [tenantId], references: [id])
```

**5. Adicione a relação com Agent (opcional agora, necessário no A4)**
```prisma
agent       Agent?   @relation(fields: [agentId], references: [id])
```

## Verificação
```bash
npx prisma validate
```
Deve passar. Se falhar com erro de relação `Agent` ainda não existir, remova temporariamente o campo `agentId` e a relação — será adicionado de volta no A4.
