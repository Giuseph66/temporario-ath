# Artemis Bot - Auditoria comparativa contra o planejamento

Data da auditoria: 24/04/2026

Fonte de planejamento analisada: `/home/jesus/Downloads/Artemis.docx.pdf`

Escopo da auditoria: leitura estática completa do repositório local, sem execução de build, lint, testes, chamadas externas, WhatsApp, Gemini, Asaas ou Google Calendar.

## 1. Veredito executivo

O projeto real está muito próximo do planejamento em arquitetura geral, stack, integrações principais e intenção de produto. A base tem os 16 arquivos TypeScript citados no PDF e soma 2.728 linhas de TypeScript em `src/`, exatamente alinhado com o número apresentado no documento.

O que está forte:

- Estrutura modular clara: controllers, services, flow, types e utils.
- FSM de conversa implementada em `src/flow/StateResolver.ts`.
- Debounce por usuário no webhook principal.
- Prompt dinâmico por estado em XML.
- Integração Gemini com tool calling para agenda e pagamentos.
- Integração Asaas para cliente, cobrança, assinatura e cancelamento.
- Integração Google Calendar para disponibilidade, criação, busca e cancelamento.
- Intake Respondi com validação por token e normalização de telefone.
- Banco PostgreSQL via Prisma com `User` e `ChatHistory`.
- Preocupação real com LGPD: consentimento, exclusão, retenção de leads, filtro de dados sensíveis.

O que impede chamar isso de produção madura:

- Webhook Asaas aceita eventos sem assinatura, secret ou verificação de origem.
- Há múltiplas instâncias diretas de `PrismaClient`, contrariando o próprio padrão Singleton.
- Não existe suite de testes.
- Não existem migrations Prisma versionadas.
- Não existe `.env.example`, configuração PM2, Docker/Compose ou runbook de deploy no repo.
- O README está desatualizado e cita OpenAI/variáveis antigas.
- O Calendar ID está hardcoded para um email pessoal/teste.
- Não há graceful shutdown para encerrar servidor e conexões do Prisma.
- Parte do comportamento crítico depende de prompt, não de validação determinística no backend.

Minha leitura senior: é um projeto de júnior com boa intuição de produto e um salto grande de complexidade, mas ainda com riscos típicos de sistema que cresceu rápido: muita regra crítica está em prompt, há acoplamento entre IA e efeitos reais, observabilidade informal por `console.log`, ausência de testes e lacunas de segurança em webhooks.

## 2. Inventário real do repositório

Arquivos principais encontrados:

- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `prisma.config.ts`
- `README.md`
- `prisma/schema.prisma`
- `config/persona.json`
- `config/programs.json`
- `config/settings.json`
- `src/index.ts`
- `src/controllers/WebhookController.ts`
- `src/controllers/AsaasWebhookController.ts`
- `src/controllers/RespondiController.ts`
- `src/flow/StateResolver.ts`
- `src/services/AIService.ts`
- `src/services/AsaasService.ts`
- `src/services/CalendarService.ts`
- `src/services/ConfigLoader.ts`
- `src/services/PromptBuilder.ts`
- `src/services/StateService.ts`
- `src/services/WhatsAppService.ts`
- `src/types/user.ts`
- `src/types/config.ts`
- `src/utils/prisma.ts`
- `src/utils/phoneNormalizer.ts`

Contagem encontrada:

- TypeScript em `src/`: 2.728 linhas.
- Config JSON: 119 linhas.
- Prisma schema: 50 linhas.
- README: 51 linhas.
- Total auditado via contagem local: 3.059 linhas.

Itens ausentes no repositório:

- Pasta `tests`, `test` ou `__tests__`.
- Migrations em `prisma/migrations`.
- `.env.example`.
- `Dockerfile` ou `docker-compose.yml`.
- Configuração PM2 (`ecosystem.config.js`).
- Configuração de CI.
- Credencial `config/google-credentials.json`, esperada em runtime pelo código.

## 3. Matriz geral: planejamento versus implementação

