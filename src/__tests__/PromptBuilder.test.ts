import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, PromptContext } from '../services/PromptBuilder';
import { configLoader } from '../services/ConfigLoader';

const config = configLoader.getConfig();

function makeCtx(state: PromptContext['state'], overrides: Partial<PromptContext['userProfile']> = {}): PromptContext {
    return {
        state,
        config,
        userProfile: {
            name: null,
            age: null,
            goal: null,
            enrollmentTarget: null,
            currentProgramId: null,
            lastPaymentUrl: null,
            cpf: null,
            email: null,
            birthDate: null,
            address: null,
            extraInfo: null,
            paymentDay: null,
            ...overrides,
        },
    };
}

describe('PromptBuilder — blocos por estado', () => {
    it('GREETING: contém bloco LGPD', () => {
        const prompt = buildSystemPrompt(makeCtx('GREETING'));
        expect(prompt).toContain('LGPD');
    });

    it('GREETING: não contém preços', () => {
        const prompt = buildSystemPrompt(makeCtx('GREETING'));
        expect(prompt).not.toContain('R$');
    });

    it('QUALIFICATION: contém instrução de coleta de dados', () => {
        const prompt = buildSystemPrompt(makeCtx('QUALIFICATION'));
        expect(prompt).toContain('QUALIFICATION');
    });

    it('QUALIFICATION: não contém preços', () => {
        const prompt = buildSystemPrompt(makeCtx('QUALIFICATION'));
        expect(prompt).not.toContain('R$');
    });

    it('PROGRAM_PRESENTATION: gerado sem crash', () => {
        const ctx = makeCtx('PROGRAM_PRESENTATION', {
            name: 'João', age: 20, goal: 'inglês', enrollmentTarget: 'para mim',
        });
        const prompt = buildSystemPrompt(ctx);
        expect(typeof prompt).toBe('string');
        expect(prompt.length).toBeGreaterThan(0);
    });

    it('CLOSING: gerado sem crash', () => {
        const ctx = makeCtx('CLOSING', {
            name: 'Ana', age: 22, goal: 'inglês', enrollmentTarget: 'para mim',
            currentProgramId: 'ingles_personalizado',
        });
        const prompt = buildSystemPrompt(ctx);
        expect(typeof prompt).toBe('string');
        expect(prompt.length).toBeGreaterThan(0);
    });

    it('HUMAN_HANDOFF: gerado sem crash (retorna string vazia ou mínima)', () => {
        const prompt = buildSystemPrompt(makeCtx('HUMAN_HANDOFF'));
        expect(typeof prompt).toBe('string');
    });

    it('identity block presente em todos os estados', () => {
        const states: PromptContext['state'][] = [
            'GREETING', 'QUALIFICATION', 'PROGRAM_PRESENTATION',
            'OBJECTION_HANDLING', 'CLOSING', 'HUMAN_HANDOFF'
        ];
        for (const state of states) {
            const prompt = buildSystemPrompt(makeCtx(state));
            expect(prompt).toContain('Artemis');
        }
    });
});
