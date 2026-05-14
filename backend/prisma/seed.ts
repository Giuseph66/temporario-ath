import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import personaJson from '../config/persona.json';
import programsJson from '../config/programs.json';
import settingsJson from '../config/settings.json';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Iniciando seed...');

    // Tenant inicial — Confluence Treinamento
    const tenant = await prisma.tenant.upsert({
        where: { slug: 'confluence' },
        update: {},
        create: {
            name: 'Confluence Treinamento',
            slug: 'confluence',
            plan: 'free',
            isActive: true,
        },
    });
    console.log(`✅ Tenant criado: ${tenant.name} (${tenant.id})`);

    // Owner do painel
    const passwordHash = await bcrypt.hash('trocar-essa-senha-123', 10);
    await prisma.tenantUser.upsert({
        where: { email: 'admin@confluence.com' },
        update: {},
        create: {
            tenantId: tenant.id,
            email: 'admin@confluence.com',
            passwordHash,
            role: 'owner',
        },
    });
    console.log(`✅ TenantUser criado: admin@confluence.com`);

    // Agent padrão com JSONs existentes
    const existingAgent = await prisma.agent.findFirst({ where: { tenantId: tenant.id } });
    if (!existingAgent) {
        await prisma.agent.create({
            data: {
                tenantId: tenant.id,
                name: 'Artemis',
                personaJson: personaJson as object,
                programsJson: programsJson as object,
                settingsJson: settingsJson as object,
                isActive: true,
            },
        });
        console.log(`✅ Agent criado: Artemis`);
    } else {
        console.log(`ℹ️ Agent já existe — pulando.`);
    }

    console.log('✅ Seed concluído.');
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
