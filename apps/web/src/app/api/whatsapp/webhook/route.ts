import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { getCredentialSecret } from '../../../../lib/ai-credentials'
import { repairTextEncoding } from '../../../../lib/text-encoding'

const baseUrl = process.env.EVOLUTION_API_URL ?? 'http://127.0.0.1:8080'
const apiKey = process.env.EVOLUTION_API_KEY
const instanceName = process.env.EVOLUTION_INSTANCE_NAME ?? 'nexo-teste'
const secret = process.env.EVOLUTION_WEBHOOK_SECRET
const configPath = path.join(process.cwd(), '.runtime', 'whatsapp-automation.json')
const contactsPath = path.join(process.cwd(), '.runtime', 'contacts.json')
const ticketsPath = path.join(process.cwd(), '.runtime', 'tickets.json')
const leadsPath = path.join(process.cwd(), '.runtime', 'leads.json')
const statePath = path.join(process.cwd(), '.runtime', 'automation-state.json')
const aiProfilePath = path.join(process.cwd(), '.runtime', 'ai-profile.json')
const aiUsagePath = path.join(process.cwd(), '.runtime', 'ai-usage.json')
const processed = new Set<string>()

function messageText(message: Record<string, any> = {}) {
  return message.conversation ?? message.extendedTextMessage?.text ?? message.imageMessage?.caption ??
    message.buttonsResponseMessage?.selectedButtonId ?? message.listResponseMessage?.singleSelectReply?.selectedRowId ?? ''
}
async function resolveOpenAIKey(){
  return process.env.OPENAI_API_KEY ?? ''
}
async function resolveGeminiKey(){
  return process.env.GEMINI_API_KEY ?? ''
}

const qualificationSchema = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    status: { type: 'string', enum: ['continue','qualified','handoff'] },
    summary: { type: 'string' },
    qualification: {
      type: 'array',
      items: {
        type: 'object',
        properties: { field: { type: 'string' }, value: { type: 'string' } },
        required: ['field','value'],
        additionalProperties: false,
      },
    },
  },
  required: ['reply','status','summary','qualification'],
  additionalProperties: false,
}

