import axios from 'axios';

function getClient() {
    const baseURL = process.env.EVOLUTION_BASE_URL;
    const globalApiKey = process.env.EVOLUTION_API_KEY;
    if (!baseURL || !globalApiKey) {
        throw new Error('EVOLUTION_BASE_URL e EVOLUTION_API_KEY são obrigatórios');
    }
    return axios.create({
        baseURL,
        headers: { apikey: globalApiKey },
        timeout: 15000,
    });
}

export const EvolutionService = {
    async sendText(instance: string, phone: string, text: string): Promise<void> {
        await getClient().post(`/message/sendText/${instance}`, { number: phone, text });
    },

    async getQRCode(instance: string): Promise<string | null> {
        try {
            const res = await getClient().get(`/instance/connect/${instance}`);
            return (res.data as { base64?: string })?.base64 ?? null;
        } catch {
            return null;
        }
    },

    async getStatus(instance: string): Promise<'open' | 'close' | 'connecting'> {
        try {
            const res = await getClient().get(`/instance/connectionState/${instance}`);
            return (res.data as { instance?: { state?: string } })?.instance?.state as 'open' | 'close' | 'connecting' ?? 'close';
        } catch {
            return 'close';
        }
    },

    async createInstance(instanceName: string): Promise<void> {
        await getClient().post('/instance/create', {
            instanceName,
            qrcode: true,
            integration: 'WHATSAPP-BAILEYS',
        });
    },

    async disconnect(instance: string): Promise<void> {
        await getClient().delete(`/instance/logout/${instance}`);
    },
};
