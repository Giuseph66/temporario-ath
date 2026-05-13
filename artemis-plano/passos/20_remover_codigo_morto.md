# Passo 20 — Remover Código Morto e Padronizar Comentários

## Contexto do Projeto
O Artemis Bot está em `/home/jesus/Neurelix/Artemis-Bot`. Durante o desenvolvimento rápido, código foi deixado para trás: variáveis declaradas mas não usadas, importações sem uso, instâncias de serviços criadas mas nunca chamadas. Isso polui o código e confunde quem vai manter.

## O que Fazer

**1. Execute o build TypeScript para revelar warnings**
```bash
npm run build 2>&1 | grep -i "declared but never\|is defined but never used\|unused"
```
Anote todos os warnings de variáveis ou importações não usadas.

**2. Verifique `ALL_TOOLS` em `src/services/AIService.ts`**
Abra o arquivo e procure por uma constante ou array chamado `ALL_TOOLS`. Se existir e não for referenciado em nenhum outro lugar do arquivo, remova a declaração.

**3. Verifique instância não usada de `WhatsAppService` em `src/services/AIService.ts`**
Procure por uma linha como:
```typescript
const whatsapp = new WhatsAppService();
// ou
private whatsapp: WhatsAppService;
```
Se essa instância for criada mas nunca chamada dentro do arquivo, remova a declaração e o import correspondente (se o import não for usado em mais nada).

**4. Procure por outros padrões de código morto**
```bash
grep -rn "TODO\|FIXME\|HACK\|XXX\|console\.log.*debug\|console\.log.*teste" src/
```
Para cada `TODO` ou `FIXME` encontrado, avalie se a tarefa ainda é relevante. Se não for, remova o comentário. Se for, mantenha.

**5. Padronize o idioma dos comentários**
O projeto usa principalmente português. Procure por comentários em inglês:
```bash
grep -rn "// [A-Z]" src/ | grep -v "TODO\|FIXME\|NOTE"
```
Converta comentários técnicos em inglês para português onde fizer sentido. Não é necessário traduzir nomes de variáveis ou tipos — apenas comentários explicativos.

**6. Remova linhas de `console.log` de debug**
Procure por logs que claramente são de debug temporário:
```bash
grep -rn "console\.log.*test\|console\.log.*debug\|console\.log.*aqui\|console\.log.*ok\b" src/
```
Remova os que são claramente temporários. Mantenha os que têm valor operacional real (ex: `[Asaas] Evento recebido: ...`).

## Verificação
```bash
npm run build 2>&1 | grep -c "warning"
```
O número de warnings deve ser zero ou menor que antes.

```bash
grep -rn "ALL_TOOLS" src/
```
Se existia e foi removido, não deve retornar nada.

```bash
npm run build
```
Deve compilar sem erros.