function buildAgentInstructions(profile:any, config:any, qualificationData:Record<string,string> = {}, isFirstTurn = false){
  const questions = Array.isArray(profile.qualificationQuestions) && profile.qualificationQuestions.length
    ? profile.qualificationQuestions
    : (profile.qualificationFields ?? []).map((field:string)=>({field,question:`Informe ${field.toLowerCase()}`,required:true}))
  return `Você é ${profile.agentName || 'o assistente ASAX'}, atuando como ${profile.role || 'pré-atendente comercial'} no WhatsApp.
EMPRESA E MARCA:
${profile.companyContext || 'Use apenas as informações fornecidas nesta conversa.'}
PLANOS E PRODUTOS:
${Array.isArray(profile.offers)&&profile.offers.length?profile.offers.map((offer:any)=>`- ${offer.name}: preço ${offer.price||'sob consulta'}; cobrança ${offer.billing||'não informada'}; inclui: ${offer.description||'não informado'}; condições: ${offer.conditions||'nenhuma condição adicional'}`).join('\n'):'Não há planos cadastrados. Não invente produtos ou valores.'}
REGRAS COMERCIAIS:
${profile.salesRules || 'Não prometa condições não cadastradas.'}
ROTEIRO DE QUALIFICAÇÃO, NA ORDEM:
${questions.length?questions.map((item:any,index:number)=>`${index+1}. Campo "${item.field}" (${item.required===false?'opcional':'obrigatório'}). Intenção da pergunta: "${item.question}"`).join('\n'):'1. Campo "Nome" (obrigatório). Intenção da pergunta: "Qual é o seu nome?"'}
DADOS JÁ IDENTIFICADOS E SALVOS:
${Object.keys(qualificationData).length?Object.entries(qualificationData).map(([field,value])=>`- ${field}: ${value}`).join('\n'):'Nenhum dado coletado ainda.'}
ASSUNTOS E AÇÕES PROIBIDAS:
${profile.forbiddenTopics || 'Não inventar informações.'}
ENTREGAR PARA HUMANO:
${profile.handoffRules || 'Quando solicitado ou quando não souber responder.'}
TOM DE VOZ: ${profile.tone || 'Cordial e objetivo'}.
OBJETIVO DESTE BLOCO: ${config.objective}. INSTRUÇÕES DESTE BLOCO: ${config.instructions}
REGRAS DO ROTEIRO:
- Primeiro analise a mensagem atual e identifique se ela responde à pergunta anterior ou já contém algum dado do roteiro.
- Sempre registre em "qualification" todo dado claramente informado, usando exatamente o nome do campo do roteiro.
- Nunca trate uma saudação como nome. "Oi", "olá", "bom dia", "quero saber" e frases parecidas não são nomes.
- Não repita perguntas de campos já salvos.
- As perguntas cadastradas representam a intenção e a ordem do atendimento. Não copie o texto mecanicamente: adapte as palavras ao contexto da conversa, mantendo o mesmo sentido.
- Faça somente a próxima pergunta ainda não respondida, respeitando a ordem acima.
- Não pergunte necessidade, produto, orçamento ou prazo antes dos campos anteriores obrigatórios.
- Se a pessoa corrigir um dado, grave o valor novo.
- Se a pessoa disser que não quer informar um dado, aceite imediatamente, registre nesse campo o valor "Prefere não informar" e siga para a próxima pergunta. Nunca insista, nunca tente convencê-la e nunca volte a perguntar esse campo.
- Se pedirem uma pessoa, atendente ou atendimento humano, não faça mais perguntas: confirme a transferência e retorne "handoff".
${isFirstTurn?'- Nesta primeira resposta, diga de forma breve que a pessoa pode pedir atendimento humano a qualquer momento. Depois faça apenas a próxima pergunta necessária.':''}
Converse naturalmente e faça uma pergunta por vez. Nunca invente dados. Retorne status "qualified" quando todos os campos obrigatórios estiverem preenchidos ou tiverem sido recusados, "handoff" quando pedirem humano ou você não puder ajudar, e "continue" quando precisar de outra resposta.`
}

function requestedHumanSupport(input:string){
  const normalized=input.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  if(/\b(nao|nem)\s+(quero|preciso|desejo).{0,18}\b(humano|atendente|pessoa)\b/.test(normalized))return false
  return /\b(quero|prefiro|gostaria|preciso|pode|chama|chamar|falar|conversar|passa|transferir).{0,35}\b(atendente|humano|pessoa|equipe)\b/.test(normalized)
    || /\b(atendimento humano|falar com alguem|uma pessoa real)\b/.test(normalized)
    || /^\s*(humano|atendente|pessoa|atendimento)\s*[.!?]*$/.test(normalized)
    || /\b(atendente|humano)\b.{0,15}\b(por favor|pfv|agora)\b/.test(normalized)
}

function refusedToProvideData(input:string){
  const normalized=input.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  return /\b(prefiro nao|nao quero|nao vou|nao desejo).{0,24}\b(informar|dizer|falar|passar|responder)\b/.test(normalized)
    || /\bnao\s+(quero|vou|desejo)\s+(dar|passar)\s+(meu|minha|o|a)\b/.test(normalized)
}

