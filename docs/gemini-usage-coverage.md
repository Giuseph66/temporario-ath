=== RELATÓRIO DE COBERTURA GEMINI USAGE TRACKING ===

Arquivos escaneados pelo grep:
- backend/src/services/AdminChatService.ts
- backend/src/services/AIService.ts
- backend/src/services/KnowledgeService.ts
- backend/src/services/TranscriptionService.ts
- backend/src/services/EmbeddingService.ts
- backend/src/services/MessagingProvider.ts
- backend/src/index.ts
- backend/src/controllers/IntegrationController.ts
- backend/src/controllers/TenantController.ts
- backend/src/controllers/LeadsController.ts

Pontos instrumentados:
- backend/src/services/AIService.ts → generateResponse → source=lead_flow/feature=lead_agent → múltiplas chamadas (`initial`, `tool_response`, `safety_net_*`, `retry_empty_response`)
- backend/src/services/AIService.ts → extractProfileData → source=lead_flow/feature=profile_extraction
- backend/src/services/AIService.ts → generateAutomationMessage → source=automation/feature=automation_message
- backend/src/services/AdminChatService.ts → handleAdminMessageWithTrace → source=admin_chat/feature=admin_orientador (`initial`, `tool_response`)
- backend/src/services/TranscriptionService.ts → transcribeAudio → source=whatsapp_audio|admin_chat/feature=audio_transcription
- backend/src/services/KnowledgeService.ts → extractFileTextWithGemini → source=knowledge/feature=rag_file_extraction (`initial`, `fallback`)
- backend/src/services/EmbeddingService.ts → embedText → source=knowledge/feature=embedding

Pontos encontrados mas não instrumentados:
- backend/src/services/MessagingProvider.ts → sendMessage → falso positivo (não chama Gemini)
- backend/src/index.ts menções `sendMessage`/`GEMINI_API_KEY` → falso positivo de rota/env
- backend/src/controllers/IntegrationController.ts/TenantController.ts → apenas gestão de chave Gemini, sem chamada de modelo
- backend/src/controllers/LeadsController.ts → `sendMessage` é envio WhatsApp, sem Gemini direto

Chamadas Gemini por arquivo:
- AIService.ts: encontradas 10+ / instrumentadas 10+ (cada `sendMessage` e `generateContent`)
- AdminChatService.ts: encontradas 2 (`chat.sendMessage`) / instrumentadas 2
- TranscriptionService.ts: encontrada 1 (`generateContent`) / instrumentada 1
- KnowledgeService.ts: encontrada 1 (`generateContent` REST com fallback por modelo) / instrumentada por tentativa
- EmbeddingService.ts: encontrada 1 (`embedContent`) + opcional `countTokens` / instrumentada

Total:
- Chamadas relevantes encontradas: 15+ (incluindo loops e fallbacks)
- Chamadas instrumentadas: 15+ (1 evento por chamada/tentativa)

Modelos usados identificados:
- gemini-3.1-pro-preview
- gemini-2.5-flash
- gemini-2.0-flash
- gemini-1.5-flash
- gemini-embedding-2
- modelos dinâmicos do tenant para extração de arquivos (com fallback)

Preços com seed:
- gemini-2.5-flash
- gemini-2.5-flash-preview-05-20
- gemini-2.5-flash-lite
- gemini-2.5-pro
- gemini-2.5-pro-preview
- gemini-3-flash-preview
- gemini-3.1-flash-lite
- gemini-3.1-flash-lite-preview
- gemini-3.1-pro-preview
- gemini-embedding-2
- gemini-2.0-flash (deprecated)
- gemini-2.0-flash-lite (deprecated)

Preços ausentes:
- Qualquer modalidade/direção não cadastrada para modelos novos retornados por ListModels
- casos são sinalizados via `missingPricesJson` + estado `MISSING_PRICES`

Comandos executados:
- grep obrigatório de chamadas Gemini (conforme prompt)
- backup banco antes de migration:
  - `pg_dump "$DATABASE_URL" -Fc -f backend/backups/artemis_pre_migration_20260517_163411.dump`

Resultado dos builds/testes:
- Ainda não executado nesta etapa (pendente execução manual com validação final).

Pendências conhecidas:
- Executar migração e geração Prisma no ambiente local com extensão `pgvector` habilitada.
- Rodar `tsc`, `build` e `tests` backend/frontend para validação final.

=====================================================
