import { prisma } from '../utils/prisma';
import * as bcrypt from 'bcrypt';
import personaDefault from '../../config/persona.json';
import programsDefault from '../../config/programs.json';
import settingsDefault from '../../config/settings.json';

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

        const personaJson = { ...personaDefault, name: agentName };

        await tx.agent.create({
            data: {
                tenantId: tenant.id,
                name: agentName,
                personaJson,
                programsJson: programsDefault as object,
                settingsJson: settingsDefault as object,
                isActive: true,
            },
        });

        return tenant;
    });
}
