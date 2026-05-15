/**
 * Migration: Agent JSON blobs → relational tables
 * Reads personaJson, programsJson, settingsJson from Agent rows
 * and populates: AgentProgram, AgentProtocol, AgentRestriction,
 *               WhitelistPhone, WhitelistGroup, plus scalar columns.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const agents = await prisma.agent.findMany({
        select: {
            id: true,
            name: true,
            personaJson: true,
            programsJson: true,
            settingsJson: true,
        },
    });

    console.log(`Migrando ${agents.length} agente(s)...`);

    for (const agent of agents) {
        const persona = (agent.personaJson ?? {}) as Record<string, unknown>;
        const programsData = (agent.programsJson ?? { programs: [] }) as { programs: unknown[] };
        const settings = (agent.settingsJson ?? {}) as Record<string, unknown>;
        const innerSettings = (settings.settings ?? {}) as Record<string, unknown>;

        // ── 1. Scalar persona columns ──────────────────────────────────────────
        await prisma.agent.update({
            where: { id: agent.id },
            data: {
                role:                    String(persona.role ?? ''),
                language:                String(persona.language ?? 'Português (BR)'),
                toneJson:                persona.tone as object ?? undefined,
                qualificationJson:       Array.isArray(persona.qualification) ? persona.qualification : undefined,
                objectionHandlingJson:   persona.objection_handling as object ?? undefined,
                knowledgeContractsJson:  persona.knowledge_base_contracts as object ?? undefined,
                // Settings scalars
                whitelistEnabled:        settings.whitelistEnabled === true,
                ignoreGroups:            settings.ignoreGroups !== false,
                adminChatEnabled:        settings.adminChatEnabled !== false,
                ownerPhone:              settings.ownerPhone ? String(settings.ownerPhone) : null,
                humanSupportNumber:      innerSettings.human_support_number ? String(innerSettings.human_support_number) : null,
                humanHandoffMessage:     innerSettings.human_handoff_message ? String(innerSettings.human_handoff_message) : null,
                humanNotificationNumber: innerSettings.human_notification_number ? String(innerSettings.human_notification_number) : null,
            },
        });

        // ── 2. AgentProgram ────────────────────────────────────────────────────
        const programs = Array.isArray(programsData.programs) ? programsData.programs : [];
        for (let i = 0; i < programs.length; i++) {
            const p = programs[i] as Record<string, unknown>;
            const key = String(p.id ?? p.name ?? `prog_${i}`).toLowerCase().replace(/\s+/g, '_');
            await prisma.agentProgram.upsert({
                where: { agentId_programKey: { agentId: agent.id, programKey: key } },
                create: {
                    agentId:       agent.id,
                    programKey:    key,
                    name:          String(p.name ?? ''),
                    priceValue:    Number(p.price_value ?? p.price ?? 0),
                    priceType:     String(p.price_type ?? 'monthly'),
                    installments:  Number(p.installments ?? 1),
                    durationWeeks: Number(p.duration_weeks ?? 0),
                    verbatimIntro: String(p.verbatim_intro ?? ''),
                    fullText:      String(p.full_text ?? ''),
                    sortOrder:     i,
                },
                update: {
                    name:          String(p.name ?? ''),
                    priceValue:    Number(p.price_value ?? p.price ?? 0),
                    priceType:     String(p.price_type ?? 'monthly'),
                    installments:  Number(p.installments ?? 1),
                    durationWeeks: Number(p.duration_weeks ?? 0),
                    verbatimIntro: String(p.verbatim_intro ?? ''),
                    fullText:      String(p.full_text ?? ''),
                    sortOrder:     i,
                },
            });
        }
        console.log(`  ✅ ${programs.length} programa(s) migrado(s) para agente "${agent.name}"`);

        // ── 3. AgentProtocol ───────────────────────────────────────────────────
        const protocols = (persona.protocols ?? {}) as Record<string, string>;
        for (const [key, value] of Object.entries(protocols)) {
            if (typeof value !== 'string') continue;
            await prisma.agentProtocol.upsert({
                where: { agentId_key: { agentId: agent.id, key } },
                create: { agentId: agent.id, key, value },
                update: { value },
            });
        }
        console.log(`  ✅ ${Object.keys(protocols).length} protocolo(s) migrado(s)`);

        // ── 4. AgentRestriction ────────────────────────────────────────────────
        const restrictions = Array.isArray(persona.absolute_restrictions) ? persona.absolute_restrictions as string[] : [];
        // Clear existing and re-insert to keep order
        await prisma.agentRestriction.deleteMany({ where: { agentId: agent.id } });
        for (let i = 0; i < restrictions.length; i++) {
            await prisma.agentRestriction.create({
                data: { agentId: agent.id, text: restrictions[i], sortOrder: i },
            });
        }
        console.log(`  ✅ ${restrictions.length} restrição(ões) migrada(s)`);

        // ── 5. WhitelistPhone ──────────────────────────────────────────────────
        const phones = Array.isArray(settings.allowedPhones) ? settings.allowedPhones as string[] : [];
        for (const phone of phones) {
            await prisma.whitelistPhone.upsert({
                where: { agentId_phone: { agentId: agent.id, phone } },
                create: { agentId: agent.id, phone },
                update: {},
            });
        }
        console.log(`  ✅ ${phones.length} telefone(s) na whitelist migrado(s)`);

        // ── 6. WhitelistGroup ──────────────────────────────────────────────────
        const groups = Array.isArray(settings.allowedGroups) ? settings.allowedGroups as string[] : [];
        for (const groupId of groups) {
            await prisma.whitelistGroup.upsert({
                where: { agentId_groupId: { agentId: agent.id, groupId } },
                create: { agentId: agent.id, groupId },
                update: {},
            });
        }
        console.log(`  ✅ ${groups.length} grupo(s) na whitelist migrado(s)`);
    }

    console.log('\n✅ Migração concluída. Verificando:');
    const [progCount, protoCount, restCount, wlPhones] = await Promise.all([
        prisma.agentProgram.count(),
        prisma.agentProtocol.count(),
        prisma.agentRestriction.count(),
        prisma.whitelistPhone.count(),
    ]);
    console.log(`  AgentProgram:     ${progCount}`);
    console.log(`  AgentProtocol:    ${protoCount}`);
    console.log(`  AgentRestriction: ${restCount}`);
    console.log(`  WhitelistPhone:   ${wlPhones}`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
