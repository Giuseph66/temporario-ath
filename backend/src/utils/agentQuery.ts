/**
 * Canonical include/select for Agent queries.
 * Replaces all manual JSON parsing — use this everywhere an Agent is loaded.
 */
import { prisma } from './prisma';

export const AGENT_INCLUDE = {
    programs:        { orderBy: { sortOrder: 'asc' as const } },
    protocols:       { orderBy: { key: 'asc' as const } },
    restrictions:    { orderBy: { sortOrder: 'asc' as const } },
    whitelistPhones: true,
    whitelistGroups: true,
} as const;

/** Full agent with all relations. */
export async function getAgentFull(where: { tenantId: string } | { id: string }) {
    return prisma.agent.findFirst({ where, include: AGENT_INCLUDE });
}

/** Serialize agent to the shape controllers/frontend expect. */
export function serializeAgent(agent: Awaited<ReturnType<typeof getAgentFull>>) {
    if (!agent) return null;

    const protocolMap = Object.fromEntries(
        agent.protocols.map(p => [p.key, p.value])
    );

    return {
        id:            agent.id,
        tenantId:      agent.tenantId,
        name:          agent.name,
        role:          agent.role,
        language:      agent.language,
        geminiModel:   agent.geminiModel,
        isActive:      agent.isActive,
        whatsappNumber: agent.whatsappNumber,

        // Persona editorial blobs
        toneJson:              agent.toneJson,
        qualificationJson:     agent.qualificationJson,
        objectionHandlingJson: agent.objectionHandlingJson,
        knowledgeContractsJson: agent.knowledgeContractsJson,

        // Settings
        whitelistEnabled:        agent.whitelistEnabled,
        ignoreGroups:            agent.ignoreGroups,
        adminChatEnabled:        agent.adminChatEnabled,
        ownerPhone:              agent.ownerPhone,
        humanSupportNumber:      agent.humanSupportNumber,
        humanHandoffMessage:     agent.humanHandoffMessage,
        humanNotificationNumber: agent.humanNotificationNumber,

        // Relational lists
        programs:     agent.programs.map(p => ({
            id:           p.id,
            programKey:   p.programKey,
            name:         p.name,
            priceValue:   p.priceValue,
            priceType:    p.priceType,
            installments: p.installments,
            durationWeeks: p.durationWeeks,
            verbatimIntro: p.verbatimIntro,
            fullText:     p.fullText,
        })),
        protocols:    protocolMap,
        restrictions: agent.restrictions.map(r => r.text),
        whitelistPhones: agent.whitelistPhones.map(w => w.phone),
        whitelistGroups: agent.whitelistGroups.map(w => w.groupId),
    };
}

/** Build the config shape WebhookController needs. */
export function agentToConfig(agent: Awaited<ReturnType<typeof getAgentFull>>, fileConfigFallback: any) {
    if (!agent) return fileConfigFallback;

    const protocolMap = Object.fromEntries(
        agent.protocols.map(p => [p.key, p.value])
    );

    return {
        persona: {
            name:     agent.name,
            role:     agent.role,
            language: agent.language,
            absolute_restrictions: agent.restrictions.map(r => r.text),
            tone:      agent.toneJson ?? fileConfigFallback?.persona?.tone ?? {},
            protocols: { ...(fileConfigFallback?.persona?.protocols ?? {}), ...protocolMap },
            qualification:      agent.qualificationJson ?? fileConfigFallback?.persona?.qualification ?? [],
            objection_handling: agent.objectionHandlingJson ?? fileConfigFallback?.persona?.objection_handling ?? {},
            knowledge_base_contracts: agent.knowledgeContractsJson ?? fileConfigFallback?.persona?.knowledge_base_contracts ?? {},
        },
        programs: {
            programs: agent.programs.map(p => ({
                id:            p.programKey,
                name:          p.name,
                price_value:   p.priceValue,
                price_type:    p.priceType,
                installments:  p.installments,
                duration_weeks: p.durationWeeks,
                verbatim_intro: p.verbatimIntro,
                full_text:     p.fullText,
            })),
        },
        settings: {
            ...(fileConfigFallback?.settings ?? {}),
            human_support_number:      agent.humanSupportNumber,
            human_handoff_message:     agent.humanHandoffMessage,
            human_notification_number: agent.humanNotificationNumber,
        },
    };
}
