import { NextRequest, NextResponse } from 'next/server'
import { isMetaWhatsAppConfigured } from '../../../../lib/whatsapp/meta'
import { listMetaMessages } from '../../../../lib/whatsapp/store'

const baseUrl = process.env.EVOLUTION_API_URL ?? 'http://127.0.0.1:8080'
const apiKey = process.env.EVOLUTION_API_KEY
const instanceName = process.env.EVOLUTION_INSTANCE_NAME ?? 'nexo-teste'

function textFromMessage(message: Record<string, any> = {}) {
  return message.conversation
    ?? message.extendedTextMessage?.text
    ?? message.imageMessage?.caption
    ?? message.videoMessage?.caption
    ?? (message.audioMessage ? '🎤 Mensagem de áudio' : null)
    ?? (message.imageMessage ? '🖼️ Imagem' : null)
    ?? (message.videoMessage ? '🎥 Vídeo' : null)
    ?? (message.documentMessage ? `📎 ${message.documentMessage.fileName ?? 'Documento'}` : null)
    ?? (message.stickerMessage ? '🟢 Figurinha' : null)
    ?? 'Mensagem'
}

export async function GET(request: NextRequest) {
  if (isMetaWhatsAppConfigured()) {
    try { return NextResponse.json({ messages: await listMetaMessages(request.nextUrl.searchParams.get('remoteJid')) }) }
    catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : 'Falha ao carregar conversas oficiais.' }, { status: 503 }) }
  }
  if (!apiKey) return NextResponse.json({ message: 'WhatsApp não configurado' }, { status: 503 })
  const remoteJid = request.nextUrl.searchParams.get('remoteJid')
  const body = remoteJid ? { where: { key: { remoteJid } }, page: 1, offset: 100 } : { page: 1, offset: 200 }
  try {
    const response = await fetch(`${baseUrl}/chat/findMessages/${instanceName}`, {
      method: 'POST',
      headers: { apikey: apiKey, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    const data = await response.json()
    if (!response.ok) return NextResponse.json({ message: data?.message ?? 'Falha ao carregar mensagens' }, { status: response.status })
    const records = (data?.messages?.records ?? []).filter((record: any) => {
      const jid=String(record.key?.remoteJid??'')
      return jid && !jid.endsWith('@g.us') && !jid.endsWith('@broadcast') && !jid.includes('status@broadcast')
    })
    const messages = records.map((record: any) => ({
      id: record.key?.id ?? record.id,
      remoteJid: record.key?.remoteJidAlt ?? record.key?.remoteJid,
      fromMe: Boolean(record.key?.fromMe),
      pushName: record.pushName ?? null,
      text: textFromMessage(record.message),
      type: record.messageType,
      hasMedia: Boolean(record.message?.audioMessage || record.message?.imageMessage || record.message?.videoMessage || record.message?.documentMessage || record.message?.stickerMessage),
      mediaKind: record.message?.audioMessage ? 'audio' : record.message?.imageMessage ? 'image' : record.message?.videoMessage ? 'video' : record.message?.documentMessage ? 'document' : record.message?.stickerMessage ? 'sticker' : null,
      timestamp: Number(record.messageTimestamp ?? 0),
      status: record.MessageUpdate?.at(-1)?.status ?? null,
    })).sort((a: any, b: any) => a.timestamp - b.timestamp)
    return NextResponse.json({ messages })
  } catch {
    return NextResponse.json({ message: 'Evolution API indisponível' }, { status: 503 })
  }
}
