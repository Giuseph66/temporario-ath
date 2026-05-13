# Artemis Bot — Plano de Execução para Desenvolvimento por IA

**Projeto:** Artemis Bot (WhatsApp AI para Confluence Treinamento)
**Stack:** TypeScript / Node.js / Express / PostgreSQL / Prisma / Gemini / Meta WhatsApp API / Asaas / Google Calendar
**Repositório:** `/home/jesus/Neurelix/Artemis-Bot`
**Data do plano:** 2026-05-13

---

## Contexto do Projeto

O Artemis Bot é uma assistente de WhatsApp com IA para a Confluence Treinamento (escola de inglês e clínica de psicanálise). Ele automatiza todo o ciclo de vida do cliente: desde a saudação inicial até qualificação, apresentação de programas, tratamento de objeções, fechamento com geração de cobrança (Asaas) e agendamento de aulas (Google Calendar).

O projeto **já existe** com 2.728 linhas de TypeScript em 16 arquivos no diretório `src/`. A maioria das funcionalidades core está implementada. O que este plano descreve é o que precisa ser **corrigido, completado e endurecido** para que o sistema funcione de forma confiável.

**Nunca reescrever a arquitetura. Nunca trocar banco ou ORM. Apenas corrigir e completar o que existe.**

---

## Mapa de Arquivos Existentes

```
src/
  index.ts                          — Ponto de entrada Express + cron LGPD
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
    prisma.ts                       — Singleton do PrismaClient (DEVE ser o único acesso ao banco)
    phoneNormalizer.ts              — Normaliza telefone brasileiro 12→13 dígitos
config/
  persona.json                      — Persona, tom, restrições, objeções, links
  programs.json                     — Programas, preços, informativos completos
  settings.json                     — Mensagem de handoff e número de suporte
prisma/
  schema.prisma                     — Esquema PostgreSQL (User + ChatHistory)
```

---

## SPRINT 1 — Estabilização (Crítico — Fazer Primeiro)

Estas correções são pré-requisito para tudo mais. Sem elas o sistema tem bugs silenciosos em produção.

---

### Tarefa 1.1 — Corrigir Prisma Singleton

**Problema:** Há três arquivos que instanciam `new PrismaClient()` diretamente, quebrando o padrão Singleton e abrindo conexões extras ao banco de dados.

**Arquivos afetados:**
- `src/index.ts` — cria instância separada para o cron LGPD
- `src/services/AIService.ts` — cria instância própria
- `src/controllers/AsaasWebhookController.ts` — cria instância própria

**O que fazer em cada arquivo:**

1. Remover o `import { PrismaClient } from '@prisma/client'` e a linha `const prisma = new PrismaClient()`
2. Adicionar no topo: `import { prisma } from '../utils/prisma'` (ajustar o caminho relativo conforme a profundidade do arquivo)
3. Verificar que todas as chamadas `prisma.algo` no arquivo continuam funcionando com a instância importada

**Verificação:** Após a correção, a palavra `new PrismaClient` não deve aparecer em nenhum arquivo fora de `src/utils/prisma.ts`. Executar: `grep -r "new PrismaClient" src/` — resultado deve ser vazio.

---

### Tarefa 1.2 — Corrigir Ordem do Histórico de Conversa

**Problema:** Em `src/services/StateService.ts`, a busca das últimas mensagens usa `orderBy: { createdAt: 'asc' }` com `take: 20`. Isso retorna as 20 mensagens **mais antigas**, não as mais recentes. A IA recebe contexto desatualizado.

**O que fazer:**

Localizar no arquivo `StateService.ts` o método que busca o histórico do usuário (provavelmente chamado `getSession` ou similar). Alterar a query Prisma para:

```typescript
orderBy: { createdAt: 'desc' },
take: 20,
```

Após buscar, inverter o array antes de montar o histórico para a IA:

```typescript
const messages = await prisma.chatHistory.findMany({
  where: { userId: user.id },
  orderBy: { createdAt: 'desc' },
  take: 20,
});
const orderedMessages = messages.reverse();
```

Usar `orderedMessages` onde antes usava `messages` ao montar o `conversationHistory`.

**Verificação:** As últimas mensagens da conversa devem aparecer no final do array, não no começo.

