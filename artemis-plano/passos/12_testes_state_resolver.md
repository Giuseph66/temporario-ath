# Passo 12 — Testes do StateResolver (FSM)

## Contexto do Projeto
O Artemis Bot está em `/home/jesus/Neurelix/Artemis-Bot`. O arquivo `src/flow/StateResolver.ts` é o cérebro da conversa: ele decide em qual estado FSM o usuário está e detecta gatilhos de transferência (DELETION, MENTAL_HEALTH, HOSTILE, SOFT). Qualquer bug aqui faz o funil de vendas ir para o estado errado.

**Este passo deve ser executado depois do Passo 10** (configuração do Vitest).

## O que Fazer

**1. Leia os arquivos necessários**
Abra e leia completamente:
- `src/flow/StateResolver.ts`
- `src/types/user.ts` (para entender os estados e tipos)

**2. Crie o arquivo de teste**
Crie `src/__tests__/StateResolver.test.ts`.

**3. Mock das dependências externas**
O `StateResolver` provavelmente acessa o banco de dados (Prisma) ou outros serviços. Use `vi.mock` para substituir essas dependências por versões falsas:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vi } from 'vitest';

// Mock do Prisma para não acessar banco real durante testes
vi.mock('../utils/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    chatHistory: {
      findMany: vi.fn(),
    },
  },
}));
```

**4. Escreva os testes para detecção de gatilhos**
Esta é a parte mais importante. Leia a lista de triggers no `StateResolver.ts` e escreva testes para cada tipo:

```typescript
describe('Detecção de gatilhos de transferência', () => {

  describe('Gatilho DELETION', () => {
    it('deve detectar pedido de exclusão de dados', () => {
      // Use as frases reais que estão na lista do StateResolver
      // Ex: 'quero apagar meus dados', 'deletar minha conta', etc.
    });
  });

  describe('Gatilho MENTAL_HEALTH', () => {
    it('deve detectar expressão de sofrimento psicológico', () => {
      // Use as frases reais da lista
    });

    it('NÃO deve disparar para conversa comum sobre psicologia/terapia sem sofrimento', () => {
      // Teste de falso positivo
    });
  });

  describe('Gatilho HOSTILE', () => {
    it('deve detectar linguagem hostil ou abusiva', () => {
      // Use as frases reais da lista
    });
  });

  describe('Gatilho SOFT', () => {
    it('deve detectar pedido para falar com humano', () => {
      // Use as frases reais da lista como 'quero falar com a Dayana'
    });

    it('NÃO deve disparar para o nome "Dayana" em contexto normal', () => {
      // Proteção contra falso positivo específica do projeto
      // Ex: 'a Dayana é boa professora' não deve disparar handoff
    });
  });

});
```

**Importante:** As frases exatas dos gatilhos estão no `StateResolver.ts`. Leia-as e use-as nos testes. Não invente frases — teste as que realmente estão no código.

**5. Escreva testes para as transições de estado FSM**
Baseie-se no que você leu no `StateResolver.ts` sobre como ele decide o estado:

```typescript
describe('Transições de estado FSM', () => {

  it('usuário sem lgpdConsent deve permanecer em GREETING', () => {
    // Monte um perfil de usuário sem consentimento
    // Chame o StateResolver
    // Espere estado GREETING
  });

  it('usuário com consentimento mas sem nome/idade deve estar em QUALIFICATION', () => {
    // Monte perfil com lgpdConsent: true mas sem name/age
    // Espere estado QUALIFICATION
  });

  // Continue para os demais estados conforme a lógica real do StateResolver
});
```

## Verificação
```bash
npm test
```
Todos os testes devem passar. Se um gatilho não for detectado corretamente, revise se a frase de teste está exatamente como a que está no código.
