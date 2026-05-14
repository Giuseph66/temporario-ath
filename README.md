# Artemis Bot

Bot WhatsApp com IA para a Confluence Treinamento. Automatiza o ciclo completo do cliente: saudação, qualificação, apresentação de programas, tratamento de objeções, fechamento com cobrança (Asaas) e agendamento (Google Calendar).

## Stack

- **Runtime:** Node.js 20.x + TypeScript 5
- **Framework:** Express
- **IA:** Google Gemini (gemini-2.5-flash / gemini-3.1-pro-preview)
- **Banco:** PostgreSQL + Prisma ORM
- **WhatsApp:** Meta WhatsApp Business API (Graph API v19)
- **Pagamentos:** Asaas (clientes, cobranças, assinaturas)
- **Agenda:** Google Calendar API v3
- **Formulários:** Respondi (webhook de intake)

## Pré-requisitos

- Node.js 20.x
- PostgreSQL rodando localmente ou remoto
- Credenciais Google Gemini (`GEMINI_API_KEY`)
- Credenciais Meta WhatsApp Business (`META_ACCESS_TOKEN`, `META_PHONE_ID`, `META_VERIFY_TOKEN`)
- Chave Asaas (`ASAAS_API_KEY`)
- Arquivo de credenciais Google OAuth em `config/google-credentials.json`

## Instalação

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com as credenciais reais

# 3. Gerar Prisma Client
npx prisma generate

# 4. Sincronizar banco (desenvolvimento)
npx prisma db push
# ou, se migrations existirem:
npx prisma migrate deploy
```

## Rodando

```bash
# Desenvolvimento (hot-reload)
npm run dev

# Build de produção
npm run build
npm start
```

## Testes

```bash
npm test
npm run test:coverage
```

## Estrutura de Arquivos

```
src/
  index.ts                          — Ponto de entrada Express + cron LGPD + graceful shutdown
  controllers/
    WebhookController.ts            — Webhook WhatsApp (debounce, ACK, FSM)
    AsaasWebhookController.ts       — Webhook confirmação de pagamento Asaas
    RespondiController.ts           — Webhook intake de formulário Respondi
  flow/
    StateResolver.ts                — FSM: decide estado e detecta gatilhos de transferência
  services/
    AIService.ts                    — Integração Gemini + tool calling + filtro reasoning
    AsaasService.ts                 — Gateway pagamento: cliente, cobrança, assinatura
    CalendarService.ts              — Google Calendar: disponibilidade, criação, busca, cancelamento
    ConfigLoader.ts                 — Carrega JSONs do diretório config/
    PromptBuilder.ts                — Monta prompt XML dinâmico por estado FSM
    StateService.ts                 — Sessão e perfil do usuário no PostgreSQL
    WhatsAppService.ts              — Envia mensagens via Meta Graph API
  types/
    user.ts                         — Enum ConversationState + tipo UserProfile
    config.ts                       — Tipos de configuração JSON
  utils/
    prisma.ts                       — Singleton do PrismaClient
    phoneNormalizer.ts              — Normaliza telefone brasileiro 12→13 dígitos
config/
  persona.json                      — Persona, tom, restrições, objeções, links
  programs.json                     — Programas, preços, informativos completos
  settings.json                     — Mensagem de handoff e número de suporte
prisma/
  schema.prisma                     — Esquema PostgreSQL (User + ChatHistory + ProcessedEvent)
```

## Estados da Conversa (FSM)

| Estado | Descrição |
|--------|-----------|
| `GREETING` | Primeira interação — coleta consentimento LGPD |
| `QUALIFICATION` | Coleta nome, idade, objetivo |
| `PROGRAM_PRESENTATION` | Apresenta o programa adequado ao perfil |
| `OBJECTION_HANDLING` | Trata objeções de preço/tempo |
| `CLOSING` | Coleta CPF, gera cobrança Asaas, agenda no Calendar |
| `HUMAN_HANDOFF` | Encaminha para Dayana (humana) |

## Variáveis de Ambiente

Ver `.env.example` para a lista completa documentada.
