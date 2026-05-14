# S4 — Frontend: Implementar Páginas Faltantes

## Arquivos (após rename packages/dashboard → frontend/)

### frontend/src/pages/Dashboard.tsx
**Dados:** GET /api/metrics
**UI:**
- Row de 4 cards: Total Leads, Matriculados, Conversas Hoje, Taxa Conversão
- Card "Agente": nome, status ativo/inativo, toggle
- Lista das últimas 5 interações (nome lead + tempo relativo)

### frontend/src/pages/Leads.tsx
**Dados:** GET /api/leads (com pagination/filtro)
**UI:**
- Barra de busca (nome/telefone) + dropdown filtro de status
- Tabela: Nome | Telefone | Status (badge) | Última interação | Criado em
- Status badges: LEAD=cinza, PAYMENT_PENDING=âmbar, ENROLLED=verde, CANCELLED=vermelho
- Click em linha → modal lateral com: todos os campos do lead + histórico de mensagens
- Modal actions: mudar status (PATCH /api/leads/:id/state), deletar (DELETE)
- Botão "Exportar JSON" (mover de Settings)

### frontend/src/pages/Conversas.tsx
**Dados:** GET /api/conversations (lista) + GET /api/leads/:id (detalhe)
**UI:**
- Layout dois painéis (lista esquerda 320px + chat direita)
- Lista: avatar inicial do nome, nome, preview última msg, timestamp
- Busca na lista
- Chat: bolhas de mensagem (user=direita claro, assistant=esquerda escuro)
- Sem funcionalidade de envio de mensagem (só visualização)

### frontend/src/pages/Agente.tsx
**Dados:** GET/PATCH /api/agent, GET/PATCH /api/agent/persona, /programs, /settings, /toggle
**UI:**
- Tab ou seções: Identidade | Programas | Configurações
- Identidade: input nome, textarea role/descrição, input whatsappNumber, select geminiModel
- Programas: lista de programs[], cada um com nome + preço. Add/Edit/Delete inline
- Configurações: JSON editor ou campos chave-valor do settingsJson
- Toggle ativo/inativo com confirmação

### frontend/src/pages/Integracoes.tsx
**Dados:** GET /api/integrations + PATCH por provider
**UI:**
- Grid de cards 2x2
- Card Evolution: status badge, campos URL + API Key, botão "Gerenciar Instância" (abre sub-seção com QR code)
- Card Meta WhatsApp: status badge, campos Token + Phone ID + Verify Token, caixa com webhook URL para copiar
- Card Asaas: status badge, campo API Key, toggle Sandbox/Produção (muda baseUrl automaticamente)
- Card Google Calendar: status badge, campo Calendar ID

## Critério de conclusão
- Nenhuma rota exibe "em breve"
- `cd frontend && npm run build` sem erros
