'use client'

import {
  Activity, Bot, CircleHelp, ContactRound, LayoutDashboard,
  MessageCircle, MoreHorizontal, Plus, Search, Settings, Sparkles,
  Target, Users, Workflow, Send, Phone, Paperclip, Clock3, CheckCircle2,
  Plug, Megaphone, FileText, BrainCircuit, Play, GitBranch, ShieldCheck,
  Trash2, ArrowLeft, ArrowRight, Timer, Tag, ListChecks, Ticket, Mic, Smile, X, Square, Pause, UploadCloud,
  Moon, Sun
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api'

type Deal = { id: number | string; name: string; company: string; value: number; age: string; tag: string; color: string; number?: string }
type Stage = { id: string; label: string; accent: string; deals: Deal[] }

const initialStages: Stage[] = [
  { id: 'entrada', label: 'Entrada', accent: '#87a7ff', deals: []},
  { id: 'qualificacao', label: 'Qualificação', accent: '#b994ff', deals: []},
  { id: 'proposta', label: 'Proposta enviada', accent: '#ffb66e', deals: []},
  { id: 'fechamento', label: 'Fechamento', accent: '#58d6ae', deals: []},
]

const nav = [
  [LayoutDashboard, 'Visão geral'], [MessageCircle, 'Conversas'], [Target, 'Negócios'],
  [ContactRound, 'Contatos'], [Users, 'Equipe'], [Workflow, 'Automações'], [Bot, 'Agentes de IA'],
  [Plug, 'Canais'], [Activity, 'Relatórios'], [Settings, 'Configurações'],
] as const

export default function Dashboard() {
  const [active, setActive] = useState('Canais')
  const [stages, setStages] = useState<Stage[]>(initialStages)
  const [query, setQuery] = useState('')
  const [dragged, setDragged] = useState<{ stage: string; deal: Deal } | null>(null)
  const [modal, setModal] = useState<string | null>(null)
  const [modalStage, setModalStage] = useState<string | undefined>()
  const [toast, setToast] = useState<string | null>(null)
  const [aiUsage,setAiUsage]=useState({totalTokens:0,calls:0})
  const [theme,setTheme]=useState<'light'|'dark'>('light')
  const total = useMemo(() => stages.flatMap(s => s.deals).reduce((sum, d) => sum + d.value, 0), [stages])

  useEffect(() => {
    const saved = localStorage.getItem('asax.pipeline.stages')
    if (saved) setStages(JSON.parse(saved))
  }, [])
  useEffect(() => {
    const saved=localStorage.getItem('asax.theme')
    const next=saved==='dark'||saved==='light' ? saved : (window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')
    setTheme(next)
    document.documentElement.dataset.theme=next
  }, [])
  useEffect(() => {
    async function syncWhatsAppLeads() {
      try {
        const response = await fetch('/api/crm/leads', { cache: 'no-store' })
        const data = await response.json()
        setStages(current => {
          const next=current.map(stage=>({...stage,deals:[...stage.deals]}))
          for(const lead of data.leads??[]){
            const currentStage=next.find(stage=>stage.deals.some(deal=>String(deal.id)===String(lead.id)))
            const existingDeal=currentStage?.deals.find(deal=>String(deal.id)===String(lead.id))
            const desired=lead.stage==='qualificacao'?next.find(stage=>stage.id==='qualificacao'):currentStage??next.find(stage=>stage.id===(lead.stage||'entrada'))
            next.forEach(stage=>{stage.deals=stage.deals.filter(deal=>String(deal.id)!==String(lead.id))})
            desired?.deals.unshift({...lead,...(existingDeal??{}),tag:lead.tag,number:lead.number})
          }
          return next
        })
      } catch {}
    }
    syncWhatsAppLeads()
    const timer = window.setInterval(syncWhatsAppLeads, 5000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => { localStorage.setItem('asax.pipeline.stages', JSON.stringify(stages)) }, [stages])
  useEffect(()=>{const load=()=>fetch('/api/ai/usage',{cache:'no-store'}).then(response=>response.json()).then(setAiUsage).catch(()=>{});load();const timer=window.setInterval(load,10000);return()=>window.clearInterval(timer)},[])
  function notify(message:string){setToast(message);setTimeout(()=>setToast(null),2600)}
  function toggleTheme(){
    const next=theme==='light'?'dark':'light'
    setTheme(next);localStorage.setItem('asax.theme',next);document.documentElement.dataset.theme=next
  }

  function drop(target: string) {
    if (!dragged || dragged.stage === target) return
    setStages(current => current.map(stage => {
      if (stage.id === dragged.stage) return { ...stage, deals: stage.deals.filter(d => d.id !== dragged.deal.id) }
      if (stage.id === target) return { ...stage, deals: [...stage.deals, dragged.deal] }
      return stage
    }))
    if (typeof dragged.deal.id === 'string') api.moveDeal(dragged.deal.id, target).catch(() => notify('Alteração salva no modo local'))
    else notify('Negócio movido com sucesso')
    setDragged(null)
  }
  function createDeal(data: Record<string,string>) {
    const stageId = data.stage || stages[0].id
    const deal: Deal = { id: Date.now(), name: data.name, company: data.company || 'Sem empresa', value: Number(data.value || 0), age: 'agora', tag: data.tag || 'Novo', color: '#d8ff72' }
    setStages(current => current.map(stage => stage.id === stageId ? {...stage,deals:[deal,...stage.deals]} : stage))
    setModal(null);setModalStage(undefined);notify('Negócio criado com sucesso')
  }
  async function removeDeal(deal: Deal) {
    if (!window.confirm(`Excluir ${deal.name} do CRM? O contato e as mensagens do WhatsApp não serão apagados.`)) return
    try {
      if (typeof deal.id === 'string') {
        const response = await fetch(`/api/crm/leads?id=${encodeURIComponent(deal.id)}`, { method: 'DELETE' })
        const data = await response.json()
        if (!response.ok) throw new Error(data.message)
      }
      setStages(current => current.map(stage => ({ ...stage, deals: stage.deals.filter(item => String(item.id) !== String(deal.id)) })))
      notify('Lead removido do CRM')
    } catch (error) { notify(error instanceof Error ? error.message : 'Não foi possível remover o lead') }
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-symbol" aria-label="ASAX"/><div><b>ASAX</b><small>CRM inteligente</small></div></div>
        <nav>{nav.map(([Icon, label]) => <button onClick={() => setActive(label)} className={label === active ? 'active' : ''} key={label}><Icon size={18}/><span>{label}</span></button>)}</nav>
        <div className="sidebar-bottom">
          <div className="ai-usage"><Sparkles size={16}/><div><span>Uso real de IA</span><div className="meter"><i style={{width:`${Math.min(100,Math.max(2,aiUsage.totalTokens/1000))}%`}}/></div><small>{aiUsage.totalTokens.toLocaleString('pt-BR')} tokens · {aiUsage.calls} chamadas</small></div></div>
          <button onClick={toggleTheme} title={`Ativar modo ${theme==='light'?'escuro':'claro'}`}>{theme==='light'?<Moon size={18}/>:<Sun size={18}/>}<span>Modo {theme==='light'?'escuro':'claro'}</span></button>
          <button onClick={()=>window.open('https://wa.me/556191537760?text=Ol%C3%A1%2C%20preciso%20de%20ajuda%20com%20o%20ASAX.','_blank','noopener,noreferrer')}><CircleHelp size={18}/> Central de ajuda</button><button onClick={() => setActive('Configurações')}><Settings size={18}/> Configurações</button>
          <div className="profile"><span>AS</span><div><b>ASAX</b><small>Administrador local</small></div></div>
          <div className="brand-footer-signature" aria-label="ASAX · Automation, Solutions and Artificial Intelligence"/>
        </div>
      </aside>

      <section className="workspace">
        {active !== 'Negócios' ? <ModulePage active={active} onAction={() => setModal(active) } onNavigate={setActive} notify={notify}/> : <>
        <header>
          <div><span className="eyebrow">PIPELINE COMERCIAL</span><h1>Negócios</h1></div>
          <div className="header-actions"><button onClick={()=>setActive('Relatórios')} className="ghost"><Activity size={17}/> Relatório</button><button onClick={()=>setModal('Negócios')} className="primary"><Plus size={17}/> Novo negócio</button></div>
        </header>

        <section className="summary">
          <div><small>Pipeline em aberto</small><strong>{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong><span>valor registrado</span></div>
          <div><small>Negócios ativos</small><strong>{stages.flatMap(s => s.deals).length}</strong><span>no pipeline</span></div>
          <div><small>Em qualificação</small><strong>{stages.find(s=>s.id==='qualificacao')?.deals.length??0}</strong><span>negócios</span></div>
          <div className="pulse"><span><i/> Uso real de IA</span><b>{aiUsage.calls} chamadas · {aiUsage.totalTokens.toLocaleString('pt-BR')} tokens</b></div>
        </section>

        <div className="toolbar">
          <div className="search"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar negócio ou empresa..."/></div>
          <span className="toolbar-chip">Pipeline principal</span>
          <span className="spacer"/>
        </div>

        <section className="board">
          {stages.map(stage => {
            const deals = stage.deals.filter(d => `${d.name} ${d.company}`.toLowerCase().includes(query.toLowerCase()))
            const stageTotal = stage.deals.reduce((sum, d) => sum + d.value, 0)
            return <div className="column" style={{'--accent':stage.accent} as React.CSSProperties} key={stage.id} onDragOver={e => e.preventDefault()} onDrop={() => drop(stage.id)}>
              <div className="column-head"><span>{stage.label}</span><b>{stage.deals.length}</b><button title={`Adicionar em ${stage.label}`} onClick={()=>{setModalStage(stage.id);setModal('Negócios')}}><Plus size={15}/></button></div>
              <small className="column-total">{stageTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</small>
              <div className="cards">
                {deals.map(deal => <article draggable onDoubleClick={()=>{if(deal.number){localStorage.setItem('nexo.openConversation',`${deal.number}@s.whatsapp.net`);setActive('Conversas')}}} onDragStart={() => setDragged({stage: stage.id, deal})} key={deal.id} title={deal.number?'Clique duas vezes para conversar no WhatsApp':'Arraste para mudar de etapa'}>
                  <div className="card-top"><span className="tag" style={{'--tag': deal.color} as React.CSSProperties}>{deal.tag}</span>{deal.number&&<button title="Abrir conversa" onClick={(event)=>{event.stopPropagation();localStorage.setItem('nexo.openConversation',`${deal.number}@s.whatsapp.net`);setActive('Conversas')}}><MessageCircle size={16}/></button>}<button className="delete-deal" title="Excluir lead do CRM" onClick={(event)=>{event.stopPropagation();removeDeal(deal)}}><Trash2 size={15}/></button></div>
                  <h3>{deal.name}</h3><p>{deal.company}</p>
                  <div className="value">{deal.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                  <footer><span className="avatar">{deal.name.split(' ').map(n => n[0]).join('').slice(0,2)}</span><small>{deal.age}</small><MessageCircle size={14}/></footer>
                </article>)}
                <button onClick={()=>{setModalStage(stage.id);setModal('Negócios')}} className="add-card"><Plus size={15}/> Adicionar negócio</button>
              </div>
            </div>
          })}
        </section>
        </>}
      </section>
      {modal==='Negócios' && <ActionModal kind={modal} stages={stages} initialStage={modalStage} onClose={()=>{setModal(null);setModalStage(undefined)}} onDeal={createDeal} onDone={(message)=>{setModal(null);notify(message)}}/>}
      {toast && <div className="toast"><CheckCircle2 size={16}/>{toast}</div>}
    </main>
  )
}

function ModulePage({ active,onAction,onNavigate,notify }: { active: string;onAction:()=>void;onNavigate:(module:string)=>void;notify:(message:string)=>void }) {
  if (active === 'Canais') return <WhatsAppChannels notify={notify}/>
  if (active === 'Conversas') return <RealInbox notify={notify}/>

  if (active === 'Automações') return <RealAutomations notify={notify}/>

  if (active === 'Agentes de IA') return <RealAgents notify={notify}/>

  if (active === 'Configurações') return <ApiVault notify={notify}/>

  if (active === 'Contatos') return <RealContacts notify={notify} onNavigate={onNavigate}/>

  if (active === 'Equipe') return <RealTeam notify={notify}/>
  if (active === 'Relatórios') return <RealReports notify={notify}/>
  return <RealOverview/>
}

type OpsMessage={id:string;remoteJid:string;fromMe:boolean;pushName?:string|null;text:string;timestamp:number}
type OpsLead={id:string|number;name:string;company?:string;value?:number;stage?:string;tag?:string;number?:string}
type OpsSnapshot={contacts:RealContact[];messages:OpsMessage[];leads:OpsLead[];usage:{totalTokens:number;calls:number};automation:{enabled:boolean;name:string;nodes?:unknown[]}}

function useOperationalSnapshot(){
  const [snapshot,setSnapshot]=useState<OpsSnapshot>({contacts:[],messages:[],leads:[],usage:{totalTokens:0,calls:0},automation:{enabled:false,name:'Sem automação',nodes:[]}})
  const [loading,setLoading]=useState(true)
  useEffect(()=>{
    let alive=true
    async function load(){
      const read=async(url:string)=>{try{const response=await fetch(url,{cache:'no-store'});return response.ok?await response.json():{}}catch{return {}}}
      const [contacts,messages,leads,usage,automation]=await Promise.all([
        read('/api/whatsapp/contacts'),read('/api/whatsapp/messages'),read('/api/crm/leads'),read('/api/ai/usage'),read('/api/whatsapp/automation'),
      ])
      if(alive)setSnapshot({
        contacts:contacts.contacts??[],messages:messages.messages??[],leads:leads.leads??[],
        usage:{totalTokens:Number(usage.totalTokens??0),calls:Number(usage.calls??0)},
        automation:{enabled:Boolean(automation.enabled),name:String(automation.name??'Sem automação'),nodes:automation.nodes??[]},
      })
      if(alive)setLoading(false)
    }
    load();const timer=window.setInterval(load,10000)
    return()=>{alive=false;window.clearInterval(timer)}
  },[])
  return {snapshot,loading}
}

function RealOverview(){
  const {snapshot,loading}=useOperationalSnapshot()
  const conversations=new Set(snapshot.messages.map(message=>message.remoteJid)).size
  const pipeline=snapshot.leads.reduce((sum,lead)=>sum+Number(lead.value??0),0)
  const recent=[...snapshot.messages].sort((a,b)=>b.timestamp-a.timestamp).slice(0,6)
  return <div className="module">
    <header><div><span className="eyebrow">CENTRAL DE OPERAÇÕES</span><h1>Visão geral</h1></div><span className="live-data"><i/>Dados reais · atualização automática</span></header>
    <div className="welcome real-welcome"><div><span>ASAX CRM</span><h2>{loading?'Carregando sua operação…':'Resumo operacional atual'}</h2><p>Este painel mostra apenas registros encontrados no WhatsApp, CRM, automações e uso da IA.</p></div><Activity size={72}/></div>
    <div className="module-stats"><Stat label="Pipeline registrado" value={pipeline.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}/><Stat label="Conversas com mensagens" value={String(conversations)}/><Stat label="Contatos sincronizados" value={String(snapshot.contacts.length)}/><Stat label="Chamadas de IA" value={String(snapshot.usage.calls)}/></div>
    <section className="data-section"><header><div><h3>Atividade recente</h3><p>Últimas mensagens realmente localizadas no canal conectado.</p></div></header>
      {recent.length?<ResourceTable rows={recent.map(message=>[
        message.fromMe?'Mensagem enviada':'Mensagem recebida',
        message.pushName||message.remoteJid.replace(/@.*/, ''),
        message.text,
        message.timestamp?new Date(message.timestamp*1000).toLocaleString('pt-BR'):'Sem horário',
      ])}/>:<EmptyState title="Nenhuma atividade encontrada" text="As mensagens novas do WhatsApp aparecerão aqui quando chegarem ao sistema."/>}
    </section>
  </div>
}

function RealReports({notify}:{notify:(message:string)=>void}){
  const {snapshot,loading}=useOperationalSnapshot()
  const days=Array.from({length:7},(_,index)=>{const date=new Date();date.setHours(0,0,0,0);date.setDate(date.getDate()-(6-index));return date})
  const daily=days.map(day=>snapshot.messages.filter(message=>{const date=new Date(message.timestamp*1000);return date.toDateString()===day.toDateString()}).length)
  const max=Math.max(1,...daily)
  const stageRows=['entrada','qualificacao','proposta','fechamento'].map(stage=>({stage,count:snapshot.leads.filter(lead=>(lead.stage||'entrada')===stage).length}))
  const pipeline=snapshot.leads.reduce((sum,lead)=>sum+Number(lead.value??0),0)
  function exportCsv(){
    const rows=[['Métrica','Valor'],['Contatos',snapshot.contacts.length],['Conversas',new Set(snapshot.messages.map(message=>message.remoteJid)).size],['Mensagens',snapshot.messages.length],['Leads',snapshot.leads.length],['Pipeline',pipeline],['Chamadas de IA',snapshot.usage.calls],['Tokens de IA',snapshot.usage.totalTokens]]
    const csv=rows.map(row=>row.map(cell=>`"${String(cell).replaceAll('"','""')}"`).join(';')).join('\n')
    const link=document.createElement('a');link.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));link.download=`asax-relatorio-${new Date().toISOString().slice(0,10)}.csv`;link.click();URL.revokeObjectURL(link.href);notify('Relatório real exportado')
  }
  return <div className="module">
    <ModuleHeader onAction={exportCsv} title="Relatórios" subtitle="DADOS OPERACIONAIS REAIS" action="Exportar CSV"/>
    <div className="module-stats"><Stat label="Mensagens carregadas" value={loading?'…':String(snapshot.messages.length)}/><Stat label="Leads no CRM" value={String(snapshot.leads.length)}/><Stat label="Pipeline registrado" value={pipeline.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}/><Stat label="Tokens de IA" value={snapshot.usage.totalTokens.toLocaleString('pt-BR')}/></div>
    <div className="charts"><div><h3>Mensagens nos últimos 7 dias</h3><div className="bars">{daily.map((count,index)=><i key={days[index].toISOString()} title={`${count} mensagens`} style={{height:`${Math.max(3,(count/max)*100)}%`}}/> )}</div><small>{days.map(day=>day.toLocaleDateString('pt-BR',{weekday:'short'}).replace('.','').toUpperCase()).join('   ')}</small></div><div><h3>Leads por etapa</h3>{stageRows.map(row=><p key={row.stage}><span>{initialStages.find(stage=>stage.id===row.stage)?.label??row.stage}</span><b>{row.count}</b></p>)}</div></div>
  </div>
}

type TeamMember={id:string;name:string;email:string;role:string;createdAt:string}
function RealTeam({notify}:{notify:(message:string)=>void}){
  const [members,setMembers]=useState<TeamMember[]>([])
  const [open,setOpen]=useState(false)
  const [saving,setSaving]=useState(false)
  const [form,setForm]=useState({name:'',email:'',role:'Atendente'})
  async function load(){const response=await fetch('/api/team',{cache:'no-store'});const data=await response.json();setMembers(data.members??[])}
  useEffect(()=>{load().catch(()=>notify('Não foi possível carregar a equipe'))},[])
  async function save(event:React.FormEvent){
    event.preventDefault();setSaving(true)
    try{const response=await fetch('/api/team',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(form)});const data=await response.json();if(!response.ok)throw new Error(data.message);await load();setOpen(false);setForm({name:'',email:'',role:'Atendente'});notify('Pessoa cadastrada na equipe')}
    catch(error){notify(error instanceof Error?error.message:'Falha ao cadastrar')}finally{setSaving(false)}
  }
  async function remove(member:TeamMember){
    if(!window.confirm(`Remover ${member.name} da equipe?`))return
    const response=await fetch(`/api/team?id=${encodeURIComponent(member.id)}`,{method:'DELETE'});if(response.ok){await load();notify('Pessoa removida')}else notify('Não foi possível remover')
  }
  return <div className="module">
    <ModuleHeader onAction={()=>setOpen(true)} title="Equipe" subtitle="PESSOAS CADASTRADAS" action="Cadastrar pessoa"/>
    <div className="module-stats"><Stat label="Pessoas cadastradas" value={String(members.length)}/><Stat label="Administradores" value={String(members.filter(member=>member.role==='Administrador').length)}/><Stat label="Supervisores" value={String(members.filter(member=>member.role==='Supervisor').length)}/></div>
    {members.length?<div className="team-list">{members.map(member=><article key={member.id}><span className="big-avatar">{member.name.slice(0,2).toUpperCase()}</span><div><b>{member.name}</b><small>{member.email}</small></div><em>{member.role}</em><small>Cadastrado em {new Date(member.createdAt).toLocaleDateString('pt-BR')}</small><button title="Remover" onClick={()=>remove(member)}><Trash2 size={15}/></button></article>)}</div>:<EmptyState title="Nenhuma pessoa cadastrada" text="Cadastre os usuários reais que farão parte da operação."/>}
    {open&&<div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setOpen(false)}}><form className="modal" onSubmit={save}><header><div><small>EQUIPE</small><h2>Cadastrar pessoa</h2></div><button type="button" onClick={()=>setOpen(false)}>×</button></header><label>Nome completo<input required value={form.name} onChange={event=>setForm({...form,name:event.target.value})}/></label><label>E-mail<input required type="email" value={form.email} onChange={event=>setForm({...form,email:event.target.value})}/></label><label>Função<select value={form.role} onChange={event=>setForm({...form,role:event.target.value})}><option>Atendente</option><option>Supervisor</option><option>Administrador</option></select></label><p className="modal-note">O cadastro fica salvo neste ambiente. O envio de convite por e-mail ainda não está habilitado.</p><footer><button type="button" onClick={()=>setOpen(false)}>Cancelar</button><button className="primary" disabled={saving}>{saving?'Salvando…':'Salvar pessoa'}</button></footer></form></div>}
  </div>
}

function EmptyState({title,text}:{title:string;text:string}){return <div className="empty-state"><Activity size={28}/><b>{title}</b><p>{text}</p></div>}

type LeadClassification = 'Novo lead' | 'Em qualificação' | 'Qualificado' | 'Proposta' | 'Cliente' | 'Perdido'
type RealContact = { number: string; remoteJid: string; name: string; source: string; classification: LeadClassification }

function RealContacts({ notify, onNavigate }: { notify: (message: string) => void; onNavigate: (module: string) => void }) {
  const [contacts, setContacts] = useState<RealContact[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; contact: RealContact } | null>(null)
  const [syncQr,setSyncQr]=useState('')
  const [syncing,setSyncing]=useState(false)

  async function load() {
    try {
      const response = await fetch('/api/whatsapp/contacts', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message)
      setContacts(data.contacts)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Falha ao carregar contatos')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    const close = () => setContextMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('scroll', close)
    return () => { window.removeEventListener('click', close); window.removeEventListener('scroll', close) }
  }, [])

  async function saveContacts(items: { name: string; number: string }[]) {
    const response = await fetch('/api/whatsapp/contacts', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contacts: items }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.message)
    await load()
  }

  async function newContact() {
    const name = window.prompt('Nome do contato')
    if (!name) return
    const number = window.prompt('Número com DDI e DDD. Exemplo: 5566999999999')
    if (!number) return
    try { await saveContacts([{ name, number }]); notify('Contato salvo no CRM') }
    catch (error) { notify(error instanceof Error ? error.message : 'Falha ao salvar contato') }
  }

  function importCsv() {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = '.csv,text/csv'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const lines = (await file.text()).split(/\r?\n/).filter(Boolean)
      const separator = lines[0]?.includes(';') ? ';' : ','
      const rows = lines.slice(1).map(line => {
        const [name, number] = line.split(separator).map(value => value.trim().replace(/^"|"$/g, ''))
        return { name, number }
      }).filter(contact => contact.name && contact.number)
      try { await saveContacts(rows); notify(`${rows.length} contatos importados`) }
      catch (error) { notify(error instanceof Error ? error.message : 'Falha ao importar CSV') }
    }
    input.click()
  }

  function exportCsv() {
    const csv = ['nome;telefone;origem', ...contacts.map(contact => `"${contact.name}";${contact.number};${contact.source}`)].join('\n')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    link.download = 'contatos-asax.csv'; link.click(); URL.revokeObjectURL(link.href)
    notify('Lista de contatos exportada')
  }

  async function classify(contact: RealContact, classification: LeadClassification) {
    try {
      const response = await fetch('/api/whatsapp/contacts', {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ number: contact.number, classification }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message)
      setContacts(current => current.map(item => item.number === contact.number ? { ...item, classification } : item))
      notify(`${contact.name} classificado como ${classification}`)
    } catch (error) { notify(error instanceof Error ? error.message : 'Falha ao classificar lead') }
  }

  function openConversation(contact: RealContact) {
    localStorage.setItem('nexo.openConversation', contact.remoteJid)
    onNavigate('Conversas')
  }
  async function syncAgenda(){
    setSyncing(true)
    try{const response=await fetch('/api/evolution/contact-sync',{method:'POST'});const data=await response.json();if(!response.ok)throw new Error(data.message);if(data.state==='open'){notify('Agenda conectada; atualizando contatos');window.setTimeout(load,1500)}else setSyncQr(data.qrCode)}
    catch(error){notify(error instanceof Error?error.message:'Falha ao sincronizar agenda')}finally{setSyncing(false)}
  }

  const filtered = contacts.filter(contact => `${contact.name} ${contact.number}`.toLowerCase().includes(query.toLowerCase()))
  return <div className="module">
    <header><div><span className="eyebrow">CONTATOS REAIS · WHATSAPP E CRM</span><h1>Contatos</h1></div><div className="header-actions"><button disabled={syncing} onClick={syncAgenda} className="ghost"><ContactRound size={17}/>{syncing?'Preparando...':'Carregar agenda do WhatsApp'}</button><button onClick={newContact} className="primary"><Plus size={17}/> Novo contato</button></div></header>
    <div className="module-stats"><Stat label="Contatos disponíveis" value={String(contacts.length)}/><Stat label="Origem" value="WhatsApp + CRM"/><Stat label="Histórico anterior" value="Não importado"/></div>
    <div className="toolbar"><div className="search"><Search size={17}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar nome ou telefone..."/></div><button onClick={exportCsv}>Exportar CSV <FileText size={15}/></button></div>
    <div className="contacts-table"><div className="contacts-head"><span>Contato</span><span>Telefone</span><span>Classificação</span><span>Ação</span></div>
      {loading && <p className="empty-chat">Carregando contatos...</p>}
      {!loading && filtered.length === 0 && <p className="empty-chat">Ainda não há contatos sincronizados. Você pode criar um contato ou importar um CSV.</p>}
      {filtered.map(contact => <div className="contact-row" onContextMenu={event => { event.preventDefault(); setContextMenu({ x: event.clientX, y: event.clientY, contact }) }} key={contact.number}><span><i className="big-avatar">{contact.name.slice(0,2).toUpperCase()}</i><b>{contact.name}</b></span><span>+{contact.number}</span><span><i className={`lead-badge lead-${contact.classification.toLowerCase().replaceAll(' ','-')}`}>{contact.classification}</i></span><button onClick={() => openConversation(contact)}>Conversar</button></div>)}
    </div>
    {contextMenu && <div className="lead-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={event => event.stopPropagation()}><small>CLASSIFICAR LEAD</small>{(['Novo lead','Em qualificação','Qualificado','Proposta','Cliente','Perdido'] as LeadClassification[]).map(classification => <button className={classification === contextMenu.contact.classification ? 'selected' : ''} onClick={() => { classify(contextMenu.contact, classification); setContextMenu(null) }} key={classification}>{classification}</button>)}</div>}
    {syncQr&&<div className="sync-modal"><div><button className="sync-close" onClick={()=>setSyncQr('')}>×</button><span className="eyebrow">IMPORTAR AGENDA COMPLETA</span><h2>Leia este QR uma única vez</h2><p>A conexão principal possui somente os contatos já entregues pelo WhatsApp. Esta leitura permite que a sessão de sincronização receba sua agenda salva.</p><img src={syncQr} alt="QR para importar agenda"/><small>Depois de conectar, aguarde alguns segundos e clique novamente em Carregar agenda.</small></div></div>}
  </div>
}

type MenuOption = { id: string; label: string }
type AIProvider='gemini'|'openai'|'custom'
type FlowAutomationNode = { id: string; type: 'trigger' | 'condition' | 'message' | 'wait' | 'classify' | 'menu' | 'webhook' | 'ticket' | 'handoff' | 'ai'; label: string; value: string; x: number; y: number; options?: MenuOption[]; operator?: 'contains' | 'equals' | 'startsWith' | 'exists'; triggerConfig?:{mode:'any'|'keyword';keyword:string}; aiConfig?: { objective:string; instructions:string; maxTurns:number; model:string; provider:AIProvider; credentialId?:string } }
type FlowEdge = { id: string; from: string; to: string; branch: string }

type AIOffer={id:string;name:string;description:string;price:string;billing:string;conditions:string}
type AIQualificationQuestion={id:string;field:string;question:string;required:boolean}
type AIProfile = { companyName:string; agentName:string; role:string; tone:string; companyContext:string; offers:AIOffer[]; salesRules:string; qualificationFields:string[]; qualificationQuestions:AIQualificationQuestion[]; forbiddenTopics:string; handoffRules:string }
type AICredential={id:string;name:string;provider:AIProvider;maskedKey:string;keySuffix:string;baseUrl?:string;model?:string;createdAt:string;updatedAt:string}

function ApiVault({notify}:{notify:(message:string)=>void}){
  const [credentials,setCredentials]=useState<AICredential[]>([])
  const [name,setName]=useState('')
  const [provider,setProvider]=useState<AIProvider>('gemini')
  const [apiKey,setApiKey]=useState('')
  const [baseUrl,setBaseUrl]=useState('')
  const [model,setModel]=useState('')
  const [saving,setSaving]=useState(false)
  const [testing,setTesting]=useState('')
  async function load(){
    try{const response=await fetch('/api/ai/credentials',{cache:'no-store'});const data=await response.json();if(!response.ok)throw new Error(data.message);setCredentials(data.credentials??[])}
    catch(error){notify(error instanceof Error?error.message:'Falha ao carregar APIs')}
  }
  useEffect(()=>{load()},[])
  async function add(){
    if(!name.trim()||!apiKey.trim())return notify('Preencha o nome e a chave da API')
    setSaving(true)
    try{
      const response=await fetch('/api/ai/credentials',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name,provider,apiKey,baseUrl,model})})
      const data=await response.json();if(!response.ok)throw new Error(data.message)
      setCredentials(current=>[...current,data]);setName('');setApiKey('');setBaseUrl('');setModel('');notify('API salva e protegida')
    }catch(error){notify(error instanceof Error?error.message:'Falha ao salvar API')}finally{setSaving(false)}
  }
  async function test(id:string){
    setTesting(id)
    try{const response=await fetch('/api/ai/credentials',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({id})});const data=await response.json();if(!response.ok)throw new Error(data.message);notify(`${data.message}: API pronta para uso`)}
    catch(error){notify(error instanceof Error?error.message:'Falha ao testar API')}finally{setTesting('')}
  }
  async function remove(id:string){
    if(!window.confirm('Excluir esta API? Blocos que usam esta credencial precisarão selecionar outra.'))return
    const response=await fetch(`/api/ai/credentials?id=${encodeURIComponent(id)}`,{method:'DELETE'})
    const data=await response.json();if(!response.ok)return notify(data.message??'Falha ao excluir API')
    setCredentials(current=>current.filter(item=>item.id!==id));notify('API removida')
  }
  return <div className="module api-vault"><header><div><span className="eyebrow">COFRE DE INTEGRAÇÕES · CRIPTOGRAFADO</span><h1>APIs e credenciais</h1><p>Cadastre várias chaves e escolha qual delas cada automação deve usar.</p></div><div className="vault-security"><ShieldCheck/><span><b>Proteção local ativa</b><small>As chaves nunca voltam para a tela</small></span></div></header>
    <div className="vault-layout"><section className="credential-form"><div className="vault-step"><span>01</span><div><b>Nova credencial</b><p>Dê um nome fácil de reconhecer no construtor.</p></div></div><label>Nome da API<input value={name} onChange={event=>setName(event.target.value)} placeholder="Ex.: OpenCode comercial"/></label><label>Tipo de provedor<select value={provider} onChange={event=>setProvider(event.target.value as AIProvider)}><option value="gemini">Google Gemini</option><option value="openai">OpenAI</option><option value="custom">Outra API · OpenCode ou compatível</option></select><small>Use “Outra API” para serviços compatíveis com o formato OpenAI.</small></label>{provider==='custom'&&<><label>Endereço da API<input value={baseUrl} onChange={event=>setBaseUrl(event.target.value)} placeholder="https://api.seuprovedor.com/v1"/></label><label>Modelo padrão<input value={model} onChange={event=>setModel(event.target.value)} placeholder="Ex.: deepseek-v4-flash"/></label></>}<label>Chave secreta<input type="password" autoComplete="off" value={apiKey} onChange={event=>setApiKey(event.target.value)} placeholder={provider==='gemini'?'Cole a chave do Google AI Studio':provider==='openai'?'Cole a chave sk-proj…':'Cole a chave fornecida pelo serviço'}/><small>A chave será criptografada antes de ser gravada.</small></label><button disabled={saving||!name.trim()||!apiKey.trim()||(provider==='custom'&&(!baseUrl.trim()||!model.trim()))} onClick={add}><Plus/>{saving?'Protegendo…':'Salvar credencial'}</button></section>
      <section className="credential-list"><header><div><b>Credenciais disponíveis</b><small>{credentials.length} cadastrada(s)</small></div><span>SELECIONÁVEIS NAS AUTOMAÇÕES</span></header>{credentials.length===0?<div className="vault-empty"><Plug/><b>Nenhuma API cadastrada</b><p>Adicione a primeira credencial ao lado.</p></div>:<div>{credentials.map(item=><article key={item.id}><span className={`provider-mark ${item.provider}`}>{item.provider==='gemini'?'G':item.provider==='openai'?'O':'+'}</span><div><small>{item.provider==='gemini'?'GOOGLE GEMINI':item.provider==='openai'?'OPENAI':'API PERSONALIZADA'}</small><b>{item.name}</b><code>{item.maskedKey}{item.model?` · ${item.model}`:''}</code></div><em>CRIPTOGRAFADA</em><button disabled={testing===item.id} onClick={()=>test(item.id)}>{testing===item.id?'Testando…':'Testar conexão'}</button><button className="credential-delete" onClick={()=>remove(item.id)} title="Excluir"><Trash2/></button></article>)}</div>}</section>
    </div><div className="vault-help"><BrainCircuit/><div><b>Como usar</b><p>Abra Automações, clique em um bloco “Agente de IA” e selecione esta credencial no campo “API utilizada”. Cada bloco pode usar uma chave diferente.</p></div></div>
  </div>
}

