# Passo 08 — Mover Calendar ID para Variável de Ambiente

## Contexto do Projeto
O Artemis Bot está em `/home/jesus/Neurelix/Artemis-Bot`. A integração com o Google Calendar está em `src/services/CalendarService.ts`. Este serviço agenda, busca e cancela aulas no Google Calendar da Confluence Treinamento.

## Problema
O `CALENDAR_ID` está hardcoded no arquivo `CalendarService.ts` com um email pessoal/de teste (ex: `'pietro.m.conte@gmail.com'`). Isso significa:
1. Qualquer deploy vai usar o calendário errado se o código não for editado manualmente
2. O email pessoal pode vazar em logs e repositórios

A variável `GOOGLE_CALENDAR_ID` já está listada no `.env.example` criado no Passo 04.

## O que Fazer

**1. Leia o arquivo**
Abra e leia `src/services/CalendarService.ts` na íntegra.

**2. Localize a constante hardcoded**
Procure por uma linha semelhante a:
```typescript
const CALENDAR_ID = 'pietro.m.conte@gmail.com';
// ou
const calendarId = 'algum.email@gmail.com';
```

**3. Substitua pela leitura da variável de ambiente**
Substitua a constante hardcoded por:
```typescript
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;
if (!CALENDAR_ID) {
  throw new Error('GOOGLE_CALENDAR_ID não está definido nas variáveis de ambiente. Configure o .env.');
}
```

**Importante:** Esta verificação deve acontecer uma vez quando o serviço é carregado, não dentro de cada método. Se o `CalendarService` é uma classe, coloque no construtor. Se é um módulo com funções, coloque no nível de módulo (fora das funções).

**4. Atualize o `.env` local**
Se ainda não tiver `GOOGLE_CALENDAR_ID` no seu arquivo `.env` local, adicione com o calendário correto da Confluence:
```
GOOGLE_CALENDAR_ID="email-do-calendario-da-confluence@gmail.com"
```

## Verificação
**Teste sem a variável:**
Comente temporariamente o `GOOGLE_CALENDAR_ID` no `.env` e tente subir o servidor. Deve falhar com a mensagem de erro clara sobre a variável ausente.

**Teste com a variável:**
Restaure o `GOOGLE_CALENDAR_ID` e o servidor deve subir normalmente.

```bash
grep -n "gmail.com\|@.*\.com" src/services/CalendarService.ts
```
Nenhum email deve aparecer hardcoded no arquivo após a correção.

```bash
npm run build
```
Deve compilar sem erros.
