# Passo 05 — Atualizar README.md

## Contexto do Projeto
O Artemis Bot está em `/home/jesus/Neurelix/Artemis-Bot`. O README atual está completamente desatualizado: cita OpenAI, variáveis `WHATSAPP_*` e uma arquitetura simplificada que não reflete o código real. Qualquer desenvolvedor (ou IA) que leia o README hoje vai configurar o projeto errado.

## Problema
- README cita `OPENAI_API_KEY` — o projeto usa Gemini
- README cita `WHATSAPP_API_TOKEN` e `WHATSAPP_PHONE_NUMBER_ID` — as variáveis reais são `META_ACCESS_TOKEN` e `META_PHONE_ID`
- README descreve apenas 4 arquivos de arquitetura — o projeto tem 16 arquivos TypeScript
- README não menciona Asaas, Google Calendar, Respondi, FSM nem LGPD

## O que Fazer

**1. Leia o README atual**
Abra `README.md` para ter uma referência do que existe.

**2. Substitua completamente o conteúdo**
Reescreva o `README.md` com as seguintes seções:

**Título e descrição:**
```
# Artemis Bot

Assistente de WhatsApp com IA para a Confluence Treinamento. Automatiza o funil de vendas completo: saudação, qualificação, apresentação de programas, tratamento de objeções, fechamento com geração de cobrança e agendamento de aulas.
```

**Stack:**
- Runtime: Node.js 20.x
- Linguagem: TypeScript (compilado para JS)
- Banco de dados: PostgreSQL via Prisma ORM 5.19.1
- IA principal: Google Gemini (gemini-3.1-pro-preview para respostas, gemini-2.5-flash para extração)
- API de mensagens: Meta WhatsApp Business API
- Pagamentos: Asaas
- Agendamento: Google Calendar
- Formulários: Respondi

**Pré-requisitos:**
- Node.js 20.x
- PostgreSQL acessível
- Conta Meta Developer com WhatsApp Business API
- Chave de API do Google Gemini
- Conta Asaas com chave de API
- Credenciais OAuth do Google Calendar (arquivo `config/google-credentials.json`)

**Instalação:**
```bash
npm install
npx prisma generate
npx prisma db push   # somente ambiente local
```

**Configuração:**
```bash
cp .env.example .env
# Preencher todas as variáveis no .env
```

**Rodando em desenvolvimento:**
```bash
npm run dev
```

**Build e produção:**
```bash
npm run build
npm start
```

**Arquitetura — Mapa de Arquivos:**
```
src/
  index.ts                        — Ponto de entrada Express + cron LGPD
  controllers/
    WebhookController.ts          — Webhook WhatsApp (debounce 5s, ACK imediato)
    AsaasWebhookController.ts     — Confirmação de pagamento Asaas
    RespondiController.ts         — Intake de formulário Respondi
  flow/
    StateResolver.ts              — FSM: 6 estados + detecção de gatilhos
  services/
    AIService.ts                  — Gemini + tool calling + filtro de reasoning
    AsaasService.ts               — Clientes, assinaturas e cobranças
    CalendarService.ts            — Disponibilidade, criação, busca e cancelamento
    ConfigLoader.ts               — Carrega JSONs do diretório config/
    PromptBuilder.ts              — Prompt XML dinâmico por estado FSM
    StateService.ts               — Sessão e perfil do usuário no PostgreSQL
    WhatsAppService.ts            — Envio de mensagens via Meta Graph API
  types/
    user.ts                       — Enum ConversationState + tipo UserProfile
    config.ts                     — Tipos dos JSONs de configuração
  utils/
    prisma.ts                     — Singleton do PrismaClient
    phoneNormalizer.ts            — Normaliza telefone brasileiro 12→13 dígitos
config/
  persona.json                    — Persona, tom, objeções, links
  programs.json                   — Programas, preços, informativos
  settings.json                   — Mensagem de handoff e número de suporte
prisma/
  schema.prisma                   — Esquema PostgreSQL (User + ChatHistory)
```

**Fluxo de Estados FSM:**
```
GREETING → QUALIFICATION → PROGRAM_PRESENTATION → OBJECTION_HANDLING → CLOSING → HUMAN_HANDOFF
```

## Verificação
Leia o README final e confirme que não há nenhuma menção a OpenAI, `WHATSAPP_API_TOKEN` ou `WHATSAPP_PHONE_NUMBER_ID`.