| Área do PDF | Status real | Evidência | Comentário senior |
|---|---:|---|---|
| TypeScript/Node.js | Implementado | `package.json`, `tsconfig.json` | Stack real bate com o planejamento. |
| Express HTTP API | Implementado | `src/index.ts` | Rotas principais existem. |
| PostgreSQL + Prisma | Implementado parcial | `prisma/schema.prisma`, `src/utils/prisma.ts` | Schema existe, mas não há migrations versionadas. |
| User + ChatHistory | Implementado | `prisma/schema.prisma` | Campos batem com o PDF. |
| FSM com 6 estados | Implementado | `src/types/user.ts`, `src/flow/StateResolver.ts` | Estado é string, não enum Prisma. Funciona, mas sem validação forte no banco. |
| Debounce 5s por usuário | Implementado | `WebhookController.ts` | Buffer por número existe. |
| Resposta 200 imediata Meta | Implementado | `WebhookController.ts` | ACK acontece antes do processamento pesado. |
| PromptBuilder XML por estado | Implementado | `PromptBuilder.ts` | Ponto forte do projeto. |
| Gemini resposta principal | Implementado | `AIService.ts` | Usa `gemini-3.1-pro-preview`. |
| Gemini extração JSON | Implementado | `AIService.ts` | Usa `gemini-2.5-flash`. |
| Tool calling com 6 ferramentas | Implementado | `AIService.ts` | 4 calendário + 2 Asaas. |
| Filtro de raciocínio | Implementado parcial | `AIService.ts` | Existe heurística, mas pode filtrar português com palavras ASCII ou deixar reasoning escapar. |
| Retry/backoff | Implementado | `WebhookController.ts`, `AIService.ts` | Retry externo no controller e classificação no service. |
| Google Calendar | Implementado parcial | `CalendarService.ts` | Funcional, mas Calendar ID hardcoded e credencial por arquivo local. |
| Asaas | Implementado parcial | `AsaasService.ts`, `AsaasWebhookController.ts` | Cobrança existe; webhook sem validação é risco crítico. |
| Respondi | Implementado | `RespondiController.ts` | Valida token via query string e faz upsert. |
| LGPD Art. 18 exclusão | Implementado | `WebhookController.ts`, `StateService.ts` | Deleta usuário e histórico em cascata. |
| LGPD retenção 30 dias | Implementado parcial | `src/index.ts` | Cron existe via `setInterval`, mas usa Prisma separado e não roda imediatamente no startup. |
| Graceful shutdown | Não implementado | Sem handlers SIGTERM/SIGINT | Item pendente do PDF confirmado. |
| Testes | Não implementado | Sem arquivos de teste | Item pendente do PDF confirmado. |
| QA end-to-end | Não encontrado | Sem scripts/cenários | Precisa virar checklist executável. |
| SaaS multi-tenant | Não implementado | Arquitetura single-tenant | Está corretamente como roadmap futuro. |

## 4. Comparativo detalhado por seção do PDF

### 4.1 Sumário executivo

Planejado:

- Assistente WhatsApp com IA para Confluence.
- Automação de ciclo de vida: contato, qualificação, matrícula, agendamento e pagamento.
- Estado de testes/debugging.
- Código em TypeScript com 2.728 linhas e 16 arquivos.

Encontrado:

- O projeto é de fato um bot WhatsApp com Express, Meta API, Gemini, Prisma, Asaas e Google Calendar.
- A automação do funil existe no fluxo: webhook recebe mensagem, agrega debounce, salva histórico, extrai perfil, resolve estado, monta prompt, chama IA, executa ferramentas e envia resposta.
- O número de linhas TypeScript confere: 2.728 linhas em 16 arquivos de `src/`.
- O status "fase de testes e debugging" parece honesto: há comentários de estabilização, código com logs extensos e ausência de testes.

Diferenças:

- O README ainda descreve OpenAI e variáveis `WHATSAPP_*`, enquanto o código usa Gemini e `META_*`.
- O projeto se descreve como "produção", mas faltam peças operacionais básicas para produção: migrations, validação do webhook Asaas, graceful shutdown, testes e runbook.

### 4.2 Infraestrutura ativa e stack

Planejado:

- Hostinger VPS, Ubuntu 24.04, Nginx, SSL, PM2.
- Node.js v20.20.0.
- PostgreSQL local.
- Prisma 5.19.1.
- Meta WhatsApp Business API.
- Asaas sandbox em testes.
- Google Calendar live.

Encontrado no repo:

