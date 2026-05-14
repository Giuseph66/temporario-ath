import { describe, it, expect } from 'vitest';

// Lógica de cálculo extraída do AIService.ts (executeToolCall → generate_payment)
function calcularValorFinal(
    amount: number,
    installmentCount: number,
    paymentType: 'monthly' | 'semester' | 'annual'
): { finalAmount: number; finalInstallments: number } {
    let finalAmount = amount;
    let finalInstallments = installmentCount;

    if (paymentType === 'semester') {
        finalAmount = amount * (installmentCount) * 0.95;
        finalInstallments = 1;
    } else if (paymentType === 'annual') {
        finalAmount = amount * 12 * 0.93;
        finalInstallments = 1;
    }

    finalAmount = Math.round(finalAmount * 100) / 100;
    return { finalAmount, finalInstallments };
}

describe('Cálculo de pagamento Asaas', () => {
    describe('Inglês Personalizado Individual (R$550/mês)', () => {
        it('mensal: sem desconto, 6 parcelas', () => {
            const { finalAmount, finalInstallments } = calcularValorFinal(550, 6, 'monthly');
            expect(finalAmount).toBe(550);
            expect(finalInstallments).toBe(6);
        });

        it('semestral: 6 × R$550 com 5% desc = R$3.135', () => {
            const { finalAmount, finalInstallments } = calcularValorFinal(550, 6, 'semester');
            expect(finalAmount).toBe(3135);
            expect(finalInstallments).toBe(1);
        });

        it('anual: 12 × R$550 com 7% desc = R$6.138', () => {
            const { finalAmount, finalInstallments } = calcularValorFinal(550, 12, 'annual');
            expect(finalAmount).toBe(6138);
            expect(finalInstallments).toBe(1);
        });
    });

    describe('Tech Lab Individual (R$770/mês)', () => {
        it('semestral: 6 × R$770 com 5% desc = R$4.389', () => {
            const { finalAmount } = calcularValorFinal(770, 6, 'semester');
            expect(finalAmount).toBe(4389);
        });

        it('anual: 12 × R$770 com 7% desc = R$8.593,20', () => {
            const { finalAmount } = calcularValorFinal(770, 12, 'annual');
            expect(finalAmount).toBe(8593.20);
        });
    });

    it('arredondamento correto para 2 casas decimais', () => {
        // R$ 100 × 6 × 0.95 = 570.00 — sem arredondamento problemático
        const { finalAmount } = calcularValorFinal(100, 6, 'semester');
        expect(finalAmount).toBe(570);
        // verify it's a number with at most 2 decimal places
        expect(Number.isFinite(finalAmount)).toBe(true);
        const decimalPart = (finalAmount * 100) % 1;
        expect(decimalPart).toBeCloseTo(0);
    });

    it('pagamento mensal não aplica desconto', () => {
        const { finalAmount } = calcularValorFinal(410, 6, 'monthly');
        expect(finalAmount).toBe(410); // valor base sem desconto
    });
});