function RealAgents({notify}:{notify:(message:string)=>void}) {
  const [profile,setProfile]=useState<AIProfile | null>(null)
  const [saving,setSaving]=useState(false)
  useEffect(()=>{fetch('/api/ai/profile').then(response=>response.json()).then(setProfile).catch(()=>notify('Falha ao carregar a base da IA'))},[])
  async function save(){
    if(!profile)return; setSaving(true)
    try{const response=await fetch('/api/ai/profile',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(profile)});const data=await response.json();if(!response.ok)throw new Error(data.message);setProfile(data);notify('Base e comportamento do agente salvos')}
    catch(error){notify(error instanceof Error?error.message:'Falha ao salvar agente')}finally{setSaving(false)}
  }
  if(!profile)return <div className="module"><p className="empty-chat">Carregando agente...</p></div>
  const field=(key:Exclude<keyof AIProfile,'offers'|'qualificationFields'|'qualificationQuestions'>,label:string,hint:string,rows=3)=><label><span>{label}</span><small>{hint}</small>{rows===1?<input value={profile[key]} onChange={event=>setProfile({...profile,[key]:event.target.value})}/>:<textarea rows={rows} value={profile[key]} onChange={event=>setProfile({...profile,[key]:event.target.value})}/>}</label>
  const qualificationOptions=['Nome','Telefone','E-mail','Empresa','Cidade/UF','Produto de interesse','Necessidade principal','Orçamento disponível','Prazo para começar','Quantidade de usuários','Segmento da empresa','Cargo do contato','Melhor horário','Origem do lead']
  function updateOffer(id:string,changes:Partial<AIOffer>){setProfile(current=>current?{...current,offers:current.offers.map(offer=>offer.id===id?{...offer,...changes}:offer)}:current)}
  function suggestedQuestion(field:string){
    if(field==='Nome')return 'Antes de continuarmos, qual é o seu nome?'
    if(field==='Empresa')return 'Qual é o nome da sua empresa?'
    if(field==='Necessidade principal')return 'O que você procura ou precisa resolver hoje?'
    if(field==='Produto de interesse')return 'Qual produto ou plano chamou mais a sua atenção?'
    if(field==='Prazo para começar')return 'Quando você pretende começar?'
    if(field==='Orçamento disponível')return 'Você já possui uma faixa de investimento definida?'
    return `Pode me informar: ${field.toLowerCase()}?`
  }
  function toggleQualification(fieldName:string){
    if(!profile)return
    const active=profile.qualificationFields.includes(fieldName)
    setProfile({...profile,
      qualificationFields:active?profile.qualificationFields.filter(item=>item!==fieldName):[...profile.qualificationFields,fieldName],
      qualificationQuestions:active?profile.qualificationQuestions.filter(item=>item.field!==fieldName):[...profile.qualificationQuestions,{id:`question-${Date.now()}`,field:fieldName,question:suggestedQuestion(fieldName),required:true}],
    })
  }
  function updateQuestion(id:string,changes:Partial<AIQualificationQuestion>){setProfile(current=>current?{...current,qualificationQuestions:current.qualificationQuestions.map(item=>item.id===id?{...item,...changes}:item)}:current)}
  function moveQuestion(index:number,direction:-1|1){setProfile(current=>{if(!current)return current;const next=[...current.qualificationQuestions],target=index+direction;if(target<0||target>=next.length)return current;[next[index],next[target]]=[next[target],next[index]];return{...current,qualificationQuestions:next,qualificationFields:next.map(item=>item.field)}})}
  return <div className="module ai-studio"><header><div><span className="eyebrow">CÉREBRO COMERCIAL · BASE ÚNICA</span><h1>Agente de IA</h1><p>Estas informações orientam todos os blocos de IA usados nas automações.</p></div><button disabled={saving} onClick={save} className="primary"><CheckCircle2/>{saving?'Salvando...':'Salvar e ativar base'}</button></header>
    <div className="ai-studio-layout"><aside><div className="agent-identity"><span><BrainCircuit/></span><small>AGENTE PRINCIPAL</small><h2>{profile.agentName||'Assistente ASAX'}</h2><p>{profile.role}</p><i>BASE VINCULADA AOS FLUXOS</i></div><nav><a href="#identidade">01 · Identidade</a><a href="#empresa">02 · Empresa e marca</a><a href="#oferta">03 · Planos e preços</a><a href="#regras">04 · Regras comerciais</a><a href="#qualificacao">05 · Qualificação</a><a href="#seguranca">06 · Limites e entrega</a></nav></aside>
      <section className="ai-profile-form">
        <article id="identidade"><div><em>01</em><h3>Identidade e voz</h3><p>Defina quem atende e como a marca deve soar.</p></div><div className="profile-grid">{field('companyName','Nome da empresa','Marca que o agente representa',1)}{field('agentName','Nome do agente','Como ele se apresenta',1)}{field('role','Função','Ex.: consultor comercial',1)}{field('tone','Tom de voz','Ex.: consultivo, informal, direto',1)}</div></article>
        <article id="empresa"><div><em>02</em><h3>Empresa e contexto</h3><p>Explique o que a empresa faz, para quem e seus diferenciais.</p></div>{field('companyContext','Contexto da marca','História, público, serviços, diferenciais e informações importantes',6)}</article>
        <article id="oferta" className="offers-section"><div><em>03</em><h3>Planos, produtos e preços</h3><p>Cada oferta fica separada para a IA nunca misturar plano, benefício e valor.</p></div><div className="offer-list">{profile.offers.map((offer,index)=><div className="offer-card" key={offer.id}><header><span>PLANO {String(index+1).padStart(2,'0')}</span><button onClick={()=>setProfile({...profile,offers:profile.offers.filter(item=>item.id!==offer.id)})}><Trash2/> Remover</button></header><div className="offer-grid"><label><span>Nome do plano ou produto</span><input value={offer.name} onChange={event=>updateOffer(offer.id,{name:event.target.value})} placeholder="Ex.: Plano Pro"/></label><label><span>Preço</span><input value={offer.price} onChange={event=>updateOffer(offer.id,{price:event.target.value})} placeholder="Ex.: R$ 299,00"/></label><label><span>Forma de cobrança</span><select value={offer.billing} onChange={event=>updateOffer(offer.id,{billing:event.target.value})}><option value="">Selecione...</option><option>Mensal</option><option>Trimestral</option><option>Semestral</option><option>Anual</option><option>Pagamento único</option><option>Sob consulta</option></select></label><label className="wide"><span>Benefícios e o que está incluído</span><textarea rows={3} value={offer.description} onChange={event=>updateOffer(offer.id,{description:event.target.value})} placeholder="Um benefício por linha"/></label><label className="wide"><span>Condições específicas</span><textarea rows={2} value={offer.conditions} onChange={event=>updateOffer(offer.id,{conditions:event.target.value})} placeholder="Implantação, fidelidade, limites, bônus..."/></label></div></div>)}</div><button className="add-offer" onClick={()=>setProfile({...profile,offers:[...profile.offers,{id:`offer-${Date.now()}`,name:'',description:'',price:'',billing:'Mensal',conditions:''}]})}><Plus/> Adicionar plano ou produto</button></article>
        <article id="regras"><div><em>04</em><h3>Regras comerciais</h3><p>Descontos, condições, regiões atendidas e políticas.</p></div>{field('salesRules','Regras de venda','Tudo que ele pode ou não oferecer durante a conversa',5)}</article>
        <article id="qualificacao" className="qualification-script"><div><em>05</em><h3>Roteiro de qualificação</h3><p>Escolha os dados, defina a pergunta e organize exatamente a ordem que a IA deve seguir.</p></div>
          <div className="qualification-chips">{qualificationOptions.map(option=>{const active=profile.qualificationFields.includes(option);return <button className={active?'selected':''} onClick={()=>toggleQualification(option)} key={option}><i>{active?'✓':'+'}</i>{option}</button>})}</div>
          <div className="question-script-head"><div><b>ORDEM DA CONVERSA</b><small>A IA reconhece respostas naturais e não repete dados já informados.</small></div><span>{profile.qualificationQuestions.length} perguntas</span></div>
          <div className="question-script-list">{profile.qualificationQuestions.map((item,index)=><div className="question-script-row" key={item.id}>
            <span className="question-order">{String(index+1).padStart(2,'0')}</span>
            <div className="question-script-copy"><b>{item.field}</b><input value={item.question} onChange={event=>updateQuestion(item.id,{question:event.target.value})}/></div>
            <label className="question-required"><input type="checkbox" checked={item.required} onChange={event=>updateQuestion(item.id,{required:event.target.checked})}/><span>Obrigatória</span></label>
            <div className="question-move"><button disabled={index===0} title="Mover para cima" onClick={()=>moveQuestion(index,-1)}>↑</button><button disabled={index===profile.qualificationQuestions.length-1} title="Mover para baixo" onClick={()=>moveQuestion(index,1)}>↓</button></div>
          </div>)}</div>
          <div className="qualification-summary"><BrainCircuit/><div><b>{profile.qualificationQuestions.filter(item=>item.required).length} perguntas obrigatórias</b><p>A IA seguirá essa sequência, salvará cada resposta e só avançará quando entender o dado atual.</p></div></div>
        </article>
        <article id="seguranca"><div><em>06</em><h3>Limites e atendimento humano</h3><p>Evite invenções e determine quando sua equipe deve assumir.</p></div><div className="profile-grid two">{field('forbiddenTopics','Proibições','Assuntos e promessas proibidas',6)}{field('handoffRules','Quando entregar ao humano','Situações que encerram a atuação da IA',6)}</div></article>
      </section>
    </div>
  </div>
}