---

### Tarefa 1.3 — Adicionar Graceful Shutdown

**Problema:** O processo não tem handlers para `SIGTERM` e `SIGINT`. Quando o PM2 reinicia ou o servidor é derrubado, conexões do Prisma ficam abertas.

**O que fazer em `src/index.ts`:**

Guardar a referência do servidor numa variável:

```typescript
const server = app.listen(port, () => {
  console.log(`Artemis rodando na porta ${port}`);
});
```

Adicionar logo abaixo da declaração do servidor:

```typescript
async function shutdown(signal: string): Promise<void> {
  console.log(`${signal} recebido. Encerrando Artemis...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

**Verificação:** Ao rodar `npm run dev` e pressionar Ctrl+C, o processo deve encerrar sem erros de conexão.

---

### Tarefa 1.4 — Criar Arquivo `.env.example`

**Problema:** Não existe `.env.example` no repositório. Qualquer pessoa (ou IA) que clonar o projeto não sabe quais variáveis são necessárias.

**O que fazer:** Criar o arquivo `/home/jesus/Neurelix/Artemis-Bot/.env.example` com o seguinte conteúdo (sem valores reais, apenas os nomes e descrições):

```
# Servidor
PORT=3000
NODE_ENV=development

# Banco de Dados PostgreSQL
DATABASE_URL="postgresql://usuario:senha@localhost:5432/artemis"

# Google Gemini
GEMINI_API_KEY="sua_chave_gemini_aqui"

# Meta WhatsApp Business API
META_ACCESS_TOKEN="seu_token_meta_aqui"
META_PHONE_ID="seu_phone_number_id_aqui"
META_VERIFY_TOKEN="seu_token_verificacao_aqui"

# Asaas (gateway de pagamento)
ASAAS_API_KEY="sua_chave_asaas_aqui"
ASAAS_BASE_URL="https://sandbox.asaas.com/api/v3"
ASAAS_WEBHOOK_SECRET="seu_secret_asaas_aqui"

# Respondi (formulários)
RESPONDI_WEBHOOK_SECRET="seu_secret_respondi_aqui"

# Google Calendar
GOOGLE_CALENDAR_ID="calendario@dominio.com"
# O arquivo de credenciais OAuth deve ficar em: config/google-credentials.json
```

---

### Tarefa 1.5 — Atualizar README.md

**Problema:** O README atual cita OpenAI e variáveis `WHATSAPP_*`. O projeto usa Gemini e variáveis `META_*`.

**O que fazer:** Substituir completamente o conteúdo de `README.md` por uma versão atualizada que:
- Descreve a stack real: TypeScript, Node.js, Express, Gemini, PostgreSQL, Prisma, Meta WhatsApp API, Asaas, Google Calendar
- Lista os pré-requisitos corretos (Node.js 20.x, PostgreSQL, credenciais Gemini + Meta + Asaas + Google)
- Instrui copiar `.env.example` para `.env` e preencher
- Instrui instalar dependências: `npm install`
- Instrui gerar Prisma Client: `npx prisma generate`
- Instrui sincronizar banco em ambiente local: `npx prisma db push`
- Instrui rodar em desenvolvimento: `npm run dev`
- Instrui fazer build: `npm run build`
- Descreve a estrutura de arquivos (usar o mapa da seção anterior)
- Remove qualquer menção a OpenAI

---

## SPRINT 2 — Segurança

Estas correções eliminam riscos reais de segurança antes de qualquer escalonamento.

---

### Tarefa 2.1 — Validar Webhook Asaas

**Problema:** O endpoint `POST /webhook/asaas` em `src/controllers/AsaasWebhookController.ts` aceita qualquer payload sem verificar a origem. Qualquer pessoa pode fazer um POST simulando um pagamento confirmado.

**O que fazer:**

1. Adicionar a variável `ASAAS_WEBHOOK_SECRET` ao `.env` (já adicionada na tarefa 1.4)

2. No início do handler do `AsaasWebhookController`, antes de processar qualquer coisa, validar o token:

