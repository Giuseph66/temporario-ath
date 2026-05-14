import { ConversationState } from '../types/user';

// ─────────────────────────────────────────────────────────────────────────────
// Trigger lists — scan the incoming message in lowercase
// ─────────────────────────────────────────────────────────────────────────────

/**
 * TIER 0 — LGPD Art. 18: Explicit data deletion requests.
 * Triggers HUMAN_HANDOFF (DELETION) — data is permanently erased.
 * Higher priority than HOSTILE so deletion is always honoured.
 */
const DELETION_TRIGGERS = [
    'apaga meus dados', 'apague meus dados', 'deletar meus dados', 'delete meus dados',
    'excluir meus dados', 'exclua meus dados', 'remover meus dados', 'remova meus dados',
    'quero ser removido', 'quero ser removida', 'direito ao esquecimento',
    'cancela meu cadastro', 'cancele meu cadastro', 'me tira do sistema',
    'não quero mais meus dados', 'opt-out', 'lgpd remover',
];

/**
 * TIER 1 — Extreme escalation: hostile, aggressive, or explicit stop demands.
 * Triggers HUMAN_HANDOFF (HOSTILE) from ANY current state.
 */
const HOSTILE_TRIGGERS = [
    // Portuguese stop/leave demands
    'para de me mandar mensagem', 'parem de me mandar', 'não me manda mais', 'não me mande mais',
    'me tira dessa lista', 'cancelem',
    // Anger / frustration
    'raiva', 'irritado', 'irritada', 'absurdo', 'ridículo', 'ridícula',
    'não acredito', 'que coisa', 'me largem', 'parem', 'chega',
    // Complaint / legal words
    'reclamar', 'reclamação', 'denúncia', 'denunciar', 'processando', 'processo',
    // Explicit profanity (covers common variations)
    'idiota', 'burro', 'burra', 'incompetente', 'lixo',
];

/**
 * TIER 1.5 — Mental health crisis: sensitive data that must NOT be stored.
 * Routes immediately to HUMAN_HANDOFF (MENTAL_HEALTH) without AI processing.
 * LGPD Art. 11 — dados de saúde são dados sensíveis e não podem ser tratados pela IA.
 */
const MENTAL_HEALTH_TRIGGERS = [
    // Crise / suicídio
    'suicídio', 'suicidar', 'me matar', 'quero morrer', 'vontade de morrer',
    'não quero mais viver', 'acabar com tudo', 'me machucar',
    // Saúde mental severa
    'depressão profunda', 'crise de ansiedade', 'ataque de pânico', 'burnout severo',
    'colapso emocional', 'transtorno', 'surto', 'me sinto muito mal',
    'não consigo mais', 'estou destruído', 'estou destruída',
];

/**
 * TIER 2 — Soft human-request: user prefers a human but isn't hostile.
 * Triggers HUMAN_HANDOFF (SOFT) from any state.
 */
const HUMAN_HANDOFF_TRIGGERS = [
    'falar com humano', 'falar com atendente', 'atendente', 'pessoa real',
    'falar com alguém', 'falar com a dayana', 'quero falar com você',
    'quero a dayana', 'cadê a dayana', 'chama a dayana', 'passa pra dayana',
    'quero um humano', 'preciso de um humano',
    'me liga', 'ligar', 'ligação', 'quero ligar',
];

/**
 * Objection signals — user is hesitating.
 */
const OBJECTION_TRIGGERS = [
    'vou pensar', 'depois', 'não tenho dinheiro', 'muito caro', 'não tenho tempo',
    'vi mais barato', 'preciso pensar', 'não sei', 'talvez', 'deixa eu ver',
    'não tenho certeza', 'tô na dúvida', 'estou na dúvida',
];

/**
 * Buying signals — user is ready to commit.
 */
const BUYING_SIGNAL_TRIGGERS = [
    // Direct buying intent
    'sim', 'quero', 'pode enviar', 'claro', 'quero saber mais',
    'tenho interesse', 'quero me inscrever', 'quero matricular',
    'vou fechar', 'como faço para me matricular', 'vou me inscrever',
    'me inscrevo', 'bora', 'vamos', 'pode mandar o link',
    // Positive reception / acceptance of program
    'gostei', 'adorei', 'perfeito', 'encaixa', 'fechou', 'combinado',
    'é isso mesmo', 'é isso aí', 'me convenceu',
    // Scheduling intent (implies user accepted and wants to proceed)
    'agendar', 'marcar aula', 'marcar horário',
    'qual horário', 'quais horários', 'horários disponíveis',
    'qualquer dia', 'qualquer horário',
    'pode ser às', 'pode ser no', 'pode ser na',
    'de manhã', 'de tarde', 'à tarde', 'à noite',
    'período da manhã', 'período da tarde',
];

// ─────────────────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────────────────

function matches(msg: string, triggers: string[]): boolean {
    return triggers.some(t => msg.includes(t));
}

// ─────────────────────────────────────────────────────────────────────────────
// Return type
// ─────────────────────────────────────────────────────────────────────────────

