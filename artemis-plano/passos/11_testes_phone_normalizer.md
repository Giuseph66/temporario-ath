# Passo 11 — Testes do phoneNormalizer

## Contexto do Projeto
O Artemis Bot está em `/home/jesus/Neurelix/Artemis-Bot`. O arquivo `src/utils/phoneNormalizer.ts` normaliza números de telefone brasileiros. Essa função é crítica porque o identificador único de cada usuário no banco é o número de telefone normalizado — se normalizar errado, o mesmo usuário pode ter dois registros diferentes.

**Este passo deve ser executado depois do Passo 10** (configuração do Vitest).

## O que Fazer

**1. Leia o arquivo a ser testado**
Abra e leia `src/utils/phoneNormalizer.ts` na íntegra para entender:
- O nome da função exportada
- Os parâmetros que ela aceita
- O que ela retorna

**2. Crie o arquivo de teste**
Crie `src/__tests__/phoneNormalizer.test.ts`.

**3. Escreva os testes baseados no comportamento real do arquivo**
Importe a função e escreva testes para cada cenário abaixo. Adapte os valores esperados de acordo com o comportamento real que você leu no arquivo:

```typescript
import { describe, it, expect } from 'vitest';
import { normalizePhoneNumber } from '../utils/phoneNormalizer'; // ajuste o nome da função se necessário

describe('phoneNormalizer', () => {

  it('número com 13 dígitos (com nono dígito) deve ser retornado sem alteração', () => {
    expect(normalizePhoneNumber('5566999998888')).toBe('5566999998888');
  });

  it('número com 12 dígitos (sem nono dígito) deve receber o 9 na posição correta', () => {
    // 55 (país) + 66 (DDD) + 99998888 (número sem 9) = 5566999998888
    expect(normalizePhoneNumber('556699998888')).toBe('5566999998888');
  });

  it('deve preservar o código de país 55', () => {
    const result = normalizePhoneNumber('5511987654321');
    expect(result.startsWith('55')).toBe(true);
  });

  it('deve preservar o DDD corretamente', () => {
    const result = normalizePhoneNumber('5566987654321');
    expect(result.slice(2, 4)).toBe('66');
  });

  it('número de SP (DDD 11) com 12 dígitos deve ser normalizado', () => {
    expect(normalizePhoneNumber('551198765432')).toBe('5511998765432');
  });

});
```

**Importante:** Leia a função original antes de escrever os testes. Se o comportamento real for diferente do descrito aqui, escreva os testes de acordo com o comportamento **real** da função, não com o comportamento descrito neste guia. O objetivo é documentar o que a função faz, não o que deveria fazer.

## Verificação
```bash
npm test
```
Todos os testes do `phoneNormalizer.test.ts` devem passar. Se algum falhar, revise se os valores esperados nos testes correspondem ao comportamento real da função.
