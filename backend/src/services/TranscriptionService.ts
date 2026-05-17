import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../utils/prisma';

// gemini-2.5-flash: suporte a áudio inline (OGG, MP3, WAV, FLAC, AAC)
const TRANSCRIPTION_MODEL = 'gemini-2.5-flash';

// Gemini aceita apenas MIME base sem parâmetros — strip codecs/suffix
function normalizeAudioMime(mime: string): string {
    const base = mime.split(';')[0].trim().toLowerCase();
    const supported = ['audio/ogg', 'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/flac', 'audio/aac', 'audio/webm', 'audio/mp4'];
    return supported.includes(base) ? base : 'audio/ogg';
}

export async function transcribeAudio(
    base64: string,
    mimeType: string,
    tenantId?: string,
): Promise<string | null> {
    try {
        const resolvedMime = normalizeAudioMime(mimeType);
        // Tenant key → env fallback (padrão Artemis)
        let apiKey = process.env.GEMINI_API_KEY ?? '';
        if (tenantId) {
            const tenant = await prisma.tenant.findUnique({
                where: { id: tenantId },
                select: { geminiApiKey: true },
            });
            if (tenant?.geminiApiKey) apiKey = tenant.geminiApiKey;
        }
        if (!apiKey) return null;

        const genai = new GoogleGenerativeAI(apiKey);
        const model = genai.getGenerativeModel({ model: TRANSCRIPTION_MODEL });

        // Race against 30s timeout — PTT de WhatsApp raramente passa de 5 min
        const result = await Promise.race([
            model.generateContent([
                { inlineData: { mimeType: resolvedMime, data: base64 } },
                'Transcreva este áudio exatamente como foi falado. Responda apenas com o texto transcrito, sem comentários ou explicações. Se não conseguir transcrever, responda com string vazia.',
            ]),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('transcription timeout')), 30_000)
            ),
        ]);

        const text = result.response.text().trim();
        return text.length > 0 ? text : null;
    } catch (e) {
        console.error('[TranscriptionService] transcription failed:', e);
        return null;
    }
}
