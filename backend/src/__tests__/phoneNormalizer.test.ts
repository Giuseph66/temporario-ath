import { describe, it, expect } from 'vitest';
import { normalizeBrazilianPhone } from '../utils/phoneNormalizer';

describe('normalizeBrazilianPhone', () => {
    it('número 13 dígitos retornado sem modificação', () => {
        expect(normalizeBrazilianPhone('5566999999999')).toBe('5566999999999');
    });

    it('número 12 dígitos recebe o 9 na posição correta', () => {
        expect(normalizeBrazilianPhone('556699999999')).toBe('5566999999999');
        // wait — 12 digits = 55 + DDD(2) + 8 digits; insert 9 after DDD
        expect(normalizeBrazilianPhone('5554996600588')).toBe('5554996600588'); // já tem 13
    });

    it('número sem DDI recebe 55 automaticamente', () => {
        expect(normalizeBrazilianPhone('66999999999')).toBe('5566999999999');
    });

    it('número sem DDI e 10 dígitos recebe 55 e o 9', () => {
        // 10 digits: DDD(2) + 8-digit = 6699999999 → +55 → 556699999999 (12) → insert 9 → 5566999999999
        expect(normalizeBrazilianPhone('6699999999')).toBe('5566999999999');
    });

    it('DDD 54 preservado corretamente', () => {
        expect(normalizeBrazilianPhone('5554996600588')).toBe('5554996600588');
    });

    it('número com formatação (parênteses, hífen) é normalizado', () => {
        expect(normalizeBrazilianPhone('55 (66) 9-9999-9999')).toBe('5566999999999');
    });

    it('número já com 13 dígitos e DDI não é alterado', () => {
        const input = '5565999887766';
        expect(normalizeBrazilianPhone(input)).toBe('5565999887766');
    });
});
