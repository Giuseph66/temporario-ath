// Simple stroke icons, 24x24 viewBox. Inherit currentColor.
// Each icon corresponds to a "power" the agent can be granted.

const Ico = {
  // payment — banknote-like rectangle with circle in middle + arrows
  payment: (p) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="2.5" y="6.5" width="19" height="11" rx="1.5" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M5.5 9.5h.01M18.5 14.5h.01" />
    </svg>
  ),
  // balance — line chart
  balance: (p) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 19h18" />
      <path d="M5 15l4-4 3 3 6-7" />
      <path d="M14 7h4v4" />
    </svg>
  ),
  // message — chat bubble
  message: (p) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 5h16v11H8l-4 4z" />
      <path d="M8 9h8M8 12h5" />
    </svg>
  ),
  // calendar
  calendar: (p) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3.5" y="5" width="17" height="15" rx="1.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  ),
  // orders — package
  orders: (p) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 7.5l9-4 9 4v9l-9 4-9-4v-9z" />
      <path d="M3 7.5l9 4 9-4M12 11.5v9" />
    </svg>
  ),
  // knowledge — book
  knowledge: (p) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 4h7a3 3 0 013 3v13a2 2 0 00-2-2H4z" />
      <path d="M20 4h-7a3 3 0 00-3 3v13a2 2 0 012-2h8z" />
    </svg>
  ),
  // handoff — user with arrow
  handoff: (p) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20c.8-3.5 3-5 6-5s5.2 1.5 6 5" />
      <path d="M16 6l3 2.5L16 11M19 8.5h-5" />
    </svg>
  ),
  // task — checklist
  task: (p) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 9l2 2 4-4M8 15h8" />
    </svg>
  ),
  // crm — contact card
  crm: (p) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
      <circle cx="9" cy="11" r="2" />
      <path d="M5.5 16.5c.7-2 2-3 3.5-3s2.8 1 3.5 3M14.5 9.5h4M14.5 12.5h4M14.5 15.5h3" />
    </svg>
  ),
  // generic check
  check: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 12l5 5 11-11" />
    </svg>
  ),
  chevron: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  ),
  shield: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
    </svg>
  ),
  clock: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
    </svg>
  ),
  bolt: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M13 3L4 14h6l-1 7 9-11h-6z" />
    </svg>
  ),
  dot: (p) => (
    <svg width="8" height="8" viewBox="0 0 8 8" {...p}><circle cx="4" cy="4" r="4" fill="currentColor" /></svg>
  ),
  search: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>
    </svg>
  ),
  whatsapp: (p) => (
    // generic chat-bubble badge, not the WhatsApp logo
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M4 4h16v12H8l-4 4z"/>
    </svg>
  ),
  settings: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 12.7a8 8 0 000-1.4l2-1.5-2-3.4-2.3.9a8 8 0 00-1.2-.7L15.5 4h-4l-.4 2.5a8 8 0 00-1.2.7l-2.3-.9-2 3.4 2 1.5a8 8 0 000 1.4l-2 1.5 2 3.4 2.3-.9a8 8 0 001.2.7l.4 2.5h4l.4-2.5a8 8 0 001.2-.7l2.3.9 2-3.4z"/>
    </svg>
  ),
  plus: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 5v14M5 12h14"/>
    </svg>
  ),
};

// Power catalog used across variations.
const POWERS = [
  { id:'payment', icon: Ico.payment, name:'Executar pagamento', short:'Pix, boleto e transferências',
    desc:'O agente pode iniciar pagamentos e transferências em nome do usuário.',
    risk:'high', defaults:{ limit:'R$ 500', approval:'sempre' } },
  { id:'balance', icon: Ico.balance, name:'Consultar saldo & extrato', short:'Leitura de dados financeiros',
    desc:'Permite consultar saldo, extrato e movimentações da conta.',
    risk:'low', defaults:{ scope:'Conta corrente + cartão' } },
  { id:'message', icon: Ico.message, name:'Enviar mensagens', short:'Disparar mensagens a contatos',
    desc:'Pode redigir e enviar mensagens em nome do usuário para outros contatos.',
    risk:'med', defaults:{ rate:'30/dia', approval:'1ª vez' } },
  { id:'calendar', icon: Ico.calendar, name:'Agendar reuniões', short:'Criar eventos e convites',
    desc:'Pode criar, mover e cancelar eventos em calendários conectados.',
    risk:'low', defaults:{ calendar:'Google · Trabalho', window:'Seg–Sex 9h–18h' } },
  { id:'orders', icon: Ico.orders, name:'Consultar pedidos', short:'Status & rastreamento',
    desc:'Pode consultar o status, prazo e rastreio de pedidos no ERP conectado.',
    risk:'low', defaults:{ source:'Shopify + Bling' } },
  { id:'knowledge', icon: Ico.knowledge, name:'Buscar na base', short:'Knowledge base & docs',
    desc:'Pode pesquisar em FAQs, manuais e documentos internos para responder dúvidas.',
    risk:'low', defaults:{ sources:'4 coleções · 1.2k docs' } },
  { id:'handoff', icon: Ico.handoff, name:'Transferir para humano', short:'Escalar para atendente',
    desc:'Pode escalar a conversa para um humano quando perceber complexidade ou desconforto.',
    risk:'low', defaults:{ team:'Atendimento · turno atual' } },
  { id:'task', icon: Ico.task, name:'Criar tarefa / lembrete', short:'Tarefas para o usuário',
    desc:'Cria lembretes e tarefas para o usuário ou para a equipe.',
    risk:'low', defaults:{ destination:'Asana · Inbox' } },
  { id:'crm', icon: Ico.crm, name:'Acessar CRM', short:'Ler e atualizar contatos',
    desc:'Lê e atualiza fichas de contatos, oportunidades e tags no CRM.',
    risk:'med', defaults:{ system:'HubSpot · workspace principal' } },
];

window.Ico = Ico;
window.POWERS = POWERS;