function RealAutomations({ notify }: { notify: (message: string) => void }) {
  const [enabled, setEnabled] = useState(true)
  const [name, setName] = useState('Atendimento inicial')
  const [nodes, setNodes] = useState<FlowAutomationNode[]>([])
  const [edges, setEdges] = useState<FlowEdge[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [connecting, setConnecting] = useState<{ from: string; branch: FlowEdge['branch'] } | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedSnapshot,setSavedSnapshot]=useState('')
  const [publishError,setPublishError]=useState('')
  const [creatorOpen, setCreatorOpen] = useState(false)
  const [creatorType, setCreatorType] = useState<keyof typeof definitions | ''>('')
  const [creatorLabel, setCreatorLabel] = useState('')
  const [creatorValue, setCreatorValue] = useState('')
  const [creatorOptions, setCreatorOptions] = useState<MenuOption[]>([])
  const [creatorOperator, setCreatorOperator] = useState<FlowAutomationNode['operator']>('contains')
  const [creatorAi, setCreatorAi] = useState<NonNullable<FlowAutomationNode['aiConfig']>>({ objective:'Qualificar o interesse do lead e coletar nome, necessidade e prazo.', instructions:'Seja cordial, direto e faça uma pergunta por vez.', maxTurns:40, model:'gemini-2.5-flash', provider:'gemini' })
  const [credentials,setCredentials]=useState<AICredential[]>([])
  const canvasRef = useRef<HTMLDivElement>(null)
  const draggedNodeRef=useRef(false)

  useEffect(() => {
    fetch('/api/whatsapp/automation').then(response => response.json()).then(config => {
      const loadedNodes = (config.nodes ?? []).map((node: FlowAutomationNode) => node.type === 'menu' && !node.options?.length ? {
        ...node, value: node.value.split('|')[0], options: node.value.split('|').slice(1).map((label,index) => ({id:String(index+1),label})),
      } : node)
      const snapshot=JSON.stringify({enabled:config.enabled,name:config.name,nodes:loadedNodes,edges:config.edges??[]})
      setEnabled(config.enabled); setName(config.name); setNodes(loadedNodes); setEdges(config.edges ?? []); setSelectedId('');setSavedSnapshot(snapshot)
    }).catch(() => notify('Não foi possível carregar o fluxo'))
  }, [])
  useEffect(()=>{fetch('/api/ai/credentials',{cache:'no-store'}).then(response=>response.json()).then(data=>setCredentials(data.credentials??[])).catch(()=>{})},[])

  const selectedNode = nodes.find(node => node.id === selectedId)
  const definitions = {
    condition: { label: 'Mensagem contém', value: 'oi' },
    message: { label: 'Enviar mensagem', value: 'Olá! Como posso ajudar?' },
    wait: { label: 'Aguardar', value: '2' },
    classify: { label: 'Classificar lead', value: 'Qualificado' },
    menu: { label: 'Menu de opções', value: 'Como podemos ajudar?|Vendas|Suporte|Financeiro' },
    webhook: { label: 'Notificar sistema', value: 'https://exemplo.com/webhook' },
    ticket: { label: 'Criar ticket', value: 'Atendimento solicitado pelo WhatsApp' },
    handoff: { label: 'Entregar para humano', value: 'Pré-atendimento concluído' },
    ai: { label: 'Agente de IA', value: 'Pré-atendimento inteligente' },
  } as const

  function chooseCreatorType(type: keyof typeof definitions) {
    const definition = definitions[type]
    setCreatorType(type); setCreatorLabel(definition.label); setCreatorValue(type === 'menu' ? 'Como podemos ajudar você hoje?' : definition.value)
    setCreatorOperator('contains')
    setCreatorOptions(type === 'menu' ? [{id:'1',label:'Quero comprar'},{id:'2',label:'Preciso de suporte'},{id:'3',label:'Falar com atendente'}] : [])
  }
  function openCreator(type?: keyof typeof definitions) {
    setCreatorOpen(true)
    if (type) chooseCreatorType(type)
    else { setCreatorType(''); setCreatorLabel(''); setCreatorValue('') }
  }
  function createNode() {
    if (!creatorType || !creatorLabel.trim() || !creatorValue.trim()) return notify('Preencha a configuração do bloco')
    const index = nodes.length
    const node: FlowAutomationNode = { id: `${creatorType}-${Date.now()}`, type: creatorType, label: creatorLabel.trim(), value: creatorValue.trim(), x: 330 + (index % 4) * 230, y: 70 + Math.floor(index / 4) * 210, options: creatorType === 'menu' ? creatorOptions : undefined, operator: creatorType === 'condition' ? creatorOperator : undefined, aiConfig: creatorType === 'ai' ? creatorAi : undefined }
    setNodes(current => [...current, node]); setSelectedId(node.id); setCreatorOpen(false)
  }
  function updateNode(changes: Partial<FlowAutomationNode>) { setNodes(current => current.map(node => node.id === selectedId ? { ...node, ...changes } : node)) }
  function removeNode() {
    if (selectedNode?.type === 'trigger') return notify('O gatilho inicial não pode ser removido')
    setNodes(current => current.filter(node => node.id !== selectedId))
    setEdges(current => current.filter(edge => edge.from !== selectedId && edge.to !== selectedId))
    setSelectedId(nodes.find(node => node.id !== selectedId)?.id ?? '')
  }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setSelectedId(''); setConnecting(null); return }
      if (!['Backspace','Delete'].includes(event.key) || !selectedId) return
      const target = event.target as HTMLElement
      if (target.matches('input,textarea,select,[contenteditable="true"]')) return
      event.preventDefault()
      removeNode()
    }
    window.addEventListener('keydown',onKey)
    return () => window.removeEventListener('keydown',onKey)
  }, [selectedId,selectedNode,nodes])
  function beginDrag(event: React.PointerEvent, node: FlowAutomationNode) {
    if ((event.target as HTMLElement).closest('.node-port')) return
    event.preventDefault()
    draggedNodeRef.current=false
    const origin = { x: event.clientX, y: event.clientY, left: node.x, top: node.y }
    const move = (pointer: PointerEvent) => {
      if(Math.abs(pointer.clientX-origin.x)+Math.abs(pointer.clientY-origin.y)>5)draggedNodeRef.current=true
      setNodes(current => current.map(item => item.id === node.id ? {
        ...item, x: Math.max(18, origin.left + pointer.clientX - origin.x), y: Math.max(18, origin.top + pointer.clientY - origin.y),
      } : item))
    }
    const stop = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop)
  }
  function handleNodeClick(node:FlowAutomationNode){
    if(draggedNodeRef.current){draggedNodeRef.current=false;return}
    if(connecting)finishConnection(node);else setSelectedId(node.id)
  }
  function finishConnection(target: FlowAutomationNode) {
    if (!connecting || connecting.from === target.id) return
    const edge: FlowEdge = { id: `${connecting.from}-${connecting.branch}-${target.id}`, from: connecting.from, to: target.id, branch: connecting.branch }
    setEdges(current => [...current.filter(item => !(item.from === edge.from && item.branch === edge.branch)), edge])
    setConnecting(null)
  }
  function setBranchTarget(branch: string, targetId: string) {
    if (!selectedNode) return
    setEdges(current => {
      const clean = current.filter(edge => !(edge.from === selectedNode.id && edge.branch === branch))
      return targetId ? [...clean, { id: `${selectedNode.id}-${branch}-${targetId}`, from: selectedNode.id, to: targetId, branch }] : clean
    })
  }
  async function save() {
    if(validationIssues.length){setPublishError('Revise os itens abaixo antes de publicar.');notify('O fluxo ainda possui configurações pendentes');return}
    setSaving(true)
    setPublishError('')
    try {
      const response = await fetch('/api/whatsapp/automation', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ enabled, name, nodes, edges }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message)
      setNodes(data.nodes); setEdges(data.edges ?? []);setSavedSnapshot(JSON.stringify({enabled:data.enabled,name:data.name,nodes:data.nodes,edges:data.edges??[]})); notify('Fluxo publicado e já ativo no WhatsApp')
    } catch (error) { const message=error instanceof Error ? error.message : 'Falha ao publicar o fluxo';setPublishError(message);notify(message) }
    finally { setSaving(false) }
  }

  const nodeIcon = (type: FlowAutomationNode['type']) => type === 'trigger' ? <MessageCircle/> : type === 'condition' ? <GitBranch/> : type === 'message' ? <Send/> : type === 'wait' ? <Timer/> : type === 'menu' ? <ListChecks/> : type === 'ticket' ? <Ticket/> : type === 'webhook' ? <Plug/> : type === 'handoff' ? <Users/> : type === 'ai' ? <BrainCircuit/> : <Tag/>
  const detail = (node: FlowAutomationNode) => node.type === 'condition' ? `Contém “${node.value}”` : node.type === 'message' ? node.value : node.type === 'wait' ? `${node.value} segundo(s)` : node.type === 'classify' ? node.value : node.type === 'menu' ? `${node.options?.length ?? 0} opções` : node.type === 'webhook' ? node.value : node.type === 'ticket' ? node.value : node.type === 'handoff' ? 'Bot para e a equipe assume' : node.type === 'ai' ? node.aiConfig?.objective ?? node.value : node.triggerConfig?.mode==='keyword'?`Ao receber “${node.triggerConfig.keyword}”`:'Qualquer mensagem recebida'
  const branchName = (from:string,branch:string) => {
    const source=nodes.find(node=>node.id===from)
    if(branch==='true')return 'SIM'; if(branch==='false')return 'NÃO'; if(branch==='qualified')return 'OBJETIVO CONCLUÍDO'; if(branch==='handoff')return 'ENTREGAR AO HUMANO'; if(branch==='fallback')return 'OUTRA RESPOSTA'
    if(branch.startsWith('option:'))return source?.options?.find(option=>`option:${option.id}`===branch)?.label.toUpperCase() ?? 'OPÇÃO'
    return 'CONTINUAR'
  }
  const currentSnapshot=JSON.stringify({enabled,name,nodes,edges})
  const hasUnsavedChanges=Boolean(savedSnapshot)&&currentSnapshot!==savedSnapshot
  const validationIssues=useMemo(()=>{
    const issues:string[]=[]
    const trigger=nodes.find(node=>node.type==='trigger')
    if(!trigger)issues.push('Adicione um gatilho de entrada.')
    if(trigger?.triggerConfig?.mode==='keyword'&&!trigger.triggerConfig.keyword.trim())issues.push('Digite a palavra ou frase que deve iniciar o fluxo.')
    if(!nodes.some(node=>['message','menu','ai','classify','ticket','handoff','webhook'].includes(node.type)))issues.push('Adicione pelo menos uma ação.')
    if(trigger&&!edges.some(edge=>edge.from===trigger.id))issues.push('Conecte o gatilho à primeira ação.')
    for(const node of nodes.filter(node=>node.type==='condition')){if(!edges.some(edge=>edge.from===node.id&&edge.branch==='true'))issues.push(`Defina a saída SIM de “${node.label}”.`)}
    for(const node of nodes.filter(node=>node.type==='menu')){for(const option of node.options??[]){if(!edges.some(edge=>edge.from===node.id&&edge.branch===`option:${option.id}`))issues.push(`Conecte a opção “${option.label}”.`)}}
    return issues
  },[nodes,edges])
  useEffect(()=>{if(publishError)setPublishError('')},[currentSnapshot])

  return <div className="module automation-module">
    <header><div><span className="eyebrow">CONSTRUTOR REAL · WHATSAPP</span><h1>Automações</h1><p className="automation-status"><i className={hasUnsavedChanges?'dirty':'saved'}/>{hasUnsavedChanges?'Alterações ainda não publicadas':'Todas as alterações estão publicadas'}</p></div><div className="header-actions"><button onClick={() => setEnabled(value => !value)} className="ghost">{enabled ? 'Pausar fluxo' : 'Ativar fluxo'}</button><button disabled={saving} onClick={save} className={`primary ${hasUnsavedChanges?'publish-ready':''}`}><CheckCircle2 size={17}/>{saving ? 'Publicando...' : hasUnsavedChanges?'Publicar alterações':'Salvar e publicar'}</button></div></header>
    <div className="flow-name"><label>Nome do fluxo<input value={name} onChange={event => setName(event.target.value)}/></label><span className={enabled ? 'online' : 'paused'}>{enabled ? 'ATIVO' : 'PAUSADO'}</span></div>
    <div className="builder-toolbar"><b>Construtor visual</b><span>Crie, configure e conecte cada etapa do atendimento.</span><button className="new-block-button" onClick={() => openCreator()}><Plus/> Novo bloco</button></div>
    <div className="automation-onboarding"><div><span>1</span><p><b>Crie uma caixa</b>Use “Novo bloco” para escolher mensagem, menu, IA ou ação.</p></div><i>→</i><div><span>2</span><p><b>Configure</b>Dê um clique curto na caixa. Arrastar apenas move.</p></div><i>→</i><div><span>3</span><p><b>Conecte</b>Clique na saída identificada e depois no destino.</p></div><i>→</i><div><span>4</span><p><b>Publique</b>Corrija os avisos e ative o fluxo no WhatsApp.</p></div></div>
    {(publishError||validationIssues.length>0)&&<div className={`flow-validation ${publishError?'error':''}`}><div><ShieldCheck/><span><b>{publishError||'Fluxo ainda incompleto'}</b><small>{validationIssues.length?`${validationIssues.length} item(ns) precisam de atenção`:'Revise a configuração e tente novamente.'}</small></span></div>{validationIssues.length>0&&<ul>{validationIssues.slice(0,6).map(issue=><li key={issue}>{issue}</li>)}</ul>}</div>}
    {connecting && <div className="connection-hint"><span>Ligando</span><b>{nodes.find(node=>node.id===connecting.from)?.label}</b><i>pela saída</i><strong>{branchName(connecting.from,connecting.branch)}</strong><em>→ clique na caixa de destino</em><button onClick={() => setConnecting(null)}>Cancelar · Esc</button></div>}
    <div className="flow-builder-canvas" ref={canvasRef}>
      <svg className="flow-lines" aria-hidden="true">
        {edges.map(edge => {
          const from = nodes.find(node => node.id === edge.from), to = nodes.find(node => node.id === edge.to)
          if (!from || !to) return null
          const optionIndex = edge.branch.startsWith('option:') ? (from.options ?? []).findIndex(option => `option:${option.id}` === edge.branch) : -1
          const x1 = from.x + 190, y1 = from.y + (optionIndex >= 0 ? 94 + optionIndex * 27 : edge.branch === 'true' ? 54 : edge.branch === 'false' ? 102 : 78)
          const x2 = to.x, y2 = to.y + 78, bend = Math.max(80, Math.abs(x2 - x1) * .45)
          return <g key={edge.id}><path className={`flow-line branch-${edge.branch}`} d={`M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`}/>
            {edge.branch !== 'default' && <text x={(x1+x2)/2} y={(y1+y2)/2-7}>{edge.branch === 'true' ? 'SIM' : edge.branch === 'false' ? 'NÃO' : edge.branch === 'qualified' ? 'CONCLUÍDO' : edge.branch === 'handoff' ? 'HUMANO' : edge.branch === 'fallback' ? 'OUTRA' : ''}</text>}</g>
        })}
      </svg>
      {nodes.map(node => <div onPointerDown={event => beginDrag(event, node)} onClick={() => handleNodeClick(node)}
        className={`builder-node node-${node.type} ${selectedId === node.id ? 'selected' : ''} ${connecting ? 'connection-target' : ''}`}
        style={{ left: node.x, top: node.y }} key={node.id}>
        <span>{nodeIcon(node.type)}</span><small>{node.type === 'trigger' ? 'GATILHO' : node.type === 'condition' ? 'CONDIÇÃO' : 'AÇÃO'}</small><b>{node.label}</b><p>{detail(node)}</p>
        {node.type === 'condition' ? <div className="branch-ports"><button className="node-port yes" onClick={event => { event.stopPropagation(); setConnecting({from:node.id,branch:'true'}) }}>Sim +</button><button className="node-port no" onClick={event => { event.stopPropagation(); setConnecting({from:node.id,branch:'false'}) }}>Não +</button></div> :
          node.type === 'menu' ? <div className="menu-node-options">{(node.options ?? []).map(option => <button className="node-port" title={option.label} onClick={event => { event.stopPropagation(); setConnecting({from:node.id,branch:`option:${option.id}`}) }} key={option.id}>{option.label}<b>+</b></button>)}<button className="node-port fallback" onClick={event => { event.stopPropagation(); setConnecting({from:node.id,branch:'fallback'}) }}>Outra resposta<b>+</b></button></div> :
          node.type === 'ai' ? <div className="ai-node-ports"><button className="node-port yes" onClick={event => {event.stopPropagation();setConnecting({from:node.id,branch:'qualified'})}}>Concluído +</button><button className="node-port no" onClick={event => {event.stopPropagation();setConnecting({from:node.id,branch:'handoff'})}}>Humano +</button></div> :
          <button className="node-port default" onClick={event => { event.stopPropagation(); setConnecting({from:node.id,branch:'default'}) }}>+</button>}
      </div>)}
    </div>
    {selectedNode && <div className="automation-blade-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setSelectedId('')}}><aside className="node-inspector automation-blade">
      <div className="blade-head"><div><span className="eyebrow">CONFIGURAR CAIXA</span><h3>{selectedNode.label}</h3><small>Alterações aplicadas imediatamente no quadro</small></div><button onClick={()=>setSelectedId('')}>×</button></div>
      <div className="inspector-field"><label>Nome da caixa<input value={selectedNode.label} disabled={selectedNode.type === 'trigger'} onChange={event => updateNode({ label: event.target.value })}/></label>
        {selectedNode.type === 'condition' && <><label>Regra<select value={selectedNode.operator ?? 'contains'} onChange={event => updateNode({ operator:event.target.value as FlowAutomationNode['operator'] })}><option value="contains">Mensagem contém</option><option value="equals">Mensagem é exatamente</option><option value="startsWith">Mensagem começa com</option><option value="exists">Contato respondeu</option></select></label>{selectedNode.operator !== 'exists' && <label>Valor esperado<input value={selectedNode.value} onChange={event => updateNode({ value: event.target.value })}/></label>}</>}
        {selectedNode.type === 'message' && <label>Mensagem enviada<textarea rows={3} value={selectedNode.value} onChange={event => updateNode({ value: event.target.value })}/></label>}
        {selectedNode.type === 'wait' && <label>Segundos de espera<input type="number" min="1" max="10" value={selectedNode.value} onChange={event => updateNode({ value: event.target.value })}/></label>}
        {selectedNode.type === 'classify' && <label>Classificação<select value={selectedNode.value} onChange={event => updateNode({ value: event.target.value })}>{['Novo lead','Em qualificação','Qualificado','Proposta','Cliente','Perdido'].map(value => <option key={value}>{value}</option>)}</select></label>}
        {selectedNode.type === 'menu' && <div className="inspector-menu"><label>Mensagem do menu<textarea rows={3} value={selectedNode.value} onChange={event => updateNode({ value: event.target.value })}/></label><b>Opções e destinos</b>{(selectedNode.options ?? []).map((option,index) => <div className="inspector-option" key={option.id}><span>{index+1}</span><input value={option.label} onChange={event => updateNode({ options:(selectedNode.options ?? []).map(item => item.id === option.id ? {...item,label:event.target.value} : item) })}/><select value={edges.find(edge => edge.from === selectedNode.id && edge.branch === `option:${option.id}`)?.to ?? ''} onChange={event => setBranchTarget(`option:${option.id}`,event.target.value)}><option value="">Escolher destino...</option>{nodes.filter(node => node.id !== selectedNode.id).map(node => <option value={node.id} key={node.id}>{node.label}</option>)}</select><button onClick={() => { updateNode({options:(selectedNode.options ?? []).filter(item => item.id !== option.id)}); setEdges(current => current.filter(edge => !(edge.from === selectedNode.id && edge.branch === `option:${option.id}`))) }}><Trash2/></button></div>)}<div className="inspector-option fallback-row"><span>!</span><b>Resposta não reconhecida</b><select value={edges.find(edge => edge.from === selectedNode.id && edge.branch === 'fallback')?.to ?? ''} onChange={event => setBranchTarget('fallback',event.target.value)}><option value="">Encerrar sem responder</option>{nodes.filter(node => node.id !== selectedNode.id).map(node => <option value={node.id} key={node.id}>{node.label}</option>)}</select><i/></div><button className="add-option" disabled={(selectedNode.options?.length ?? 0) >= 10} onClick={() => updateNode({options:[...(selectedNode.options ?? []),{id:`${Date.now()}`,label:`Opção ${(selectedNode.options?.length ?? 0)+1}`}]})}><Plus/> Adicionar opção</button></div>}
        {selectedNode.type === 'webhook' && <label>URL do webhook<input type="url" value={selectedNode.value} onChange={event => updateNode({ value: event.target.value })}/></label>}
        {selectedNode.type === 'ticket' && <label>Assunto do ticket<input value={selectedNode.value} onChange={event => updateNode({ value: event.target.value })}/></label>}
        {selectedNode.type === 'handoff' && <label>Motivo da entrega<input value={selectedNode.value} onChange={event => updateNode({ value: event.target.value })}/><small>Ao chegar aqui, a automação para de responder este contato até você reativá-la.</small></label>}
        {selectedNode.type === 'ai' && <div className="inspector-menu">
          <label>API utilizada<select value={selectedNode.aiConfig?.credentialId??''} onChange={event=>{const credential=credentials.find(item=>item.id===event.target.value);const base=selectedNode.aiConfig??{objective:'',instructions:'',maxTurns:8,model:'gemini-2.5-flash',provider:'gemini'};updateNode({aiConfig:{...base,credentialId:event.target.value||undefined,provider:credential?.provider??base.provider,model:credential?.model??(credential?.provider==='openai'?'gpt-5.6':credential?.provider==='gemini'?'gemini-2.5-flash':base.model)}})}}><option value="">Credencial padrão do ambiente</option>{credentials.map(item=><option value={item.id} key={item.id}>{item.name} · {item.provider==='gemini'?'Gemini':item.provider==='openai'?'OpenAI':'Personalizada'} · {item.maskedKey}</option>)}</select><small>Cadastre Gemini, OpenAI, OpenCode ou outra API compatível em Configurações.</small></label>
          <label>Provedor da IA<select disabled={Boolean(selectedNode.aiConfig?.credentialId)} value={selectedNode.aiConfig?.provider ?? (selectedNode.aiConfig?.model?.startsWith('gemini-')?'gemini':'openai')} onChange={event=>{const provider=event.target.value as AIProvider;updateNode({aiConfig:{...(selectedNode.aiConfig??{objective:'',instructions:'',maxTurns:8,model:'gemini-2.5-flash',provider:'gemini'}),provider,model:provider==='gemini'?'gemini-2.5-flash':'gpt-5.6'}})}}><option value="gemini">Gemini · gratuito para testes</option><option value="openai">OpenAI · exige saldo na API</option><option value="custom">API personalizada</option></select></label>
          <label>Modelo{selectedNode.aiConfig?.provider==='custom'?<input value={selectedNode.aiConfig?.model??''} onChange={event=>updateNode({aiConfig:{...(selectedNode.aiConfig??{objective:'',instructions:'',maxTurns:8,provider:'custom'}),model:event.target.value}})} placeholder="Modelo configurado na credencial"/>:<select value={selectedNode.aiConfig?.model ?? 'gemini-2.5-flash'} onChange={event=>updateNode({aiConfig:{...(selectedNode.aiConfig??{objective:'',instructions:'',maxTurns:8,provider:'gemini'}),model:event.target.value}})}>{(selectedNode.aiConfig?.provider??'gemini')==='gemini'?<><option value="gemini-2.5-flash">Gemini 2.5 Flash</option><option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite</option></>:<option value="gpt-5.6">GPT-5.6</option>}</select>}</label>
          <label>Objetivo<textarea rows={3} value={selectedNode.aiConfig?.objective ?? ''} onChange={event => updateNode({aiConfig:{...(selectedNode.aiConfig ?? {instructions:'',maxTurns:8,model:'gemini-2.5-flash',provider:'gemini'}),objective:event.target.value}})}/></label>
          <label>Instruções<textarea rows={3} value={selectedNode.aiConfig?.instructions ?? ''} onChange={event => updateNode({aiConfig:{...(selectedNode.aiConfig ?? {objective:'',maxTurns:8,model:'gemini-2.5-flash',provider:'gemini'}),instructions:event.target.value}})}/></label>
          <label>Limite de interações<input type="number" min="1" max="100" value={Math.max(selectedNode.aiConfig?.maxTurns ?? 40,40)} onChange={event => updateNode({aiConfig:{...(selectedNode.aiConfig ?? {objective:'',instructions:'',model:'gemini-2.5-flash',provider:'gemini'}),maxTurns:Number(event.target.value)}})}/><small>Defina quantas mensagens a IA pode trocar. O sistema preserva as perguntas obrigatórias e só entrega antes em caso de pedido humano ou após 100 interações sem conclusão.</small></label>
          <div className="branch-config"><label>Objetivo concluído<select value={edges.find(edge=>edge.from===selectedNode.id&&edge.branch==='qualified')?.to??''} onChange={event=>setBranchTarget('qualified',event.target.value)}><option value="">Encerrar fluxo</option>{nodes.filter(node=>node.id!==selectedNode.id).map(node=><option value={node.id} key={node.id}>{node.label}</option>)}</select></label><label>Entregar para humano<select value={edges.find(edge=>edge.from===selectedNode.id&&edge.branch==='handoff')?.to??''} onChange={event=>setBranchTarget('handoff',event.target.value)}><option value="">Pausar automaticamente</option>{nodes.filter(node=>node.id!==selectedNode.id).map(node=><option value={node.id} key={node.id}>{node.label}</option>)}</select></label></div>
        </div>}
        {selectedNode.type === 'trigger' && <div className="trigger-settings">
          <div className="trigger-mode-card"><span><MessageCircle/></span><div><b>Quando iniciar este fluxo?</b><p>Escolha se a IA atende qualquer nova conversa ou somente uma mensagem específica.</p></div></div>
          <label>Tipo de entrada<select value={selectedNode.triggerConfig?.mode??'any'} onChange={event=>updateNode({triggerConfig:{mode:event.target.value as 'any'|'keyword',keyword:selectedNode.triggerConfig?.keyword??''}})}><option value="any">Qualquer mensagem recebida</option><option value="keyword">Somente palavra ou frase específica</option></select></label>
          {(selectedNode.triggerConfig?.mode??'any')==='keyword'&&<label>Mensagem que ativa o fluxo<input value={selectedNode.triggerConfig?.keyword??''} onChange={event=>updateNode({triggerConfig:{mode:'keyword',keyword:event.target.value}})} placeholder="Ex.: quero conhecer os planos"/><small>Não diferencia maiúsculas e minúsculas. A frase pode estar no meio da mensagem.</small></label>}
          <label>Primeira etapa<select value={edges.find(edge=>edge.from===selectedNode.id&&edge.branch==='default')?.to??''} onChange={event=>setBranchTarget('default',event.target.value)}><option value="">Escolha o primeiro bloco...</option>{nodes.filter(node=>node.id!==selectedNode.id).map(node=><option value={node.id} key={node.id}>{node.type==='ai'?'✨ Iniciar direto com IA · ':''}{node.label}</option>)}</select><small>Para a IA responder imediatamente, escolha o bloco “Agente de IA”.</small></label>
        </div>}
        {selectedNode.type === 'condition' && <div className="branch-config">
          <label>Se SIM, ir para<select value={edges.find(edge => edge.from === selectedNode.id && edge.branch === 'true')?.to ?? ''} onChange={event => setBranchTarget('true', event.target.value)}><option value="">Selecione uma caixa...</option>{nodes.filter(node => node.id !== selectedNode.id).map(node => <option value={node.id} key={node.id}>{node.label}</option>)}</select></label>
          <label>Se NÃO, ir para<select value={edges.find(edge => edge.from === selectedNode.id && edge.branch === 'false')?.to ?? ''} onChange={event => setBranchTarget('false', event.target.value)}><option value="">Encerrar este caminho</option>{nodes.filter(node => node.id !== selectedNode.id).map(node => <option value={node.id} key={node.id}>{node.label}</option>)}</select></label>
        </div>}
      </div>
      {edges.some(edge=>edge.from===selectedNode.id)&&<div className="connection-manager"><b>CONEXÕES DESTA CAIXA</b>{edges.filter(edge=>edge.from===selectedNode.id).map(edge=><div key={edge.id}><span>{branchName(edge.from,edge.branch)}</span><i>→</i><strong>{nodes.find(node=>node.id===edge.to)?.label??'Destino removido'}</strong><button title="Excluir somente esta conexão" onClick={()=>setEdges(current=>current.filter(item=>item.id!==edge.id))}><Trash2/></button></div>)}</div>}
      <div className="inspector-actions"><button onClick={() => setConnecting({from:selectedNode.id,branch:selectedNode.type === 'condition' ? 'true' : 'default'})}><Plug/> Criar conexão</button><button disabled={selectedNode.type === 'trigger'} onClick={removeNode} className="danger"><Trash2/> Excluir caixa</button></div>
      <footer className="blade-footer"><span>Pressione <kbd>Backspace</kbd> para excluir</span><button onClick={()=>setSelectedId('')}>Concluir</button></footer>
    </aside></div>}
    <div className="test-instruction"><Play size={18}/><div><b>Fluxo executável</b><p>Arraste as caixas livremente. Use o + para ligar uma caixa a outra; condições possuem caminhos Sim e Não. Ao publicar, o WhatsApp percorre as conexões desenhadas.</p></div></div>
    {creatorOpen && <div className="block-creator-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setCreatorOpen(false) }}>
      <section className="block-creator">
        <header><div><span className="eyebrow">NOVA ETAPA DO FLUXO</span><h2>{creatorType ? 'Configurar bloco' : 'O que deve acontecer?'}</h2><p>{creatorType ? 'Preencha os dados abaixo. Você poderá alterar tudo depois.' : 'Escolha uma ação para adicionar ao seu atendimento automático.'}</p></div><button onClick={() => setCreatorOpen(false)}>×</button></header>
        <div className="creator-body">
          <aside className="creator-catalog">
            {([
              ['message','CONVERSA','Enviar mensagem','Texto automático para o contato',Send],
              ['condition','LÓGICA','Decisão Sim / Não','Crie dois caminhos conforme uma resposta',GitBranch],
              ['menu','CONVERSA','Menu de opções','Mostre escolhas clicáveis no WhatsApp',ListChecks],
              ['ai','INTELIGÊNCIA','Agente de IA','Conduza o pré-atendimento dentro do fluxo',BrainCircuit],
              ['wait','CONTROLE','Aguardar','Espere antes de continuar o fluxo',Timer],
              ['classify','CRM','Classificar lead','Atualize a classificação do contato',Tag],
              ['ticket','EQUIPE','Criar ticket','Abra uma solicitação para a equipe',Ticket],
              ['handoff','EQUIPE','Entregar para humano','Encerre o bot e passe para um atendente',Users],
              ['webhook','INTEGRAÇÃO','Chamar webhook','Envie os dados para outro sistema',Plug],
            ] as const).map(([type,kind,title,description,Icon]) => <button className={creatorType === type ? 'selected' : ''} onClick={() => chooseCreatorType(type)} key={type}><i><Icon/></i><span><small>{kind}</small><b>{title}</b><em>{description}</em></span><strong>›</strong></button>)}
          </aside>
          <div className="creator-config">
            {!creatorType ? <div className="creator-empty"><Workflow/><b>Escolha um bloco ao lado</b><p>As configurações aparecerão aqui antes de ele entrar no quadro.</p></div> : <>
              <div className="creator-selected"><span>{nodeIcon(creatorType)}</span><div><small>BLOCO SELECIONADO</small><b>{definitions[creatorType].label}</b></div></div>
              <label>Nome do bloco<input value={creatorLabel} onChange={event => setCreatorLabel(event.target.value)} /></label>
              {creatorType === 'message' && <label>Mensagem que será enviada<textarea rows={5} value={creatorValue} onChange={event => setCreatorValue(event.target.value)} placeholder="Digite a mensagem..."/></label>}
              {creatorType === 'condition' && <><div className="condition-sentence"><span>SE</span><select value={creatorOperator} onChange={event => setCreatorOperator(event.target.value as FlowAutomationNode['operator'])}><option value="contains">a mensagem contém</option><option value="equals">a mensagem é exatamente</option><option value="startsWith">a mensagem começa com</option><option value="exists">o contato respondeu</option></select>{creatorOperator !== 'exists' && <input value={creatorValue} onChange={event => setCreatorValue(event.target.value)} placeholder="Digite o valor esperado"/>}</div><div className="logic-preview"><i>SIM</i><span>Quando a condição for atendida</span><i>NÃO</i><span>Quando não for atendida</span></div></>}
              {creatorType === 'menu' && <div className="menu-editor"><label>Mensagem do menu<textarea rows={3} value={creatorValue} onChange={event => setCreatorValue(event.target.value)} placeholder="Como podemos ajudar?"/></label><div className="option-head"><b>OPÇÕES DE RESPOSTA</b><small>{creatorOptions.length}/10</small></div>{creatorOptions.map((option,index) => <div className="option-row" key={option.id}><span>{index+1}</span><input value={option.label} maxLength={24} onChange={event => setCreatorOptions(current => current.map(item => item.id === option.id ? {...item,label:event.target.value} : item))}/><small>{option.label.length}/24</small><button disabled={creatorOptions.length <= 1} onClick={() => setCreatorOptions(current => current.filter(item => item.id !== option.id))}><Trash2/></button></div>)}<button className="add-option" disabled={creatorOptions.length >= 10} onClick={() => setCreatorOptions(current => [...current,{id:`${Date.now()}`,label:`Opção ${current.length+1}`}])}><Plus/> Adicionar opção</button><p className="menu-note">Cada opção ganhará uma saída própria no quadro. Inclua “Falar com atendente” como último caminho.</p></div>}
              {creatorType === 'wait' && <label>Tempo de espera em segundos<input type="number" min="1" max="10" value={creatorValue} onChange={event => setCreatorValue(event.target.value)}/></label>}
              {creatorType === 'classify' && <label>Classificação<select value={creatorValue} onChange={event => setCreatorValue(event.target.value)}>{['Novo lead','Em qualificação','Qualificado','Proposta','Cliente','Perdido'].map(value => <option key={value}>{value}</option>)}</select></label>}
              {creatorType === 'ticket' && <label>Assunto do ticket<input value={creatorValue} onChange={event => setCreatorValue(event.target.value)}/></label>}
              {creatorType === 'handoff' && <label>Motivo da entrega<input value={creatorValue} onChange={event => setCreatorValue(event.target.value)}/><small>A automação será pausada e sua equipe continuará o atendimento.</small></label>}
              {creatorType === 'webhook' && <label>Endereço do webhook<input type="url" value={creatorValue} onChange={event => setCreatorValue(event.target.value)}/></label>}
              {creatorType === 'ai' && <div className="ai-block-config"><label>API utilizada<select value={creatorAi.credentialId??''} onChange={event=>{const credential=credentials.find(item=>item.id===event.target.value);setCreatorAi({...creatorAi,credentialId:event.target.value||undefined,provider:credential?.provider??creatorAi.provider,model:credential?.model??(credential?.provider==='openai'?'gpt-5.6':credential?.provider==='gemini'?'gemini-2.5-flash':creatorAi.model)})}}><option value="">Credencial padrão do ambiente</option>{credentials.map(item=><option value={item.id} key={item.id}>{item.name} · {item.provider==='gemini'?'Gemini':item.provider==='openai'?'OpenAI':'Personalizada'}</option>)}</select></label><label>Provedor<select disabled={Boolean(creatorAi.credentialId)} value={creatorAi.provider} onChange={event=>{const provider=event.target.value as AIProvider;setCreatorAi({...creatorAi,provider,model:provider==='gemini'?'gemini-2.5-flash':'gpt-5.6'})}}><option value="gemini">Gemini · gratuito para testes</option><option value="openai">OpenAI · exige saldo na API</option><option value="custom">API personalizada</option></select></label>{creatorAi.provider==='custom'&&<label>Modelo<input value={creatorAi.model} onChange={event=>setCreatorAi({...creatorAi,model:event.target.value})}/></label>}<label>Objetivo do agente<textarea rows={3} value={creatorAi.objective} onChange={event => setCreatorAi({...creatorAi,objective:event.target.value})}/></label><label>Como ele deve conversar<textarea rows={4} value={creatorAi.instructions} onChange={event => setCreatorAi({...creatorAi,instructions:event.target.value})}/></label><label>Limite de interações<input type="number" min="1" max="100" value={creatorAi.maxTurns} onChange={event => setCreatorAi({...creatorAi,maxTurns:Number(event.target.value)})}/><small>40 é o padrão recomendado. As perguntas obrigatórias continuam protegidas até serem respondidas ou recusadas.</small></label><div className="ai-exits"><span><i/> Continuar conversando</span><span><i/> Objetivo concluído</span><span><i/> Entregar ao humano</span></div></div>}
            </>}
          </div>
        </div>
        <footer><button onClick={() => setCreatorOpen(false)}>Cancelar</button><button disabled={!creatorType} className="primary" onClick={createNode}><Plus/> Adicionar ao quadro</button></footer>
      </section>
    </div>}
  </div>
}