- `package.json` usa Prisma `5.19.1`, `@google/generative-ai`, `googleapis`, `axios`, `express`.
- Script de produção existe: `npm run build` e `npm start`.
- Não há arquivos de Nginx, PM2, SSL, VPS ou deploy no repositório.
- Não há `.env.example`.
- Não há instruções atualizadas de deploy no README.

Conclusão:

- A stack de aplicação bate.
- A infraestrutura citada no PDF não é comprovável pelo repo local. Pode existir no VPS, mas não está versionada nem documentada aqui.
- Como prática senior, o repo deveria conter pelo menos um `docs/DEPLOY.md`, `.env.example` e um `ecosystem.config.js` para reduzir dependência de memória oral.

### 4.3 Banco de dados

Planejado:

- Tabela `User` com 20 campos.
- Tabela `ChatHistory` com 5 campos e cascade delete.
- Histórico limitado às últimas 20 mensagens.

Encontrado:

- `User` possui os campos do PDF: `id`, `phoneNumber`, `name`, `age`, `goal`, `currentProgramId`, `conversationState`, `interactionCount`, `lastInteraction`, `createdAt`, `cpf`, `email`, `birthDate`, `address`, `paymentDay`, `enrollmentTarget`, `extraInfo`, `lgpdConsent`, `asaasCustomerId`, `lastPaymentUrl`.
- `ChatHistory` possui `id`, `userId`, `role`, `content`, `createdAt`.
- Relação `ChatHistory.user` usa `onDelete: Cascade`.
- `StateService.getSession` limita a busca a `take: 20`.

Problemas:

- O `take: 20` com `orderBy: { createdAt: 'asc' }` pega as 20 mensagens mais antigas, não as últimas 20. Para cumprir o PDF, deveria buscar `desc`, `take: 20` e inverter a ordem antes de mandar ao Gemini, ou usar outra estratégia.
- `conversationState` é `String?` no banco. Não há enum ou validação no schema.
- Não há migrations versionadas; só existe `schema.prisma`.
- `asaasCustomerId` é `@unique`, bom, mas se o Asaas permitir múltiplos perfis com CPF duplicado ou migração manual, pode gerar conflito operacional.

### 4.4 Arquitetura principal

Planejado:

- FSM: `GREETING -> QUALIFICATION -> PROGRAM_PRESENTATION -> OBJECTION_HANDLING -> CLOSING -> HUMAN_HANDOFF`.
- MVC/camadas.
- Debounce de 5.000 ms.
- PromptBuilder XML dinâmico.
- ConfigLoader carrega `persona`, `programs` e `settings`.
- RespondiController com secret.

Encontrado:

- FSM existe em `src/types/user.ts` e `src/flow/StateResolver.ts`.
- Controllers e services estão separados.
- Debounce existe com `DEBOUNCE_MS = 5000`.
- PromptBuilder constrói blocos por estado.
- ConfigLoader lê os três JSONs.
- RespondiController valida `RESPONDI_WEBHOOK_SECRET`.

Observações senior:

- O FSM é simples e legível, mas depende de `session.interactionCount`, extração por IA e triggers por substring.
- O estado `currentProgramId` existe no schema, mas quase não há lógica determinística salvando esse campo. O PromptBuilder deduz programa por idade quando `currentProgramId` está vazio.
- O sistema não tem fila real por usuário. O debounce evita rajadas, mas se o processamento demorar e uma nova janela de debounce disparar para o mesmo número, pode haver concorrência entre dois `processMessages`.
- A dependência do Gemini para extração antes de resolver estado é útil, mas cria custo e latência a cada perfil incompleto.

### 4.5 Inteligência e comportamento da IA

Planejado:

- Memória persistente.
- Extração em segundo plano.
- Tool calling com 6 ferramentas.
- Filtro de raciocínio.
- Objeção em 3 camadas.
- Protocolo teen.
- Bloqueio de preços/links sem consentimento.
- Timeouts e retry.
- Killswitch de mídia.

Encontrado:

- Memória persistente existe via `ChatHistory`.
- Extração existe em `AIService.extractProfileData`.
- Seis ferramentas existem:
  - `check_availability`
  - `create_appointment`
  - `find_appointments`
  - `cancel_appointment`
  - `generate_payment`
  - `cancel_asaas_payment`
