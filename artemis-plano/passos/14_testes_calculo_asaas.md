# Passo 14 — Testes de Cálculo de Pagamento Asaas

## Contexto do Projeto
O Artemis Bot está em `/home/jesus/Neurelix/Artemis-Bot`. Quando um aluno quer se matricular, o bot calcula o valor total do pacote (com desconto para semestral ou anual) e gera uma cobrança no Asaas. Um erro de cálculo resulta em cobrança errada para o aluno.

**Este passo deve ser executado depois do Passo 10** (configuração do Vitest).

## O que Fazer

**1. Leia os arquivos de negócio**
Abra e leia completamente:
- `src/services/AIService.ts` — onde provavelmente está a lógica de cálculo antes de chamar o Asaas
- `src/services/AsaasService.ts` — onde a cobrança é gerada
- `config/programs.json` — para ver os preços base de cada programa

**2. Identifique onde o cálculo está**
Procure pela lógica que transforma `preço_mensal × meses` em valor total com desconto. Ela provavelmente está em `AIService.ts` dentro do método que processa a tool call `generate_payment`. A lógica de desconto é:
- Mensal: sem desconto
- Semestral (6 meses): 5% de desconto no total
- Anual (12 meses): 7% de desconto no total
- Pagamento adiantado (1 mês antes): 2% de bônus adicional

**3. Extraia a lógica de cálculo para uma função pura (se necessário)**
Se o cálculo estiver embutido dentro de um método grande com dependências externas, extraia para uma função pura em `src/utils/paymentCalculator.ts`:

```typescript
export function calculatePaymentTotal(
  pricePerMonth: number,
  months: number
): { total: number; discount: number } {
  if (months === 1) {
    return { total: pricePerMonth, discount: 0 };
  }
  const baseTotal = pricePerMonth * months;
  const discountRate = months >= 12 ? 0.07 : months >= 6 ? 0.05 : 0;
  const discount = baseTotal * discountRate;
  return { total: baseTotal - discount, discount };
}
```
Adapte conforme a lógica real que você encontrou no código.

**4. Crie o arquivo de teste**
Crie `src/__tests__/paymentCalculations.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
// Importe a função real — seja de paymentCalculator, AIService ou AsaasService
// conforme onde a lógica está depois do passo anterior

describe('Cálculos de pagamento', () => {

  describe('Inglês Personalizado Individual (R$550/mês)', () => {
    it('mensal: sem desconto', () => {
      // 1 × 550 = 550
    });

    it('semestral (6 meses): 5% de desconto', () => {
      // 6 × 550 = 3.300 → com 5% = 3.135
    });

    it('anual (12 meses): 7% de desconto', () => {
      // 12 × 550 = 6.600 → com 7% = 6.138
    });
  });

  describe('Tech Lab Individual (R$770/mês)', () => {
    it('semestral (6 meses): 5% de desconto', () => {
      // 6 × 770 = 4.620 → com 5% = 4.389
    });

    it('anual (12 meses): 7% de desconto', () => {
      // 12 × 770 = 9.240 → com 7% = 8.593,20
    });
  });

  describe('Inglês Personalizado em Dupla (R$410/mês)', () => {
    it('semestral (6 meses): 5% de desconto', () => {
      // 6 × 410 = 2.460 → com 5% = 2.337
    });
  });

  describe('Terapia PRM (R$315/sessão — sem desconto)', () => {
    it('sessão avulsa: sem desconto', () => {
      // 1 × 315 = 315
    });
  });

});
```

**Adapte os valores** de acordo com a lógica real encontrada no código. Se a lógica de desconto for diferente da descrita acima, escreva os testes de acordo com o comportamento real.

## Verificação
```bash
npm test
```
Todos os cálculos devem estar corretos. Se algum valor não bater, revise se a lógica no código está implementando os descontos corretamente conforme o `config/programs.json` e o `config/persona.json` (seção `bonuses`).
