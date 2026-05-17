import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { prisma } from '../utils/prisma';
import { EvolutionService } from '../services/EvolutionService';

export async function getMessageMedia(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;

    const message = await prisma.chatHistory.findFirst({
        where: { id },
        include: { user: { include: { tenant: true } } },
    });

    if (!message) {
        res.status(404).json({ error: 'Mensagem não encontrada' });
        return;
    }

    // Verify this message belongs to tenant
    if (message.user?.tenant?.id !== req.tenantId) {
        res.status(403).json({ error: 'Acesso negado' });
        return;
    }

    const media = message.media as any;

    // Location and contact don't need binary fetch
    if (media?.type === 'location' || media?.type === 'contact') {
        res.status(400).json({ error: 'Este tipo de mídia não requer download de binário' });
        return;
    }

    if (!media?.messageData) {
        res.status(404).json({ error: 'Mídia não disponível' });
        return;
    }

    const evolutionInstance = message.user?.tenant?.evolutionInstance;
    if (!evolutionInstance) {
        res.status(503).json({ error: 'Instância Evolution não configurada' });
        return;
    }

    const result = await EvolutionService.getMediaBase64(evolutionInstance, media.messageData);

    if (!result) {
        res.status(502).json({ error: 'Falha ao obter mídia da Evolution' });
        return;
    }

    res.json({ base64: result.base64, mimeType: result.mediaType, type: media.type });
}