```typescript
const receivedToken = req.headers['asaas-access-token'] as string;
const expectedToken = process.env.ASAAS_WEBHOOK_SECRET;

if (!expectedToken || receivedToken !== expectedToken) {
  return res.status(401).json({ error: 'Unauthorized' });
}
```

3. Adicionar validação mínima de shape do payload:

```typescript
if (!req.body?.event || !req.body?.payment?.id) {
  return res.status(400).json({ error: 'Invalid payload' });
}
```

**Verificação:** Um POST sem o header correto deve retornar 401. Um POST com payload malformado deve retornar 400.

---

### Tarefa 2.2 — Adicionar Idempotência ao Webhook Asaas

**Problema:** O mesmo evento de pagamento pode ser enviado mais de uma vez pelo Asaas (retentativas). Sem controle de idempotência, o bot envia mensagem de confirmação duplicada para o cliente.

**O que fazer:**

1. Adicionar campo `processedPaymentIds` no modelo Prisma ou criar tabela separada `ProcessedEvent` com campos `id` (string, payment ID do Asaas) e `processedAt` (DateTime). Atualizar `prisma/schema.prisma`:

```prisma
model ProcessedEvent {
  id          String   @id
  processedAt DateTime @default(now())
}
```

2. Após validar o webhook, antes de enviar mensagem ao usuário, verificar se o `payment.id` já foi processado:

```typescript
const paymentId = req.body.payment.id;
const already = await prisma.processedEvent.findUnique({ where: { id: paymentId } });
if (already) {
  return res.sendStatus(200);
}
await prisma.processedEvent.create({ data: { id: paymentId } });
```

3. Rodar `npx prisma migrate dev --name add_processed_events` para criar a migration.

**Verificação:** Enviar o mesmo payload duas vezes — a segunda deve retornar 200 sem enviar mensagem.

---

### Tarefa 2.3 — Mover Calendar ID para Variável de Ambiente

**Problema:** Em `src/services/CalendarService.ts`, o `CALENDAR_ID` está hardcoded com um email pessoal/teste.

**O que fazer:**

1. Localizar a linha com `CALENDAR_ID` hardcoded (ex: `const CALENDAR_ID = 'pietro.m.conte@gmail.com'`) e substituir por:

```typescript
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;
if (!CALENDAR_ID) {
  throw new Error('GOOGLE_CALENDAR_ID não está definido nas variáveis de ambiente.');
}
```

2. Colocar essa validação no momento em que o serviço é inicializado ou no início da classe/função principal.

3. Adicionar `GOOGLE_CALENDAR_ID` ao `.env.example` (já feito na tarefa 1.4).

**Verificação:** Iniciar o servidor sem `GOOGLE_CALENDAR_ID` no `.env` deve lançar erro com mensagem clara. Com a variável definida, deve funcionar normalmente.

---

### Tarefa 2.4 — Remover Logs com Dados Pessoais

**Problema:** Em `src/controllers/RespondiController.ts`, o payload bruto do formulário é logado. Isso expõe CPF, email, endereço e data de nascimento nos logs.

**O que fazer:**

1. Localizar os `console.log` no `RespondiController.ts` que imprimem o body completo ou campos como `cpf`, `email`, `address`.

2. Substituir por logs que registram apenas metadados não sensíveis:

```typescript
console.log(`[Respondi] Webhook recebido — telefone: ${phoneNormalizado?.slice(0, 4)}****`);
console.log(`[Respondi] Campos presentes: ${Object.keys(dadosExtraidos).join(', ')}`);
```

3. Revisar `src/services/AIService.ts` e `src/controllers/AsaasWebhookController.ts` para remover qualquer `console.log` que imprima dados de usuário (nome, CPF, email, telefone completo).

**Regra geral:** Logs podem registrar que uma ação ocorreu e quais campos estavam presentes, mas nunca o valor de dados pessoais.

---

## SPRINT 3 — Testes

Adicionar cobertura de testes para as partes mais críticas do sistema. Usar **Vitest** (mais leve, compatível com TypeScript nativo).

---

### Tarefa 3.1 — Configurar Framework de Testes (Vitest)

**O que fazer:**

1. Instalar Vitest e dependências:

```bash
npm install --save-dev vitest @vitest/coverage-v8
```

2. Adicionar ao `package.json` os scripts:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

