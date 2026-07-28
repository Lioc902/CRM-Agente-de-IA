import 'server-only'

import { createAdminClient } from '../supabase/admin'

export type StoredWhatsAppMessage = {
  id: string; remoteJid: string; fromMe: boolean; pushName: string | null; text: string; type: string
  hasMedia: boolean; mediaKind: 'audio' | 'image' | 'video' | 'document' | 'sticker' | null; timestamp: number; status: string | null
}
type MetaMessageInput = { id: string; from: string; name?: string | null; timestamp?: string | number | null; type?: string | null; text?: string | null; mediaId?: string | null; mimeType?: string | null; raw?: unknown }
const numberFrom = (value: string) => String(value ?? '').replace(/\D/g, '')
const toUnix = (value?: string | number | null) => { const parsed = Number(value ?? 0); return Number.isFinite(parsed) && parsed > 0 ? parsed : Math.floor(Date.now() / 1000) }
function mediaKind(type: string): StoredWhatsAppMessage['mediaKind'] { return ['audio', 'image', 'video', 'document', 'sticker'].includes(type) ? type as StoredWhatsAppMessage['mediaKind'] : null }
function displayText(type: string, text?: string | null) {
  if (text?.trim()) return text.trim()
  return ({ audio:'🎤 Mensagem de áudio', image:'🖼️ Imagem', video:'🎥 Vídeo', document:'📎 Documento', sticker:'🟢 Figurinha', location:'📍 Localização', contacts:'👤 Contato compartilhado', interactive:'Resposta interativa' } as Record<string, string>)[type] ?? 'Mensagem'
}
export async function saveIncomingMetaMessage(input: MetaMessageInput) {
  const number = numberFrom(input.from); if (!input.id || number.length < 10) return null
  const type = String(input.type ?? 'text')
  const row = { provider_message_id:input.id, provider:'meta', remote_jid:`${number}@s.whatsapp.net`, phone:number, contact_name:input.name?.trim() || null, direction:'inbound', message_type:type, body:displayText(type,input.text), media_id:input.mediaId ?? null, media_mime_type:input.mimeType ?? null, provider_timestamp:new Date(toUnix(input.timestamp)*1000).toISOString(), raw:input.raw ?? null }
  const { error } = await createAdminClient().from('whatsapp_messages').upsert(row, { onConflict:'provider_message_id', ignoreDuplicates:true })
  if (error) throw new Error(`Não foi possível salvar a mensagem oficial (${error.code ?? error.message}).`)
  return row
}
export async function saveOutgoingMetaMessage(input: { id?: string | null; number: string; text: string }) {
  const number = numberFrom(input.number); if (!input.id || number.length < 10) return null
  const { error } = await createAdminClient().from('whatsapp_messages').upsert({ provider_message_id:input.id, provider:'meta', remote_jid:`${number}@s.whatsapp.net`, phone:number, direction:'outbound', message_type:'text', body:input.text, provider_timestamp:new Date().toISOString() }, { onConflict:'provider_message_id', ignoreDuplicates:true })
  if (error) throw new Error(`Não foi possível registrar o envio oficial (${error.code ?? error.message}).`)
}
export async function listMetaMessages(remoteJid?: string | null): Promise<StoredWhatsAppMessage[]> {
  let query = createAdminClient().from('whatsapp_messages').select('provider_message_id, remote_jid, contact_name, direction, message_type, body, media_id, provider_timestamp, created_at').eq('provider','meta').order('provider_timestamp',{ascending:true}).limit(500)
  if (remoteJid) query=query.eq('remote_jid',remoteJid)
  const { data,error }=await query; if(error)throw new Error(`Não foi possível carregar as conversas oficiais (${error.code ?? error.message}).`)
  return (data??[]).map((row:Record<string,unknown>)=>{const type=String(row.message_type??'text'); return {id:String(row.provider_message_id),remoteJid:String(row.remote_jid),fromMe:row.direction==='outbound',pushName:typeof row.contact_name==='string'?row.contact_name:null,text:String(row.body??'Mensagem'),type,hasMedia:Boolean(row.media_id)||Boolean(mediaKind(type)),mediaKind:mediaKind(type),timestamp:Math.floor(new Date(String(row.provider_timestamp??row.created_at??'')).getTime()/1000),status:null}})
}
export async function listMetaContacts() {
  const {data,error}=await createAdminClient().from('whatsapp_messages').select('phone, remote_jid, contact_name, provider_timestamp').eq('provider','meta').order('provider_timestamp',{ascending:false}).limit(1000)
  if(error)throw new Error(`Não foi possível carregar os contatos oficiais (${error.code ?? error.message}).`)
  const contacts=new Map<string,{number:string;remoteJid:string;name:string;source:string;classification:string}>()
  for(const row of data??[]){const number=String(row.phone??'');if(!number||contacts.has(number))continue;contacts.set(number,{number,remoteJid:String(row.remote_jid),name:String(row.contact_name??`+${number}`),source:'WhatsApp oficial',classification:'Novo lead'})}
  return [...contacts.values()]
}
