# Passo E3 — Backend: Endpoints de Configuração do Agente

## Contexto
Artemis Bot em `/home/jesus/Neurelix/Artemis-Bot`. O painel precisa ler e atualizar a configuração do agente (persona, programas, settings) sem rebuild do backend. Os JSONs ficam no banco no modelo `Agent`.

**Pré-requisito:** Passo A4 (modelo Agent criado) + Sprint B (auth middleware).

## O que Fazer

**1. Crie `src/controllers/AgentController.ts`**

```typescript
import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { prisma } from '../utils/prisma';

export async function getAgent(req: AuthRequest, res: Response) {
  const agent = await prisma.agent.findFirst({ where: { tenantId: req.tenantId } });
  if (!agent) return res.status(404).json({ error: 'Agente não encontrado' });
  return res.json(agent);
}

export async function updatePersona(req: AuthRequest, res: Response) {
  const { personaJson } = req.body;
  if (!personaJson || typeof personaJson !== 'object') {
    return res.status(400).json({ error: 'personaJson inválido' });
  }
  // Validação mínima
  if (!personaJson.name || !personaJson.role) {
    return res.status(400).json({ error: 'persona precisa ter name e role' });
  }

  const agent = await prisma.agent.findFirst({ where: { tenantId: req.tenantId } });
  if (!agent) return res.status(404).json({ error: 'Agente não encontrado' });

  await prisma.agent.update({ where: { id: agent.id }, data: { personaJson } });
  return res.json({ ok: true });
}

export async function updatePrograms(req: AuthRequest, res: Response) {
  const { programsJson } = req.body;
  if (!programsJson || !Array.isArray(programsJson.programs)) {
    return res.status(400).json({ error: 'programsJson deve ter campo programs[]' });
  }

  const agent = await prisma.agent.findFirst({ where: { tenantId: req.tenantId } });
  if (!agent) return res.status(404).json({ error: 'Agente não encontrado' });

  await prisma.agent.update({ where: { id: agent.id }, data: { programsJson } });
  return res.json({ ok: true });
}

export async function updateSettings(req: AuthRequest, res: Response) {
  const { settingsJson } = req.body;
  if (!settingsJson || typeof settingsJson !== 'object') {
    return res.status(400).json({ error: 'settingsJson inválido' });
  }

  const agent = await prisma.agent.findFirst({ where: { tenantId: req.tenantId } });
  if (!agent) return res.status(404).json({ error: 'Agente não encontrado' });

  await prisma.agent.update({ where: { id: agent.id }, data: { settingsJson } });
  return res.json({ ok: true });
}

export async function toggleAgent(req: AuthRequest, res: Response) {
  const agent = await prisma.agent.findFirst({ where: { tenantId: req.tenantId } });
  if (!agent) return res.status(404).json({ error: 'Agente não encontrado' });

  await prisma.agent.update({ where: { id: agent.id }, data: { isActive: !agent.isActive } });
  return res.json({ isActive: !agent.isActive });
}
```

**2. Atualize o `ConfigLoader.ts` para ler do banco por tenantId**
Leia `src/services/ConfigLoader.ts`. Atualmente lê dos arquivos JSON. Adicione um método `getAgentConfig(tenantId)` que busca o Agent no banco e retorna `{ persona, programs, settings }`:

```typescript
async getAgentConfig(tenantId: string) {
  const agent = await prisma.agent.findFirst({ where: { tenantId, isActive: true } });
  if (!agent) throw new Error(`Agent não encontrado para tenant ${tenantId}`);
  return {
    persona: agent.personaJson as PersonaConfig,
    programs: (agent.programsJson as any).programs as ProgramConfig[],
    settings: (agent.settingsJson as any).settings as SettingsConfig,
  };
}
```

**3. Registre as rotas em `src/index.ts`**

```typescript
import { getAgent, updatePersona, updatePrograms, updateSettings, toggleAgent } from './controllers/AgentController';
app.get('/api/agent',                requireAuth, getAgent);
app.patch('/api/agent/persona',      requireAuth, updatePersona);
app.patch('/api/agent/programs',     requireAuth, updatePrograms);
app.patch('/api/agent/settings',     requireAuth, updateSettings);
app.patch('/api/agent/toggle',       requireAuth, toggleAgent);
```

## Verificação
```bash
# Ler config atual
curl http://localhost:3000/api/agent -H "Authorization: Bearer TOKEN"

# Atualizar persona
curl -X PATCH http://localhost:3000/api/agent/persona \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"personaJson":{"name":"Artemis","role":"IA Confluence",...}}'
```
Deve retornar `{"ok":true}`. Bot deve usar a nova persona na próxima mensagem.

```bash
npm run build
```
Sem erros.
