import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { prisma } from '../utils/prisma';
import { EvolutionService } from '../services/EvolutionService';

// Gera todas as variantes do número para match com Contact (com/sem +, com/sem 9 do DDD)
function phoneVariants(phone: string): string[] {
    const digits = phone.replace(/\D/g, '');
    const variants = new Set<string>();
    variants.add(digits);
    variants.add('+' + digits);
    // Remove o 9 inserido por normalizeBrazilianPhone (13 → 12 dígitos BR)
    if (digits.length === 13 && digits.startsWith('55')) {
        const short = digits.slice(0, 4) + digits.slice(5); // remove índice 4 (o 9)
        variants.add(short);
        variants.add('+' + short);
    }
    // Insere o 9 (12 → 13 dígitos BR)
    if (digits.length === 12 && digits.startsWith('55')) {
        const long = digits.slice(0, 4) + '9' + digits.slice(4);
        variants.add(long);
        variants.add('+' + long);
    }
    return Array.from(variants);
}

export async function listLeads(req: AuthRequest, res: Response): Promise<Response> {
    const { state, search, page = '1', limit = '30' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: Record<string, unknown> = { tenantId: req.tenantId };
    if (state) where.conversationState = state;
    if (search) {
        where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { phoneNumber: { contains: search } },
        ];
    }

    const [leads, total] = await Promise.all([
        prisma.user.findMany({
            where: where as object,
            orderBy: { lastInteraction: 'desc' },
            take: parseInt(limit),
            skip,
            select: {
                id: true, name: true, phoneNumber: true, conversationState: true,
                currentProgramId: true, enrollmentStatus: true, lastInteraction: true,
                interactionCount: true, lgpdConsent: true,
            },
        }),
        prisma.user.count({ where: where as object }),
    ]);

    return res.json({ leads, total, page: parseInt(page), limit: parseInt(limit) });
}

export async function getLead(req: AuthRequest, res: Response): Promise<Response> {
    const lead = await prisma.user.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId },
        include: {
            messages: { orderBy: { createdAt: 'desc' }, take: 200 },
        },
    });
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

    // Fetch profilePicUrl from Contact cache
    const contact = await prisma.contact.findFirst({
        where: { tenantId: req.tenantId, phone: { in: phoneVariants(lead.phoneNumber) } },
        select: { profilePicUrl: true },
    }).catch(() => null);

    return res.json({ ...lead, profilePicUrl: contact?.profilePicUrl ?? null });
}

