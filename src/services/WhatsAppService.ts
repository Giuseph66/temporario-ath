import axios from 'axios';
import dotenv from 'dotenv';
import { parsePhoneNumber } from 'libphonenumber-js';

dotenv.config();

export class WhatsAppService {
    private token: string;
    private phoneId: string;
    private baseUrl: string;

    constructor() {
        this.token = process.env.META_ACCESS_TOKEN || '';
        this.phoneId = process.env.META_PHONE_ID || '';
        this.baseUrl = `https://graph.facebook.com/v17.0/${this.phoneId}/messages`;

        // Se faltar chave, avisa no terminal (mas não trava)
        if (!this.token || !this.phoneId) {
            console.warn("⚠️  AVISO: Credenciais da Meta não configuradas no .env");
        }
    }

    // AQUI ESTÁ A FUNÇÃO QUE ESTAVA FALTANDO 👇
    async sendText(to: string, message: string) {
        try {
            // --- LOGICA SEGURA DE CORREÇÃO DE NÚMEROS ---
let formattedNumber = to;
try {
    // Tenta formatar apenas se for número brasileiro (começa com 55)
    if (to.startsWith('55')) {
        // A biblioteca exige o '+' na frente para identificar o código do país
        const phoneNumber = parsePhoneNumber('+' + to);
        if (phoneNumber && phoneNumber.isValid()) {
            // O .number retorna no padrão E.164 (ex: +5511999999999)
            // O WhatsApp exige sem o '+', então nós removemos
            formattedNumber = phoneNumber.number.replace('+', '');
        }
    }
} catch (e) {
    console.warn(`⚠️ Aviso: Falha ao validar o número ${to}. Usando formato original.`);
}
            // ----------------------------------------------

            await axios.post(
                this.baseUrl,
                {
                    messaging_product: 'whatsapp',
                    to: formattedNumber, // Envia para o número corrigido
                    text: { body: message },
                },
                {
                    headers: {
                        Authorization: `Bearer ${this.token}`,
                        'Content-Type': 'application/json',
                    },
                }
            );
            console.log(`✅ Mensagem enviada para ${formattedNumber}`);
        } catch (error: any) {
            console.error('❌ Erro ao enviar mensagem:', error.response?.data || error.message);
        }
    }
}