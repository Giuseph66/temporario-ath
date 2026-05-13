# Passo 10 — Configurar Framework de Testes (Vitest)

## Contexto do Projeto
O Artemis Bot está em `/home/jesus/Neurelix/Artemis-Bot`. Atualmente **não existe nenhum teste automatizado** no projeto. Os Passos 11 a 15 adicionarão testes para as partes críticas. Este passo instala e configura o Vitest, que é o framework de testes que será usado.

## O que Fazer

**1. Instale o Vitest**
No terminal dentro de `/home/jesus/Neurelix/Artemis-Bot`:
```bash
npm install --save-dev vitest @vitest/coverage-v8
```

**2. Leia o `package.json` atual**
Abra e leia `package.json` para ver os scripts existentes.

**3. Adicione os scripts de teste ao `package.json`**
Na seção `"scripts"`, adicione:
```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```
Mantenha todos os scripts existentes intactos.

**4. Crie o arquivo de configuração do Vitest**
Crie o arquivo `vitest.config.ts` na raiz do projeto com:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

**5. Crie o diretório de testes**
Crie o diretório `src/__tests__/` — é onde todos os arquivos de teste ficarão.

**6. Crie um teste básico de sanidade**
Crie o arquivo `src/__tests__/sanity.test.ts` com:
```typescript
import { describe, it, expect } from 'vitest';

describe('Sanidade do ambiente de testes', () => {
  it('deve executar um teste simples', () => {
    expect(1 + 1).toBe(2);
  });
});
```

## Verificação
Execute os testes:
```bash
npm test
```
Deve imprimir algo como:
```
✓ src/__tests__/sanity.test.ts (1)
  ✓ Sanidade do ambiente de testes > deve executar um teste simples

Test Files  1 passed (1)
Tests       1 passed (1)
```

```bash
npm run build
```
Deve compilar sem erros.
