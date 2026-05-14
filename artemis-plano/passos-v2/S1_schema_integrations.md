# S1 — Schema: Campos de Integração no Tenant

## Objetivo
Adicionar campos de configuração de integrações (Asaas, Meta WhatsApp, Google Calendar) diretamente no model `Tenant` para que cada tenant configure suas APIs via UI, sem depender de variáveis de ambiente.

## Arquivo
`prisma/schema.prisma`

## Campos a adicionar no model Tenant
```prisma
asaasApiKey         String?
asaasBaseUrl        String?  @default("https://sandbox.asaas.com/api/v3")
asaasWebhookSecret  String?
metaAccessToken     String?
metaPhoneId         String?
metaVerifyToken     String?
googleCalendarId    String?
```

## Pós-schema
```bash
npx prisma migrate dev --name add_integration_fields
```

## Dependências
- PostgreSQL ativo (DATABASE_URL configurada)

## Critério de conclusão
- `prisma migrate status` mostra migração aplicada
- `prisma studio` exibe os novos campos no model Tenant
