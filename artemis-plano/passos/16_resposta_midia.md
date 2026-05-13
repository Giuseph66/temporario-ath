# Passo 16 — Resposta Determinística para Mídia Não Suportada

## Contexto do Projeto
O Artemis Bot está em `/home/jesus/Neurelix/Artemis-Bot`. O webhook principal (`src/controllers/WebhookController.ts`) recebe todas as mensagens do WhatsApp. Quando o usuário envia imagem, áudio, vídeo ou documento, o bot ignora silenciosamente — o usuário fica sem resposta e não sabe o que fazer.

## Problema
O webhook só processa mensagens do tipo `text`. Mensagens de outros tipos são recebidas, retornam 200 para a Meta (correto), mas não enviam nenhuma resposta ao usuário. Isso gera uma experiência ruim: o aluno envia uma foto de um contrato e a Artemis simplesmente não responde.

## O que Fazer

**1. Leia o arquivo**
Abra e leia `src/controllers/WebhookController.ts` na íntegra.

**2. Localize onde o tipo de mensagem é verificado**
Procure pela lógica que extrai o tipo da mensagem do payload da Meta. Deve ter algo como:
```typescript
const messageType = messageData.type;
// ou
const text = messageData.text?.body;
```

**3. Adicione o bloqueio de mídia com resposta ao usuário**
Logo após extrair o tipo da mensagem e o número do remetente (`from`), adicione:

```typescript
const tiposNaoSuportados = ['image', 'audio', 'video', 'document', 'sticker', 'location', 'contacts'];

if (tiposNaoSuportados.includes(messageData.type)) {
  await whatsappService.sendMessage(
    from,
    'No momento, consigo responder apenas mensagens de texto. Por favor, descreva sua dúvida por escrito. 😉'
  );
  return; // Encerra o processamento aqui, sem chamar a IA
}
```

**Posicionamento:** Este bloco deve vir **depois** do ACK de 200 para a Meta (que deve acontecer imediatamente) mas **antes** de qualquer chamada à IA ou ao banco de dados.

**4. Confirme que o ACK de 200 já aconteceu**
O fluxo correto é:
1. Meta envia POST → servidor responde 200 imediatamente
2. Processamento assíncrono começa
3. Dentro do processamento assíncrono: verificar tipo → se mídia, enviar resposta → return

Confirme que a lógica de resposta 200 não foi alterada.

## Verificação
Com o servidor rodando e um número de teste conectado:

Envie uma imagem pelo WhatsApp para o bot. O bot deve responder com a mensagem de texto informando que só suporta texto.

Envie uma mensagem de texto comum. O bot deve continuar respondendo normalmente.

```bash
npm run build
```
Deve compilar sem erros.
