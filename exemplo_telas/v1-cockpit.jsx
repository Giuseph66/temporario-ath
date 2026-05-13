// V1 — Cockpit: single-agent detail focus, premium minimal aesthetic.

const v1c = {
  page: {
    width:'100%', height:'100%', overflow:'hidden',
    background:'var(--paper)', color:'var(--ink-1)',
    fontFamily:"'Geist', -apple-system, system-ui, sans-serif",
    display:'flex', flexDirection:'column',
  },
  topbar: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'14px 32px', borderBottom:'1px solid var(--line)',
    fontSize:13, color:'var(--ink-3)',
  },
  crumb: { display:'flex', alignItems:'center', gap:8 },
  body: { flex:1, display:'flex', flexDirection:'column', overflow:'hidden' },

  hero: { padding:'28px 32px 22px', borderBottom:'1px solid var(--line)', display:'flex', alignItems:'flex-start', gap:24 },
  avatar: {
    width:84, height:84, borderRadius:'50%', flexShrink:0,
    background:'linear-gradient(135deg,#d8d2bf 0%, #b8b3a6 100%)',
    display:'flex', alignItems:'center', justifyContent:'center',
    fontFamily:"'Fraunces', serif", fontWeight:400, fontSize:36, color:'#3a3630',
    border:'1px solid var(--line-2)',
    position:'relative',
  },
  online: { position:'absolute', bottom:4, right:4, width:14, height:14, borderRadius:'50%', background:'var(--accent)', border:'3px solid var(--paper)' },
  heroMain: { flex:1, minWidth:0 },
  heroTitle: {
    fontFamily:"'Fraunces', serif", fontWeight:400, fontSize:38, letterSpacing:-0.5,
    lineHeight:1.05, color:'var(--ink-1)', margin:0, display:'flex', alignItems:'center', gap:14, flexWrap:'wrap',
  },
  badge: {
    display:'inline-flex', alignItems:'center', gap:6, padding:'3px 9px',
    border:'1px solid var(--line-2)', borderRadius:999,
    fontFamily:"'Geist Mono', monospace", fontSize:11, color:'var(--ink-3)', background:'var(--paper-2)',
    fontWeight:500, textTransform:'uppercase', letterSpacing:0.5,
  },
  heroSub: { fontSize:14, color:'var(--ink-3)', marginTop:8, maxWidth:640, lineHeight:1.5 },
  heroMeta: { display:'flex', gap:28, marginTop:16, fontSize:12, color:'var(--ink-3)' },
  metaItem: { display:'flex', flexDirection:'column', gap:3 },
  metaLabel: { fontFamily:"'Geist Mono', monospace", fontSize:10, textTransform:'uppercase', letterSpacing:0.6, color:'var(--ink-4)' },
  metaValue: { fontSize:13, color:'var(--ink-1)', fontWeight:500 },

  heroActions: { display:'flex', gap:8, flexShrink:0 },
  btn: { padding:'8px 14px', borderRadius:8, border:'1px solid var(--line-2)', background:'var(--paper)', cursor:'pointer', fontSize:13, color:'var(--ink-1)', fontWeight:500, fontFamily:'inherit', display:'inline-flex', alignItems:'center', gap:6 },
  btnPrimary: { padding:'8px 16px', borderRadius:8, border:'1px solid var(--accent-ink)', background:'var(--accent)', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:500, fontFamily:'inherit', display:'inline-flex', alignItems:'center', gap:6 },

  main: { flex:1, display:'grid', gridTemplateColumns:'1fr 320px', overflow:'hidden' },
  powersCol: { padding:'24px 32px 28px', overflow:'auto', borderRight:'1px solid var(--line)' },
  sideCol: { padding:'24px 28px 28px', overflow:'auto', background:'var(--paper-2)' },

  sectionHead: { display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:14 },
  sectionTitle: { fontSize:14, fontWeight:600, color:'var(--ink-1)', margin:0, letterSpacing:-0.1 },
  sectionCount: { fontFamily:"'Geist Mono', monospace", fontSize:11, color:'var(--ink-4)' },

  grid: { display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12 },

  card: (on, risk) => ({
    border: on ? '1px solid #c9d8d0' : '1px solid var(--line)',
    borderRadius:12, padding:'16px 16px 14px',
    background: on ? '#f6faf8' : 'var(--paper)',
    position:'relative', transition:'all .15s', display:'flex', flexDirection:'column', gap:10,
    minHeight: 138,
  }),
  cardTop: { display:'flex', justifyContent:'space-between', alignItems:'flex-start' },
  iconWrap: (on) => ({
    width:34, height:34, borderRadius:8,
    background: on ? 'var(--accent)' : 'var(--paper-2)',
    color: on ? '#fff' : 'var(--ink-2)',
    display:'flex', alignItems:'center', justifyContent:'center',
    border: on ? '1px solid var(--accent-ink)' : '1px solid var(--line)',
  }),
  cardName: { fontSize:14, fontWeight:600, color:'var(--ink-1)', margin:'0', lineHeight:1.25 },
  cardShort: { fontSize:12, color:'var(--ink-3)', margin:0, lineHeight:1.45 },
  cardFoot: { display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:'auto', paddingTop:6, fontSize:11, color:'var(--ink-4)', fontFamily:"'Geist Mono', monospace" },
  cardFootChip: (risk) => ({
    display:'inline-flex', alignItems:'center', gap:4, padding:'2px 6px', borderRadius:4,
    background: risk==='high'?'var(--danger-soft)':risk==='med'?'var(--amber-soft)':'var(--paper-2)',
    color: risk==='high'?'var(--danger)':risk==='med'?'var(--amber)':'var(--ink-3)',
    fontSize:10, textTransform:'uppercase', letterSpacing:0.4,
  }),

  // Toggle
  toggle: (on) => ({
    width:34, height:20, borderRadius:999, background: on?'var(--accent)':'var(--ink-5)', position:'relative', cursor:'pointer', transition:'background .15s', flexShrink:0,
  }),
  toggleKnob: (on) => ({
    position:'absolute', top:2, left: on?16:2, width:16, height:16, borderRadius:'50%', background:'#fff', transition:'left .15s', boxShadow:'0 1px 2px rgba(0,0,0,.15)',
  }),

  // sidebar panels
  panel: { background:'var(--paper)', border:'1px solid var(--line)', borderRadius:12, padding:16, marginBottom:14 },
  panelTitle: { fontSize:12, fontFamily:"'Geist Mono', monospace", textTransform:'uppercase', letterSpacing:0.6, color:'var(--ink-4)', margin:'0 0 10px' },
  promptBox: { fontFamily:"'Geist Mono', monospace", fontSize:11.5, lineHeight:1.6, color:'var(--ink-2)', background:'var(--paper-2)', border:'1px solid var(--line)', borderRadius:8, padding:'10px 12px', maxHeight:140, overflow:'hidden', position:'relative' },
  promptFade: { position:'absolute', bottom:0, left:0, right:0, height:36, background:'linear-gradient(transparent, var(--paper-2))' },

  toneChip: (on) => ({
    padding:'5px 10px', borderRadius:999, fontSize:12,
    border: on?'1px solid var(--accent-ink)':'1px solid var(--line-2)',
    background: on?'var(--accent)':'var(--paper)',
    color: on?'#fff':'var(--ink-2)',
    cursor:'pointer',
  }),

  footbar: { padding:'14px 32px', borderTop:'1px solid var(--line)', background:'var(--paper)', display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:12, color:'var(--ink-3)' },
};

