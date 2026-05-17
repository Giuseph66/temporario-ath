import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { aiService } from '../services/AIService';
import { handleAdminMessageWithTrace } from '../services/AdminChatService';
import { buildSystemPrompt } from '../services/PromptBuilder';
import { configLoader } from '../services/ConfigLoader';
import { retrieveRelevantContext } from '../services/KnowledgeService';
import { getAgentFull, agentToConfig } from '../utils/agentQuery';

export async function simulateMessage(req: AuthRequest, res: Response): Promise<void> {
    const { message, agentType, history, conversationState } = req.body as {
        message: string;
        agentType: 'atendente' | 'orientador';
        history: { role: 'user' | 'model'; content: string }[];
        conversationState?: string;
    };

    if (!message?.trim()) {
        res.status(400).json({ error: 'message obrigatório' });
        return;
    }

    const tenantId = req.tenantId;

    if (agentType === 'orientador') {
        const result = await handleAdminMessageWithTrace(tenantId, message, history ?? []);
        res.json(result);
        return;
    }

    // atendente — replica pipeline do EvolutionWebhookController
    const state = conversationState ?? 'GREETING';
    const fileConfig = configLoader.getConfig();
    const dbAgent = await getAgentFull({ tenantId });
    const config = agentToConfig(dbAgent, fileConfig);

    const ragContext = await retrieveRelevantContext(tenantId, message).catch(() => null);

    const systemInstruction = buildSystemPrompt({
        state: state as any,
        config,
        ragContext,
        userProfile: {
            name: null, age: null, goal: null, currentProgramId: null,
            lastPaymentUrl: null, cpf: null, email: null,
            birthDate: null, address: null, enrollmentTarget: null,
            extraInfo: null, paymentDay: null,
        },
    });

    // Phone sintético — evita criação real de cobrança Asaas
    const syntheticPhone = `simulator-${tenantId}`;

    // Gemini exige que history comece com role='user'
    const cleanHistory = [...(history ?? [])];
    while (cleanHistory.length > 0 && cleanHistory[0].role !== 'user') {
        cleanHistory.shift();
    }

    const result = await aiService.generateResponse(
        syntheticPhone,
        cleanHistory,
        message,
        systemInstruction,
        state,
        tenantId,
    );

    if (result.trace && ragContext) {
        (result.trace as any).ragUsed = {
            chars: ragContext.length,
            snippet: ragContext.slice(0, 300),
        };
    }

    res.json({ text: result.text, trace: result.trace });
}
