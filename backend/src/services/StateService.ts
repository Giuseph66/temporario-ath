import { ConversationState } from '../types/user';
import { prisma } from '../utils/prisma';

export class StateService {

    // O 'async' avisa o Node.js que essa função vai demorar milissegundos,
    // pois precisa ir buscar no disco rígido (banco de dados)
    public async getSession(phoneNumber: string, tenantId?: string, agentId?: string) {

        const whereClause = tenantId
            ? { phoneNumber, tenantId }
            : { phoneNumber };

        let user = await prisma.user.findFirst({
            where: whereClause,
            include: {
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 20
                }
            }
        });

        if (!user) {
            user = await prisma.user.create({
                data: {
                    phoneNumber,
                    ...(tenantId ? { tenantId } : {}),
                    ...(agentId ? { agentId } : {}),
                },
                include: { messages: true }
            });
        } else if (tenantId && !user.tenantId) {
            // Migra lead órfão que chegou antes do fix
            user = await prisma.user.update({
                where: { id: user.id },
                data: { tenantId, ...(agentId ? { agentId } : {}) },
                include: { messages: true }
            });
        }

        // Reverse para ordem cronológica correta (buscamos desc, entregamos asc)
        const messages = (user as unknown as { messages: { role: string; content: string }[] }).messages ?? [];
        const conversationHistory = messages.slice().reverse().map((msg) => ({
            role: msg.role === 'model' ? 'model' as const : 'user' as const,
            content: msg.content
        }));

        // Garante que o estado nunca seja nulo (novo usuário começa em GREETING)
        const conversationState = (user.conversationState as ConversationState) || 'GREETING';

        return { ...user, conversationHistory, conversationState, lastPaymentUrl: user.lastPaymentUrl ?? null };
    }

    // Função para salvar uma nova mensagem
    public async addToHistory(phoneNumber: string, role: string, content: string) {
        const user = await prisma.user.findFirst({ where: { phoneNumber } });
        if (!user) return;

        await prisma.chatHistory.create({
            data: {
                userId: user.id,
                role: role,
                content: content
            }
        });

        if (role === 'user') {
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    interactionCount: { increment: 1 },
                    lastInteraction: new Date()
                }
            });
        }
    }

    // Atualiza o estado da conversa no banco
    public async updateConversationState(phoneNumber: string, state: ConversationState) {
        const user = await prisma.user.findFirst({ where: { phoneNumber } });
        if (!user) return;
        await prisma.user.update({
            where: { id: user.id },
            data: { conversationState: state }
        });
        console.log(`🔄 Estado da conversa atualizado para ${phoneNumber}: [${state}]`);
    }

    // LGPD Art. 11 — keywords de saúde mental que NÃO devem ser persistidas no perfil
    private readonly SENSITIVE_HEALTH_KEYWORDS = [
        'ansiedade', 'ansioso', 'ansiosa', 'estresse', 'estressado', 'estressada',
        'burnout', 'depressão', 'deprimido', 'deprimida', 'transtorno', 'terapia',
        'angústia', 'angustiado', 'angustiada', 'pânico', 'trauma', 'traumatizado',
        'suicídio', 'suicidar', 'me matar', 'quero morrer',
    ];

    private containsSensitiveHealthData(text: string): boolean {
        const lower = text.toLowerCase();
        return this.SENSITIVE_HEALTH_KEYWORDS.some(kw => lower.includes(kw));
    }

    // Atualiza o perfil do usuário no banco
    public async updateUserProfile(phoneNumber: string, data: any) {
        const updateData: any = {};
        if (data.name) updateData.name = data.name;
        if (data.age) updateData.age = parseInt(data.age);
        // LGPD Art. 11: nunca persistir dados de saúde mental no campo goal
        if (data.goal && !this.containsSensitiveHealthData(data.goal)) {
            updateData.goal = data.goal;
        } else if (data.goal) {
            console.warn(`🏥 [StateService] Dado sensível de saúde detectado no goal — NÃO salvo no banco (LGPD Art. 11).`);
        }
        if (data.enrollmentTarget) updateData.enrollmentTarget = data.enrollmentTarget;

        if (Object.keys(updateData).length > 0) {
            const foundUser = await prisma.user.findFirst({ where: { phoneNumber } });
            if (foundUser) {
                await prisma.user.update({ where: { id: foundUser.id }, data: updateData });
                console.log(`💾 Perfil atualizado no banco para ${phoneNumber}:`, updateData);
            }
        }
    }

    // LGPD Art. 18 — Exclusão imediata de todos os dados do titular
    public async deleteUserData(phoneNumber: string): Promise<void> {
        const user = await prisma.user.findFirst({ where: { phoneNumber } });
        if (!user) return;
        // ChatHistory é deletado em cascata (onDelete: Cascade no schema)
        await prisma.user.delete({ where: { id: user.id } });
        console.log(`🗑️ [LGPD Art. 18] Todos os dados do usuário ${phoneNumber} foram permanentemente excluídos.`);
    }
}

export const stateService = new StateService();