- Filtro de reasoning existe em `isModelReasoning`.
- Objeções em 3 camadas existem em `config/persona.json` e no `PromptBuilder`.
- Protocolo teen existe, mas diverge entre documentos/código:
  - PDF fala 14-16 em alguns trechos.
  - Prompt usa 12-17 em outros trechos.
  - `buildProgramPresentationBlock` usa 14-16 para dedução inicial.
- Timeouts existem:
  - 45s para estados normais.
  - 60s para estados com ferramentas.
  - 90s no loop total de ferramentas.
- Retry existe no controller com backoff.

Problemas:

- O "killswitch de mídia" não está implementado como resposta determinística. O webhook só processa `messageData.text?.body`; se vier imagem, áudio ou vídeo, ele responde 200 e ignora. Isso reduz custo, mas não "rejeita instantaneamente" com mensagem ao usuário.
- O bloqueio de links/preços depende principalmente de prompt. Não há uma camada determinística que impeça envio de URL de formulário fora do `CLOSING` se a IA alucinar, exceto instruções.
- O filtro de reasoning é heurístico e pode falhar. Melhor tratar com contratos de saída, validação e fallback mais explícito.
- `ALL_TOOLS` é declarado mas não usado; não quebra o sistema, mas indica sobra de refatoração.
- `AIService` instancia `PrismaClient` diretamente em vez de usar `src/utils/prisma.ts`.
- `AIService` instancia `WhatsAppService`, mas não usa `whatsapp`; isso é código morto.

### 4.6 Transferência para humano

Planejado:

- Quatro tipos:
  - `DELETION`
  - `MENTAL_HEALTH`
  - `HOSTILE`
  - `SOFT`
- Respostas determinísticas sem IA.
- Mais de 50 frases em português e proteção contra falso positivo.

Encontrado:

- Os quatro tipos existem.
- `WebhookController` trata handoff sem chamar IA.
- `StateResolver` tem listas de triggers.
- Há proteção específica para falso positivo com nome "Dayana".
- `DELETION` deleta dados e envia confirmação.
- `MENTAL_HEALTH` direciona para humano e CVV.
- `HOSTILE` envia link.
- `SOFT` pede confirmação e depois envia link/template se o estado anterior já era `HUMAN_HANDOFF`.

Diferenças:

- A soma visual dos triggers não parece passar de 50 frases únicas. Há bastante cobertura, mas a frase "mais de 50" do PDF parece inflada.
- O estado `HUMAN_HANDOFF` é persistido. Dependendo da resposta seguinte, a conversa pode ficar presa em handoff até novos triggers/fluxos. Isso pode ser desejado, mas precisa de teste.

### 4.7 Funil de vendas

Planejado:

1. Saudação disruptiva.
2. Qualificação por objetivo e idade.
3. Apresentação do programa ideal.
4. Objeções.
5. Fechamento com CPF, pagamento, endereço, Respondi.
6. Humano.

Encontrado:

- Fluxo existe.
- GREETING hoje começa com consentimento LGPD obrigatório antes de qualquer venda.
- QUALIFICATION coleta nome, para quem é matrícula, idade e objetivo.
- PROGRAM_PRESENTATION apresenta texto completo após consentimento do usuário.
- OBJECTION_HANDLING usa camadas.
- CLOSING pede formulário, CPF, vencimento, horário, gera cobrança e agenda.
- HUMAN_HANDOFF é determinístico.

Diferenças:

- O PDF diz "coleta objetivo primeiro, depois idade"; o PromptBuilder atual coleta nome, para quem, idade e objetivo.
- O PDF diz que o fechamento coleta CPF, dia de pagamento e endereço antes do link; o código atual empurra dados de faturamento para formulário Respondi e também pode pedir CPF/dia via conversa.
- O plano diz "formulário Respondi somente após o usuário confirmar intenção"; isso está coerente com o estado `CLOSING`.
- A seleção de programa por objetivo é limitada. Sem `currentProgramId`, o código deduz principalmente por idade; PRM é mencionado por prompt, mas não há roteamento determinístico robusto para `terapia_psicanalise`.

### 4.8 Asaas

Planejado:

- CRUD/busca de clientes.
- Mensal, semestral e anual.
- Webhook de confirmação.
- `lastPaymentUrl`.
- Lacuna conhecida: webhook sem assinatura.

Encontrado:

