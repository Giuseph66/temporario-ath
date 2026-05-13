# Passo 09 — Remover Logs com Dados Pessoais

## Contexto do Projeto
O Artemis Bot está em `/home/jesus/Neurelix/Artemis-Bot`. Ele processa dados pessoais de alunos: CPF, email, endereço, data de nascimento, telefone. A LGPD exige que esses dados não sejam expostos desnecessariamente. Logs de servidor são frequentemente armazenados e podem ser acessados por pessoas não autorizadas.

## Problema
O `src/controllers/RespondiController.ts` loga o payload bruto do formulário Respondi, que contém CPF, email, endereço e data de nascimento. Outros arquivos podem ter problemas similares.

## O que Fazer

**1. Audite `src/controllers/RespondiController.ts`**
Leia o arquivo completo. Procure por qualquer `console.log` que imprima:
- `req.body` (payload completo)
- `cpf`, `email`, `address`, `birthDate`, `nome` completo
- Qualquer variável que possa conter esses dados

**2. Substitua os logs problemáticos**
Para cada log que imprime dados sensíveis, substitua por uma versão que loga apenas metadados:
```typescript
// ERRADO — não fazer:
console.log('[Respondi] Payload recebido:', req.body);
console.log('[Respondi] CPF:', cpf);

// CORRETO — fazer assim:
console.log(`[Respondi] Webhook recebido. Campos presentes: ${Object.keys(dadosExtraidos).join(', ')}`);
```

Se precisar logar o telefone para debug, mascare parcialmente:
```typescript
const telMascarado = telefone ? `${telefone.slice(0, 4)}****${telefone.slice(-2)}` : 'ausente';
console.log(`[Respondi] Telefone recebido: ${telMascarado}`);
```

**3. Audite `src/services/AIService.ts`**
Leia o arquivo completo. Procure por logs que imprimam o conteúdo de mensagens do usuário, perfil completo, ou dados de pagamento. Substitua por logs de metadados (ex: `[AIService] Processando mensagem do usuário ID: ${userId}`).

**4. Audite `src/controllers/AsaasWebhookController.ts`**
Procure por logs que imprimam `req.body` completo ou dados de pagamento com informações de cliente. Substitua por logs como:
```typescript
console.log(`[Asaas] Evento recebido: ${req.body.event} para payment ID: ${req.body.payment?.id}`);
```

**5. Regra geral a aplicar em todos os arquivos**
- **PODE logar:** ID de usuário, tipo de evento, campos presentes (sem valores), status de operação, timestamps
- **NÃO PODE logar:** CPF, email, endereço, data de nascimento, nome completo, conteúdo de mensagens, número de telefone completo

## Verificação
Execute uma busca pelos padrões mais críticos:
```bash
grep -rn "req\.body\b" src/controllers/
grep -rn "console\.log.*cpf\|console\.log.*email\|console\.log.*address" src/
```
Qualquer resultado que imprima o valor (não apenas verificar se existe) deve ser revisado.

```bash
npm run build
```
Deve compilar sem erros.
