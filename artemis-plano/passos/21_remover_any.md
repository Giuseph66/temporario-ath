# Passo 21 — Melhorar Tipagem TypeScript (Remover `any`)

## Contexto do Projeto
O Artemis Bot está em `/home/jesus/Neurelix/Artemis-Bot`. O projeto usa TypeScript, mas há usos de `any` que desativam a verificação de tipos. Isso esconde bugs que só aparecem em produção.

## O que Fazer

**1. Liste todas as ocorrências de `any`**
```bash
grep -rn ": any\|as any\|any\[\]" src/
```
Anote cada arquivo e linha.

**2. Leia os tipos existentes**
Abra e leia:
- `src/types/user.ts` — tipos de usuário e estado FSM
- `src/types/config.ts` — tipos de configuração JSON

Esses arquivos definem os tipos centrais do projeto.

**3. Corrija os `any` por prioridade**

**Prioridade alta — `src/services/StateService.ts`:**
- O retorno da sessão do usuário provavelmente é tipado como `any`. Substitua pelo tipo `UserProfile` ou equivalente de `src/types/user.ts`.
- Exemplo:
  ```typescript
  // Antes:
  async getSession(phone: string): Promise<any> {
  
  // Depois:
  async getSession(phone: string): Promise<UserProfile | null> {
  ```

**Prioridade alta — `src/flow/StateResolver.ts`:**
- Parâmetros de entrada que são `any` devem ser tipados com `UserProfile` ou o tipo correto de sessão.

**Prioridade média — `src/services/AIService.ts`:**
- Resultados de chamadas de ferramentas (tool calls) podem estar tipados como `any`. Crie um tipo ou interface para o resultado de cada ferramenta:
  ```typescript
  interface ToolCallResult {
    success: boolean;
    message?: string;
    data?: unknown;
  }
  ```

**4. Use tipos do Prisma Client onde necessário**
O Prisma gera tipos automaticamente. Para tipos de retorno de queries, use:
```typescript
import type { User, ChatHistory } from '@prisma/client';
```

**5. Para `any` difícil de tipar, use `unknown` em vez de `any`**
`unknown` é mais seguro que `any` porque força verificação de tipo antes de usar:
```typescript
// Melhor que any:
function processarDados(dados: unknown): void {
  if (typeof dados === 'object' && dados !== null) {
    // agora pode acessar com segurança
  }
}
```

## Verificação
```bash
grep -rn ": any\b\|as any\b" src/
```
O número de resultados deve ser significativamente menor (ou zero).

```bash
npm run build
```
Deve compilar sem erros. Se novos erros de tipo aparecerem após remover `any`, eles estavam escondidos antes — corrija-os.
