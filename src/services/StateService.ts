import { ConversationState } from '../types/user';
import { prisma } from '../utils/prisma';

export class StateService {

    // O 'async' avisa o Node.js que essa função vai demorar milissegundos,
    // pois precisa ir buscar no disco rígido (banco de dados)
    public async getSession(phoneNumber: string) {

        // Tenta achar o usuário pelo número e já traz as últimas 40 mensagens dele
        let user = await prisma.user.findUnique({
            where: { phoneNumber },
            include: {
                messages: {
                    orderBy: { createdAt: 'asc' }, // Traz da mais antiga pra mais nova
                    take: 20 // Reduzido de 40 para diminuir payload e evitar timeouts na API
                }
            }
        });

        // Se o usuário não existir (primeira vez chamando), cria ele no banco
        if (!user) {
            user = await prisma.user.create({
                data: { phoneNumber },
                include: { messages: true }
            });
        }

        // A API do Google Gemini exige que o histórico seja formatado de um jeito específico.
        const conversationHistory = user.messages.map((msg: any) => ({
            role: msg.role === 'model' ? 'model' : 'user',
            content: msg.content
        }));

        // Garante que o estado nunca seja nulo (novo usuário começa em GREETING)
        const conversationState = (user.conversationState as ConversationState) || 'GREETING';

        return { ...user, conversationHistory, conversationState, lastPaymentUrl: (user as any).lastPaymentUrl ?? null };
    }

    // Função para salvar uma nova mensagem
    public async addToHistory(phoneNumber: string, role: string, content: string) {
        const user = await prisma.user.findUnique({ where: { phoneNumber } });
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
        await prisma.user.update({
            where: { phoneNumber },
            data: { conversationState: state } as any
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
            await prisma.user.update({
                where: { phoneNumber },
                data: updateData
            });
            console.log(`💾 Perfil atualizado no banco para ${phoneNumber}:`, updateData);
        }
    }

    // LGPD Art. 18 — Exclusão imediata de todos os dados do titular
    public async deleteUserData(phoneNumber: string): Promise<void> {
        const user = await prisma.user.findUnique({ where: { phoneNumber } });
        if (!user) return;
        // ChatHistory é deletado em cascata (onDelete: Cascade no schema)
        await prisma.user.delete({ where: { phoneNumber } });
        console.log(`🗑️ [LGPD Art. 18] Todos os dados do usuário ${phoneNumber} foram permanentemente excluídos.`);
    }
}

export const stateService = new StateService();