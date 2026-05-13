# Artemis Bot - Guia de execução, operação e melhorias

Data: 24/04/2026

Este guia descreve como rodar o projeto localmente, quais variáveis são necessárias, como operar em produção e quais melhorias técnicas devem ser priorizadas.

## 1. O que é o projeto

Artemis Bot é uma aplicação Node.js/TypeScript que atende usuários pelo WhatsApp usando a Meta WhatsApp Business API, gera respostas com Gemini, salva estado em PostgreSQL via Prisma, agenda aulas no Google Calendar, recebe formulários do Respondi e gera cobranças no Asaas.

Fluxo resumido:

1. Meta envia mensagem para `POST /webhook`.
2. O servidor responde 200 imediatamente.
3. O webhook agrupa mensagens rápidas do mesmo usuário por 5 segundos.
4. O sistema salva mensagem e histórico no PostgreSQL.
5. Gemini Flash extrai dados de perfil quando necessário.
6. `StateResolver` decide o estado da conversa.
7. `PromptBuilder` monta prompt específico do estado.
8. Gemini gera resposta e pode chamar ferramentas.
9. Ferramentas executam Calendar/Asaas.
10. Bot envia resposta pelo WhatsApp.

## 2. Pré-requisitos locais

Necessário:

- Node.js 20.x recomendado.
- npm.
- PostgreSQL acessível.
- Banco criado.
- Variáveis de ambiente em `.env`.
- Credenciais Google Calendar em `config/google-credentials.json`, se for testar agenda.
- Tokens válidos da Meta, Gemini, Asaas e Respondi para testar integrações reais.

Observação: o README atual está desatualizado. Ele cita OpenAI e variáveis antigas. O código real usa Gemini e variáveis `META_*`.

## 3. Instalação

Na raiz do projeto:

```bash
npm install
```

Gerar Prisma Client:

```bash
npx prisma generate
```

Se o banco ainda não tiver tabelas, usar uma estratégia de schema. Como o repositório não possui migrations, o caminho atual mais direto em ambiente local é:

```bash
npx prisma db push
```

Para produção, o ideal é criar migrations versionadas antes de promover alterações:

```bash
npx prisma migrate dev --name initial_schema
```

## 4. Variáveis de ambiente

Crie um arquivo `.env` local com:

```bash
PORT=3000
NODE_ENV=development

DATABASE_URL="postgresql://usuario:senha@localhost:5432/artemis"

GEMINI_API_KEY="..."

META_ACCESS_TOKEN="..."
META_PHONE_ID="..."
META_VERIFY_TOKEN="..."

ASAAS_API_KEY="..."
ASAAS_BASE_URL="https://sandbox.asaas.com/api/v3"

RESPONDI_WEBHOOK_SECRET="..."
```

Variáveis que deveriam ser adicionadas ao código:

```bash
GOOGLE_CALENDAR_ID="calendario@dominio.com"
GOOGLE_APPLICATION_CREDENTIALS="config/google-credentials.json"
ASAAS_WEBHOOK_SECRET="..."
```

Hoje o código espera o arquivo Google em:

```bash
config/google-credentials.json
```

E usa Calendar ID hardcoded em `src/services/CalendarService.ts`.

## 5. Rodar em desenvolvimento

```bash
npm run dev
```

Isso usa `nodemon src/index.ts`.

Endpoint local:

```bash
http://localhost:3000/
```

Resposta esperada:

```text
Artemis PRO (Architecture Cleaned) Online!
```

## 6. Rodar em produção

Build:

```bash
npm run build
```

Start:

```bash
npm start
```

Isso roda:

```bash
node dist/index.js
```

Fluxo típico com PM2:

```bash
npm run build
pm2 start dist/index.js --name artemis
pm2 save
```

Restart após deploy:

```bash
git pull
npm install
npx prisma generate
npm run build
pm2 restart artemis
```

Se houver alteração de schema, não use `db push` direto em produção sem revisão. Crie migration, revise SQL e aplique com:

```bash
npx prisma migrate deploy
```

## 7. Webhooks necessários

Meta WhatsApp:

- Verificação: `GET /webhook`
- Recebimento: `POST /webhook`
- Token de verificação: `META_VERIFY_TOKEN`

Asaas:

- `POST /webhook/asaas`
- Hoje sem validação. Antes de produção real, implementar secret/assinatura/idempotência.

