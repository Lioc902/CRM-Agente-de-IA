import { NextRequest, NextResponse } from 'next/server'
import { isMetaWhatsAppConfigured, sendMetaWhatsAppText } from '../../../../lib/whatsapp/meta'
import { saveOutgoingMetaMessage } from '../../../../lib/whatsapp/store'

const baseUrl = process.env.EVOLUTION_API_URL ?? 'http://127.0.0.1:8080'
const apiKey = process.env.EVOLUTION_API_KEY
const instanceName = process.env.EVOLUTION_INSTANCE_NAME ?? 'nexo-teste'

export async function POST(request: NextRequest) {
  const { number, text } = await request.json()
  const normalized = String(number ?? '').replace(/\D/g, '')
  const message = String(text ?? '').trim()
  if (normalized.length < 10 || !message) {
    return NextResponse.json({ message: 'Informe telefone e mensagem validos' }, { status: 400 })
  }

  if (isMetaWhatsAppConfigured()) {
    try {
      const data = await sendMetaWhatsAppText(normalized, message)
      await saveOutgoingMetaMessage({ id: data.id, number: normalized, text: message })
      return NextResponse.json({ ...data, status: 'sent', provider: 'meta' })
    } catch (error) {
      const status = (error as Error & { status?: number }).status ?? 503
      return NextResponse.json({ message: (error as Error).message }, { status })
    }
  }

  if (!apiKey) return NextResponse.json({ message: 'WhatsApp nao configurado' }, { status: 503 })
  try {
    const response = await fetch(`${baseUrl}/message/sendText/${instanceName}`, {
      method: 'POST', headers: { apikey: apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({ number: normalized, text: message, delay: 300, linkPreview: true }),
    })
    const data = await response.json()
    if (!response.ok) return NextResponse.json({ message: data?.response?.message?.[0] ?? data?.message ?? 'Falha ao enviar' }, { status: response.status })
    return NextResponse.json({ id: data?.key?.id, remoteJid: data?.key?.remoteJid, status: data?.status, provider: 'evolution' })
  } catch {
    return NextResponse.json({ message: 'Evolution API indisponivel' }, { status: 503 })
  }
}
