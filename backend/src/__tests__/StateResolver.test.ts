import { describe, it, expect } from 'vitest';
import { resolveState } from '../flow/StateResolver';

function makeSession(overrides: Record<string, unknown> = {}) {
    return {
        conversationState: 'GREETING',
        interactionCount: 2,
        name: null,
        age: null,
        goal: null,
        enrollmentTarget: null,
        ...overrides,
    };
}

describe('resolveState — estados FSM', () => {
    it('usuário novo (interactionCount <= 1) → GREETING', () => {
        const result = resolveState(makeSession({ interactionCount: 1 }), 'oi');
        expect(result.state).toBe('GREETING');
    });

    it('perfil incompleto → QUALIFICATION', () => {
        const result = resolveState(makeSession(), 'tenho 20 anos');
        expect(result.state).toBe('QUALIFICATION');
    });

    it('perfil completo → PROGRAM_PRESENTATION', () => {
        const session = makeSession({
            name: 'João',
            age: 20,
            goal: 'aprender inglês',
            enrollmentTarget: 'para mim',
        });
        const result = resolveState(session, 'ok');
        expect(result.state).toBe('PROGRAM_PRESENTATION');
    });

    it('perfil completo + sinal de compra em PROGRAM_PRESENTATION → CLOSING', () => {
        const session = makeSession({
            name: 'João',
            age: 20,
            goal: 'aprender inglês',
            enrollmentTarget: 'para mim',
            conversationState: 'PROGRAM_PRESENTATION',
        });
        const result = resolveState(session, 'quero me inscrever');
        expect(result.state).toBe('CLOSING');
    });

    it('objeção após apresentação → OBJECTION_HANDLING', () => {
        const session = makeSession({
            name: 'Maria',
            age: 18,
            goal: 'inglês',
            enrollmentTarget: 'para mim',
            conversationState: 'PROGRAM_PRESENTATION',
        });
        const result = resolveState(session, 'muito caro, vou pensar');
        expect(result.state).toBe('OBJECTION_HANDLING');
    });
});

describe('resolveState — gatilhos de transferência', () => {
    it('pedido de exclusão LGPD → HUMAN_HANDOFF (DELETION)', () => {
        // trigger: "apaga meus dados" (sem 'r') — exato substring
        const result = resolveState(makeSession(), 'por favor apaga meus dados');
        expect(result.state).toBe('HUMAN_HANDOFF');
        expect(result.handoffType).toBe('DELETION');
    });

    it('saúde mental → HUMAN_HANDOFF (MENTAL_HEALTH)', () => {
        const result = resolveState(makeSession(), 'não consigo mais, vontade de morrer');
        expect(result.state).toBe('HUMAN_HANDOFF');
        expect(result.handoffType).toBe('MENTAL_HEALTH');
    });

    it('mensagem hostil → HUMAN_HANDOFF (HOSTILE)', () => {
        const result = resolveState(makeSession(), 'que absurdo, me largem');
        expect(result.state).toBe('HUMAN_HANDOFF');
        expect(result.handoffType).toBe('HOSTILE');
    });

    it('solicitação de humano → HUMAN_HANDOFF (SOFT)', () => {
        const result = resolveState(makeSession(), 'quero falar com a dayana');
        expect(result.state).toBe('HUMAN_HANDOFF');
        expect(result.handoffType).toBe('SOFT');
    });

    it('falso positivo: nome "Dayana" em saudação curta não dispara SOFT', () => {
        const session = makeSession({
            name: 'Dayana',
            conversationState: 'GREETING',
        });
        const result = resolveState(session, 'dayana');
        expect(result.state).not.toBe('HUMAN_HANDOFF');
    });
});