Respondi:

- `POST /webhook/respondi?token=SEU_SECRET`
- Secret: `RESPONDI_WEBHOOK_SECRET`

## 8. Estrutura operacional

Arquivos de configuração sem rebuild:

- `config/persona.json`: tom, restrições, objeções, links e protocolos.
- `config/programs.json`: programas, preços e informativos.
- `config/settings.json`: mensagens/números de suporte.

Arquivos que exigem rebuild:

- Qualquer arquivo em `src/`.
- `prisma/schema.prisma` quando o Prisma Client precisar refletir mudança de schema.

## 9. Como testar manualmente sem chamar serviços reais

Como não há testes automatizados, o QA mínimo deve ser manual e registrado.

Teste de saúde:

```bash
curl http://localhost:3000/
```

Teste de verificação Meta:

```bash
curl "http://localhost:3000/webhook?hub.mode=subscribe&hub.verify_token=SEU_TOKEN&hub.challenge=123"
```

Teste Respondi:

```bash
curl -X POST "http://localhost:3000/webhook/respondi?token=SEU_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"respondent":{"answers":{"WhatsApp":{"country":"55","phone":"66999999999"},"Nome completo":"Teste QA","CPF":"12345678900","Email":"qa@example.com","Data de nascimento":"01/01/2000","Consentimento LGPD":"sim"},"raw_answers":[]}}'
```

Não execute teste de WhatsApp/Gemini/Asaas/Calendar em produção sem usar números, chaves e calendários sandbox.

## 10. Checklist de QA conversacional

Execute com um número de teste:

- [ ] Primeira mensagem recebe pedido de consentimento LGPD.
- [ ] "Não" no consentimento não avança funil.
- [ ] "Sim" registra consentimento e avança.
- [ ] Bot pergunta nome.
- [ ] Bot pergunta para quem é a matrícula.
- [ ] Bot pergunta idade do aluno correto.
- [ ] Bot pergunta objetivo.
- [ ] Adulto recebe Inglês Personalizado.
- [ ] Teen recebe Tech Lab.
- [ ] Informativo só é enviado após confirmação.
- [ ] Objeção "muito caro" entra em tratamento de objeção.
- [ ] Pedido de aula experimental agenda sem cobrança.
- [ ] Pedido de matrícula entra em fechamento.
- [ ] Fechamento pede formulário se faltam dados fiscais.
- [ ] Fechamento não gera link sem CPF confirmado.
- [ ] Fechamento não agenda sem pagamento para matrícula regular.
- [ ] Link de pagamento é enviado como mensagem separada.
- [ ] Pedido de reenviar link não duplica cobrança.
- [ ] Pedido de cancelar cobrança chama cancelamento.
- [ ] Pedido de humano faz handoff soft.
- [ ] Linguagem hostil envia link direto.
- [ ] Pedido de exclusão apaga usuário e histórico.
- [ ] Conteúdo de crise mental recebe resposta segura e não segue IA.
- [ ] Imagem/áudio/vídeo recebem resposta clara de mídia não suportada. Hoje isso precisa ser implementado.

## 11. Melhorias técnicas prioritárias

### 11.1 Segurança do Asaas

Problema: `POST /webhook/asaas` aceita qualquer payload com `PAYMENT_RECEIVED` ou `PAYMENT_CONFIRMED`.

Correção recomendada:

- Configurar secret no Asaas, se disponível.
- Validar header/token antes de `res.sendStatus(200)` ou responder 401 para inválidos.
- Validar shape mínimo do payload.
- Persistir `payment.id` em tabela de eventos ou campo de auditoria.
- Ignorar eventos duplicados.
- Registrar status financeiro no banco.

### 11.2 Prisma Singleton

Problema: há `new PrismaClient()` fora do singleton em:

- `src/index.ts`
- `src/services/AIService.ts`
- `src/controllers/AsaasWebhookController.ts`

Correção:

- Importar `{ prisma }` de `src/utils/prisma.ts`.
- Remover instâncias diretas.
- Adicionar shutdown chamando `prisma.$disconnect()`.

### 11.3 Histórico correto

Problema: `StateService.getSession` ordena ascendente e `take: 20`, o que tende a pegar as mensagens mais antigas.

Correção:

- Buscar por `createdAt: 'desc'`, `take: 20`.
- Inverter array antes de montar `conversationHistory`.

