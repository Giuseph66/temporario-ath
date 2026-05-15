import { prisma } from '../utils/prisma';
import * as bcrypt from 'bcrypt';

export async function createTenant(params: {
    companyName: string;
    slug: string;
    agentName: string;
    ownerEmail: string;
    ownerPassword: string;
}) {
    const { companyName, slug, agentName, ownerEmail, ownerPassword } = params;
    const passwordHash = await bcrypt.hash(ownerPassword, 10);

    return prisma.$transaction(async tx => {
        const tenant = await tx.tenant.create({
            data: { name: companyName, slug, plan: 'free', isActive: true },
        });

        await tx.tenantUser.create({
            data: { tenantId: tenant.id, email: ownerEmail, passwordHash, role: 'owner' },
        });

        const agent = await tx.agent.create({
            data: {
                tenantId: tenant.id,
                name: agentName,
                role: 'Assistente de vendas e atendimento',
                language: 'Português (BR)',
                isActive: true,
            },
        });

        // Default protocols
        const defaultProtocols: Record<string, string> = {
            human_contact_link:      'https://wa.me/',
            human_handoff_consent:   'Posso te conectar com um humano. Deseja continuar?',
            human_handoff_hostile:   'Aqui está o contato direto: {LINK}',
            human_handoff_confirmed: 'Ótimo! Contato: {LINK}',
            registration_link:       '',
            respondi_form_link:      '',
        };
        for (const [key, value] of Object.entries(defaultProtocols)) {
            await tx.agentProtocol.create({ data: { agentId: agent.id, key, value } });
        }

        return tenant;
    });
}
