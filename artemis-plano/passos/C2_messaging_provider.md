# Passo C2 — Backend: Abstração MessagingProvider

## Contexto
Artemis Bot em `/home/jesus/Neurelix/Artemis-Bot`. Criando interface para abstrair o canal de mensagens. Hoje o código chama `WhatsAppService` diretamente (Meta API). Com a abstração, o mesmo código de bot pode usar Evolution ou Meta API — a troca é por config do tenant, não por mudança de código.

**Pré-requisito:** Passo C1 concluído.

## O que Fazer

**1. Crie `src/services/MessagingProvider.ts`**

```typescript
import { EvolutionService } from './EvolutionService';

export interface IMessagingProvider {
  sendMessage(to: string, text: string): Promise<void>;
}

// Provider usando Evolution API (padrão para SaaS)
export class EvolutionProvider implements IMessagingProvider {
  constructor(private instance: string) {}

  async sendMessage(to: string, text: string): Promise<void> {
    await EvolutionService.sendText(this.instance, to, text);
  }
}

// Provider usando Meta API oficial (mantém compatibilidade atual)
export class MetaProvider implements IMessagingProvider {
  async sendMessage(to: string, text: string): Promise<void> {
    // Importar e usar o WhatsAppService existente
    const { WhatsAppService } = await import('./WhatsAppService');
    const svc = new WhatsAppService();
    await svc.sendMessage(to, text);
  }
}

// Factory: resolve o provider correto baseado no tenant
export function resolveProvider(tenant: { evolutionInstance?: string | null }): IMessagingProvider {
  if (tenant.evolutionInstance) {
    return new EvolutionProvider(tenant.evolutionInstance);
  }
  return new MetaProvider();
}
```

**2. Atualize `src/controllers/WebhookController.ts` para usar o provider**
Leia o arquivo. Onde o código chama `whatsappService.sendMessage(...)` diretamente, substitua por:

```typescript
import { resolveProvider } from '../services/MessagingProvider';
import { prisma } from '../utils/prisma';

// Dentro do handler, após resolver o tenant:
const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
const provider = resolveProvider(tenant!);
await provider.sendMessage(to, responseText);
```

**Nota:** O `tenantId` virá do contexto do webhook Evolution (resolvido pelo campo `instance`). Para o webhook Meta atual, usar o tenant da Confluence hardcoded por enquanto até a migração completa.

## Verificação
```bash
npm run build
```
Sem erros de tipo. O código compila com a interface `IMessagingProvider` usada corretamente.
