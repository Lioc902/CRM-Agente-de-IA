import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { saveIncomingMetaMessage } from '../../../../../lib/whatsapp/store'

export const runtime = 'nodejs'

// A variável de ambiente substitui o valor local de teste assim que o CRM for publicado.
const verifyToken = process.env.META_WHATSAPP_VERIFY_TOKEN_ACTIVE ?? process.env.META_WHATSAPP_VERIFY_TOKEN
// META_APP_SECRET_ACTIVE permits a safe secret rotation without downtime.
const appSecret = process.env.META_APP_SECRET_ACTIVE ?? process.env.META_APP_SECRET

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('hub.mode')
  const token = request.nextUrl.searchParams.get('hub.verify_token')
  const challenge = request.nextUrl.searchParams.get('hub.challenge')

  if (verifyToken && mode === 'subscribe' && token === verifyToken && challenge) {
    return new NextResponse(challenge, { status: 200, headers: { 'content-type': 'text/plain' } })
  }
  return NextResponse.json({ message: 'Verificação do webhook recusada.' }, { status: 403 })
}

export async function POST(request: NextRequest) {
  if (!appSecret && process.env.NODE_ENV === 'production') return NextResponse.json({ accepted: false }, { status: 503 })
  const rawPayload = await request.text()
  const signature = request.headers.get('x-hub-signature-256')
  if (appSecret) {
    const expected = `sha256=${createHmac('sha256', appSecret).update(rawPayload).digest('hex')}`
    const valid = signature && signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    if (!valid) return NextResponse.json({ accepted: false }, { status: 401 })
  }
  let payload: any
  try { payload = JSON.parse(rawPayload || 'null') } catch { return NextResponse.json({ accepted: false }, { status: 400 }) }
  if (!payload || payload.object !== 'whatsapp_business_account') {
    return NextResponse.json({ accepted: false }, { status: 400 })
  }

  try {
    for (const entry of payload.entry ?? []) for (const change of entry.changes ?? []) {
      const value = change?.value
      if (change?.field !== 'messages' || !value?.messages) continue
      const names = new Map<string, string>((value.contacts ?? []).map((contact: any): [string, string] => [String(contact.wa_id), String(contact.profile?.name ?? '')]))
      for (const message of value.messages) {
        const type = String(message.type ?? 'text')
        const interactive = message.interactive?.button_reply?.title ?? message.interactive?.list_reply?.title ?? null
        await saveIncomingMetaMessage({
          id: String(message.id), from: String(message.from), name: names.get(String(message.from)) ?? null,
          timestamp: message.timestamp, type, text: String(message.text?.body ?? interactive ?? message.button?.text ?? '').trim() || null,
          mediaId: message[type]?.id ?? null, mimeType: message[type]?.mime_type ?? null, raw: message,
        })
      }
    }
  } catch (error) {
    console.error('Meta WhatsApp webhook persistence failed', error)
    return NextResponse.json({ accepted: false }, { status: 503 })
  }

  return NextResponse.json({ accepted: true })
}