### 11.4 Graceful shutdown

Adicionar:

```ts
const server = app.listen(port, () => {
  console.log(`Artemis rodando na porta ${port}`);
});

async function shutdown(signal: string) {
  console.log(`${signal} recebido. Encerrando...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

### 11.5 Calendar configurável

Problema: Calendar ID está hardcoded.

Correção:

- Usar `GOOGLE_CALENDAR_ID`.
- Validar no startup.
- Manter calendário sandbox e produção separados.

### 11.6 Logs e LGPD

Problema: payload bruto do Respondi é logado com dados pessoais.

Correção:

- Não logar CPF, endereço, email completo ou payload bruto.
- Logar apenas `requestId`, telefone mascarado e campos presentes.
- Adicionar política de retenção de logs.

### 11.7 Testes mínimos

Adicionar framework de teste, por exemplo Vitest ou Jest. Começar pequeno:

- `phoneNormalizer.test.ts`
- `StateResolver.test.ts`
- `AsaasService` para cálculo de semestral/anual, isolando chamadas HTTP.
- `PromptBuilder` para garantir que cada estado inclui/exclui blocos corretos.
- `RespondiController` com payloads simulados.

Não comece com testes end-to-end completos. Primeiro proteja as funções puras e regras de negócio.

## 12. Boas práticas de uso

Para operação diária:

- Use sempre sandbox do Asaas até fechar QA.
- Use calendário de teste enquanto não houver aceite final.
- Tenha um número WhatsApp de teste separado.
- Não edite prompts diretamente em produção sem registrar mudança.
- Após mudar `config/persona.json` ou `config/programs.json`, reinicie PM2 para recarregar config.
- Após mudar `src/`, rode build antes de restart.
- Antes de promover para produção, teste pelo menos um fluxo completo de adulto, teen, objeção, handoff, exclusão e pagamento sandbox.

Para manutenção:

- Mudanças de prompt devem ser tratadas como mudança de produto, não só texto.
- Toda regra que causa pagamento, agendamento, exclusão ou handoff deve ter validação fora do prompt.
- Nunca confie só no modelo para impedir ações perigosas.
- Prefira funções pequenas e testáveis para regras de negócio.
- Evite duplicar clientes Prisma.
- Evite logs com dados pessoais.

## 13. Ordem recomendada de evolução

Sprint 1 - estabilização:

- Corrigir Prisma Singleton.
- Corrigir histórico das últimas 20 mensagens.
- Adicionar graceful shutdown.
- Criar `.env.example`.
- Atualizar README.

Sprint 2 - segurança:

- Validar webhook Asaas.
- Idempotência do webhook Asaas.
- Remover logs sensíveis.
- Calendar ID por env.

Sprint 3 - testes:

- Testes de FSM.
- Testes de phone normalizer.
- Testes de PromptBuilder.
- Testes de cálculo Asaas.
- Testes Respondi com payloads reais anonimizados.

Sprint 4 - produto:

- Roteamento PRM determinístico.
- Unificar regra teen.
- Melhorar fluxo de mídia não suportada.
- Criar status de matrícula/pagamento.

Sprint 5 - operação:

- PM2 config versionada.
- Runbook de deploy.
- Checklist QA formal.
- Observabilidade com logs estruturados.

## 14. Comandos úteis

Instalar:

```bash
npm install
```

Gerar Prisma:

```bash
npx prisma generate
```

Sincronizar banco local sem migration:

```bash
npx prisma db push
```

Rodar dev:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Start produção:

```bash
npm start
```

Prisma Studio local:

```bash
npx prisma studio
```

PM2 logs:

```bash
pm2 logs artemis
```

PM2 restart:

```bash
pm2 restart artemis
```

## 15. Critério de pronto

Antes de dizer que o Artemis está pronto para produção, eu exigiria:

- Build TypeScript limpo.
- Migrations aplicadas por `migrate deploy`.
- Webhook Asaas protegido.
- Logs sem dados pessoais sensíveis.
- QA manual documentado com evidências.
- Testes unitários cobrindo regras centrais.
- Graceful shutdown.
- Configuração de produção sem hardcoded calendar/email pessoal.
- README/runbook coerente com o código real.

Sem esses itens, o projeto pode até funcionar, mas ainda está em fase de testes operacionais.