3. Criar o diretório `src/__tests__/` onde todos os arquivos de teste ficarão.

4. Certificar que o `tsconfig.json` inclui `src/__tests__/**/*.ts`.

---

### Tarefa 3.2 — Testes do phoneNormalizer

**Arquivo de teste a criar:** `src/__tests__/phoneNormalizer.test.ts`

**O que testar:**

- Número com 12 dígitos (sem nono dígito) deve ser convertido para 13 dígitos adicionando `9` na posição correta
- Número com 13 dígitos deve ser retornado sem modificação
- Número com código de país `55` já incluso deve ser tratado corretamente
- Número inválido (menos de 10 dígitos) deve lançar erro ou retornar null (depender do comportamento atual)
- DDD válido (ex: 66) deve ser preservado

Cada teste deve verificar entrada e saída explicitamente com `expect(normalizar('5566999999999')).toBe('5566999999999')`.

---

### Tarefa 3.3 — Testes do StateResolver (FSM)

**Arquivo de teste a criar:** `src/__tests__/StateResolver.test.ts`

**O que testar:**

- Usuário novo sem histórico deve entrar em `GREETING`
- Usuário sem `lgpdConsent` não deve avançar para `QUALIFICATION`
- Usuário com consentimento dado e sem nome/idade/objetivo deve estar em `QUALIFICATION`
- Usuário com nome, idade e objetivo mas sem `currentProgramId` deve estar em `PROGRAM_PRESENTATION`
- Usuário com programa definido e sem objeções pendentes deve avançar para `OBJECTION_HANDLING` ou `CLOSING` conforme `interactionCount`
- Gatilho DELETION: mensagens como "apagar meus dados", "deletar minha conta" devem retornar tipo `DELETION`
- Gatilho MENTAL_HEALTH: mensagens como "quero me machucar", "não consigo mais" devem retornar tipo `MENTAL_HEALTH`
- Gatilho HOSTILE: palavras ofensivas devem retornar tipo `HOSTILE`
- Gatilho SOFT: "falar com humano", "quero falar com a Dayana" devem retornar tipo `SOFT`
- Falso positivo: o nome "Dayana" sozinho em contexto normal não deve disparar `SOFT`

**Observação:** Mockar qualquer dependência do banco de dados usando `vi.mock`.

---

### Tarefa 3.4 — Testes do PromptBuilder

**Arquivo de teste a criar:** `src/__tests__/PromptBuilder.test.ts`

**O que testar:**

- Estado `GREETING`: prompt deve conter bloco de consentimento LGPD, não deve conter blocos de fechamento ou pagamento
- Estado `QUALIFICATION`: prompt deve conter instruções de coleta de nome/idade/objetivo, não deve conter preços
- Estado `PROGRAM_PRESENTATION`: prompt deve conter o informativo do programa selecionado (`verbatim_intro` + `full_text` do `programs.json`)
- Estado `OBJECTION_HANDLING`: prompt deve conter as camadas de objeção do `persona.json`
- Estado `CLOSING`: prompt deve conter instruções de coleta de CPF, dia de pagamento e link do formulário Respondi
- Estado `HUMAN_HANDOFF`: prompt deve ser mínimo, sem instruções de venda

Para cada teste, instanciar `PromptBuilder` com configurações mockadas (carregar os JSONs reais de `config/`) e verificar que o XML gerado contém as strings esperadas.

---

### Tarefa 3.5 — Testes de Cálculo de Pagamento Asaas

**Arquivo de teste a criar:** `src/__tests__/AsaasCalculations.test.ts`

**O que testar (extraindo a lógica de cálculo de `src/services/AIService.ts` ou `AsaasService.ts`):**

- Inglês Personalizado Individual semestral (6 meses × R$550): total deve ser R$3.300 com 5% de desconto = R$3.135
- Inglês Personalizado Individual anual (12 meses × R$550): total deve ser R$6.600 com 7% de desconto = R$6.138
- Tech Lab Individual semestral (6 × R$770): R$4.620 com 5% = R$4.389
- Pagamento mensal não deve ter desconto
- Pagamento com 1 mês de antecedência deve ter 2% de bônus

**Observação:** Se a lógica de cálculo estiver embutida em métodos grandes, extrair para funções puras e testáveis antes de testar.

