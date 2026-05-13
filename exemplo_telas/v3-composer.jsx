// V3 — Composer: editorial layout with rich expandable power cards.

const v3c = {
  page: { width:'100%', height:'100%', overflow:'auto', background:'var(--paper-2)', color:'var(--ink-1)', fontFamily:"'Geist', system-ui, sans-serif" },

  inner: { maxWidth: 980, margin:'0 auto', padding:'36px 40px 64px' },

  topbar: { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:34, fontSize:13, color:'var(--ink-3)' },
  crumb: { display:'flex', alignItems:'center', gap:8 },
  brand: { fontFamily:"'Fraunces', serif", fontSize:16, color:'var(--ink-1)' },

  hero: { background:'var(--paper)', border:'1px solid var(--line)', borderRadius:16, padding:'32px 36px 30px', display:'flex', gap:28, alignItems:'flex-start', marginBottom:32 },
  avatar: { width:96, height:96, borderRadius:'50%', background:'linear-gradient(160deg, #2b3a32 0%, #1b6b4d 100%)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Fraunces', serif", fontSize:42, fontWeight:400, flexShrink:0, position:'relative', border:'1px solid var(--line-2)' },
  liveDot: { position:'absolute', bottom:6, right:6, width:16, height:16, borderRadius:'50%', background:'#5ec88a', border:'3px solid var(--paper)' },
  heroMain: { flex:1, minWidth:0 },
  eyebrow: { fontFamily:"'Geist Mono', monospace", fontSize:11, textTransform:'uppercase', letterSpacing:0.8, color:'var(--ink-4)', marginBottom:6 },
  heroName: { fontFamily:"'Fraunces', serif", fontWeight:400, fontSize:54, letterSpacing:-1, lineHeight:1, margin:0, color:'var(--ink-1)' },
  heroNamePost: { fontFamily:"'Fraunces', serif", fontStyle:'italic', color:'var(--ink-3)', fontWeight:300 },
  heroDesc: { fontSize:15, color:'var(--ink-2)', lineHeight:1.55, maxWidth:560, margin:'14px 0 0' },
  heroStats: { display:'flex', gap:32, marginTop:22, paddingTop:20, borderTop:'1px solid var(--line)' },
  stat: { display:'flex', flexDirection:'column', gap:2 },
  statLabel: { fontFamily:"'Geist Mono', monospace", fontSize:10.5, textTransform:'uppercase', letterSpacing:0.6, color:'var(--ink-4)' },
  statValue: { fontFamily:"'Fraunces', serif", fontSize:22, color:'var(--ink-1)' },

  // Section heading
  sectionHead: { display:'flex', alignItems:'baseline', justifyContent:'space-between', margin:'8px 4px 14px' },
  sectionTitle: { fontFamily:"'Fraunces', serif", fontSize:28, fontWeight:400, color:'var(--ink-1)', margin:0, letterSpacing:-0.4 },
  sectionSub: { fontSize:13, color:'var(--ink-3)' },

  // Power card
  pwr: (on, expanded) => ({
    background:'var(--paper)', border: on?'1px solid #c9d8d0':'1px solid var(--line)', borderRadius:14, marginBottom:12,
    overflow:'hidden', transition:'all .15s',
  }),
  pwrHead: (on) => ({ padding:'18px 22px', display:'flex', alignItems:'center', gap:16, cursor:'pointer' }),
  pwrIcon: (on) => ({ width:44, height:44, borderRadius:10, background: on?'var(--accent)':'var(--paper-2)', color: on?'#fff':'var(--ink-3)', display:'flex', alignItems:'center', justifyContent:'center', border: on?'1px solid var(--accent-ink)':'1px solid var(--line)', flexShrink:0 }),
  pwrMain: { flex:1, minWidth:0 },
  pwrName: { fontSize:16, fontWeight:600, color:'var(--ink-1)', margin:0, letterSpacing:-0.1 },
  pwrDesc: { fontSize:13, color:'var(--ink-3)', marginTop:3, lineHeight:1.45 },
  pwrRight: { display:'flex', alignItems:'center', gap:12, flexShrink:0 },
  riskTag: (risk) => ({
    fontFamily:"'Geist Mono', monospace", fontSize:10.5, textTransform:'uppercase', letterSpacing:0.5, padding:'3px 8px', borderRadius:4,
    background: risk==='high'?'var(--danger-soft)':risk==='med'?'var(--amber-soft)':'var(--accent-soft)',
    color: risk==='high'?'var(--danger)':risk==='med'?'var(--amber)':'var(--accent-ink)',
  }),
  chev: (open) => ({ transition:'transform .15s', transform: open?'rotate(180deg)':'none', color:'var(--ink-4)' }),

  expand: { padding:'4px 22px 22px 82px', borderTop:'1px dashed var(--line)' },

  // sub-config
  subRow: { display:'grid', gridTemplateColumns:'160px 1fr', gap:24, padding:'14px 0', borderBottom:'1px solid var(--line)' },
  subLabel: { fontSize:12, color:'var(--ink-4)', fontFamily:"'Geist Mono', monospace", textTransform:'uppercase', letterSpacing:0.5, paddingTop:4 },
  subBody: { fontSize:13.5, color:'var(--ink-1)' },

  segChip: (sel) => ({
    padding:'6px 12px', borderRadius:7, border:'1px solid var(--line-2)', background: sel?'var(--ink-1)':'var(--paper)', color: sel?'var(--paper)':'var(--ink-2)', fontSize:12.5, cursor:'pointer', fontFamily:'inherit',
  }),
  pill: (sel) => ({
    display:'inline-flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:999, border: sel?'1px solid var(--accent-ink)':'1px solid var(--line-2)', background: sel?'var(--accent-soft)':'var(--paper)', color: sel?'var(--accent-ink)':'var(--ink-2)', fontSize:12, cursor:'pointer',
  }),
  numberInput: { display:'inline-flex', alignItems:'center', gap:8, padding:'7px 12px', border:'1px solid var(--line-2)', borderRadius:7, background:'var(--paper)', fontFamily:"'Geist Mono', monospace", fontSize:13, color:'var(--ink-1)' },
  slider: { position:'relative', height:6, background:'var(--paper-3)', borderRadius:3, marginTop:8, marginBottom:6 },
  sliderFill: (pct) => ({ position:'absolute', left:0, top:0, bottom:0, width:`${pct}%`, background:'var(--accent)', borderRadius:3 }),
  sliderKnob: (pct) => ({ position:'absolute', left:`calc(${pct}% - 8px)`, top:-5, width:16, height:16, borderRadius:'50%', background:'#fff', border:'2px solid var(--accent)', boxShadow:'0 1px 3px rgba(0,0,0,.1)' }),

  toggle:(on)=>({ width:38, height:22, borderRadius:999, background: on?'var(--accent)':'var(--ink-5)', position:'relative', cursor:'pointer', flexShrink:0 }),
  toggleKnob:(on)=>({ position:'absolute', top:2, left: on?18:2, width:18, height:18, borderRadius:'50%', background:'#fff', boxShadow:'0 1px 2px rgba(0,0,0,.15)' }),

  hourGrid: { display:'flex', gap:3 },
  hourCell: (active) => ({ width:12, height:22, borderRadius:2, background: active?'var(--accent)':'var(--paper-3)' }),

  footer: { marginTop:32, padding:20, background:'var(--paper)', border:'1px solid var(--line)', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'space-between' },
};

function V3Toggle({ on }) { return <div style={v3c.toggle(on)}><div style={v3c.toggleKnob(on)}/></div>; }

function SubRow({ label, children }) {
  return (
    <div style={v3c.subRow}>
      <div style={v3c.subLabel}>{label}</div>
      <div style={v3c.subBody}>{children}</div>
    </div>
  );
}

function PowerCard({ p, on, expanded, children }) {
  return (
    <div style={v3c.pwr(on, expanded)}>
      <div style={v3c.pwrHead(on)}>
        <div style={v3c.pwrIcon(on)}><p.icon/></div>
        <div style={v3c.pwrMain}>
          <h4 style={v3c.pwrName}>{p.name}</h4>
          <p style={v3c.pwrDesc}>{p.desc}</p>
        </div>
        <div style={v3c.pwrRight}>
          <span style={v3c.riskTag(p.risk)}>risco {p.risk==='high'?'alto':p.risk==='med'?'médio':'baixo'}</span>
          <V3Toggle on={on}/>
          <div style={v3c.chev(expanded)}><Ico.chevron/></div>
        </div>
      </div>
      {expanded && on && (
        <div style={v3c.expand}>{children}</div>
      )}
    </div>
  );
}

function V3Composer() {
  const powerById = Object.fromEntries(POWERS.map(p => [p.id, p]));
  return (
    <div style={v3c.page}>
      <div style={v3c.inner}>
        {/* Topbar */}
        <div style={v3c.topbar}>
          <div style={v3c.crumb}>
            <span style={v3c.brand}>Zap</span>
            <span style={{color:'var(--ink-5)'}}>·</span>
            <span>Agentes</span>
            <span style={{color:'var(--ink-5)'}}>/</span>
            <span style={{color:'var(--ink-1)', fontWeight:500}}>Sofia</span>
          </div>
          <div style={{display:'flex', gap:8, alignItems:'center'}}>
            <button style={{padding:'8px 14px', borderRadius:8, border:'1px solid var(--line-2)', background:'var(--paper)', fontSize:13, color:'var(--ink-2)', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6, fontFamily:'inherit'}}><Ico.message/> Testar</button>
            <button style={{padding:'8px 16px', borderRadius:8, border:'1px solid var(--accent-ink)', background:'var(--accent)', color:'#fff', fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'inherit', display:'inline-flex', alignItems:'center', gap:6}}><Ico.check/> Publicar</button>
          </div>
        </div>

        {/* Hero */}
        <div style={v3c.hero}>
          <div style={v3c.avatar}>
            S
            <div style={v3c.liveDot}/>
          </div>
          <div style={v3c.heroMain}>
            <div style={v3c.eyebrow}>Atendimento · Cobrança · +55 11 4000-1820</div>
            <h1 style={v3c.heroName}>Sofia<span style={v3c.heroNamePost}>, sua agente de relacionamento.</span></h1>
            <p style={v3c.heroDesc}>
              Cordial e direta. Cuida de dúvidas, status de pedidos, segunda via e cobrança no WhatsApp. Você define o que ela pode fazer sozinha — e o que precisa passar por um humano antes.
            </p>
            <div style={v3c.heroStats}>
              <div style={v3c.stat}><span style={v3c.statLabel}>Conversas hoje</span><span style={v3c.statValue}>1.284</span></div>
              <div style={v3c.stat}><span style={v3c.statLabel}>Resolução</span><span style={v3c.statValue}>87%</span></div>
              <div style={v3c.stat}><span style={v3c.statLabel}>Tempo médio</span><span style={v3c.statValue}>42s</span></div>
              <div style={v3c.stat}><span style={v3c.statLabel}>Poderes ativos</span><span style={v3c.statValue}>7 / 9</span></div>
            </div>
          </div>
        </div>

        {/* Section header */}
        <div style={v3c.sectionHead}>
          <h2 style={v3c.sectionTitle}>Poderes</h2>
          <span style={v3c.sectionSub}>O que a Sofia pode fazer em nome da empresa</span>
        </div>

        {/* Powers list — Payment EXPANDED */}
        <PowerCard p={powerById.payment} on={true} expanded={true}>
          <SubRow label="Limite por transação">
            <div style={{display:'flex', alignItems:'center', gap:14}}>
              <span style={v3c.numberInput}>R$ 500,00</span>
              <span style={{fontSize:12, color:'var(--ink-4)'}}>acima disso, requer aprovação humana</span>
            </div>
            <div style={v3c.slider}>
              <div style={v3c.sliderFill(25)}/>
              <div style={v3c.sliderKnob(25)}/>
            </div>
            <div style={{display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--ink-4)', fontFamily:"'Geist Mono', monospace"}}>
              <span>R$ 0</span><span>R$ 2.000</span>
            </div>
          </SubRow>
          <SubRow label="Modalidades">
            <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
              <span style={v3c.pill(true)}><Ico.check/> Pix</span>
              <span style={v3c.pill(true)}><Ico.check/> Boleto</span>
              <span style={v3c.pill(false)}>TED</span>
              <span style={v3c.pill(false)}>Cartão de crédito</span>
            </div>
          </SubRow>
          <SubRow label="Aprovação humana">
            <div style={{display:'flex', gap:6}}>
              <button style={v3c.segChip(true)}>Sempre</button>
              <button style={v3c.segChip(false)}>Acima do limite</button>
              <button style={v3c.segChip(false)}>Nunca</button>
            </div>
            <div style={{fontSize:12, color:'var(--ink-4)', marginTop:8}}>Aprovador padrão: <span style={{color:'var(--ink-2)', fontWeight:500}}>marina@acme.com</span> · responde em ~3 min</div>
          </SubRow>
          <SubRow label="Janela ativa">
            <div style={v3c.hourGrid}>
              {Array.from({length:24}).map((_,h)=>(
                <div key={h} style={v3c.hourCell(h>=8 && h<20)}/>
              ))}
            </div>
            <div style={{display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--ink-4)', fontFamily:"'Geist Mono', monospace", marginTop:6}}>
              <span>00h</span><span>08h — 20h ativo</span><span>23h</span>
            </div>
          </SubRow>
        </PowerCard>

        {/* Balance — collapsed but on */}
        <PowerCard p={powerById.balance} on={true} expanded={false}/>

        {/* Message — EXPANDED */}
        <PowerCard p={powerById.message} on={true} expanded={true}>
          <SubRow label="Limite de envios">
            <div style={{display:'flex', alignItems:'center', gap:14}}>
              <span style={v3c.numberInput}>30 / dia</span>
              <span style={{fontSize:12, color:'var(--ink-4)'}}>por contato — evita spam</span>
            </div>
          </SubRow>
          <SubRow label="Pode escrever para">
            <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
              <span style={v3c.pill(true)}><Ico.check/> Clientes ativos</span>
              <span style={v3c.pill(true)}><Ico.check/> Leads quentes</span>
              <span style={v3c.pill(false)}>Toda a base</span>
              <span style={v3c.pill(false)}>Contatos novos</span>
            </div>
          </SubRow>
          <SubRow label="Confirmação de envio">
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
              <div>
                <div style={{fontSize:13.5, color:'var(--ink-1)'}}>Mostrar prévia antes de enviar</div>
                <div style={{fontSize:12, color:'var(--ink-4)', marginTop:2}}>Sofia escreve a mensagem e mostra para você confirmar.</div>
              </div>
              <V3Toggle on={true}/>
            </div>
          </SubRow>
        </PowerCard>

        {/* Calendar collapsed */}
        <PowerCard p={powerById.calendar} on={true} expanded={false}/>

        {/* Orders collapsed */}
        <PowerCard p={powerById.orders} on={true} expanded={false}/>

        {/* Knowledge EXPANDED */}
        <PowerCard p={powerById.knowledge} on={true} expanded={true}>
          <SubRow label="Fontes conectadas">
            <div style={{display:'flex', flexDirection:'column', gap:8}}>
              {[
                {name:'FAQ Atendimento', docs:'248 artigos', updated:'sincronizada agora'},
                {name:'Manual de Produtos', docs:'612 páginas', updated:'há 4h'},
                {name:'Política de Cobrança', docs:'18 documentos', updated:'há 2 dias'},
                {name:'Notion · Time de Vendas', docs:'304 páginas', updated:'sincronizando…'},
              ].map(s => (
                <div key={s.name} style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', background:'var(--paper-2)', border:'1px solid var(--line)', borderRadius:8}}>
                  <div>
                    <div style={{fontSize:13.5, color:'var(--ink-1)', fontWeight:500}}>{s.name}</div>
                    <div style={{fontSize:11.5, color:'var(--ink-4)', fontFamily:"'Geist Mono', monospace", marginTop:2}}>{s.docs} · {s.updated}</div>
                  </div>
                  <V3Toggle on={true}/>
                </div>
              ))}
            </div>
          </SubRow>
          <SubRow label="Comportamento">
            <div style={{fontSize:13.5, color:'var(--ink-1)'}}>Citar a fonte ao responder</div>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:8}}>
              <div style={{fontSize:12, color:'var(--ink-4)'}}>Inclui um link curto para o documento original na resposta.</div>
              <V3Toggle on={true}/>
            </div>
          </SubRow>
        </PowerCard>

        {/* Handoff collapsed */}
        <PowerCard p={powerById.handoff} on={true} expanded={false}/>

        {/* Task — OFF */}
        <PowerCard p={powerById.task} on={false} expanded={false}/>

        {/* CRM collapsed */}
        <PowerCard p={powerById.crm} on={true} expanded={false}/>

        {/* Footer */}
        <div style={v3c.footer}>
          <div style={{fontSize:13, color:'var(--ink-3)'}}>3 alterações não publicadas · última versão estável <span style={{fontFamily:"'Geist Mono', monospace", color:'var(--ink-1)'}}>v3.2.1</span></div>
          <div style={{display:'flex', gap:8}}>
            <button style={{padding:'9px 14px', borderRadius:8, border:'1px solid var(--line-2)', background:'var(--paper-2)', fontSize:13, color:'var(--ink-2)', cursor:'pointer', fontFamily:'inherit'}}>Descartar</button>
            <button style={{padding:'9px 18px', borderRadius:8, border:'1px solid var(--accent-ink)', background:'var(--accent)', color:'#fff', fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'inherit'}}>Publicar Sofia v3.2.2</button>
          </div>
        </div>
      </div>
    </div>
  );
}

window.V3Composer = V3Composer;
