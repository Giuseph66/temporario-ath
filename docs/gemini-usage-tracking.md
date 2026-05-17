# Gemini Usage Tracking (Artemis)

## Visão geral
Sistema multi-tenant de tracking operacional de uso Gemini.
Cada chamada Gemini gera um evento individual (`GeminiUsageEvent`) com tokens, custo estimado, modelo, feature, status e latência.

## Fluxo
1. Serviço faz chamada Gemini (SDK/REST).
2. `recordUsage` extrai `usageMetadata`.
3. `GeminiPriceService` calcula custo estimado USD/BRL por catálogo interno.
4. Evento salvo em `GeminiUsageEvent`.
5. Endpoints `/api/ai-usage/*` expõem métricas para painel.

## Features medidas
- Lead flow (`AIService.generateResponse`)
- Extração de perfil (`AIService.extractProfileData`)
- Mensagens de automação (`AIService.generateAutomationMessage`)
- Orientador/Admin (`AdminChatService`)
- Transcrição de áudio (`TranscriptionService`)
- Extração de texto RAG arquivo (`KnowledgeService`)
- Embedding (`EmbeddingService`)

## Custo estimado vs custo oficial
- Painel mostra custo estimado operacional.
- Fonte: `usageMetadata` + `GeminiPriceCatalog`.
- Fatura oficial pode divergir.
- Conciliação oficial futura pode usar Google Cloud Billing.

## Modelos
- Sync: `POST /api/ai-usage/models/sync`
- Lista: `GET /api/ai-usage/models`
- Disponibilidade e depreciação por tenant.

## Catálogo de preços
- Seed fallback: `npm run seed:prices`
- Lista: `GET /api/ai-usage/prices`
- Criar: `POST /api/ai-usage/prices`
- Editar: `PATCH /api/ai-usage/prices/:id`

## Orçamento
- Ler: `GET /api/ai-usage/budget`
- Atualizar: `PATCH /api/ai-usage/budget`
- Estado: `GET /api/ai-usage/status`

Estados:
- `OK`, `MISSING_PRICES`, `WARNING_50`, `WARNING_80`, `CRITICAL_90`, `LIMIT_REACHED`, `BLOCKED`

## MISSING_PRICES
Sinaliza ausência de preço para modelo/modalidade usados em eventos do período ou modelo atual sem preço.
Não derruba resposta do bot.

## Bloqueio automático
Quando `hardLimitEnabled=true` e `blockOnLimit=true` e uso >= 100%:
- estado `BLOCKED`
- `canUseGemini=false`
- resposta neutra:  
  `Estou passando por uma instabilidade temporária. Nossa equipe foi notificada. Tente novamente em breve.`

## Variáveis de ambiente
No backend:
- `GEMINI_TRACKING_ENABLED=true`
- `PRICING_CACHE_TTL_HOURS=24`
- `EXCHANGE_RATE_CACHE_HOURS=1`
- `GCP_BILLING_API_KEY=` (opcional)

## Como adicionar tracking em nova chamada Gemini
1. Capturar `startedAt = Date.now()`.
2. Em sucesso:
   `recordUsage(context, result).catch(() => {})`
3. Em erro:
   `recordError(context, error).catch(() => {})`
4. Nunca bloquear fluxo principal por falha de tracking.

## Limitações conhecidas
- Custo é estimado, não fatura oficial.
- `chatHistoryId` é salvo sem FK nesta versão.
- Cálculo depende cobertura do catálogo de preços por modalidade/modelo.