---

### Tarefa 3.6 — Testes do RespondiController

**Arquivo de teste a criar:** `src/__tests__/RespondiController.test.ts`

**O que testar:**

- Request sem token deve retornar 401
- Request com token inválido deve retornar 401
- Payload com telefone de 12 dígitos deve ter o telefone normalizado para 13 dígitos antes do upsert
- Campo `lgpdConsent` deve ser `true` somente quando a resposta do formulário for `"sim"` (case-insensitive)
- Campos ausentes no payload não devem sobrescrever campos já existentes no banco (lógica de upsert parcial)
- CPF e email devem ser salvos corretamente quando presentes
- Payload com telefone já existente no banco deve fazer `update`, não criar duplicata

Usar `supertest` para simular requests HTTP e mockar `prisma` com `vi.mock`.

---

## SPRINT 4 — Produto (Comportamento e Funil)

Estas tarefas corrigem comportamentos incorretos ou incompletos na lógica de negócio.

---

### Tarefa 4.1 — Implementar Resposta para Mídia Não Suportada

**Problema:** Quando o usuário envia imagem, áudio ou vídeo, o webhook processa a mensagem, não encontra `messageData.text?.body` e ignora silenciosamente. O usuário fica sem resposta.

**O que fazer em `src/controllers/WebhookController.ts`:**

1. Após extrair o tipo da mensagem recebida, verificar se é um tipo não suportado (tipo diferente de `text`):

```typescript
const messageType = messageData.type;
if (messageType !== 'text') {
  await whatsappService.sendMessage(
    from,
    'No momento consigo responder apenas mensagens de texto. Por favor, descreva sua dúvida por escrito. 😉'
  );
  return;
}
```

2. Esta resposta deve ser enviada imediatamente, sem passar pelo processamento de IA.

**Verificação:** Enviar uma imagem pelo WhatsApp de teste deve gerar a mensagem de texto informando que mídia não é suportada.

---

### Tarefa 4.2 — Padronizar Protocolo Teen (Faixa Etária)

**Problema:** Há inconsistência na faixa etária do Tech Lab. O PDF diz 14-16. Alguns trechos do código usam 12-17. O `PromptBuilder` usa 14-16. Precisa ser uniformizado.

**O que fazer:**

1. Buscar todas as ocorrências de comparações de idade no código: `grep -rn "14\|16\|17\|teen\|Teen\|TEEN" src/`

2. Padronizar para: **14 a 16 anos** inclusive → Tech Lab obrigatório. **17 anos ou mais** → Inglês Personalizado. **Menor de 14** → não atendido pelos programas atuais (responder com clareza).

3. Atualizar o `persona.json` na chave `qualification` para refletir exatamente: "Tech Lab: Apenas para alunos de 14 a 16 anos. Para 17 anos ou mais, oferecer Inglês Personalizado."

4. Garantir que o `PromptBuilder` usa exatamente os mesmos limites ao montar os blocos de apresentação de programa por idade.

---

### Tarefa 4.3 — Salvar `currentProgramId` de Forma Determinística

**Problema:** O campo `currentProgramId` no banco raramente é salvo. O `PromptBuilder` deduz o programa por idade porque o campo está vazio. Isso cria inconsistência — a IA pode apresentar programas diferentes em conversas diferentes para o mesmo usuário.

**O que fazer em `src/services/StateService.ts` ou `src/flow/StateResolver.ts`:**

1. Quando a extração de perfil (`AIService.extractProfileData`) confirmar que o usuário tem idade definida, aplicar a regra determinística de programa:
   - 14-16 anos → `currentProgramId = 'ingles_techlab'`
   - 17+ anos → `currentProgramId = 'ingles_personalizado'`
   - Keyword de saúde mental no `goal` → `currentProgramId = 'terapia_psicanalise'`

2. Salvar imediatamente no banco via `prisma.user.update`.

3. Só sobrescrever se o campo ainda estiver `null` ou `undefined` (não sobrescrever se o usuário já escolheu).

---

### Tarefa 4.4 — Adicionar Status de Matrícula/Pagamento no Banco