export async function listConversations(req: AuthRequest, res: Response): Promise<Response> {
    const leads = await prisma.user.findMany({
        where: { tenantId: req.tenantId },
        orderBy: { lastInteraction: 'desc' },
        take: 100,
        select: {
            id: true, name: true, phoneNumber: true, conversationState: true,
            lastInteraction: true, enrollmentStatus: true, isGroup: true,
            messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
    });

    // Batch-fetch profilePicUrls from Contact cache (one query for all phones)
    const phones = leads.flatMap(l => phoneVariants(l.phoneNumber));
    const contacts = await prisma.contact.findMany({
        where: { tenantId: req.tenantId, phone: { in: phones } },
        select: { phone: true, profilePicUrl: true },
    }).catch(() => [] as { phone: string; profilePicUrl: string | null }[]);

    const picByPhone = new Map(contacts.map(c => [c.phone, c.profilePicUrl]));

    const result = leads.map(l => ({
        ...l,
        profilePicUrl: phoneVariants(l.phoneNumber).map(v => picByPhone.get(v)).find(Boolean) ?? null,
    }));

    return res.json(result);
}

export async function updateLeadState(req: AuthRequest, res: Response): Promise<Response> {
    const { state } = req.body as { state: string };
    const validStates = ['GREETING', 'QUALIFICATION', 'PROGRAM_PRESENTATION', 'OBJECTION_HANDLING', 'CLOSING', 'HUMAN_HANDOFF'];
    if (!validStates.includes(state)) return res.status(400).json({ error: 'Estado inválido' });

    const lead = await prisma.user.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

    await prisma.user.update({ where: { id: req.params.id }, data: { conversationState: state } });
    return res.json({ ok: true });
}

export async function updateLead(req: AuthRequest, res: Response): Promise<Response> {
    const lead = await prisma.user.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

    const { name, age, email, goal, currentProgramId, lgpdConsent } = req.body as {
        name?: string; age?: number | null; email?: string | null;
        goal?: string | null; currentProgramId?: string | null; lgpdConsent?: boolean;
    };

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name || null;
    if (age !== undefined) data.age = age !== null && age !== undefined ? Number(age) : null;
    if (email !== undefined) data.email = email || null;
    if (goal !== undefined) data.goal = goal || null;
    if (currentProgramId !== undefined) data.currentProgramId = currentProgramId || null;
    if (lgpdConsent !== undefined) data.lgpdConsent = Boolean(lgpdConsent);

    // Se nome editado manualmente, persiste também no cache de contatos (como customName)
    if (name !== undefined && name && !lead.isGroup) {
        const phoneWithPlus = lead.phoneNumber.startsWith('+') ? lead.phoneNumber : `+${lead.phoneNumber}`;
        await prisma.contact.updateMany({
            where: { tenantId: req.tenantId, phone: { in: phoneVariants(lead.phoneNumber) } },
            data: { customName: name },
        });
    }

    const updated = await prisma.user.update({ where: { id: req.params.id }, data });
    return res.json(updated);
}

export async function deleteLead(req: AuthRequest, res: Response): Promise<Response> {
    const lead = await prisma.user.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

    await prisma.user.delete({ where: { id: req.params.id } });
    return res.json({ ok: true });
}

export async function clearSession(req: AuthRequest, res: Response): Promise<Response> {
    const lead = await prisma.user.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

    await prisma.user.update({
        where: { id: lead.id },
        data: {
            conversationState: 'GREETING',
            interactionCount: 0,  // StateResolver usa <= 1 pra detectar primeira interação
        },
    });

    // Marca no histórico que uma nova sessão foi iniciada (contexto visual)
    await prisma.chatHistory.create({
        data: { userId: lead.id, role: 'system', content: '— Nova sessão iniciada pelo operador —' },
    });

    return res.json({ ok: true });
}

export async function backfillNames(req: AuthRequest, res: Response): Promise<Response> {
    // Busca todos os leads (não só os sem nome) pra aplicar customName com prioridade
    const leads = await prisma.user.findMany({
        where: { tenantId: req.tenantId },
        select: { id: true, phoneNumber: true, name: true },
    });

    let updated = 0;
    for (const lead of leads) {
        const contact = await prisma.contact.findFirst({
            where: { tenantId: req.tenantId, phone: { in: phoneVariants(lead.phoneNumber) } },
            select: { name: true, customName: true },
        });

        // Prioridade: customName > name do contact > manter atual
        const bestName = contact?.customName ?? contact?.name ?? null;
        if (bestName && bestName !== lead.name) {
            await prisma.user.update({ where: { id: lead.id }, data: { name: bestName } });
            updated++;
        }
    }

    return res.json({ ok: true, checked: leads.length, updated });
}

export async function sendMediaMessage(req: AuthRequest, res: Response): Promise<Response> {
    try {
        const { base64, mediatype, mimetype, caption, fileName } = req.body as {
            base64: string;
            mediatype: 'image' | 'audio' | 'video' | 'document';
            mimetype: string;
            caption?: string;
            fileName?: string;
        };

        // Derive a filename from mimetype when not provided — required by Evolution for doc/video
        function resolveFileName(): string | undefined {
            if (fileName) return fileName;
            const ext: Record<string, string> = {
                'image/jpeg': 'image.jpg', 'image/png': 'image.png', 'image/gif': 'image.gif', 'image/webp': 'image.webp',
                'video/mp4': 'video.mp4', 'video/quicktime': 'video.mov', 'video/webm': 'video.webm',
                'audio/webm': 'audio.webm', 'audio/ogg': 'audio.ogg', 'audio/mpeg': 'audio.mp3', 'audio/mp4': 'audio.mp4',
                'application/pdf': 'document.pdf',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document.docx',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'document.xlsx',
                'application/zip': 'archive.zip',
            };
            // Try exact match, then prefix match
            return ext[mimetype] ?? `file.${mimetype.split('/')[1]?.split(';')[0] ?? 'bin'}`;
        }

        if (!base64 || !mediatype || !mimetype) {
            return res.status(400).json({ error: 'base64, mediatype e mimetype obrigatórios' });
        }

        const lead = await prisma.user.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
        if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

        const phone = lead.phoneNumber.replace('+', '');
        if (phone.length > 15 || !/^\d+$/.test(phone)) {
            return res.status(400).json({ error: `Número inválido: ${lead.phoneNumber}` });
        }

        const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
        if (!tenant?.evolutionInstance) return res.status(400).json({ error: 'Evolution não configurada' });

        // PTT audio via dedicated endpoint — capture response for messageData
        let evoResponse: any;
        if (mediatype === 'audio') {
            evoResponse = await EvolutionService.sendWhatsAppAudio(tenant.evolutionInstance, lead.phoneNumber, base64);
        } else {
            evoResponse = await EvolutionService.sendMedia(tenant.evolutionInstance, lead.phoneNumber, mediatype, base64, mimetype, caption, resolveFileName());
        }

        // Only store the message key — enough to re-fetch via getBase64FromMediaMessage.
        // Never store the full evoResponse: Evolution echoes the sent base64 back,
        // which would make every GET /api/leads/:id return MBs of base64 on the poll.
        const msgKey = evoResponse?.key ?? null;

        // messageData needs at least { key } for Evolution to locate the media
        const messageData = msgKey ? { key: msgKey } : null;

        const media = {
            type: mediatype,
            mimeType: mimetype,
            caption: caption ?? '',
            filename: resolveFileName(),
            messageKey: msgKey,
            messageData,
        };
        const msg = await prisma.chatHistory.create({
            data: {
                userId: lead.id,
                role: 'operator',
                content: caption ?? '',
                media: media as any,
            },
        });

        return res.json({ ok: true, message: msg });
    } catch (err: any) {
        const detail = err?.response?.data ?? err?.message ?? 'desconhecido';
        return res.status(500).json({ error: `Erro ao enviar mídia: ${JSON.stringify(detail)}` });
    }
}

export async function sendMessage(req: AuthRequest, res: Response): Promise<Response> {
    try {
        const { text } = req.body as { text: string };
        if (!text?.trim()) return res.status(400).json({ error: 'text obrigatório' });

        const lead = await prisma.user.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
        if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

        // Rejeita números de grupo (muito longos ou com padrão @g.us)
        const phone = lead.phoneNumber.replace('+', '');
        if (phone.length > 15 || !/^\d+$/.test(phone)) {
            return res.status(400).json({ error: `Número inválido para envio: ${lead.phoneNumber}. Parece ser um grupo ou JID interno.` });
        }

        const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
        if (!tenant?.evolutionInstance) return res.status(400).json({ error: 'Evolution não configurada' });

        await EvolutionService.sendText(tenant.evolutionInstance, lead.phoneNumber, text.trim());
        const msg = await prisma.chatHistory.create({
            data: { userId: lead.id, role: 'operator', content: text.trim() },
        });

        return res.json({ ok: true, message: msg });
    } catch (err: any) {
        const detail = err?.response?.data ?? err?.message ?? 'desconhecido';
        return res.status(500).json({ error: `Erro ao enviar mensagem: ${JSON.stringify(detail)}` });
    }
}