- `getOrCreateCustomer` busca por CPF e cria/atualiza cliente.
- `generatePaymentLink` cria assinatura se `installmentCount > 1`, cobrança avulsa se `installmentCount = 1`.
- Semestral/anual são calculados em `AIService.executeToolCall` antes de chamar `AsaasService`.
- `lastPaymentUrl` é salvo.
- `cancelPendingPayments` cancela assinaturas ativas e cobranças pendentes.
- Webhook envia mensagem de confirmação para o usuário.

Problemas:

- Webhook Asaas realmente não valida assinatura, token, secret, IP ou estrutura assinada.
- O webhook responde 200 antes de validar payload. Isso evita retentativa, mas também confirma recebimento de evento falso.
- Não há idempotência por `payment.id` ou registro de eventos processados. Evento duplicado pode enviar confirmação duplicada.
- Não há persistência de status de matrícula/pagamento no banco. O usuário recebe mensagem, mas o estado do lead não muda para "pago", "matriculado" ou similar.
- `AsaasWebhookController` instancia `PrismaClient` diretamente.

### 4.9 Google Calendar

Planejado:

- `check_availability`
- `create_appointment`
- `find_appointments`
- `cancel_appointment`
- Recorrência para 24 semanas.
- Fuso `America/Cuiaba`.

Encontrado:

- As 4 operações existem.
- Recorrência via `RRULE:FREQ=WEEKLY;COUNT=...`.
- Fuso `America/Cuiaba` aparece nas chamadas.
- Há guarda server-side para não criar evento em horário ocupado.

Problemas:

- `CALENDAR_ID = 'pietro.m.conte@gmail.com'` hardcoded.
- `config/google-credentials.json` é exigido por caminho fixo, mas o arquivo não está no repo.
- Não há variável `GOOGLE_CALENDAR_ID`.
- Não há validação de horário comercial no backend. As regras estão no prompt, mas uma tool call com domingo/noite poderia passar se o calendário estiver livre.
- Double-booking é mitigado por `freebusy` antes do insert, mas ainda pode haver corrida se duas requisições consultarem o mesmo slot ao mesmo tempo.

### 4.10 Respondi

Planejado:

- Validação de `RESPONDI_WEBHOOK_SECRET`.
- Ingestão de phone, name, CPF, email, birthDate, goal, paymentDay, enrollmentTarget, address, extraInfo.
- Normalização telefone 12/13 dígitos.
- Consentimento LGPD só com "sim".
- Upsert inteligente.

Encontrado:

- Validação por query param `?token=...`.
- Campos são extraídos por busca parcial no título da pergunta.
- Telefone é normalizado.
- Busca tenta número 13 dígitos e variante 12 dígitos.
- Atualiza registro existente ou cria novo.
- `lgpdConsent` só é setado true se resposta for `sim` ou boolean true.

Problemas:

- O token em query string tende a aparecer em logs, proxies e histórico. Funciona, mas header assinado seria melhor.
- O controller loga payload bruto. Isso pode expor CPF, email, endereço e dados pessoais em logs.
- A extração por título de pergunta é flexível, mas frágil se o formulário mudar muito.

### 4.11 LGPD

Planejado:

- Art. 11: bloquear dados sensíveis no `goal`.
- Art. 15/16: acesso e correção via conversa.
- Art. 18: exclusão.
- Cron 30 dias.
- Consentimento.

Encontrado:

- Bloqueio de termos sensíveis em `StateService.updateUserProfile`.
- Exclusão por trigger e cascade.
- Cron 30 dias no `index.ts`.
- Consentimento via Respondi e via conversa no GREETING.

Parcial ou ausente:

- Acesso e correção via conversa não aparecem como fluxo determinístico. Pode até ser respondido pela IA, mas não há ferramenta/endpoint para exibir ou corrigir perfil sob demanda.
- Logs podem conter dados pessoais em excesso, especialmente no Respondi.
- Cron usa `setInterval`; se o processo reiniciar frequentemente, a limpeza pode demorar 24h a partir do start. Um job dedicado ou execução inicial controlada seria mais previsível.
- Não há política de retenção para `ChatHistory` de clientes convertidos.

## 5. O que já foi feito

Funcionalidades principais implementadas:

