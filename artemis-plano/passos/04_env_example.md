# Passo 04 — Criar Arquivo `.env.example`

## Contexto do Projeto
O Artemis Bot está em `/home/jesus/Neurelix/Artemis-Bot`. Ele usa variáveis de ambiente lidas pelo `dotenv` para configurar todas as integrações externas. Não existe um `.env.example` no repositório, então qualquer pessoa (ou IA) que abrir o projeto não sabe quais variáveis são necessárias.

## Problema
Sem `.env.example`, é impossível saber quais variáveis de ambiente configurar sem ler o código-fonte inteiro. O README atual ainda cita variáveis antigas (`WHATSAPP_*`, `OPENAI_API_KEY`) que não existem mais no código real.

## O que Fazer

**1. Crie o arquivo**
Crie o arquivo `/home/jesus/Neurelix/Artemis-Bot/.env.example` com exatamente o seguinte conteúdo (sem valores reais, apenas nomes e comentários descritivos):

```
# Servidor
PORT=3000
NODE_ENV=development

# Banco de Dados PostgreSQL
DATABASE_URL="postgresql://usuario:senha@localhost:5432/artemis"

# Google Gemini (IA principal)
GEMINI_API_KEY="sua_chave_gemini_aqui"

# Meta WhatsApp Business API
META_ACCESS_TOKEN="seu_token_meta_aqui"
META_PHONE_ID="seu_phone_number_id_aqui"
META_VERIFY_TOKEN="token_de_verificacao_do_webhook_aqui"

# Asaas — Gateway de Pagamento Brasileiro
ASAAS_API_KEY="sua_chave_asaas_aqui"
ASAAS_BASE_URL="https://sandbox.asaas.com/api/v3"
ASAAS_WEBHOOK_SECRET="seu_secret_do_webhook_asaas_aqui"

# Respondi — Plataforma de Formulários
RESPONDI_WEBHOOK_SECRET="seu_secret_respondi_aqui"

# Google Calendar
GOOGLE_CALENDAR_ID="calendario@dominio.com"
# O arquivo de credenciais OAuth do Google deve ficar em: config/google-credentials.json
# Esse arquivo NÃO deve ser commitado no repositório
```

**2. Confirme que `.env` está no `.gitignore`**
Abra o arquivo `.gitignore` na raiz do projeto e confirme que as linhas `.env` e `config/google-credentials.json` estão presentes. Se não estiverem, adicione-as.

## Verificação
O arquivo `.env.example` deve existir na raiz do projeto e conter todas as variáveis listadas acima. Execute:
```bash
cat /home/jesus/Neurelix/Artemis-Bot/.env.example
```
Todas as variáveis devem aparecer.
