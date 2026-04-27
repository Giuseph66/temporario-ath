import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { normalizeBrazilianPhone } from '../utils/phoneNormalizer';

export const handleRespondiWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
        // Log every incoming attempt BEFORE auth — critical for debugging
        console.log('📋 [RespondiWebhook] Requisição recebida. Query params:', JSON.stringify({
            token: req.query.token ? '[PRESENTE]' : '[AUSENTE]',
        }));
        console.log('📋 [RespondiWebhook] Payload bruto:', JSON.stringify(req.body));
        console.log('📋 [RespondiWebhook] Campos recebidos:', Object.keys(req.body || {}));

        // SECURITY: Verify the request comes from the configured Respondi instance
        // Respondi sends the token as a URL query parameter: ?token=xxx
        const secret = process.env.RESPONDI_WEBHOOK_SECRET;
        if (!secret) {
            console.error('❌ [RespondiWebhook] RESPONDI_WEBHOOK_SECRET não está definido no ambiente. Todas as requisições serão rejeitadas.');
            res.status(500).json({ success: false, error: "Webhook secret not configured on server" });
            return;
        }

        const queryToken = req.query.token as string | undefined;
        if (queryToken !== secret) {
            console.warn('⚠️ [RespondiWebhook] Falha de autenticação. Token na URL:', queryToken ? '[INCORRETO]' : '[AUSENTE]');
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }

        // Respondi sends a nested payload: { form: {...}, respondent: { answers: {...}, raw_answers: [...] } }
        // The answers object is keyed by question title (e.g. "Qual o CPF do cadastro?": "12345678900")
        // Phone fields arrive as objects: { country: "55", phone: "54996600588" }
        const answers = req.body?.respondent?.answers ?? {};
        const rawAnswers: Array<{ question_title: string; answer: any }> = req.body?.respondent?.raw_answers ?? [];

        console.log('📋 [RespondiWebhook] Títulos das perguntas:', Object.keys(answers));

        // Helper: find answer by partial question title match (case-insensitive)
        const findAnswer = (keyword: string): any => {
            const key = Object.keys(answers).find(k => k.toLowerCase().includes(keyword.toLowerCase()));
            return key ? answers[key] : undefined;
        };

        // Extract phone — Respondi phone fields are objects { country, phone }
        const phoneAnswer = findAnswer('whatsapp') ?? findAnswer('telefone') ?? findAnswer('celular');
        let telefoneLimpo = '';
        if (phoneAnswer && typeof phoneAnswer === 'object' && phoneAnswer.phone) {
            telefoneLimpo = (phoneAnswer.country ?? '55') + phoneAnswer.phone.replace(/\D/g, '');
        } else if (phoneAnswer) {
            telefoneLimpo = String(phoneAnswer).replace(/\D/g, '');
            if (telefoneLimpo && !telefoneLimpo.startsWith('55')) {
                telefoneLimpo = '55' + telefoneLimpo;
            }
        }

        telefoneLimpo = normalizeBrazilianPhone(telefoneLimpo);

        if (!telefoneLimpo) {
            console.error('❌ [RespondiWebhook] Campo de telefone não encontrado nas respostas. Títulos disponíveis:', Object.keys(answers));
            res.status(400).json({ success: false, error: 'Campo de telefone ausente no payload' });
            return;
        }

        // Extract all fields by question title keywords
        const nomeRaw = findAnswer('nome completo') ?? findAnswer('nome');
        const cpfRaw = findAnswer('cpf');
        const emailRaw = findAnswer('email');
        const birthDateRaw = findAnswer('nascimento');
        const goalRaw = findAnswer('objetivo');
        const paymentDayRaw = findAnswer('vencimento');
        const enrollmentTargetRaw = findAnswer('procurando') ?? findAnswer('para quem');
        const extraInfoRaw = findAnswer('mais alguma coisa') ?? findAnswer('específica');
        const consentimentoRaw = findAnswer('consentimento') ?? findAnswer('lgpd');

        // Extract address — Respondi address fields are objects with street, number, city, etc.
        const addressRaw = findAnswer('endereço') ?? findAnswer('cep');
        let addressString: string | null = null;
        if (addressRaw && typeof addressRaw === 'object') {
            const parts = [
                addressRaw.street,
                addressRaw.number,
                addressRaw.addressComplement ?? addressRaw.complement,
                addressRaw.neighborhood,
                addressRaw.city,
                addressRaw.state,
                `CEP: ${addressRaw.cep ?? addressRaw.zipCode ?? addressRaw.zip}`,
                addressRaw.country,
            ].filter(Boolean);
            addressString = parts.join(', ');
        } else if (addressRaw) {
            addressString = String(addressRaw);
        }

        // Compute age from birthDate (expected format: "DD/MM/YYYY")
        let computedAge: number | null = null;
        if (birthDateRaw) {
            const parts = String(birthDateRaw).split('/');
            if (parts.length === 3) {
                const [day, month, year] = parts.map(Number);
                const birth = new Date(year, month - 1, day);
                const today = new Date();
                let age = today.getFullYear() - birth.getFullYear();
                const m = today.getMonth() - birth.getMonth();
                if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
                computedAge = age;
            }
        }

        const formData: Record<string, any> = {
            name: nomeRaw ? String(nomeRaw) : null,
            cpf: cpfRaw ? String(cpfRaw).replace(/\D/g, '').padStart(11, '0') : null,
            email: emailRaw ? String(emailRaw) : null,
            birthDate: birthDateRaw ? String(birthDateRaw) : null,
            address: addressString,
            paymentDay: paymentDayRaw ? parseInt(String(paymentDayRaw), 10) || null : null,
            goal: goalRaw ? String(goalRaw) : null,
            enrollmentTarget: enrollmentTargetRaw ? (Array.isArray(enrollmentTargetRaw) ? enrollmentTargetRaw.join(', ') : String(enrollmentTargetRaw)) : null,
            extraInfo: extraInfoRaw ? String(extraInfoRaw) : null,
            age: computedAge,
        };

        // Only set lgpdConsent to true — never overwrite an existing true → false
        if (consentimentoRaw === 'sim' || consentimentoRaw === true) {
            formData.lgpdConsent = true;
        }

        console.log('✅ [RespondiWebhook] Dados extraídos:', { telefone: telefoneLimpo, ...formData });

        // Smart lookup: try the normalized 13-digit phone first, then
        // the 12-digit variant (without the 9) to catch old records
        // created before the phone normalizer was introduced.
        let existingUser = await prisma.user.findUnique({
            where: { phoneNumber: telefoneLimpo },
        });

        if (!existingUser && telefoneLimpo.length === 13) {
            // Build the 12-digit variant: 55 + DDD + 8-digit number (remove the 9)
            const without9 = telefoneLimpo.slice(0, 4) + telefoneLimpo.slice(5);
            existingUser = await prisma.user.findUnique({
                where: { phoneNumber: without9 },
            });
            if (existingUser) {
                console.log(`🔄 [RespondiWebhook] Found old 12-digit record (${without9}). Normalizing to ${telefoneLimpo}.`);
            }
        }

        // Update existing record (also fixes the phone number if it was 12-digit),
        // or create a new one if the user hasn't chatted on WhatsApp yet.
        const upsertedUser = existingUser
            ? await prisma.user.update({
                where: { id: existingUser.id },
                data: { phoneNumber: telefoneLimpo, ...formData },
              })
            : await prisma.user.create({
                data: { phoneNumber: telefoneLimpo, ...formData },
              });

        console.log(`✅ [RespondiWebhook] Usuário salvo com sucesso. ID: ${upsertedUser.id}`);
        res.status(200).json({ success: true, record: upsertedUser.id });
    } catch (error) {
        console.error("❌ [RespondiWebhook] Erro ao salvar dados:", error);
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
};