- Servidor Express com rotas:
  - `GET /`
  - `GET /webhook`
  - `POST /webhook`
  - `POST /webhook/asaas`
  - `POST /webhook/respondi`
- Webhook WhatsApp com ACK imediato.
- Debounce por usuário de 5 segundos.
- Persistência de usuário e histórico no PostgreSQL via Prisma.
- Normalização de telefone brasileiro.
- FSM por estados conversacionais.
- Extração de perfil com Gemini Flash.
- Resposta principal com Gemini Pro Preview.
- Prompt dinâmico por estado.
- Tool calling com calendário e pagamento.
- Envio de WhatsApp via Meta Graph API.
- Intake de formulário Respondi.
- Cadastro/assinatura/cobrança/cancelamento no Asaas.
- Confirmação de pagamento via webhook Asaas.
- Integração Google Calendar.
- Exclusão LGPD.
- Retenção de leads inativos por 30 dias.
- Configuração de persona/programas por JSON.

## 6. O que falta fazer

Prioridade crítica:

1. Validar webhook Asaas antes de processar qualquer evento.
2. Remover instâncias diretas de `new PrismaClient()` e usar o Singleton.
3. Adicionar graceful shutdown para HTTP server e Prisma.
4. Corrigir busca das últimas 20 mensagens.
5. Criar testes unitários para `StateResolver`, `phoneNormalizer`, `StateService` e cálculos Asaas.
6. Criar `.env.example` atualizado.
7. Criar migrations Prisma versionadas.

Prioridade alta:

1. Mover `CALENDAR_ID` para variável de ambiente.
2. Criar validação determinística de horário comercial no backend.
3. Adicionar idempotência ao webhook Asaas.
4. Remover logs de payload bruto com dados pessoais.
5. Atualizar README ou substituí-lo por documentação real.
6. Criar checklist de QA end-to-end com conversas simuladas.
7. Criar script/guia de deploy PM2.

Prioridade média:

1. Transformar regras críticas de prompt em validações backend.
2. Adicionar status de matrícula/pagamento no banco.
3. Melhorar roteamento determinístico para PRM.
4. Tipar melhor o retorno de sessão e perfil em vez de `any`.
5. Padronizar idioma dos comentários/logs.
6. Remover código morto (`ALL_TOOLS`, `whatsapp` não usado em `AIService`).
7. Criar camada de observabilidade com logs estruturados.

Prioridade futura:

1. Painel administrativo.
2. Multi-tenant.
3. White-label.
4. Migração de VPS para infraestrutura própria.
5. Reengajamento automático.

## 7. O que foi feito e não estava claro no planejamento

Itens extras ou mais específicos do que o PDF descreve:

- Cancelamento de cobranças Asaas via tool `cancel_asaas_payment`.
- Safety net que tenta forçar `create_appointment` e `generate_payment` juntos no fechamento.
- Aula experimental gratuita como último recurso em objeções.
- Confirmação para reutilizar CPF já salvo.
- Reenvio de `lastPaymentUrl` sem gerar nova cobrança.
- Normalização de número também no envio WhatsApp usando `libphonenumber-js`.
- Fallback de mensagem quando o processamento background falha.
- Regras explícitas para não prometer contato da Dayana.
- Bloqueio de "ignorar cobrança"; o prompt manda cancelar formalmente.
- Upsert Respondi compatível com registros antigos sem nono dígito.

## 8. Divergências importantes entre PDF e código

| Planejamento | Código atual | Risco |
|---|---|---|
| README deveria guiar o projeto real | README cita OpenAI e `WHATSAPP_*` | Onboarding errado. |
| Histórico últimas 20 mensagens | Busca 20 primeiras por `createdAt: asc` | IA perde contexto recente. |
| Killswitch rejeita mídia | Mídia é ignorada silenciosamente | UX ruim; usuário fica sem resposta. |
| Prisma Singleton | `index.ts`, `AIService.ts`, `AsaasWebhookController.ts` criam Prisma direto | Pool duplicado/conexões abertas. |
| Calendar definitivo por config | Email hardcoded | Deploy frágil e risco de usar calendário errado. |
| QA end-to-end pendente | Não há cenários ou scripts | Regressões invisíveis. |
| Art. 15/16 acesso/correção | Não há fluxo backend claro | LGPD parcial. |
| Infra produção documentada | Não há PM2/Nginx/deploy no repo | Operação depende de conhecimento externo. |
| Asaas webhook inseguro | Confirmado no código | Risco financeiro real. |

