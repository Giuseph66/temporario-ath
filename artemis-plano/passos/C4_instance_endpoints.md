# Passo C4 — Backend: Endpoints de Gestão de Instância WhatsApp

## Contexto
Artemis Bot em `/home/jesus/Neurelix/Artemis-Bot`. O painel precisa de endpoints para criar instância na Evolution, obter QR Code e verificar status — tudo que o frontend vai chamar na tela de Integrações.

**Pré-requisito:** Passos C1, C2, C3 concluídos. Middleware `requireAuth` do B1 funcionando.

## O que Fazer

**1. Crie `src/controllers/InstanceController.ts`**

```typescript
import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { prisma } from '../utils/prisma';
import { EvolutionService } from '../services/EvolutionService';

export async function createInstance(req: AuthRequest, res: Response) {
  const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
  if (!tenant) return res.status(404).json({ error: 'Tenant não encontrado' });

  // Nome da instância: artemis-{slug} para fácil identificação
  const instanceName = `artemis-${tenant.slug}`;

  await EvolutionService.createInstance(instanceName);

  await prisma.tenant.update({
    where: { id: req.tenantId },
    data: { evolutionInstance: instanceName },
  });

  return res.json({ instance: instanceName });
}

export async function getQRCode(req: AuthRequest, res: Response) {
  const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
  if (!tenant?.evolutionInstance) {
    return res.status(400).json({ error: 'Instância não criada. Crie primeiro via POST /api/instances/create' });
  }

  const qr = await EvolutionService.getQRCode(tenant.evolutionInstance);
  if (!qr) return res.status(202).json({ status: 'connecting', qr: null });

  return res.json({ status: 'connecting', qr });
}

export async function getStatus(req: AuthRequest, res: Response) {
  const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
  if (!tenant?.evolutionInstance) {
    return res.json({ status: 'not_created' });
  }

  const status = await EvolutionService.getStatus(tenant.evolutionInstance);
  return res.json({ status, instance: tenant.evolutionInstance });
}

export async function disconnectInstance(req: AuthRequest, res: Response) {
  const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
  if (!tenant?.evolutionInstance) return res.status(400).json({ error: 'Sem instância ativa' });

  await EvolutionService.disconnect(tenant.evolutionInstance);
  await prisma.tenant.update({ where: { id: req.tenantId }, data: { evolutionInstance: null } });

  return res.json({ ok: true });
}
```

**2. Registre as rotas em `src/index.ts`**

```typescript
import { requireAuth } from './middlewares/auth';
import { createInstance, getQRCode, getStatus, disconnectInstance } from './controllers/InstanceController';

app.post('/api/instances/create',    requireAuth, createInstance);
app.get('/api/instances/qrcode',     requireAuth, getQRCode);
app.get('/api/instances/status',     requireAuth, getStatus);
app.delete('/api/instances/disconnect', requireAuth, disconnectInstance);
```

## Verificação
Com token válido no header:
```bash
# Verificar status
curl http://localhost:3000/api/instances/status \
  -H "Authorization: Bearer SEU_TOKEN"
# Deve retornar: {"status":"not_created"} ou {"status":"open","instance":"artemis-confluence"}

# Criar instância
curl -X POST http://localhost:3000/api/instances/create \
  -H "Authorization: Bearer SEU_TOKEN"
# Deve retornar: {"instance":"artemis-confluence"}
```
