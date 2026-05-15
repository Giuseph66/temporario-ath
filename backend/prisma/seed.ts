import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Iniciando seed...');

    const tenant = await prisma.tenant.upsert({
        where: { slug: 'confluence' },
        update: {},
        create: { name: 'Confluence Treinamento', slug: 'confluence', plan: 'free', isActive: true },
    });
    console.log(`✅ Tenant: ${tenant.name} (${tenant.id})`);

    const passwordHash = await bcrypt.hash('trocar-essa-senha-123', 10);
    await prisma.tenantUser.upsert({
        where: { email: 'admin@confluence.com' },
        update: {},
        create: { tenantId: tenant.id, email: 'admin@confluence.com', passwordHash, role: 'owner' },
    });
    console.log('✅ TenantUser: admin@confluence.com');

    const existingAgent = await prisma.agent.findFirst({ where: { tenantId: tenant.id } });
    if (!existingAgent) {
        const agent = await prisma.agent.create({
            data: {
                tenantId: tenant.id,
                name: 'Artemis',
                role: 'Assistente de vendas e atendimento da Confluence Treinamento',
                language: 'Português (BR)',
                isActive: true,
            },
        });

        // Default protocols
        const protocols: Record<string, string> = {
            human_contact_link:      'https://wa.me/',
            human_handoff_consent:   'Posso te conectar com um humano. Deseja continuar?',
            human_handoff_hostile:   'Aqui está o contato direto: {LINK}',
            human_handoff_confirmed: 'Ótimo! Aqui está o contato: {LINK}',
            registration_link:       '',
        };
        for (const [key, value] of Object.entries(protocols)) {
            await prisma.agentProtocol.create({ data: { agentId: agent.id, key, value } });
        }

        console.log('✅ Agent criado: Artemis');
    } else {
        console.log('ℹ️ Agent já existe — pulando.');
    }

    console.log('✅ Seed concluído.');
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