## 9. Avaliação senior por dimensão

### Arquitetura

Nota: 7/10.

Boa separação inicial de responsabilidades. O desenho controller/service/flow é compreensível e facilita manutenção. A principal fraqueza é o acoplamento entre IA e efeitos reais: uma resposta do modelo pode acionar calendário e pagamento. O sistema tenta mitigar com prompts e safety nets, mas produção pede validações determinísticas antes de executar ações irreversíveis.

### Segurança

Nota: 4/10.

O projeto tem boas intenções de LGPD, mas segurança operacional ainda é fraca. O webhook Asaas sem validação é o maior risco. Logs com payload bruto e CPF são outro problema. Falta `.env.example` para padronizar secrets e falta política clara de rotação/produção/sandbox.

### Confiabilidade

Nota: 5/10.

ACK imediato, debounce, retry e fallback são bons sinais. Mas faltam fila por usuário, idempotência, testes, graceful shutdown, migrations e observabilidade. Em produção real, esses pontos viram incidentes.

### Produto e UX

Nota: 7/10.

O funil está bem pensado. A persona, objeções, consentimento, informativos e handoff mostram entendimento comercial. O risco é depender demais de prompt para regras comerciais e legais. Também há inconsistência na faixa teen e na ordem de qualificação.

### Manutenibilidade

Nota: 6/10.

O código é legível, mas ainda tem `any`, comentários excessivos em alguns trechos, código morto e inconsistências de configuração. Falta teste para permitir refatoração segura.

### Operação

Nota: 4/10.

Scripts básicos existem, mas não há documentação operacional suficiente no repo. O README está errado para a stack atual. PM2, Nginx, SSL, envs, credenciais e deploy estão descritos no PDF, mas não versionados como runbook.

## 10. Recomendações de refatoração segura

Ordem recomendada:

1. Documentar execução e variáveis reais.
2. Adicionar `.env.example`.
3. Corrigir Prisma Singleton em todos os arquivos.
4. Corrigir ordenação do histórico.
5. Adicionar graceful shutdown.
6. Mover `CALENDAR_ID` para env.
7. Implementar validação do webhook Asaas.
8. Criar testes unitários pequenos.
9. Criar QA manual com scripts de conversa.
10. Só depois mexer no funil/prompt.

Evite neste momento:

- Reescrever a arquitetura inteira.
- Migrar para microserviços.
- Adicionar painel administrativo antes de estabilizar o core.
- Tornar multi-tenant antes de testar o single-tenant.
- Trocar banco ou ORM.
- Adicionar dependências grandes sem resolver segurança/testes.

## 11. Checklist de aceite para considerar pronto para produção

- [ ] Webhook Asaas validado.
- [ ] Webhook Asaas idempotente.
- [ ] Prisma Singleton usado em todos os acessos.
- [ ] Graceful shutdown implementado.
- [ ] `.env.example` criado.
- [ ] README atualizado ou substituído por guia operacional.
- [ ] Migrations Prisma versionadas.
- [ ] Histórico usa últimas 20 mensagens reais.
- [ ] Calendar ID configurável por env.
- [ ] Logs não imprimem CPF/endereço/payload sensível.
- [ ] Testes unitários para FSM.
- [ ] Testes unitários para normalização de telefone.
- [ ] Testes unitários para cálculo de pagamento.
- [ ] QA manual dos 6 estados concluído.
- [ ] Fluxo de mídia não suportada responde deterministicamente.
- [ ] Cenário de exclusão LGPD validado.
- [ ] Cenário de pagamento confirmado validado em sandbox.
- [ ] Cenário de agendamento recorrente validado em calendário de teste.

## 12. Conclusão

O Artemis Bot não é um protótipo vazio. Ele tem bastante implementação real e cobre a maior parte do planejamento funcional. O PDF, porém, apresenta algumas partes com tom mais maduro do que o repositório sustenta operacionalmente.

O sistema está em um bom ponto para endurecimento técnico: primeiro segurança, banco, testes e documentação; depois melhorias de funil e roadmap SaaS. O caminho mais seguro não é recomeçar, é estabilizar o núcleo existente com diffs pequenos e validações objetivas.