**Problema:** Quando o Asaas confirma um pagamento, o bot envia mensagem ao usuário, mas o banco não registra que aquele usuário se tornou um aluno. Não é possível saber quem pagou.

**O que fazer:**

1. Adicionar campo no modelo `User` em `prisma/schema.prisma`:

```prisma
enrollmentStatus  String?  @default("LEAD")
enrollmentDate    DateTime?
```

Valores possíveis: `LEAD`, `PAYMENT_PENDING`, `ENROLLED`, `CANCELLED`.

2. Em `src/controllers/AsaasWebhookController.ts`, quando o evento for `PAYMENT_RECEIVED` ou `PAYMENT_CONFIRMED`, além de enviar a mensagem ao usuário, atualizar o banco:

```typescript
await prisma.user.update({
  where: { phoneNumber: user.phoneNumber },
  data: {
    enrollmentStatus: 'ENROLLED',
    enrollmentDate: new Date(),
  },
});
```

3. Criar migration: `npx prisma migrate dev --name add_enrollment_status`

---

### Tarefa 4.5 — Remover Código Morto

**Problema:** Há variáveis e importações sem uso que poluem o código.

**O que fazer:**

1. Em `src/services/AIService.ts`: remover `ALL_TOOLS` se existir e não for usado (verificar se a constante é declarada mas nunca referenciada). Remover instância de `WhatsAppService` se existir no arquivo e não for chamada.

2. Executar o build TypeScript (`npm run build`) e verificar os warnings de variáveis não usadas. Resolver cada um removendo a declaração.

3. Padronizar idioma dos comentários: escolher português ou inglês e manter consistente em todos os arquivos. O restante do projeto usa português nos comentários — manter português.

---

### Tarefa 4.6 — Melhorar Tipagem TypeScript (Remover `any`)

**Problema:** Há usos de `any` em retornos de sessão e perfil. Isso esconde bugs de tipagem.

**O que fazer:**

1. Localizar todos os `any` no código: `grep -rn ": any\|as any" src/`

2. Para cada `any`, tentar substituir pelo tipo correto usando os tipos definidos em `src/types/user.ts` e `src/types/config.ts`.

3. Se a tipagem de algum retorno do Prisma estiver como `any`, usar os tipos gerados automaticamente pelo Prisma Client (ex: `Prisma.UserGetPayload<...>`).

4. Priorizar os arquivos `StateService.ts`, `AIService.ts` e `StateResolver.ts` que lidam com dados de usuário.

---

## SPRINT 5 — Banco de Dados e Migrations

---

### Tarefa 5.1 — Criar Migrations Prisma Versionadas

**Problema:** O repositório não tem migrations. Só existe o `schema.prisma`. Isso significa que qualquer mudança de schema precisa de `db push` (destrutivo em produção) ou é feita manualmente.

**O que fazer:**

1. Com o banco local rodando e já populado (ou vazio para desenvolvimento), executar:

```bash
npx prisma migrate dev --name initial_schema
```

Isso cria o diretório `prisma/migrations/` com o SQL da migration inicial.

2. Depois de cada tarefa que altera o schema (ex: Tarefa 2.2, Tarefa 4.4), executar:

```bash
npx prisma migrate dev --name <nome_descritivo_da_mudanca>
```

3. Commitar o diretório `prisma/migrations/` no repositório.

4. **Nunca usar `db push` em produção.** Em produção, usar apenas:

```bash
npx prisma migrate deploy
```

---

### Tarefa 5.2 — Adicionar Enum de Estado FSM no Schema Prisma

**Problema:** O campo `conversationState` é `String?` no banco. Qualquer string inválida pode ser salva sem erro.

**O que fazer:**

1. Adicionar enum no `prisma/schema.prisma`:

```prisma
enum ConversationState {
  GREETING
  QUALIFICATION
  PROGRAM_PRESENTATION
  OBJECTION_HANDLING
  CLOSING
  HUMAN_HANDOFF
}
```

2. Alterar o campo no modelo `User`:

```prisma
conversationState ConversationState @default(GREETING)
```

3. Atualizar o tipo `ConversationState` em `src/types/user.ts` para usar o enum do Prisma ao invés de string literal, ou manter ambos em sync.