export async function POST(request: NextRequest) {
  if (!secret && process.env.NODE_ENV === 'production') return NextResponse.json({ message: 'Webhook não configurado.' }, { status: 503 })
  if (secret && request.headers.get('x-nexo-secret') !== secret) {
    return NextResponse.json({ message: 'Assinatura inválida' }, { status: 401 })
  }
  const payload = await request.json()
  const data = payload?.data ?? payload
  const key = data?.key ?? data?.message?.key
  const message = data?.message?.message ?? data?.message ?? {}
  const id = key?.id
  if (!id || key?.fromMe || processed.has(id)) return NextResponse.json({ accepted: true })
  processed.add(id)
  if (processed.size > 500) processed.delete(processed.values().next().value as string)

  let config: any = {
    enabled: true,
    nodes: [
      { type: 'trigger', value: 'message.received' },
      { type: 'condition', value: 'oi' },
      { type: 'message', value: 'Olá! 👋 Sou a automação da ASAX. Recebi sua mensagem e um atendente continuará por aqui.' },
    ],
  }
  try { config = { ...config, ...JSON.parse(await fs.readFile(configPath, 'utf8')) } } catch {}
  const text = messageText(message).toLowerCase()
  const canonicalJid=String(key.remoteJidAlt ?? key.remoteJid ?? '')
  const number = canonicalJid.split('@')[0]
  const contactName = data?.pushName ?? `+${number}`
  let previouslyQualifiedByAi = false

  // Toda conversa recebida vira contato e lead de entrada, sem duplicar.
  if (number) {
    let contacts: any[] = [], leads: any[] = []
    try { contacts = JSON.parse(await fs.readFile(contactsPath, 'utf8')) } catch {}
    try { leads = JSON.parse(await fs.readFile(leadsPath, 'utf8')) } catch {}
    previouslyQualifiedByAi = leads.some(lead => lead.number === number && lead.tag === 'IA qualificado')
    const previous = contacts.find(contact => contact.number === number)
    contacts = contacts.filter(contact => contact.number !== number)
    contacts.push({ number, remoteJid: `${number}@s.whatsapp.net`, name: previous?.name ?? contactName, source: previous?.source ?? 'Pré-atendimento', classification: previous?.classification ?? 'Novo lead' })
    if (!leads.some(lead => lead.number === number)) leads.unshift({ id: `wa-${number}`, number, name: contactName, company: 'Lead do WhatsApp', value: 0, age: 'agora', tag: 'Novo lead', color: '#5de3b3', stage: 'entrada', createdAt: new Date().toISOString() })
    await fs.mkdir(path.dirname(contactsPath), { recursive: true })
    await Promise.all([
      fs.writeFile(contactsPath, JSON.stringify(contacts, null, 2), 'utf8'),
      fs.writeFile(leadsPath, JSON.stringify(leads.slice(0, 5000), null, 2), 'utf8'),
    ])
  }

  let automationState: Record<string, any> = {}
  try { automationState = JSON.parse(await fs.readFile(statePath, 'utf8')) } catch {}
  if (automationState[number]?.paused) return NextResponse.json({ accepted: true, automation: 'paused-for-human' })
  if(previouslyQualifiedByAi&&!automationState[number]?.reactivatedManually){
    automationState[number]={...automationState[number],paused:true,completed:true,reason:'Pré-atendimento e qualificação já concluídos',updatedAt:new Date().toISOString()}
    await fs.mkdir(path.dirname(statePath),{recursive:true})
    await fs.writeFile(statePath,JSON.stringify(automationState,null,2),'utf8')
    return NextResponse.json({accepted:true,automation:'already-qualified'})
  }
  const nodes = Array.isArray(config.nodes) ? config.nodes : [
    { type: 'condition', value: config.keyword ?? 'oi' },
    { type: 'message', value: config.reply ?? 'Olá! 👋 Sou a automação da ASAX.' },
  ]
  if (config.enabled && number && apiKey) {
    const openaiApiKey=await resolveOpenAIKey()
    const geminiApiKey=await resolveGeminiKey()
    const edges = Array.isArray(config.edges) ? config.edges : nodes.slice(0, -1).map((node: any, index: number) => ({ from: node.id, to: nodes[index + 1]?.id, branch: node.type === 'condition' ? 'true' : 'default' }))
    const pendingMenu = automationState[number]?.pendingMenu
    const activeAgent = automationState[number]?.activeAgent
    const triggerNode = nodes.find((item:any)=>item.type==='trigger')
    const triggerMode = triggerNode?.triggerConfig?.mode ?? 'any'
    const triggerKeyword = String(triggerNode?.triggerConfig?.keyword ?? '').trim().toLowerCase()
    if(!activeAgent&&!pendingMenu&&triggerMode==='keyword'&&(!triggerKeyword||!text.includes(triggerKeyword))){
      return NextResponse.json({accepted:true,automation:'waiting-for-trigger'})
    }
    let node = triggerNode ?? nodes[0]
    if (activeAgent) {
      node = nodes.find((item: any) => item.id === activeAgent.nodeId)
    } else if (pendingMenu) {
      const menuNode = nodes.find((item: any) => item.id === pendingMenu.nodeId)
      const normalized = text.trim().toLowerCase()
      const option = (menuNode?.options ?? []).find((item: any, index: number) =>
        normalized === `option-${item.id}` || normalized === item.id.toLowerCase() || normalized === item.label.toLowerCase() || normalized === String(index + 1)
      )
      const menuEdge = edges.find((edge: any) => edge.from === pendingMenu.nodeId && edge.branch === (option ? `option:${option.id}` : 'fallback'))
      node = nodes.find((item: any) => item.id === menuEdge?.to)
      delete automationState[number].pendingMenu
      await fs.writeFile(statePath, JSON.stringify(automationState, null, 2), 'utf8')
    }
    const visited = new Set<string>()
    for (let step = 0; node && step < 40 && !visited.has(node.id); step++) {
      visited.add(node.id)
      const expected = String(node.value).toLowerCase()
      const conditionMatched = node.type !== 'condition' || (node.operator === 'equals' ? text.trim() === expected.trim()
        : node.operator === 'startsWith' ? text.startsWith(expected)
        : node.operator === 'exists' ? Boolean(text.trim())
        : text.includes(expected))
      if (node.type === 'wait') await new Promise(resolve => setTimeout(resolve, Math.min(Math.max(Number(node.value) || 1, 1), 10) * 1000))
      if (node.type === 'message') {
        await fetch(`${baseUrl}/message/sendText/${instanceName}`, {
          method: 'POST',
          headers: { apikey: apiKey, 'content-type': 'application/json' },
          body: JSON.stringify({ number, text: String(node.value), delay: 500 }),
        })
      }
      if (node.type === 'menu') {
        const legacy = String(node.value).split('|').map((part: string) => part.trim()).filter(Boolean)
        const title = legacy[0] || 'Escolha uma opção'
        const options = Array.isArray(node.options) && node.options.length ? node.options : legacy.slice(1).map((label: string, index: number) => ({ id: String(index + 1), label }))
        if (options.length <= 3) {
          await fetch(`${baseUrl}/message/sendButtons/${instanceName}`, {
            method: 'POST',
            headers: { apikey: apiKey, 'content-type': 'application/json' },
            body: JSON.stringify({ number, title, description: 'Toque em uma opção para continuar', footer: 'ASAX', buttons: options.map((option: any) => ({ type: 'reply', displayText: option.label, id: `option-${option.id}` })) }),
          })
        } else {
          await fetch(`${baseUrl}/message/sendText/${instanceName}`, {
            method: 'POST',
            headers: { apikey: apiKey, 'content-type': 'application/json' },
            body: JSON.stringify({ number, text: `${title}\n\n${options.map((option: any, index: number) => `${index + 1}. ${option.label}`).join('\n')}\n\nResponda com o número da opção.`, delay: 400 }),
          })
        }
        automationState[number] = { ...(automationState[number] ?? {}), pendingMenu: { nodeId: node.id }, updatedAt: new Date().toISOString() }
        await fs.writeFile(statePath, JSON.stringify(automationState, null, 2), 'utf8')
        break
      }
      if (node.type === 'webhook') {
        try {
          const destination = new URL(String(node.value))
          if (['http:', 'https:'].includes(destination.protocol)) await fetch(destination, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ event: 'asax.automation', number, text, pushName: data?.pushName, messageId: id }) })
        } catch {}
      }
      if (node.type === 'ticket') {
        let tickets: any[] = []
        try { tickets = JSON.parse(await fs.readFile(ticketsPath, 'utf8')) } catch {}
        tickets.push({ id: `ticket-${Date.now()}`, number, contact: data?.pushName ?? `+${number}`, subject: String(node.value), status: 'open', createdAt: new Date().toISOString() })
        await fs.mkdir(path.dirname(ticketsPath), { recursive: true })
        await fs.writeFile(ticketsPath, JSON.stringify(tickets.slice(-1000), null, 2), 'utf8')
      }
      if (node.type === 'handoff') {
        automationState[number] = { paused: true, reason: String(node.value || 'Pré-atendimento concluído'), updatedAt: new Date().toISOString() }
        await fs.mkdir(path.dirname(statePath), { recursive: true })
        await fs.writeFile(statePath, JSON.stringify(automationState, null, 2), 'utf8')
      }
      if (node.type === 'ai') {
        const state = automationState[number] ?? {}
        const history = Array.isArray(state.agentHistory) ? state.agentHistory : []
        if(requestedHumanSupport(text)){
          await fetch(`${baseUrl}/message/sendText/${instanceName}`,{
            method:'POST',
            headers:{apikey:apiKey,'content-type':'application/json'},
            body:JSON.stringify({number,text:'Claro. Vou pausar o atendimento automático e encaminhar você para uma pessoa da nossa equipe. A IA não responderá mais nesta conversa.',delay:300}),
          })
          automationState[number]={...state,paused:true,completed:false,reactivatedManually:false,activeAgent:undefined,reason:'Contato solicitou atendimento humano',handoffRequestedAt:new Date().toISOString(),updatedAt:new Date().toISOString()}
          await fs.writeFile(statePath,JSON.stringify(automationState,null,2),'utf8')
          break
        }
        const config = node.aiConfig ?? { objective: node.value, instructions: '', maxTurns: 40, model: 'gemini-2.5-flash', provider: 'gemini' }
        const credentialRequested = Boolean(config.credentialId)
        let storedCredential: Awaited<ReturnType<typeof getCredentialSecret>> = null
        if (credentialRequested) {
          try { storedCredential = await getCredentialSecret(String(config.credentialId)) } catch {}
        }
        const provider = String(storedCredential?.provider || config.provider || (String(config.model).startsWith('gemini-') ? 'gemini' : 'openai'))
        const selectedKey = credentialRequested
          ? storedCredential?.apiKey ?? ''
          : provider === 'gemini' ? geminiApiKey : openaiApiKey
        const selectedModel=String(storedCredential?.model||config.model||(provider==='gemini'?'gemini-2.5-flash':'gpt-5.6'))
        if(!selectedKey){
          await fetch(`${baseUrl}/message/sendText/${instanceName}`,{method:'POST',headers:{apikey:apiKey,'content-type':'application/json'},body:JSON.stringify({number,text:'O atendimento automático está temporariamente indisponível. Vou encaminhar você para nossa equipe.',delay:300})})
          automationState[number]={...state,paused:true,reason:credentialRequested?'Credencial selecionada não foi encontrada ou não pôde ser aberta':`Chave do provedor ${provider} não carregada`,updatedAt:new Date().toISOString()}
          await fs.writeFile(statePath,JSON.stringify(automationState,null,2),'utf8')
          break
        }
        const turns = Number(state.agentTurns ?? 0) + 1
        let profile: any = {}
        try { profile = repairTextEncoding(JSON.parse(await fs.readFile(aiProfilePath, 'utf8'))) } catch {}
        const instructions = buildAgentInstructions(profile, config, state.qualificationData ?? {}, history.length===0)
        const response = provider === 'gemini'
          ? await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(selectedModel)}:generateContent`, {
              method: 'POST',
              headers: { 'x-goog-api-key': selectedKey, 'content-type': 'application/json' },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: instructions }] },
                contents: [...history.slice(-12), { role: 'user', content: text }].map((entry:any)=>({
                  role: entry.role === 'assistant' ? 'model' : 'user',
                  parts: [{ text: String(entry.content ?? '') }],
                })),
                generationConfig: { responseMimeType: 'application/json', responseJsonSchema: qualificationSchema },
              }),
            })
          : provider==='openai' ? await fetch('https://api.openai.com/v1/responses', {
              method: 'POST',
              headers: { authorization: `Bearer ${selectedKey}`, 'content-type': 'application/json' },
              body: JSON.stringify({
                model: selectedModel,
                instructions,
                input: [...history.slice(-12), { role: 'user', content: text }],
                text: { format: { type: 'json_schema', name: 'pre_atendimento', strict: true, schema: qualificationSchema } },
              }),
            })
          : await fetch(`${String(storedCredential?.baseUrl??'').replace(/\/+$/,'')}/chat/completions`,{
              method:'POST',
              headers:{authorization:`Bearer ${selectedKey}`,'content-type':'application/json'},
              body:JSON.stringify({
                model:selectedModel,
                messages:[{role:'system',content:`${instructions}\nResponda somente como JSON válido com: reply (texto), status (continue, qualified ou handoff), summary (texto) e qualification (lista de objetos field e value).`},...history.slice(-12),{role:'user',content:text}],
                response_format:{type:'json_object'},
              }),
            })
        if (!response.ok) {
          await fetch(`${baseUrl}/message/sendText/${instanceName}`, { method: 'POST', headers: { apikey: apiKey, 'content-type': 'application/json' }, body: JSON.stringify({ number, text: 'Vou encaminhar você para um atendente continuar por aqui.', delay: 300 }) })
          automationState[number] = { ...state, paused: true, reason: 'Falha ou indisponibilidade da IA', updatedAt: new Date().toISOString() }
          await fs.writeFile(statePath, JSON.stringify(automationState, null, 2), 'utf8')
          break
        }
        const result: any = await response.json()
        let measured:any={inputTokens:0,outputTokens:0,totalTokens:0,calls:0}
        try{measured=JSON.parse(await fs.readFile(aiUsagePath,'utf8'))}catch{}
        const inputTokens=Number(result.usage?.input_tokens??result.usage?.prompt_tokens??result.usageMetadata?.promptTokenCount??0),outputTokens=Number(result.usage?.output_tokens??result.usage?.completion_tokens??result.usageMetadata?.candidatesTokenCount??0)
        measured={inputTokens:Number(measured.inputTokens??0)+inputTokens,outputTokens:Number(measured.outputTokens??0)+outputTokens,totalTokens:Number(measured.totalTokens??0)+inputTokens+outputTokens,calls:Number(measured.calls??0)+1,lastUsedAt:new Date().toISOString(),lastProvider:provider}
        await fs.writeFile(aiUsagePath,JSON.stringify(measured,null,2),'utf8')
        const outputText = provider === 'gemini'
          ? result.candidates?.[0]?.content?.parts?.map((part:any)=>part.text ?? '').join('')
          : provider==='openai'
            ? result.output_text ?? result.output?.flatMap((item: any) => item.content ?? []).find((item: any) => item.type === 'output_text')?.text
            : result.choices?.[0]?.message?.content
        const decision = JSON.parse(outputText || '{"reply":"Como posso ajudar?","status":"continue","summary":"","qualification":[]}')
        const qualificationData={...(state.qualificationData??{})}
        for(const item of Array.isArray(decision.qualification)?decision.qualification:[]){if(item?.field&&item?.value)qualificationData[String(item.field)]=String(item.value)}
        const questionScript=Array.isArray(profile.qualificationQuestions)?profile.qualificationQuestions:[]
        const refusedField=questionScript.find((item:any)=>!String(qualificationData[item.field]??'').trim())
        if(refusedToProvideData(text)&&refusedField){
          qualificationData[refusedField.field]='Prefere não informar'
          const nextQuestion=questionScript.find((item:any)=>!String(qualificationData[item.field]??'').trim())
          decision.reply=nextQuestion?`Tudo bem, não precisa informar. ${nextQuestion.question}`:'Tudo bem, não precisa informar. Obrigado por responder.'
        }
        const missingRequired=questionScript.filter((item:any)=>item.required!==false&&!String(qualificationData[item.field]??'').trim())
        if(decision.status==='qualified'&&missingRequired.length){
          decision.status='continue'
        }
        if(history.length===0&&!/\b(atendente|atendimento humano|uma pessoa|equipe)\b/i.test(String(decision.reply))){
          decision.reply=`Antes de começarmos: se preferir, posso chamar uma pessoa da nossa equipe a qualquer momento.\n\n${decision.reply}`
        }
        await fetch(`${baseUrl}/message/sendText/${instanceName}`, { method: 'POST', headers: { apikey: apiKey, 'content-type': 'application/json' }, body: JSON.stringify({ number, text: decision.reply, delay: 500 }) })
        const nextHistory = [...history, { role: 'user', content: text }, { role: 'assistant', content: decision.reply }].slice(-14)
        const requiredQuestionCount=questionScript.filter((item:any)=>item.required!==false).length
        const configuredMaxTurns=Math.min(Math.max(Number(config.maxTurns)||40,1),100)
        const minimumForQualification=Math.min(Math.max(requiredQuestionCount*3+6,12),100)
        const effectiveMaxTurns=Math.max(configuredMaxTurns,minimumForQualification)
        // Nunca entrega para humano somente por limite enquanto ainda faltarem perguntas obrigatórias.
        // O teto absoluto evita uma conversa presa caso o contato nunca responda ao roteiro.
        const forcedHandoff = turns >= 100 || (turns >= effectiveMaxTurns && missingRequired.length===0)
        const status = forcedHandoff ? 'handoff' : decision.status
        const terminal = status === 'qualified' || status === 'handoff'
        automationState[number] = {
          ...state,
          agentHistory: nextHistory,
          agentTurns: turns,
          qualificationData,
          activeAgent: status === 'continue' ? { nodeId: node.id } : undefined,
          paused: terminal,
          completed: status === 'qualified',
          reactivatedManually: terminal ? false : state.reactivatedManually,
          reason: status === 'qualified' ? 'Pré-atendimento e qualificação concluídos' : status === 'handoff' ? 'Contato encaminhado para atendimento humano' : state.reason,
          completedAt: status === 'qualified' ? new Date().toISOString() : state.completedAt,
          updatedAt: new Date().toISOString(),
        }
        await fs.writeFile(statePath, JSON.stringify(automationState, null, 2), 'utf8')
        if (status === 'continue') break
        if(status==='qualified'){
          let leads:any[]=[];try{leads=JSON.parse(await fs.readFile(leadsPath,'utf8'))}catch{}
          leads=leads.map(lead=>lead.number===number?{...lead,tag:'IA qualificado',stage:'qualificacao',qualification:qualificationData,summary:decision.summary,updatedAt:new Date().toISOString()}:lead)
          await fs.writeFile(leadsPath,JSON.stringify(leads,null,2),'utf8')
        }
        const aiEdge = edges.find((edge: any) => edge.from === node.id && edge.branch === status)
        node = nodes.find((item: any) => item.id === aiEdge?.to)
        if (!node && status === 'handoff') {
          automationState[number] = { ...automationState[number], paused: true, reason: 'Agente solicitou atendimento humano' }
          await fs.writeFile(statePath, JSON.stringify(automationState, null, 2), 'utf8')
        }
        continue
      }
      if (node.type === 'classify') {
        let contacts: any[] = []
        try { contacts = JSON.parse(await fs.readFile(contactsPath, 'utf8')) } catch {}
        const existing = contacts.find(contact => contact.number === number)
        contacts = contacts.filter(contact => contact.number !== number)
        contacts.push({ number, remoteJid: `${number}@s.whatsapp.net`, name: existing?.name ?? data?.pushName ?? `+${number}`, source: existing?.source ?? 'Automação', classification: String(node.value) })
        await fs.mkdir(path.dirname(contactsPath), { recursive: true })
        await fs.writeFile(contactsPath, JSON.stringify(contacts, null, 2), 'utf8')
      }
      const outgoing = edges.filter((edge: any) => edge.from === node.id)
      const nextEdge = node.type === 'condition'
        ? outgoing.find((edge: any) => edge.branch === (conditionMatched ? 'true' : 'false'))
        : outgoing.find((edge: any) => edge.branch === 'default') ?? outgoing[0]
      node = nodes.find((item: any) => item.id === nextEdge?.to)
    }
  }
  return NextResponse.json({ accepted: true })
}
