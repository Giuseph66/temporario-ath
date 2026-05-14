// ──────────────────────────────────────────────────────────────────────────────
// Interfaces que espelham o formato real de persona.json, programs.json, settings.json
// ──────────────────────────────────────────────────────────────────────────────

export interface ToneConfig {
    primary: string[];
    secondary?: string[];
    formatting?: string;
    emoji_rules?: string;
    ai_identity?: string;
}

export interface ObjectionHandling {
    layer_1_soft: string[];
    layer_2_medium: string[];
    layer_3_direct: string[];
    tactics: Record<string, string>;
}

export interface ContractRules {
    rules: string[];
    bonuses: {
        early: string;
        semester: string;
        annual: string;
    };
    evolution?: Record<string, string>;
}

export interface Protocols {
    registration_link: string;
    human_handoff_consent?: string;
    human_handoff_message?: string;
    human_contact_link: string;
    respondi_form_link?: string;
    calendar_placeholder?: string;
    prm_trigger?: string;
}

export interface PersonaConfig {
    name: string;
    role: string;
    language: string;
    tone: ToneConfig;
    absolute_restrictions?: string[];
    qualification?: string[];
    objection_handling?: ObjectionHandling;
    knowledge_base_contracts?: ContractRules;
    protocols: Protocols;
    // Legacy fields (kept for backwards compatibility)
    principles?: string[];
}

export interface Program {
    id: string;
    name: string;
    verbatim_intro?: string;
    full_text?: string;
    target_audience?: string;
    description?: string;
    format?: string;
    price?: string;
    informative_text?: string;
    warning?: string;
}

export interface ProgramsConfig {
    programs: Program[];
}

export interface SystemSettings {
    human_handoff_message?: string;
    human_support_number?: string;
}

export interface Config {
    persona: PersonaConfig;
    programs: ProgramsConfig;
    settings: SystemSettings;
}
