// V2 — Console: split view, dense, Linear-style, with execution log.

const v2c = {
  page: {
    width:'100%', height:'100%', overflow:'hidden',
    background:'var(--paper)', color:'var(--ink-1)',
    fontFamily:"'Geist', -apple-system, system-ui, sans-serif",
    display:'grid', gridTemplateColumns:'248px 1fr 380px',
  },

  // sidebar
  side: { background:'#fafaf7', borderRight:'1px solid var(--line)', display:'flex', flexDirection:'column', minWidth:0 },
  sideHead: { padding:'14px 16px 10px', borderBottom:'1px solid var(--line)' },
  brand: { display:'flex', alignItems:'center', gap:8, marginBottom:14 },
  brandMark: { width:24, height:24, borderRadius:6, background:'var(--ink-1)', color:'var(--paper)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Geist Mono', monospace", fontWeight:600, fontSize:13 },
  brandName: { fontWeight:600, fontSize:14, letterSpacing:-0.1 },
  search: { display:'flex', alignItems:'center', gap:8, padding:'7px 10px', background:'var(--paper)', border:'1px solid var(--line)', borderRadius:7, color:'var(--ink-4)', fontSize:12.5 },
  sideLabel: { padding:'14px 16px 6px', fontSize:10.5, fontFamily:"'Geist Mono', monospace", textTransform:'uppercase', letterSpacing:0.6, color:'var(--ink-4)', display:'flex', justifyContent:'space-between' },
  agentRow: (sel) => ({
    display:'flex', alignItems:'center', gap:10, padding:'7px 16px',
    cursor:'pointer', borderLeft: sel?'2px solid var(--accent)':'2px solid transparent',
    background: sel?'var(--paper)':'transparent',
  }),
  agentAv: (color) => ({ width:26, height:26, borderRadius:'50%', background:color, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:600, flexShrink:0, fontFamily:"'Fraunces', serif" }),
  agentMain: { flex:1, minWidth:0 },
  agentName: { fontSize:13, fontWeight:500, color:'var(--ink-1)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' },
  agentMeta: { fontSize:11, color:'var(--ink-4)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', fontFamily:"'Geist Mono', monospace" },
  statusDot: (c) => ({ width:7, height:7, borderRadius:'50%', background:c, flexShrink:0 }),

  newBtn: { margin:'10px 12px', padding:'7px 10px', borderRadius:7, border:'1px dashed var(--line-2)', background:'transparent', color:'var(--ink-3)', fontSize:12.5, display:'flex', alignItems:'center', justifyContent:'center', gap:6, cursor:'pointer', fontFamily:'inherit' },

  // center
  center: { display:'flex', flexDirection:'column', minWidth:0, overflow:'hidden' },
  centerHead: { padding:'14px 24px', borderBottom:'1px solid var(--line)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:16 },
  centerTitle: { display:'flex', alignItems:'center', gap:12 },
  centerAvatar: { width:38, height:38, borderRadius:'50%', background:'#7a5b3a', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Fraunces', serif", fontSize:17, fontWeight:500 },
  centerName: { fontSize:18, fontWeight:600, letterSpacing:-0.2, margin:0 },
  centerSub: { fontSize:12, color:'var(--ink-4)', fontFamily:"'Geist Mono', monospace", marginTop:1 },
  tabBar: { display:'flex', gap:0, padding:'0 24px', borderBottom:'1px solid var(--line)' },
  tab: (sel) => ({
    padding:'10px 0', marginRight:24, fontSize:13, fontWeight: sel?600:500, color: sel?'var(--ink-1)':'var(--ink-4)',
    borderBottom: sel?'2px solid var(--ink-1)':'2px solid transparent', cursor:'pointer', display:'flex', alignItems:'center', gap:6,
  }),
  tabCount: { fontSize:11, fontFamily:"'Geist Mono', monospace", color:'var(--ink-4)', background:'var(--paper-2)', padding:'1px 6px', borderRadius:4 },
  centerBody: { flex:1, overflow:'auto', padding:'8px 0' },

  pwrHeader: { display:'grid', gridTemplateColumns:'24px 1fr 140px 110px 70px', alignItems:'center', gap:14, padding:'8px 24px', fontSize:10.5, fontFamily:"'Geist Mono', monospace", textTransform:'uppercase', letterSpacing:0.6, color:'var(--ink-4)', borderBottom:'1px solid var(--line)' },
  pwrRow: (on) => ({
    display:'grid', gridTemplateColumns:'24px 1fr 140px 110px 70px', alignItems:'center', gap:14,
    padding:'12px 24px', borderBottom:'1px solid var(--line)',
    background: on?'transparent':'var(--paper-2)',
    opacity: on?1:.7,
  }),
  pwrIcon: (on) => ({ width:26, height:26, borderRadius:6, background: on?'var(--accent-soft)':'var(--paper-3)', color: on?'var(--accent-ink)':'var(--ink-4)', display:'flex', alignItems:'center', justifyContent:'center' }),
  pwrName: { fontSize:13.5, fontWeight:500, color:'var(--ink-1)' },
  pwrDesc: { fontSize:12, color:'var(--ink-4)', marginTop:2 },
  pwrDetail: { fontSize:11.5, color:'var(--ink-3)', fontFamily:"'Geist Mono', monospace" },
  pwrChip: (risk) => ({
    display:'inline-flex', alignItems:'center', gap:4,
    padding:'2px 7px', borderRadius:4, fontSize:10.5, textTransform:'uppercase', letterSpacing:0.4,
    background: risk==='high'?'var(--danger-soft)':risk==='med'?'var(--amber-soft)':'var(--accent-soft)',
    color: risk==='high'?'var(--danger)':risk==='med'?'var(--amber)':'var(--accent-ink)',
    fontFamily:"'Geist Mono', monospace",
  }),

  // toggle
  toggle:(on)=>({ width:30, height:18, borderRadius:999, background: on?'var(--accent)':'var(--ink-5)', position:'relative', cursor:'pointer', flexShrink:0 }),
  toggleKnob:(on)=>({ position:'absolute', top:2, left: on?14:2, width:14, height:14, borderRadius:'50%', background:'#fff', transition:'left .15s', boxShadow:'0 1px 2px rgba(0,0,0,.15)' }),

  // log
  log: { background:'#191713', color:'#cfc8b6', borderLeft:'1px solid var(--line)', display:'flex', flexDirection:'column', minWidth:0 },
  logHead: { padding:'14px 18px', borderBottom:'1px solid #2a2722', display:'flex', alignItems:'center', justifyContent:'space-between' },
  logTitle: { fontSize:13, fontWeight:600, color:'#f1ecdc', display:'flex', alignItems:'center', gap:8 },
  liveDot: { width:7, height:7, borderRadius:'50%', background:'#5ec88a', boxShadow:'0 0 0 3px rgba(94,200,138,.18)' },
  logBody: { flex:1, overflow:'auto', padding:'4px 0', fontFamily:"'Geist Mono', monospace", fontSize:11.5, lineHeight:1.55 },
  logRow: { padding:'9px 18px', borderBottom:'1px solid #221f1a', display:'flex', flexDirection:'column', gap:3 },
  logTop: { display:'flex', justifyContent:'space-between', gap:8, color:'#7a7468', fontSize:10.5 },
  logTag: (kind) => ({
    display:'inline-block', padding:'1px 6px', borderRadius:3, fontSize:9.5, textTransform:'uppercase', letterSpacing:0.5, fontWeight:600,
    color: kind==='ok'?'#7ad79c': kind==='wait'?'#e6b15a': kind==='err'?'#e88a76':'#9d9788',
    background: kind==='ok'?'rgba(122,215,156,.12)': kind==='wait'?'rgba(230,177,90,.15)': kind==='err'?'rgba(232,138,118,.15)':'rgba(180,170,150,.08)',
  }),
  logMain: { color:'#e6dfc8' },
  logSub: { color:'#928c7a', fontSize:10.5 },
};

const v2Agents = [
  { id:'sofia', initial:'S', color:'#7a5b3a', name:'Sofia', role:'Atendimento · Cobrança', last:'agora · 1.2k conv', status:'on', sel:true },
  { id:'caio', initial:'C', color:'#34556a', name:'Caio', role:'Vendas inbound', last:'4 min · 312 conv', status:'on' },
  { id:'lara', initial:'L', color:'#5d3a55', name:'Lara', role:'Pós-venda · NPS', last:'12 min · 86 conv', status:'on' },
  { id:'bruno', initial:'B', color:'#3e5e3a', name:'Bruno', role:'Recuperação de carrinho', last:'1h · 540 conv', status:'on' },
  { id:'maya', initial:'M', color:'#8a4a3a', name:'Maya', role:'Onboarding novos clientes', last:'pausada', status:'off' },
  { id:'dora', initial:'D', color:'#4a4a4a', name:'Dora', role:'Suporte técnico nível 1', last:'rascunho', status:'draft' },
];

const v2Log = [
  { time:'14:32:08', tag:'ok', agent:'sofia', action:'consultar saldo', sub:'cliente 9821 · saldo R$ 1.842,30', ms:'412ms' },
  { time:'14:32:01', tag:'ok', agent:'sofia', action:'enviar mensagem', sub:'→ +55 11 9 8217-1102', ms:'128ms' },
  { time:'14:31:54', tag:'wait', agent:'sofia', action:'executar pagamento · Pix R$ 1.420,00', sub:'aprovação humana em fila · marina@acme.com', ms:'…' },
  { time:'14:31:30', tag:'ok', agent:'sofia', action:'consultar pedido', sub:'#A-29841 · em trânsito', ms:'318ms' },
  { time:'14:30:12', tag:'ok', agent:'sofia', action:'buscar na base', sub:'"política de estorno" · 3 trechos', ms:'209ms' },
  { time:'14:29:48', tag:'ok', agent:'sofia', action:'agendar reunião', sub:'amanhã 10h · Marina × Cliente Souza', ms:'502ms' },
  { time:'14:29:02', tag:'err', agent:'sofia', action:'acessar CRM', sub:'HubSpot 429 rate-limit · retry em 12s', ms:'1.8s' },
  { time:'14:28:31', tag:'ok', agent:'sofia', action:'transferir p/ humano', sub:'fila Atendimento · pos 2', ms:'88ms' },
  { time:'14:27:50', tag:'ok', agent:'sofia', action:'criar tarefa', sub:'Asana · "ligar p/ cliente 8821"', ms:'241ms' },
  { time:'14:27:11', tag:'ok', agent:'sofia', action:'consultar saldo', sub:'cliente 8211 · saldo R$ 312,80', ms:'389ms' },
  { time:'14:26:42', tag:'wait', agent:'sofia', action:'executar pagamento · boleto R$ 89,90', sub:'limite diário OK · aguardando confirmação cliente', ms:'…' },
];

function V2Toggle({ on }) { return <div style={v2c.toggle(on)}><div style={v2c.toggleKnob(on)}/></div>; }

function V2PowerRow({ p, on }) {
  return (
    <div style={v2c.pwrRow(on)}>
      <div style={v2c.pwrIcon(on)}><p.icon/></div>
      <div>
        <div style={v2c.pwrName}>{p.name}</div>
        <div style={v2c.pwrDesc}>{p.desc}</div>
      </div>
      <div style={v2c.pwrDetail}>{Object.values(p.defaults).join(' · ')}</div>
      <div>
        <span style={v2c.pwrChip(p.risk)}>
          {p.risk==='high'?'risco alto':p.risk==='med'?'risco médio':'risco baixo'}
        </span>
      </div>
      <div style={{display:'flex', justifyContent:'flex-end', alignItems:'center', gap:8}}>
        <V2Toggle on={on}/>
      </div>
    </div>
  );
}

function V2Console() {
  const enabled = { payment:true, balance:true, message:true, calendar:true, orders:true, knowledge:true, handoff:true, task:false, crm:true };
  return (
    <div style={v2c.page}>
      {/* SIDEBAR */}
      <div style={v2c.side}>
        <div style={v2c.sideHead}>
          <div style={v2c.brand}>
            <div style={v2c.brandMark}>Z</div>
            <div style={v2c.brandName}>Zap Console</div>
          </div>
          <div style={v2c.search}><Ico.search/> <span>Buscar agente…</span> <span style={{marginLeft:'auto', fontFamily:"'Geist Mono', monospace", fontSize:11}}>⌘K</span></div>
        </div>

        <div style={v2c.sideLabel}>
          <span>Agentes</span>
          <span>{v2Agents.length}</span>
        </div>
        <div style={{flex:1, overflow:'auto', paddingBottom:8}}>
          {v2Agents.map(a => (
            <div key={a.id} style={v2c.agentRow(a.sel)}>
              <div style={v2c.agentAv(a.color)}>{a.initial}</div>
              <div style={v2c.agentMain}>
                <div style={v2c.agentName}>{a.name}</div>
                <div style={v2c.agentMeta}>{a.role}</div>
              </div>
              <div style={v2c.statusDot(a.status==='on'?'var(--accent)':a.status==='off'?'var(--ink-5)':'var(--amber)')}/>
            </div>
          ))}
          <button style={v2c.newBtn}><Ico.plus/> Novo agente</button>
        </div>

        <div style={{padding:'12px 16px', borderTop:'1px solid var(--line)', display:'flex', alignItems:'center', gap:10, fontSize:12, color:'var(--ink-3)'}}>
          <div style={{...v2c.agentAv('#2a2823'), width:24, height:24, fontSize:11}}>MA</div>
          <div style={{flex:1, minWidth:0}}>
            <div style={{color:'var(--ink-1)', fontWeight:500, fontSize:12.5}}>Marina Aoki</div>
            <div style={{fontSize:10.5, color:'var(--ink-4)', fontFamily:"'Geist Mono', monospace"}}>admin · acme</div>
          </div>
          <Ico.settings/>
        </div>
      </div>

      {/* CENTER */}
      <div style={v2c.center}>
        <div style={v2c.centerHead}>
          <div style={v2c.centerTitle}>
            <div style={v2c.centerAvatar}>S</div>
            <div>
              <h2 style={v2c.centerName}>Sofia</h2>
              <div style={v2c.centerSub}>+55 11 4000-1820 · Sonnet 4.5 · ativa há 41 dias</div>
            </div>
          </div>
          <div style={{display:'flex', gap:8}}>
            <button style={{padding:'7px 12px', borderRadius:7, border:'1px solid var(--line-2)', background:'var(--paper)', fontSize:12.5, color:'var(--ink-2)', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6, fontFamily:'inherit'}}>
              <Ico.bolt/> Testar
            </button>
            <button style={{padding:'7px 14px', borderRadius:7, border:'1px solid var(--ink-1)', background:'var(--ink-1)', color:'var(--paper)', fontSize:12.5, fontWeight:500, cursor:'pointer', fontFamily:'inherit'}}>
              Publicar
            </button>
          </div>
        </div>

        <div style={v2c.tabBar}>
          <div style={v2c.tab(true)}>Poderes <span style={v2c.tabCount}>9</span></div>
          <div style={v2c.tab(false)}>Personalidade</div>
          <div style={v2c.tab(false)}>Conexões <span style={v2c.tabCount}>4</span></div>
          <div style={v2c.tab(false)}>Guardrails <span style={v2c.tabCount}>7</span></div>
          <div style={v2c.tab(false)}>Histórico</div>
        </div>

        <div style={v2c.centerBody}>
          <div style={v2c.pwrHeader}>
            <span></span>
            <span>Poder</span>
            <span>Configuração</span>
            <span>Risco</span>
            <span style={{textAlign:'right'}}>Estado</span>
          </div>
          {POWERS.map(p => <V2PowerRow key={p.id} p={p} on={enabled[p.id]} />)}
          <div style={{padding:'14px 24px', display:'flex', alignItems:'center', gap:8, color:'var(--ink-4)', fontSize:13, cursor:'pointer'}}>
            <Ico.plus/> <span>Adicionar poder customizado (webhook, função…)</span>
          </div>
        </div>
      </div>

      {/* LOG */}
      <div style={v2c.log}>
        <div style={v2c.logHead}>
          <div style={v2c.logTitle}>
            <div style={v2c.liveDot}/>
            <span>Execuções ao vivo</span>
          </div>
          <div style={{fontSize:11, color:'#7a7468', fontFamily:"'Geist Mono', monospace"}}>últimos 5 min</div>
        </div>
        <div style={v2c.logBody}>
          {v2Log.map((l,i)=>(
            <div key={i} style={v2c.logRow}>
              <div style={v2c.logTop}>
                <span>{l.time} · {l.agent}</span>
                <span style={v2c.logTag(l.tag)}>{l.tag==='ok'?'sucesso':l.tag==='wait'?'aguardando':'erro'}</span>
              </div>
              <div style={v2c.logMain}>{l.action}</div>
              <div style={v2c.logSub}>{l.sub} <span style={{color:'#5f5a4e', marginLeft:6}}>{l.ms}</span></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

window.V2Console = V2Console;