type WhatsAppMessage = {
  id: string
  remoteJid: string
  fromMe: boolean
  pushName: string | null
  text: string
  hasMedia?: boolean
  mediaKind?: 'audio' | 'image' | 'video' | 'document' | 'sticker' | null
  timestamp: number
  status: string | null
}

function RealInbox({ notify }: { notify: (message: string) => void }) {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([])
  const [inboxContacts,setInboxContacts]=useState<RealContact[]>([])
  const [selected, setSelected] = useState('')
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pendingJid, setPendingJid] = useState('')
  const [threadContext, setThreadContext] = useState<{ x: number; y: number; number: string; name: string } | null>(null)
  const [botPaused, setBotPaused] = useState(false)
  const [botReason,setBotReason]=useState('')
  const [dragActive,setDragActive]=useState(false)
  const [recording, setRecording] = useState(false)
  const [recordingSeconds,setRecordingSeconds]=useState(0)
  const [audioDraft,setAudioDraft]=useState<{blob:Blob;url:string;fileName:string}|null>(null)
  const [mediaDraft,setMediaDraft]=useState<{file:File;url:string;kind:'image'|'video'|'audio'|'document'}[]>([])
  const [mediaCaption,setMediaCaption]=useState('')
  const [mediaProgress,setMediaProgress]=useState('')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recorderStreamRef=useRef<MediaStream|null>(null)
  const recorderChunksRef=useRef<BlobPart[]>([])
  const discardRecordingRef=useRef(false)
  const recordingTimerRef=useRef<number|null>(null)
  const dragDepthRef=useRef(0)
  const [stickerPicker,setStickerPicker]=useState<{id:string;dataUrl:string}[] | null>(null)
  const [loadingStickers,setLoadingStickers]=useState(false)

  async function loadMessages(silent = false) {
    try {
      const [response,contactsResponse] = await Promise.all([fetch('/api/whatsapp/messages', { cache: 'no-store' }),fetch('/api/whatsapp/contacts',{cache:'no-store'})])
      const [data,contactsData] = await Promise.all([response.json(),contactsResponse.json()])
      if (!response.ok) throw new Error(data.message)
      setMessages(data.messages)
      if(contactsResponse.ok)setInboxContacts(contactsData.contacts??[])
      if (!selected && data.messages.length) setSelected(data.messages.at(-1).remoteJid)
    } catch (error) {
      if (!silent) notify(error instanceof Error ? error.message : 'Falha ao carregar o WhatsApp')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const target = localStorage.getItem('nexo.openConversation')
    if (target) {
      setPendingJid(target)
      setSelected(target)
      localStorage.removeItem('nexo.openConversation')
    }
    loadMessages()
    const timer = window.setInterval(() => loadMessages(true), 3500)
    return () => window.clearInterval(timer)
  }, [selected])

  useEffect(() => {
    const close = () => setThreadContext(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [])

  useEffect(()=>()=> {
    if(recordingTimerRef.current)window.clearInterval(recordingTimerRef.current)
    recorderStreamRef.current?.getTracks().forEach(track=>track.stop())
  },[])
  useEffect(()=>()=>{if(audioDraft?.url)URL.revokeObjectURL(audioDraft.url)},[audioDraft?.url])

  async function classifyThread(classification: LeadClassification) {
    if (!threadContext) return
    try {
      const response = await fetch('/api/whatsapp/contacts', {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ number: threadContext.number, name: threadContext.name, classification }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message)
      notify(`${threadContext.name} classificado como ${classification}`)
    } catch (error) { notify(error instanceof Error ? error.message : 'Falha ao classificar contato') }
    finally { setThreadContext(null) }
  }

  const chats = useMemo(() => {
    const grouped = new Map<string, WhatsAppMessage[]>()
    messages.filter(message => message.remoteJid && !message.remoteJid.endsWith('@broadcast') && !message.remoteJid.endsWith('@g.us') && !message.remoteJid.includes('status@broadcast')).forEach(message => {
      grouped.set(message.remoteJid, [...(grouped.get(message.remoteJid) ?? []), message])
    })
    inboxContacts.forEach(contact=>{if(contact.remoteJid&&!contact.remoteJid.endsWith('@g.us')&&!grouped.has(contact.remoteJid))grouped.set(contact.remoteJid,[])})
    if (pendingJid && !grouped.has(pendingJid)) grouped.set(pendingJid, [])
    return [...grouped.entries()].map(([remoteJid, records]) => {
      const number = remoteJid.split('@')[0]
      const savedContact=inboxContacts.find(contact=>contact.number===number||contact.remoteJid===remoteJid)
      if (!records.length) return { remoteJid, number, name: savedContact?.name ?? `+${number}`, last: { id: 'new', remoteJid, fromMe: true, pushName: null, text: 'Contato salvo · sem mensagens novas', timestamp: 0, status: null } as WhatsAppMessage }
      const last = records.at(-1)!
      const incomingName = [...records].reverse().find(record => !record.fromMe && record.pushName)?.pushName
      return { remoteJid, number, name: savedContact?.name ?? incomingName ?? (number === '556699566791' ? 'Você · teste' : `+${number}`), last }
    }).filter(chat => `${chat.name} ${chat.number}`.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => b.last.timestamp - a.last.timestamp)
  }, [messages, query, pendingJid, inboxContacts])

  const current = chats.find(chat => chat.remoteJid === selected) ?? chats[0]
  const currentMessages = current ? messages.filter(message => message.remoteJid === current.remoteJid) : []

  useEffect(() => {
    if (!current) return
    fetch(`/api/whatsapp/bot-state?number=${current.number}`, { cache: 'no-store' }).then(response => response.json()).then(data => {setBotPaused(Boolean(data.paused));setBotReason(String(data.reason??''))}).catch(() => {})
  }, [current?.number])

  async function toggleBot() {
    if (!current) return
    const response = await fetch('/api/whatsapp/bot-state', { method: 'PATCH', headers: { 'content-type':'application/json' }, body: JSON.stringify({ number: current.number, paused: !botPaused }) })
    const data = await response.json()
    if (!response.ok) return notify(data.message ?? 'Falha ao alterar automação')
    setBotPaused(Boolean(data.paused))
    setBotReason(String(data.reason??''))
    notify(data.paused ? 'Atendimento humano ativado: o bot não responderá mais' : 'Automação reativada para este contato')
  }

  async function send() {
    if (!draft.trim() || !current || sending) return
    const text = draft.trim()
    setSending(true)
    try {
      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ number: current.number, text }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message)
      setDraft('')
      notify('Mensagem enviada pelo WhatsApp')
      window.setTimeout(() => loadMessages(true), 700)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Não foi possível enviar')
    } finally {
      setSending(false)
    }
  }

  function newConversation() {
    const number = window.prompt('Digite o número com DDD. Exemplo: 5566999999999')
    const normalized = number?.replace(/\D/g, '')
    if (!normalized || normalized.length < 10) return
    setSelected(`${normalized}@s.whatsapp.net`)
    setMessages(currentMessages => [...currentMessages, {
      id: `draft-${Date.now()}`, remoteJid: `${normalized}@s.whatsapp.net`, fromMe: true,
      pushName: null, text: 'Nova conversa — escreva a primeira mensagem abaixo.', timestamp: Date.now() / 1000, status: null,
    }])
  }

  function addMediaFiles(files:File[]){
    const accepted=files.filter(file=>file.type.startsWith('image/')||file.type.startsWith('video/')||file.type.startsWith('audio/')||/\.(pdf|docx?|xlsx?|csv|txt)$/i.test(file.name))
    if(!accepted.length)return notify('Solte imagens, vídeos, áudios ou documentos compatíveis')
    if(accepted.length<files.length)notify('Alguns arquivos não são compatíveis e foram ignorados')
    setMediaDraft(currentDraft=>[
      ...currentDraft,
      ...accepted.map(file=>({
          file,
          url:URL.createObjectURL(file),
          kind:file.type.startsWith('image/')?'image' as const:file.type.startsWith('video/')?'video' as const:file.type.startsWith('audio/')?'audio' as const:'document' as const,
      })),
    ])
  }
  function selectMedia() {
    if (!current || sending) return
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = 'image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt'
    input.onchange = () => addMediaFiles([...(input.files ?? [])])
    input.click()
  }
  function handleFileDragEnter(event:React.DragEvent<HTMLElement>){
    if(!current||sending||!event.dataTransfer.types.includes('Files'))return
    event.preventDefault();dragDepthRef.current+=1;setDragActive(true)
  }
  function handleFileDragOver(event:React.DragEvent<HTMLElement>){
    if(!current||sending||!event.dataTransfer.types.includes('Files'))return
    event.preventDefault();event.dataTransfer.dropEffect='copy'
  }
  function handleFileDragLeave(event:React.DragEvent<HTMLElement>){
    if(!event.dataTransfer.types.includes('Files'))return
    event.preventDefault();dragDepthRef.current=Math.max(0,dragDepthRef.current-1)
    if(dragDepthRef.current===0)setDragActive(false)
  }
  function handleFileDrop(event:React.DragEvent<HTMLElement>){
    if(!current||sending)return
    event.preventDefault();dragDepthRef.current=0;setDragActive(false)
    addMediaFiles([...event.dataTransfer.files])
  }
  function removeMediaDraft(index:number){
    setMediaDraft(currentDraft=>{
      const item=currentDraft[index]
      if(item)URL.revokeObjectURL(item.url)
      return currentDraft.filter((_,itemIndex)=>itemIndex!==index)
    })
  }
  function cancelMediaDraft(){
    mediaDraft.forEach(item=>URL.revokeObjectURL(item.url))
    setMediaDraft([]);setMediaCaption('');setMediaProgress('')
  }
  async function sendMediaDraft(){
    if(!current||!mediaDraft.length||sending)return
    setSending(true)
    try{
      for(let index=0;index<mediaDraft.length;index++){
        const item=mediaDraft[index]
        setMediaProgress(`Enviando ${index+1} de ${mediaDraft.length}`)
        const form=new FormData()
        form.append('file',item.file);form.append('number',current.number);form.append('caption',index===0?mediaCaption.trim():'')
        const response=await fetch('/api/whatsapp/media',{method:'POST',body:form})
        const data=await response.json()
        if(!response.ok)throw new Error(data.message)
      }
      notify(mediaDraft.length>1?`${mediaDraft.length} arquivos enviados`:'Arquivo enviado pelo WhatsApp')
      cancelMediaDraft()
      window.setTimeout(()=>loadMessages(true),900)
    }catch(error){notify(error instanceof Error?error.message:'Falha ao enviar arquivo');setMediaProgress('')}
    finally{setSending(false)}
  }

  async function selectSticker() {
    if(!current||sending)return
    setStickerPicker([]);setLoadingStickers(true)
    try{const response=await fetch('/api/whatsapp/stickers',{cache:'no-store'});const data=await response.json();if(!response.ok)throw new Error(data.message);setStickerPicker(data.stickers??[])}
    catch(error){notify(error instanceof Error?error.message:'Falha ao carregar figurinhas')}finally{setLoadingStickers(false)}
  }
  function uploadSticker() {
    if (!current || sending) return
    const input = document.createElement('input')
    input.type = 'file'; input.accept = 'image/webp,image/png,image/jpeg'
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return
      setSending(true)
      try {
        const form = new FormData(); form.append('file',file); form.append('number',current.number); form.append('kind','sticker')
        const response = await fetch('/api/whatsapp/media',{method:'POST',body:form}); const data=await response.json()
        if(!response.ok) throw new Error(data.message)
        notify('Figurinha enviada'); window.setTimeout(()=>loadMessages(true),800)
      } catch(error){notify(error instanceof Error?error.message:'Falha ao enviar figurinha')} finally{setSending(false)}
    }
    input.click()
  }
  async function sendSavedSticker(id:string){
    if(!current||sending)return
    setSending(true)
    try{const response=await fetch('/api/whatsapp/stickers',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id,number:current.number})});const data=await response.json();if(!response.ok)throw new Error(data.message);setStickerPicker(null);notify('Figurinha enviada');window.setTimeout(()=>loadMessages(true),700)}
    catch(error){notify(error instanceof Error?error.message:'Falha ao enviar figurinha')}finally{setSending(false)}
  }

  async function startRecording() {
    if (!current || sending || recording || !navigator.mediaDevices || typeof MediaRecorder==='undefined') return notify('Microfone indisponível neste navegador')
    try {
      if(audioDraft){URL.revokeObjectURL(audioDraft.url);setAudioDraft(null)}
      const stream = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}})
      const preferred=['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/webm']
      const mimeType=preferred.find(type=>MediaRecorder.isTypeSupported(type))
      const recorder = mimeType?new MediaRecorder(stream,{mimeType}):new MediaRecorder(stream)
      recorderRef.current = recorder
      recorderStreamRef.current=stream
      recorderChunksRef.current=[]
      discardRecordingRef.current=false
      recorder.ondataavailable = event => { if(event.data.size)recorderChunksRef.current.push(event.data) }
      recorder.onstop = () => {
        stream.getTracks().forEach(track=>track.stop())
        recorderStreamRef.current=null
        if(recordingTimerRef.current)window.clearInterval(recordingTimerRef.current)
        recordingTimerRef.current=null
        setRecording(false)
        if(discardRecordingRef.current){recorderChunksRef.current=[];setRecordingSeconds(0);return}
        const blob=new Blob(recorderChunksRef.current,{type:recorder.mimeType||'audio/webm'})
        recorderChunksRef.current=[]
        if(!blob.size){notify('Não foi possível capturar o áudio');setRecordingSeconds(0);return}
        const extension=blob.type.includes('ogg')?'ogg':'webm'
        setAudioDraft({blob,url:URL.createObjectURL(blob),fileName:`audio-${Date.now()}.${extension}`})
      }
      recorder.start(200)
      setRecordingSeconds(0);setRecording(true)
      recordingTimerRef.current=window.setInterval(()=>setRecordingSeconds(value=>value+1),1000)
    } catch { notify('Permita o acesso ao microfone para gravar áudio') }
  }
  function stopRecording(){if(recording&&recorderRef.current?.state!=='inactive')recorderRef.current?.stop()}
  function cancelRecording(){
    discardRecordingRef.current=true
    if(recorderRef.current&&recorderRef.current.state!=='inactive')recorderRef.current.stop()
    else{recorderStreamRef.current?.getTracks().forEach(track=>track.stop());setRecording(false);setRecordingSeconds(0)}
  }
  function cancelAudioDraft(){if(audioDraft?.url)URL.revokeObjectURL(audioDraft.url);setAudioDraft(null);setRecordingSeconds(0)}
  async function sendRecordedAudio(){
    if(!audioDraft||!current||sending)return
    setSending(true)
    try{
      const form=new FormData()
      form.append('file',new File([audioDraft.blob],audioDraft.fileName,{type:audioDraft.blob.type||'audio/webm'}))
      form.append('number',current.number);form.append('kind','voice')
      const response=await fetch('/api/whatsapp/media',{method:'POST',body:form})
      const data=await response.json()
      if(!response.ok)throw new Error(data.message)
      cancelAudioDraft();notify('Áudio enviado como mensagem de voz');window.setTimeout(()=>loadMessages(true),900)
    }catch(error){notify(error instanceof Error?error.message:'Falha ao enviar áudio')}
    finally{setSending(false)}
  }
  const recordingClock=`${String(Math.floor(recordingSeconds/60)).padStart(2,'0')}:${String(recordingSeconds%60).padStart(2,'0')}`

  return <div className="module"><ModuleHeader onAction={newConversation} title="Conversas" subtitle="WHATSAPP CONECTADO" action="Nova conversa"/>
    <div className="inbox">
      <aside className="thread-list"><div className="search"><Search size={16}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar conversas..."/></div>
        {loading && <p className="empty-chat">Carregando mensagens...</p>}
        {!loading && chats.length === 0 && <p className="empty-chat">Nenhuma mensagem nova. Envie uma mensagem para o número conectado.</p>}
        {chats.map(chat => <button onContextMenu={event => { event.preventDefault(); setThreadContext({ x:event.clientX, y:event.clientY, number:chat.number, name:chat.name }) }} onClick={() => setSelected(chat.remoteJid)} className={chat.remoteJid === current?.remoteJid ? 'selected' : ''} key={chat.remoteJid}>
          <span className="avatar">{chat.name.slice(0,2).toUpperCase()}</span><div><b>{chat.name}</b><p>{chat.last.text}</p></div><small>{new Date(chat.last.timestamp * 1000).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</small>
        </button>)}
      </aside>
      <section className={`chat ${dragActive?'drop-active':''}`} onDragEnter={handleFileDragEnter} onDragOver={handleFileDragOver} onDragLeave={handleFileDragLeave} onDrop={handleFileDrop}>
        {dragActive&&<div className="chat-drop-zone"><UploadCloud/><b>Solte para anexar</b><span>As imagens serão abertas para você conferir antes do envio</span></div>}
        {current ? <><header><span className="avatar">{current.name.slice(0,2).toUpperCase()}</span><div><b>{current.name}</b><small><i/> WhatsApp real · +{current.number}</small></div><button title="Ligar para o contato" onClick={()=>window.location.href=`tel:+${current.number}`}><Phone size={17}/></button><button title="Copiar número" onClick={()=>navigator.clipboard.writeText(`+${current.number}`).then(()=>notify('Número copiado'))}><MoreHorizontal size={17}/></button></header>
          <div className="messages"><span className="date">MENSAGENS REAIS</span>{groupMessages(currentMessages).map(group => <div key={group[0].id} className={`bubble ${group[0].fromMe ? 'outgoing' : 'incoming'} ${group.length>1?'media-album':''}`}>{group.length>1 ? <div className="album-grid">{group.map(message=><MediaMessage message={message} key={message.id}/>)}</div> : group[0].hasMedia ? <MediaMessage message={group[0]}/> : <LinkifiedText text={group[0].text}/>}<small>{new Date(group.at(-1)!.timestamp * 1000).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}{group[0].fromMe ? ` · ${group.at(-1)!.status === 'READ' ? '✓✓' : '✓'}` : ''}</small></div>)}</div>
          {mediaDraft.length>0&&<div className="attachment-draft"><header><div><b>{mediaDraft.length===1?'Preparar anexo':`Preparar ${mediaDraft.length} anexos`}</b><small>Confira antes de enviar pelo WhatsApp</small></div><button disabled={sending} onClick={cancelMediaDraft}><X/></button></header><div className="attachment-strip">{mediaDraft.map((item,index)=><article key={`${item.file.name}-${index}`}>{item.kind==='image'?<img src={item.url} alt={item.file.name}/>:item.kind==='video'?<video src={item.url}/>:item.kind==='audio'?<audio controls src={item.url}/>:<span><FileText/><b>{item.file.name}</b></span>}<button disabled={sending} onClick={()=>removeMediaDraft(index)} title="Remover"><X/></button><small>{item.file.name}</small></article>)}</div><footer><input disabled={sending} value={mediaCaption} onChange={event=>setMediaCaption(event.target.value)} placeholder="Adicionar legenda à primeira mídia…"/><span>{mediaProgress}</span><button disabled={sending||!mediaDraft.length} onClick={sendMediaDraft}><Send/> Enviar</button></footer></div>}
          {recording?<footer className="voice-composer recording-active"><button className="voice-cancel" onClick={cancelRecording} title="Cancelar gravação"><Trash2/></button><div className="live-recording"><i/><b>{recordingClock}</b><div className="voice-wave">{Array.from({length:26},(_,index)=><span style={{animationDelay:`${(index%7)*.08}s`}} key={index}/>)}</div><small>Gravando</small></div><button className="voice-stop" onClick={stopRecording} title="Parar e revisar"><Square/></button></footer>:audioDraft?<footer className="voice-composer voice-preview"><button className="voice-cancel" disabled={sending} onClick={cancelAudioDraft} title="Descartar áudio"><Trash2/></button><div><span><Mic/></span><audio controls preload="metadata" src={audioDraft.url}/></div><small>Ouça antes de enviar</small><button className="voice-send" disabled={sending} onClick={sendRecordedAudio} title="Enviar áudio"><Send/></button></footer>:<footer className="message-composer"><button disabled={sending||mediaDraft.length>0} onClick={selectMedia} title="Enviar imagem, vídeo ou documento"><Paperclip size={18}/></button><button disabled={sending||mediaDraft.length>0} onClick={selectSticker} title="Enviar figurinha"><Smile size={18}/></button><input value={draft} disabled={sending||mediaDraft.length>0} onChange={event=>setDraft(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey)send()}} placeholder={sending?'Enviando…':'Digite uma mensagem'}/>{draft.trim()?<button disabled={sending||mediaDraft.length>0} onClick={send} className="send" title="Enviar mensagem"><Send size={17}/></button>:<button className="microphone" disabled={sending||mediaDraft.length>0} onClick={startRecording} title="Gravar mensagem de voz"><Mic size={18}/></button>}</footer>}</> :
          <div className="no-conversation"><MessageCircle size={46}/><b>Aguardando a primeira conversa</b><p>Envie uma mensagem nova para o WhatsApp conectado ou inicie uma conversa.</p></div>}
      </section>
      <aside className="contact-panel">{current && <><span className="big-avatar">{current.name.slice(0,2).toUpperCase()}</span><h3>{current.name}</h3><p>+{current.number}</p><hr/><small>CANAL</small><b>WhatsApp · Evolution</b><small>ATENDIMENTO</small><b className={botPaused ? 'human-state' : 'bot-state'}>{botPaused ? botReason||'Humano assumiu · bot pausado' : 'Automação ativa'}</b><button className="bot-toggle" onClick={toggleBot}>{botPaused ? 'Reativar automação' : 'Assumir atendimento'}</button><hr/><button onClick={() => navigator.clipboard.writeText(current.number)}>Copiar número</button></>}</aside>
    </div>
    {threadContext && <div className="lead-context-menu" style={{ left: threadContext.x, top: threadContext.y }} onClick={event => event.stopPropagation()}><small>QUALIFICAR CONTATO</small>{(['Novo lead','Em qualificação','Qualificado','Proposta','Cliente','Perdido'] as LeadClassification[]).map(classification => <button onClick={() => classifyThread(classification)} key={classification}>{classification}</button>)}</div>}
    {stickerPicker && <div className="sticker-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setStickerPicker(null)}}><section className="sticker-picker"><header><div><b>Suas figurinhas recentes</b><small>Recebidas ou enviadas nesta conexão</small></div><button onClick={()=>setStickerPicker(null)}>×</button></header><div>{loadingStickers?<p>Carregando...</p>:stickerPicker.length?stickerPicker.map(sticker=><button onClick={()=>sendSavedSticker(sticker.id)} key={sticker.id}><img src={sticker.dataUrl} alt="Figurinha"/></button>):<p>Nenhuma figurinha encontrada no histórico atual.</p>}</div><footer><button onClick={uploadSticker}><Plus/> Enviar nova imagem como figurinha</button></footer></section></div>}
  </div>
}

