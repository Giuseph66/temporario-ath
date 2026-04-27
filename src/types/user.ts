/**
 * Define os estágios possíveis de uma conversa com a Artemis.
 * Cada estado determina QUAIS blocos de instrução serão enviados para a IA.
 *
 * GREETING            → Primeira mensagem. Envia: identidade, tom, script de abertura.
 * QUALIFICATION       → Dados do perfil incompletos. Envia: identidade, tom, regras de qualificação.
 * PROGRAM_PRESENTATION → Perfil completo. Envia: identidade, tom, protocolos Teen/PRM, dados do programa relevante.
 * OBJECTION_HANDLING  → Usuário hesitando. Envia: identidade, tom, camadas de objeção.
 * CLOSING             → Programa escolhido. Envia: identidade, tom, protocolo de cadastro.
 * HUMAN_HANDOFF       → Escalada para humano. Envia: identidade, tom, protocolo de handoff.
 */
export type ConversationState =
    | 'GREETING'
    | 'QUALIFICATION'
    | 'PROGRAM_PRESENTATION'
    | 'OBJECTION_HANDLING'
    | 'CLOSING'
    | 'HUMAN_HANDOFF';

export interface UserProfile {
    age?: number;
    name?: string;
    goal?: string;
    currentProgramId?: string; // The program currently being discussed
}

export interface UserState {
    phoneNumber: string;
    profile: UserProfile;
    conversationState: ConversationState;
    threadId?: string;
    conversationHistory: { role: 'user' | 'assistant' | 'system', content: string }[];
    lastInteraction: Date;
    interactionCount: number;
}
