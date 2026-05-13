# Passo A4 — Criar modelo Agent no schema Prisma

## Contexto
Artemis Bot em `/home/jesus/Neurelix/Artemis-Bot`. O `Agent` é a configuração do bot por tenant. Hoje persona/programs/settings vivem em arquivos JSON fixos. No SaaS, cada tenant tem seu próprio Agent com JSONs no banco — editável pelo painel sem rebuild.

**Pré-requisito:** Passos A1, A2, A3 concluídos.

## O que Fazer

**1. Adicione o modelo Agent ao schema**
Logo antes do modelo `User`:

```prisma
model Agent {
  id             String   @id @default(uuid())
  tenantId       String
  name           String
  personaJson    Json
  programsJson   Json
  settingsJson   Json
  geminiModel    String   @default("gemini-2.5-flash-preview-05-20")
  isActive       Boolean  @default(true)
  whatsappNumber String?
  createdAt      DateTime @default(now())

  tenant         Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  leads          User[]
}
```

**2. Confirme relações bidirecionais**

No modelo `Tenant`, o campo `agents Agent[]` deve estar declarado. Se não estiver, adicione.

No modelo `User`, se o campo `agentId String?` e a relação `agent Agent? @relation(...)` foram removidos no A3 por erro de validação, adicione-os agora.

**3. Confirme o schema completo**
Ordem recomendada dos modelos no arquivo:
1. `Tenant`
2. `TenantUser`
3. `Agent`
4. `User`
5. `ChatHistory`
6. `ProcessedEvent`

## Verificação
```bash
npx prisma validate
```
Deve passar sem nenhum erro. Todos os modelos com relações válidas.
