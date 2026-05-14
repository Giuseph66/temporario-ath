import { EvolutionService } from './EvolutionService';

export interface IMessagingProvider {
    sendMessage(to: string, text: string): Promise<void>;
    sendText(to: string, text: string): Promise<void>;
}

export class EvolutionProvider implements IMessagingProvider {
    constructor(private instance: string) {}

    async sendMessage(to: string, text: string): Promise<void> {
        await EvolutionService.sendText(this.instance, to, text);
    }

    async sendText(to: string, text: string): Promise<void> {
        await EvolutionService.sendText(this.instance, to, text);
    }
}

export class MetaProvider implements IMessagingProvider {
    async sendMessage(to: string, text: string): Promise<void> {
        const { WhatsAppService } = await import('./WhatsAppService');
        const svc = new WhatsAppService();
        await svc.sendText(to, text);
    }

    async sendText(to: string, text: string): Promise<void> {
        return this.sendMessage(to, text);
    }
}

export function resolveProvider(tenant: { evolutionInstance?: string | null }): IMessagingProvider {
    if (tenant.evolutionInstance) {
        return new EvolutionProvider(tenant.evolutionInstance);
    }
    return new MetaProvider();
}