function groupMessages(messages:WhatsAppMessage[]) {
  const groups:WhatsAppMessage[][]=[]
  for(const message of messages){
    const last=groups.at(-1)
    const albumMedia=['image','video'].includes(message.mediaKind ?? '')
    const joins=albumMedia && last && ['image','video'].includes(last.at(-1)?.mediaKind ?? '') && last[0].fromMe===message.fromMe && message.timestamp-last.at(-1)!.timestamp<=120
    if(joins)last.push(message);else groups.push([message])
  }
  return groups
}
function LinkifiedText({text}:{text:string}) {
  const parts=text.split(/(https?:\/\/[^\s]+)/gi)
  return <>{parts.map((part,index)=>/^https?:\/\//i.test(part)?<a className="chat-link" href={part} target="_blank" rel="noreferrer" key={index}>{part}</a>:part)}</>
}
function MediaMessage({ message }: { message: WhatsAppMessage }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  async function load() {
    if (url || loading) return
    setLoading(true)
    try {
      const response = await fetch(`/api/whatsapp/download?id=${encodeURIComponent(message.id)}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.message)
      setUrl(data.dataUrl)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Mídia indisponível') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [message.id])
  if (!url) return <button className="media-loader" onClick={load}>{loading ? 'Baixando...' : error || (message.mediaKind === 'audio' ? '▶ Ouvir áudio' : message.mediaKind === 'image' ? '🖼 Abrir imagem' : message.mediaKind === 'video' ? '▶ Abrir vídeo' : '📎 Baixar documento')}</button>
  if (message.mediaKind === 'audio') return <VoiceMessagePlayer url={url}/>
  if (message.mediaKind === 'image') return <><img className="chat-media" src={url} alt="Imagem recebida"/>{message.text&&!message.text.includes('Imagem')&&<p className="media-caption"><LinkifiedText text={message.text}/></p>}</>
  if (message.mediaKind === 'sticker') return <img className="chat-sticker" src={url} alt="Figurinha"/>
  if (message.mediaKind === 'video') return <video className="chat-media" controls src={url}/>
  return <a className="media-download" download href={url}>Baixar documento</a>
}

function VoiceMessagePlayer({url}:{url:string}){
  const audioRef=useRef<HTMLAudioElement>(null)
  const [playing,setPlaying]=useState(false)
  const [duration,setDuration]=useState(0)
  const [position,setPosition]=useState(0)
  async function toggle(){
    const audio=audioRef.current
    if(!audio)return
    if(audio.paused){await audio.play();setPlaying(true)}else{audio.pause();setPlaying(false)}
  }
  const format=(value:number)=>`${Math.floor((Number.isFinite(value)?value:0)/60)}:${String(Math.floor((Number.isFinite(value)?value:0)%60)).padStart(2,'0')}`
  return <div className="voice-message"><audio ref={audioRef} preload="metadata" src={url} onLoadedMetadata={event=>setDuration(event.currentTarget.duration)} onTimeUpdate={event=>setPosition(event.currentTarget.currentTime)} onEnded={()=>setPlaying(false)}/><button onClick={toggle}>{playing?<Pause/>:<Play/>}</button><div><input aria-label="Posição do áudio" type="range" min="0" max={duration||0} step=".1" value={Math.min(position,duration||0)} onChange={event=>{const next=Number(event.target.value);if(audioRef.current)audioRef.current.currentTime=next;setPosition(next)}}/><span><small>{format(position)}</small><i>Mensagem de voz</i><small>{format(duration)}</small></span></div><Mic/></div>
}

type WhatsAppState = 'loading' | 'open' | 'connecting' | 'close' | 'offline' | 'error' | 'unconfigured'

function WhatsAppChannels({ notify }: { notify: (message: string) => void }) {
  const [state, setState] = useState<WhatsAppState>('loading')
  const [qrCode, setQrCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('Consultando a conexão...')
  const [syncQr, setSyncQr] = useState('')
  const [syncingContacts, setSyncingContacts] = useState(false)

  async function checkStatus(silent = false) {
    try {
      const response = await fetch('/api/evolution/status', { cache: 'no-store' })
      const data = await response.json()
      const nextState = (data.state ?? 'error') as WhatsAppState
      setState(nextState)
      if (nextState === 'open') {
        setQrCode('')
        setMessage('WhatsApp conectado e pronto para uso.')
        if (!silent) notify('WhatsApp conectado com sucesso')
      } else if (nextState === 'connecting') {
        setMessage(qrCode ? 'Leia o QR Code pelo celular.' : 'Aguardando um novo QR Code.')
      } else {
        setMessage(data.message ?? 'WhatsApp ainda não conectado.')
      }
    } catch {
      setState('offline')
      setMessage('O serviço local do WhatsApp está desligado.')
    }
  }

  async function generateQr() {
    setBusy(true)
    setQrCode('')
    try {
      const response = await fetch('/api/evolution/connect', { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message)
      if (data.state === 'open') {
        setState('open')
        setMessage('WhatsApp conectado e pronto para uso.')
      } else {
        setState('connecting')
        setQrCode(data.qrCode)
        setMessage('QR Code novo. Leia-o sem atualizar a página.')
      }
    } catch (error) {
      setState('error')
      setMessage(error instanceof Error ? error.message : 'Não foi possível gerar o QR Code.')
    } finally {
      setBusy(false)
    }
  }

  async function syncContacts() {
    setSyncingContacts(true)
    try {
      const response = await fetch('/api/evolution/contact-sync', { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message)
      if (data.state === 'open') notify('Sincronização de contatos já está conectada')
      else { setSyncQr(data.qrCode); notify('Leia o QR para importar sua agenda do WhatsApp') }
    } catch (error) { notify(error instanceof Error ? error.message : 'Falha ao iniciar sincronização') }
    finally { setSyncingContacts(false) }
  }

  useEffect(() => {
    checkStatus(true)
    const timer = window.setInterval(() => checkStatus(true), 4000)
    return () => window.clearInterval(timer)
  }, [])

  const connected = state === 'open'
  return <div className="module">
    <header><div><span className="eyebrow">INTEGRAÇÕES E CANAIS</span><h1>Canais</h1></div></header>
    <section className="channel-layout">
      <article className="channel-card">
        <div className="channel-head">
          <div className="whatsapp-mark"><MessageCircle size={22}/></div>
          <div><h2>WhatsApp via QR Code</h2><p>Evolution API · sessão persistente do CRM</p></div>
          <span className={`connection-state ${connected ? 'connected' : 'disconnected'}`}><i/>{connected ? 'Conectado' : 'Desconectado'}</span>
        </div>
        <div className="channel-body">
          <div className="qr-area">
            {qrCode ? <img src={qrCode} alt="QR Code para conectar o WhatsApp"/> :
              connected ? <div className="connection-success"><CheckCircle2 size={54}/><b>Conexão ativa</b><span>O canal já pode receber e enviar mensagens.</span></div> :
              <div className="qr-placeholder"><Phone size={48}/><b>WhatsApp ainda não conectado</b><span>Gere um código para iniciar.</span></div>}
          </div>
          <div className="connect-guide">
            <span className="eyebrow">CONEXÃO SEGURA</span><h3>{connected ? 'Canal pronto' : 'Conecte pelo celular'}</h3>
            <p>{message}</p>
            {!connected && <ol><li>Abra o WhatsApp no celular.</li><li>Acesse <b>Dispositivos conectados</b>.</li><li>Toque em <b>Conectar dispositivo</b>.</li><li>Leia o código exibido ao lado.</li></ol>}
            <button disabled={busy || connected} onClick={generateQr} className="primary connect-button">
              {busy ? 'Gerando...' : connected ? 'WhatsApp conectado' : qrCode ? 'Gerar outro código' : 'Gerar QR Code'}
            </button>
            {qrCode && <small>Não atualize a página durante a leitura. Se expirar, clique em “Gerar outro código”.</small>}
          </div>
        </div>
      </article>
      <aside className="channel-info"><h3>Recursos ativos deste canal</h3><p><CheckCircle2/> Envio e recebimento de mensagens</p><p><CheckCircle2/> Imagens, áudios e documentos</p><p><CheckCircle2/> Sincronização de contatos disponíveis</p><p><CheckCircle2/> Automações e agente de IA</p><hr/><button className="sync-contacts-button" disabled={syncingContacts} onClick={syncContacts}>{syncingContacts ? 'Preparando...' : 'Sincronizar contatos salvos'}</button><small>Importa os contatos que o WhatsApp disponibilizar para a sessão conectada.</small></aside>
    </section>
    {syncQr && <div className="sync-modal"><div><button className="sync-close" onClick={() => setSyncQr('')}>×</button><span className="eyebrow">SINCRONIZAÇÃO DA AGENDA</span><h2>Leia este QR uma única vez</h2><p>Esta sessão serve para o WhatsApp entregar os contatos já salvos. Mensagens antigas continuam fora da Inbox.</p><img src={syncQr} alt="QR Code para sincronizar contatos"/><small>Depois de conectar, os contatos aparecerão automaticamente em Contatos.</small></div></div>}
  </div>
}

function ModuleHeader({title,subtitle,action,onAction}:{title:string;subtitle:string;action:string;onAction:()=>void}) {
  return <header><div><span className="eyebrow">{subtitle}</span><h1>{title}</h1></div><div className="header-actions"><button onClick={onAction} className="primary"><Plus size={17}/>{action}</button></div></header>
}
function Stat({label,value}:{label:string;value:string}) { return <div><small>{label}</small><strong>{value}</strong></div> }
function FlowNode({icon,kind,title,detail}:{icon:React.ReactNode;kind:string;title:string;detail:string}) { return <div className="flow-node"><span>{icon}</span><small>{kind}</small><b>{title}</b><p>{detail}</p></div> }
function ResourceTable({rows}:{rows:string[][]}) { return <div className="resource-table">{rows.map((row,i)=><div key={i}>{row.map((cell,j)=>j===0?<b key={j}>{cell}</b>:<span key={j}>{cell}</span>)}</div>)}</div> }

function ActionModal({kind,stages,initialStage,onClose,onDeal,onDone}:{kind:string;stages:Stage[];initialStage?:string;onClose:()=>void;onDeal:(data:Record<string,string>)=>void;onDone:(m:string)=>void}) {
  const [form,setForm]=useState<Record<string,string>>({stage:initialStage??stages[0].id})
  const field=(name:string,label:string,type='text')=><label>{label}<input required type={type} value={form[name]??''} onChange={e=>setForm({...form,[name]:e.target.value})}/></label>
  function submit(e:React.FormEvent){e.preventDefault();if(kind==='Negócios')return onDeal(form);onDone(`${kind.replace(/s$/,'')} salvo com sucesso`)}
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><form className="modal" onSubmit={submit}><header><div><small>NOVO REGISTRO</small><h2>{kind}</h2></div><button type="button" onClick={onClose}>×</button></header>
    {kind==='Negócios'&&<>{field('name','Nome do contato')}{field('company','Empresa')}{field('value','Valor','number')}<label>Etapa<select value={form.stage??stages[0].id} onChange={e=>setForm({...form,stage:e.target.value})}>{stages.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label>{field('tag','Tag')}</>}
    {kind==='Contatos'&&<>{field('name','Nome completo')}{field('company','Empresa')}{field('email','E-mail','email')}{field('phone','WhatsApp')}</>}
    {kind==='Conversas'&&<>{field('phone','Telefone/WhatsApp')}{field('message','Mensagem inicial')}</>}
    {kind==='Automações'&&<>{field('name','Nome da automação')}<label>Gatilho<select><option>Nova mensagem</option><option>Tag adicionada</option><option>Webhook</option></select></label></>}
    {kind==='Agentes de IA'&&<>{field('name','Nome do agente')}<label>Modelo<select><option>GPT-4.1 mini</option><option>Gemini 2.5 Flash</option><option>Claude Sonnet</option></select></label>{field('instructions','Objetivo do agente')}</>}
    {kind==='Equipe'&&<>{field('name','Nome completo')}{field('email','E-mail','email')}<label>Função<select><option>Atendente</option><option>Supervisor</option><option>Administrador</option></select></label></>}
    {!['Negócios','Contatos','Conversas','Automações','Agentes de IA','Equipe'].includes(kind)&&<p className="modal-note">As preferências deste módulo serão vinculadas à sua conta quando a API estiver conectada.</p>}
    <footer><button type="button" onClick={onClose}>Cancelar</button><button className="primary" type="submit">Salvar</button></footer>
  </form></div>
}
