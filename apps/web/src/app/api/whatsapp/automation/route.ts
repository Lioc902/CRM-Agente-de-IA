import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

const configPath = path.join(process.cwd(), '.runtime', 'whatsapp-automation.json')

export type AutomationNode = {
  id: string
  type: 'trigger' | 'condition' | 'message' | 'wait' | 'classify' | 'menu' | 'webhook' | 'ticket' | 'handoff' | 'ai'
  label: string
  value: string
  options?: { id: string; label: string }[]
  operator?: 'contains' | 'equals' | 'startsWith' | 'exists'
  triggerConfig?: { mode: 'any' | 'keyword'; keyword: string }
  aiConfig?: { objective: string; instructions: string; maxTurns: number; model: string; provider?: 'gemini' | 'openai'; credentialId?: string }
  x?: number
  y?: number
}
export type AutomationEdge = { id: string; from: string; to: string; branch?: string }

const defaults = {
  enabled: true,
  name: 'Atendimento inicial',
  nodes: [
    { id: 'trigger-1', type: 'trigger', label: 'Mensagem recebida', value: 'message.received', triggerConfig:{mode:'any',keyword:''}, x: 60, y: 150 },
    { id: 'condition-1', type: 'condition', label: 'Mensagem contém', value: 'oi', x: 340, y: 150 },
    { id: 'message-1', type: 'message', label: 'Responder no WhatsApp', value: 'Olá! 👋 Sou a automação da ASAX. Recebi sua mensagem e um atendente continuará por aqui.', x: 650, y: 70 },
  ] as AutomationNode[],
  edges: [
    { id: 'edge-1', from: 'trigger-1', to: 'condition-1', branch: 'default' },
    { id: 'edge-2', from: 'condition-1', to: 'message-1', branch: 'true' },
  ] as AutomationEdge[],
}

async function readConfig() {
  try {
    const saved = JSON.parse(await fs.readFile(configPath, 'utf8'))
    if (Array.isArray(saved.nodes)) return {
      ...defaults,
      ...saved,
      nodes: saved.nodes.map((node: AutomationNode, index: number) => ({ ...node, x: node.x ?? 60 + index * 280, y: node.y ?? 150 })),
      edges: Array.isArray(saved.edges) ? saved.edges : saved.nodes.slice(0, -1).map((node: AutomationNode, index: number) => ({ id: `edge-${index + 1}`, from: node.id, to: saved.nodes[index + 1].id, branch: node.type === 'condition' ? 'true' : 'default' })),
    }
    return {
      ...defaults,
      enabled: saved.enabled ?? true,
      nodes: defaults.nodes.map(node => node.type === 'condition' ? { ...node, value: saved.keyword ?? 'oi' } : node.type === 'message' ? { ...node, value: saved.reply ?? node.value } : node),
      edges: defaults.edges,
    }
  } catch {
    return defaults
  }
}

export async function GET() {
  return NextResponse.json(await readConfig())
}

export async function POST(request: NextRequest) {
  const data = await request.json()
  const nodes = Array.isArray(data.nodes) ? data.nodes.filter((node: AutomationNode) =>
    node?.id && ['trigger', 'condition', 'message', 'wait', 'classify', 'menu', 'webhook', 'ticket', 'handoff', 'ai'].includes(node.type) && String(node.value ?? '').trim()
  ).map((node: AutomationNode) => ({ id: String(node.id), type: node.type, label: String(node.label), value: String(node.value).trim(), x: Number(node.x) || 0, y: Number(node.y) || 0, operator: node.operator ?? 'contains', triggerConfig:node.type==='trigger'?{mode:node.triggerConfig?.mode==='keyword'?'keyword':'any',keyword:String(node.triggerConfig?.keyword??'').trim()}:undefined, options: Array.isArray(node.options) ? node.options.slice(0, 10).map(option => ({ id: String(option.id), label: String(option.label).trim() })).filter(option => option.label) : undefined, aiConfig: node.aiConfig ? { objective: String(node.aiConfig.objective ?? ''), instructions: String(node.aiConfig.instructions ?? ''), maxTurns: Math.min(Math.max(Number(node.aiConfig.maxTurns) || 8, 1), 30), model: String(node.aiConfig.model || 'gemini-2.5-flash'), provider: node.aiConfig.provider === 'openai' ? 'openai' : String(node.aiConfig.model).startsWith('gpt-') ? 'openai' : 'gemini', credentialId:String(node.aiConfig.credentialId??'').trim()||undefined } : undefined })) : []
  const actionTypes=['message','menu','ai','classify','ticket','handoff','webhook']
  if (!nodes.some((node: AutomationNode) => node.type === 'trigger') || !nodes.some((node: AutomationNode) => actionTypes.includes(node.type))) {
    return NextResponse.json({ message: 'Adicione um gatilho e pelo menos uma ação, como mensagem, menu ou agente de IA.' }, { status: 400 })
  }
  const nodeIds = new Set(nodes.map((node: AutomationNode) => node.id))
  const edges = (Array.isArray(data.edges) ? data.edges : []).filter((edge: AutomationEdge) => nodeIds.has(edge.from) && nodeIds.has(edge.to) && edge.from !== edge.to).map((edge: AutomationEdge) => ({ id: String(edge.id), from: String(edge.from), to: String(edge.to), branch: String(edge.branch || 'default') }))
  const config = { enabled: Boolean(data.enabled), name: String(data.name ?? 'Automação sem nome').trim(), nodes, edges }
  await fs.mkdir(path.dirname(configPath), { recursive: true })
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8')
  return NextResponse.json(config)
}