export interface StateResolution {
    state: ConversationState;
    /**
     * Only present when state === 'HUMAN_HANDOFF'.
     * 'HOSTILE'       means an aggressive/stop trigger fired → send link immediately.
     * 'SOFT'          means the user politely requested a human → ask consent first.
     * 'MENTAL_HEALTH' means sensitive health data detected → route to human, do NOT store data.
     * 'DELETION'      means explicit LGPD deletion request → delete all data immediately.
     */
    handoffType?: 'HOSTILE' | 'SOFT' | 'MENTAL_HEALTH' | 'DELETION';
}

// ─────────────────────────────────────────────────────────────────────────────
// Main resolver
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evaluates the incoming message and current session to determine the next
 * ConversationState that should be saved to the database, plus the handoff
 * type when applicable.
 *
 * NOTE: This function must be called AFTER profile extraction so that
 * session.name / session.age / session.goal are already up to date.
 */
export function resolveState(session: any, incomingMessage: string): StateResolution {
    const msg = incomingMessage.toLowerCase();
    const currentState = session.conversationState as ConversationState;

    // ── STEP 1: Emergency escalation override (highest priority) ──────────────

    // LGPD Art. 18 — Pedido explícito de exclusão de dados (maior prioridade)
    if (matches(msg, DELETION_TRIGGERS)) {
        console.log('🗑️ [StateResolver] Pedido de exclusão LGPD detectado → HUMAN_HANDOFF (DELETION)');
        return { state: 'HUMAN_HANDOFF', handoffType: 'DELETION' };
    }

    // Mental health crisis — LGPD Art. 11 — dados sensíveis de saúde → não tratar com IA
    if (matches(msg, MENTAL_HEALTH_TRIGGERS)) {
        console.log('🏥 [StateResolver] Conteúdo de saúde mental detectado → HUMAN_HANDOFF (MENTAL_HEALTH)');
        return { state: 'HUMAN_HANDOFF', handoffType: 'MENTAL_HEALTH' };
    }

    // Hostile or explicit stop demands → unconditional HUMAN_HANDOFF (HOSTILE)
    if (matches(msg, HOSTILE_TRIGGERS)) {
        console.log('🚨 [StateResolver] Trigger hostil detectado → HUMAN_HANDOFF (HOSTILE)');
        return { state: 'HUMAN_HANDOFF', handoffType: 'HOSTILE' };
    }

    // Soft human-request (e.g., "quero falar com a Dayana") → HUMAN_HANDOFF (SOFT)
    // Guard: If the user's name contains "dayana" and the message is short (likely just
    // answering "what's your name?"), skip handoff to avoid false positives.
    if (matches(msg, HUMAN_HANDOFF_TRIGGERS)) {
        const userName = (session.name || '').toLowerCase();
        const isNameDayana = userName.includes('dayana') || msg.trim().toLowerCase() === 'dayana';
        const isShortMessage = msg.trim().split(/\s+/).length <= 4;
        const isQualificationOrGreeting = currentState === 'QUALIFICATION' || currentState === 'GREETING';

        // If the user IS named Dayana (or the message is just "Dayana" as a name answer)
        // and it's a short message during qualification/greeting, skip handoff
        if (isNameDayana && isShortMessage && isQualificationOrGreeting) {
            console.log('🤝 [StateResolver] Mensagem contém trigger de handoff, mas o usuário se chama Dayana — ignorando falso positivo.');
        } else {
            console.log('🤝 [StateResolver] Solicitação de humano detectada → HUMAN_HANDOFF (SOFT)');
            return { state: 'HUMAN_HANDOFF', handoffType: 'SOFT' };
        }
    }

    // ── STEP 2: Very first interaction → always greet ─────────────────────────
    if (session.interactionCount <= 1) {
        return { state: 'GREETING' };
    }

    // ── STEP 3: Profile completeness check ───────────────────────────────────
    const profileComplete = !!(session.name && session.age && session.goal && session.enrollmentTarget);

    if (profileComplete) {
        // Buying signal — only advance to CLOSING if the program has already been presented
        if (matches(msg, BUYING_SIGNAL_TRIGGERS)) {
            if (currentState === 'PROGRAM_PRESENTATION' || currentState === 'OBJECTION_HANDLING' || currentState === 'CLOSING') {
                console.log('💳 [StateResolver] Sinal de compra detectado → CLOSING');
                return { state: 'CLOSING' };
            }
        }

        // Already closing / just confirmed → stay
        if (currentState === 'CLOSING') return { state: 'CLOSING' };

        // Objection after presentation → handle it
        if (matches(msg, OBJECTION_TRIGGERS)) {
            console.log('🤔 [StateResolver] Objeção detectada → OBJECTION_HANDLING');
            return { state: 'OBJECTION_HANDLING' };
        }

        // Profile is complete → present the program (or stay presenting)
        return { state: 'PROGRAM_PRESENTATION' };
    }

    // ── STEP 4: Profile incomplete → keep collecting ──────────────────────────
    return { state: 'QUALIFICATION' };
}