function Toggle({ on }) {
  return (
    <div style={v1c.toggle(on)}>
      <div style={v1c.toggleKnob(on)} />
    </div>
  );
}

function V1PowerCard({ p, on }) {
  return (
    <div style={v1c.card(on, p.risk)}>
      <div style={v1c.cardTop}>
        <div style={v1c.iconWrap(on)}>
          <p.icon />
        </div>
        <Toggle on={on} />
      </div>
      <div>
        <h4 style={v1c.cardName}>{p.name}</h4>
        <p style={{...v1c.cardShort, marginTop:3}}>{p.short}</p>
      </div>
      <div style={v1c.cardFoot}>
        {on ? (
          <>
            <span style={v1c.cardFootChip(p.risk)}>
              {p.risk==='high' ? <><Ico.shield/> alta</> : p.risk==='med' ? <><Ico.shield/> média</> : <><Ico.check/> baixa</>}
            </span>
            <span>{Object.values(p.defaults)[0]}</span>
          </>
        ) : (
          <span style={{color:'var(--ink-5)'}}>desativado</span>
        )}
      </div>
    </div>
  );
}

function V1Cockpit() {
  // Default enabled state for the demo
  const enabled = { payment:true, balance:true, message:true, calendar:true, orders:true, knowledge:true, handoff:true, task:false, crm:true };

  return (
    <div style={v1c.page}>
      {/* Topbar */}
      <div style={v1c.topbar}>
        <div style={v1c.crumb}>
          <span style={{fontFamily:"'Fraunces', serif", fontSize:15, color:'var(--ink-1)'}}>Zap</span>
          <span style={{color:'var(--ink-5)'}}>·</span>
          <span>Agentes</span>
          <span style={{color:'var(--ink-5)'}}>/</span>
          <span style={{color:'var(--ink-1)', fontWeight:500}}>Sofia · Atendimento</span>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:14, fontFamily:"'Geist Mono', monospace", fontSize:11, color:'var(--ink-4)'}}>
          <span>workspace: acme-financeira</span>
          <span style={{width:1, height:14, background:'var(--line-2)'}}></span>
          <span>v 3.2.1</span>
        </div>
      </div>

      {/* Hero */}
      <div style={v1c.hero}>
        <div style={v1c.avatar}>
          S
          <div style={v1c.online}></div>
        </div>
        <div style={v1c.heroMain}>
          <h1 style={v1c.heroTitle}>
            Sofia
            <span style={{...v1c.badge, background:'var(--accent-soft)', color:'var(--accent-ink)', borderColor:'#c9d8d0'}}>
              <Ico.dot/> ao vivo
            </span>
          </h1>
          <p style={v1c.heroSub}>
            Agente de atendimento e cobrança da Acme Financeira. Responde clientes no WhatsApp, consulta status de pedidos e contratos, e pode iniciar pagamentos com aprovação humana.
          </p>
          <div style={v1c.heroMeta}>
            <div style={v1c.metaItem}>
              <span style={v1c.metaLabel}>Número</span>
              <span style={v1c.metaValue}>+55 11 4000-1820</span>
            </div>
            <div style={v1c.metaItem}>
              <span style={v1c.metaLabel}>Modelo</span>
              <span style={v1c.metaValue}>Claude Sonnet 4.5</span>
            </div>
            <div style={v1c.metaItem}>
              <span style={v1c.metaLabel}>Conversas (24h)</span>
              <span style={v1c.metaValue}>1.284</span>
            </div>
            <div style={v1c.metaItem}>
              <span style={v1c.metaLabel}>Resolução</span>
              <span style={v1c.metaValue}>87% sem humano</span>
            </div>
          </div>
        </div>
        <div style={v1c.heroActions}>
          <button style={v1c.btn}><Ico.message/> Testar no chat</button>
          <button style={v1c.btnPrimary}><Ico.check/> Publicar mudanças</button>
        </div>
      </div>

      {/* Main */}
      <div style={v1c.main}>
        <div style={v1c.powersCol}>
          <div style={v1c.sectionHead}>
            <h3 style={v1c.sectionTitle}>Poderes do agente</h3>
            <span style={v1c.sectionCount}>{Object.values(enabled).filter(Boolean).length} / {POWERS.length} ativos</span>
          </div>
          <div style={v1c.grid}>
            {POWERS.map(p => <V1PowerCard key={p.id} p={p} on={enabled[p.id]} />)}
          </div>
        </div>

        {/* Sidebar */}
        <div style={v1c.sideCol}>
          <div style={v1c.panel}>
            <h4 style={v1c.panelTitle}>Personalidade</h4>
            <div style={{display:'flex', gap:6, flexWrap:'wrap', marginBottom:12}}>
              {['cordial','direta','formal','bem-humorada'].map((t,i)=>(
                <span key={t} style={v1c.toneChip(i<2)}>{t}</span>
              ))}
            </div>
            <div style={{fontSize:12, color:'var(--ink-3)', marginBottom:6}}>Idioma principal</div>
            <div style={{fontSize:13, color:'var(--ink-1)', fontWeight:500}}>Português (Brasil)</div>
          </div>

          <div style={v1c.panel}>
            <h4 style={v1c.panelTitle}>Instrução de sistema</h4>
            <div style={v1c.promptBox}>
              Você é a Sofia, atendente da Acme Financeira. Seja cordial e direta. Sempre confirme o nome do cliente antes de tratar de valores. Para pagamentos acima de R$ 500, peça aprovação humana via /handoff. Nunca invente informação de saldo — sempre consulte…
              <div style={v1c.promptFade}></div>
            </div>
            <button style={{...v1c.btn, marginTop:10, width:'100%', justifyContent:'center'}}>Editar instrução</button>
          </div>

          <div style={v1c.panel}>
            <h4 style={v1c.panelTitle}>Janela de atendimento</h4>
            <div style={{fontSize:13, color:'var(--ink-1)', display:'flex', justifyContent:'space-between', marginBottom:4}}>
              <span>Seg–Sex</span><span style={{fontFamily:"'Geist Mono', monospace"}}>08:00 – 20:00</span>
            </div>
            <div style={{fontSize:13, color:'var(--ink-1)', display:'flex', justifyContent:'space-between', marginBottom:4}}>
              <span>Sábado</span><span style={{fontFamily:"'Geist Mono', monospace"}}>09:00 – 14:00</span>
            </div>
            <div style={{fontSize:13, color:'var(--ink-4)', display:'flex', justifyContent:'space-between'}}>
              <span>Domingo</span><span style={{fontFamily:"'Geist Mono', monospace"}}>fechado</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={v1c.footbar}>
        <span>Última publicação: <span style={{color:'var(--ink-1)', fontFamily:"'Geist Mono', monospace"}}>há 2h por marina@acme.com</span></span>
        <span>3 alterações não publicadas</span>
      </div>
    </div>
  );
}

window.V1Cockpit = V1Cockpit;