4. Criar migration: `npx prisma migrate dev --name add_conversation_state_enum`

5. Corrigir qualquer comparação de string direta com o estado que passe a exigir o enum.

---

## Ordem de Execução Recomendada para IA

Execute exatamente nesta ordem. Cada sprint depende do anterior estar funcionando.

```
Sprint 1 (Estabilização):
  1.1 → Prisma Singleton
  1.2 → Histórico correto
  1.3 → Graceful shutdown
  1.4 → .env.example
  1.5 → README atualizado

Sprint 2 (Segurança):
  2.1 → Validar webhook Asaas
  2.2 → Idempotência Asaas
  2.3 → Calendar ID por env
  2.4 → Remover logs sensíveis

Sprint 3 (Testes):
  3.1 → Configurar Vitest
  3.2 → Testes phoneNormalizer
  3.3 → Testes StateResolver
  3.4 → Testes PromptBuilder
  3.5 → Testes cálculos Asaas
  3.6 → Testes RespondiController

Sprint 4 (Produto):
  4.1 → Resposta para mídia
  4.2 → Padronizar teen 14-16
  4.3 → Salvar currentProgramId
  4.4 → Status de matrícula
  4.5 → Remover código morto
  4.6 → Remover any

Sprint 5 (Banco):
  5.1 → Migrations versionadas
  5.2 → Enum de estado FSM
```

---

## Checklist Final de Aceite

Antes de considerar o projeto concluído, cada item abaixo deve ser verdadeiro:

- [ ] `grep -r "new PrismaClient" src/` retorna vazio (exceto `prisma.ts`)
- [ ] Últimas 20 mensagens chegam ao Gemini em ordem cronológica correta
- [ ] Ctrl+C no servidor encerra sem erros de conexão
- [ ] `.env.example` existe e tem todas as variáveis documentadas
- [ ] README descreve a stack real (Gemini, META_*, PostgreSQL)
- [ ] POST no webhook Asaas sem token retorna 401
- [ ] POST no webhook Asaas com payload duplicado retorna 200 sem enviar mensagem ao usuário
- [ ] `GOOGLE_CALENDAR_ID` lido de env, não hardcoded
- [ ] `console.log` não imprime CPF, email ou endereço
- [ ] `npm test` executa e todos os testes passam
- [ ] Cobertura de testes cobre phoneNormalizer, StateResolver, PromptBuilder, cálculos Asaas, RespondiController
- [ ] Imagem/áudio/vídeo recebidos retornam mensagem de texto informando que o tipo não é suportado
- [ ] Faixa teen padronizada: 14-16 → Tech Lab, 17+ → Inglês Personalizado
- [ ] `currentProgramId` é salvo no banco quando a idade é confirmada
- [ ] Campo `enrollmentStatus` existe e é atualizado para `ENROLLED` após pagamento confirmado
- [ ] Código morto (`ALL_TOOLS`, instâncias não usadas) removido
- [ ] Migrations Prisma versionadas existem em `prisma/migrations/`
- [ ] `npm run build` compila sem erros TypeScript

---

## Padrões Críticos que NUNCA Devem ser Alterados

Estes padrões são a espinha dorsal do sistema. Qualquer alteração neles quebra funcionalidades centrais:

1. **Resposta 200 imediata** — O webhook WhatsApp DEVE retornar 200 OK para a Meta antes de qualquer processamento assíncrono. Se isso mudar, a Meta vai reenviar a mensagem e o usuário recebe duplicatas.

2. **Debounce de 5.000ms por usuário** — Todo processamento de mensagem por usuário deve permanecer serializado dentro do buffer de 5s. Processamento paralelo de mensagens do mesmo usuário corrompe o estado da FSM.

3. **Sanitizador JSON** — Toda resposta do Gemini usada para extração de dados DEVE passar pelo sanitizador Regex antes de `JSON.parse()`. Remover isso causa crash em produção.

4. **Filtro de reasoning** — Toda saída da IA passa pelo filtro que remove raciocínio interno em inglês antes de enviar ao WhatsApp. Nunca contornar este filtro.

5. **Diretório `config/`** — Persona, preços e configurações operacionais vivem aqui. Nunca duplicar essas informações hardcoded no código-fonte.
