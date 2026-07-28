import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { isMetaWhatsAppConfigured } from '../../../../lib/whatsapp/meta'
import { listMetaContacts } from '../../../../lib/whatsapp/store'

const baseUrl = process.env.EVOLUTION_API_URL ?? 'http://127.0.0.1:8080'
const apiKey = process.env.EVOLUTION_API_KEY
const instanceName = process.env.EVOLUTION_INSTANCE_NAME ?? 'nexo-teste'
const localPath = path.join(process.cwd(), '.runtime', 'contacts.json')

async function localContacts() {
  try { return JSON.parse(await fs.readFile(localPath, 'utf8')) as any[] } catch { return [] }
}

export async function GET() {
  if (isMetaWhatsAppConfigured()) {
    try { return NextResponse.json({ contacts: await listMetaContacts() }) }
    catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : 'Não foi possível carregar os contatos oficiais.' }, { status: 503 }) }
  }
  if (!apiKey) return NextResponse.json({ message: 'WhatsApp não configurado' }, { status: 503 })
  try {
    const [instancesResponse, messagesResponse, locals] = await Promise.all([
      fetch(`${baseUrl}/instance/fetchInstances`, { headers: { apikey: apiKey }, cache: 'no-store' }),
      fetch(`${baseUrl}/chat/findMessages/${instanceName}`, {
        method: 'POST', headers: { apikey: apiKey, 'content-type': 'application/json' },
        body: JSON.stringify({ page: 1, offset: 500 }), cache: 'no-store',
      }),
      localContacts(),
    ])
    const instancesData = instancesResponse.ok ? await instancesResponse.json() : []
    const instances = (Array.isArray(instancesData) ? instancesData : instancesData?.value ?? []).map((item: any) => item.name).filter(Boolean)
    const contactLists = await Promise.all(instances.map(async (name: string) => {
      const response = await fetch(`${baseUrl}/chat/findContacts/${name}`, {
        method: 'POST', headers: { apikey: apiKey, 'content-type': 'application/json' }, body: '{}', cache: 'no-store',
      })
      return response.ok ? await response.json() : []
    }))
    const providerContacts = contactLists.flat()
    const messageData = messagesResponse.ok ? await messagesResponse.json() : { messages: { records: [] } }
    const merged = new Map<string, any>()
    for (const contact of [...(Array.isArray(providerContacts) ? providerContacts : []), ...locals]) {
      const remoteJid = contact.remoteJid ?? contact.id
      const number = String(contact.number ?? remoteJid ?? '').split('@')[0].replace(/\D/g, '')
      const displayName = String(contact.name ?? contact.pushName ?? '').trim()
      if (number) merged.set(number, { number, remoteJid: remoteJid ?? `${number}@s.whatsapp.net`, name: displayName || `+${number}`, source: contact.source ?? 'WhatsApp', classification: contact.classification ?? 'Novo lead' })
    }
    for (const record of messageData?.messages?.records ?? []) {
      const remoteJid = record.key?.remoteJidAlt ?? record.key?.remoteJid
      if (!remoteJid || remoteJid.endsWith('@broadcast') || remoteJid.endsWith('@g.us')) continue
      const number = remoteJid.split('@')[0].replace(/\D/g, '')
      const current = merged.get(number)
      merged.set(number, { number, remoteJid, name: current?.name ?? record.pushName ?? (number === '556699566791' ? 'Você' : `+${number}`), source: current?.source ?? 'Conversa', classification: current?.classification ?? 'Novo lead' })
    }
    return NextResponse.json({ contacts: [...merged.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')) })
  } catch {
    return NextResponse.json({ message: 'Não foi possível carregar os contatos' }, { status: 503 })
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const incoming = Array.isArray(body.contacts) ? body.contacts : [body]
  const current = await localContacts()
  const merged = new Map(current.map((contact: any) => [contact.number, contact]))
  for (const contact of incoming) {
    const number = String(contact.number ?? contact.phone ?? '').replace(/\D/g, '')
    if (number.length >= 10) merged.set(number, { number, remoteJid: `${number}@s.whatsapp.net`, name: String(contact.name ?? `+${number}`).trim(), source: contact.source ?? 'CRM', classification: contact.classification ?? merged.get(number)?.classification ?? 'Novo lead' })
  }
  await fs.mkdir(path.dirname(localPath), { recursive: true })
  await fs.writeFile(localPath, JSON.stringify([...merged.values()], null, 2), 'utf8')
  return NextResponse.json({ contacts: [...merged.values()] })
}

export async function PATCH(request: NextRequest) {
  const { number: rawNumber, classification } = await request.json()
  const number = String(rawNumber ?? '').replace(/\D/g, '')
  const allowed = ['Novo lead', 'Em qualificação', 'Qualificado', 'Proposta', 'Cliente', 'Perdido']
  if (!number || !allowed.includes(classification)) return NextResponse.json({ message: 'Classificação inválida' }, { status: 400 })
  const current = await localContacts()
  const existing = current.find((contact: any) => contact.number === number)
  const updated = current.filter((contact: any) => contact.number !== number)
  updated.push({ number, remoteJid: `${number}@s.whatsapp.net`, name: existing?.name ?? `+${number}`, source: existing?.source ?? 'WhatsApp', classification })
  await fs.mkdir(path.dirname(localPath), { recursive: true })
  await fs.writeFile(localPath, JSON.stringify(updated, null, 2), 'utf8')
  return NextResponse.json({ number, classification })
}
