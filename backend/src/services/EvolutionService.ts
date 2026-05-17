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

    async instanceExists(instanceName: string): Promise<boolean> {
        const res = await getClient().get('/instance/fetchInstances');
        const instances = res.data as Array<{ name?: string; instanceName?: string }>;
        return instances.some(i => i.name === instanceName || i.instanceName === instanceName);
    },

    async disconnect(instance: string): Promise<void> {
        await getClient().delete(`/instance/logout/${instance}`);
    },

    async setWebhook(instance: string): Promise<void> {
        const serverUrl = process.env.SERVER_URL;
        if (!serverUrl) throw new Error('SERVER_URL ausente no .env');
        await getClient().post(`/webhook/set/${instance}`, {
            webhook: {
                enabled: true,
                url: `${serverUrl}/webhook/evolution`,
                webhookByEvents: false,
                webhookBase64: false,
                events: ['MESSAGES_UPSERT'],
            },
        });
    },

    async getOwnerPhone(instance: string): Promise<string | null> {
        try {
            const res = await getClient().get('/instance/fetchInstances');
            const instances = res.data as Array<{ name: string; ownerJid?: string }>;
            const found = instances.find(i => i.name === instance);
            if (!found?.ownerJid) return null;
            return found.ownerJid.replace('@s.whatsapp.net', '').replace('@lid', '');
        } catch {
            return null;
        }
    },

    async getContacts(instance: string): Promise<Array<{ phone: string; name: string | null; profilePicUrl: string | null }>> {
        try {
            const res = await getClient().post(`/chat/findContacts/${instance}`, { where: { isGroup: false } });
            const raw = res.data as Array<{ remoteJid: string; pushName?: string | null; profilePicUrl?: string | null }>;
            return raw
                .filter(c => c.remoteJid.includes('@s.whatsapp.net') && c.remoteJid !== '0@s.whatsapp.net')
                .map(c => ({
                    phone: '+' + c.remoteJid.replace('@s.whatsapp.net', ''),
                    name: c.pushName ?? null,
                    profilePicUrl: c.profilePicUrl ?? null,
                }));
        } catch {
            return [];
        }
    },

    async getMediaBase64(instance: string, messageData: object): Promise<{ base64: string; mediaType: string } | null> {
        try {
            const res = await getClient().post(`/chat/getBase64FromMediaMessage/${instance}`, {
                message: messageData,
            });
            const data = res.data as { base64?: string; mediaType?: string };
            if (!data?.base64) return null;
            return { base64: data.base64, mediaType: data.mediaType ?? 'application/octet-stream' };
        } catch {
            return null;
        }
    },

    async getWebhookStatus(instance: string): Promise<{ configured: boolean; url: string | null; enabled: boolean }> {
        try {
            const res = await getClient().get(`/webhook/find/${instance}`);
            // Evolution v2 retorna flat, v1 retorna aninhado em { webhook: {...} }
            const wh = (res.data as any)?.webhook ?? res.data;
            const url: string = wh?.url ?? '';
            return {
                configured: wh?.enabled === true && url.includes('/webhook/evolution'),
                url: url || null,
                enabled: wh?.enabled === true,
            };
        } catch {
            return { configured: false, url: null, enabled: false };
        }
    },
};
