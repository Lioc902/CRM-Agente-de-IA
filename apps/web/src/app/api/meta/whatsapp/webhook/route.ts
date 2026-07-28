import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'

export const runtime = 'nodejs'

// A variável de ambiente substitui o valor local de teste assim que o CRM for publicado.
const verifyToken = process.env.META_WHATSAPP_VERIFY_TOKEN
// META_APP_SECRET_ACTIVE permits a safe secret rotation without downtime.
const appSecret = process.env.META_APP_SECRET_ACTIVE ?? process.env.META_APP_SECRET
const eventsPath = path.join(process.cwd(), '.runtime', 'meta-whatsapp-events.json')

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
  const payload = JSON.parse(rawPayload || 'null')
  if (!payload || payload.object !== 'whatsapp_business_account') {
    return NextResponse.json({ accepted: false }, { status: 400 })
  }

  await fs.mkdir(path.dirname(eventsPath), { recursive: true })
  let events: unknown[] = []
  try { events = JSON.parse(await fs.readFile(eventsPath, 'utf8')) } catch {}
  events.push({ receivedAt: new Date().toISOString(), payload })
  await fs.writeFile(eventsPath, JSON.stringify(events.slice(-1000), null, 2), 'utf8')

  return NextResponse.json({ accepted: true })
}
