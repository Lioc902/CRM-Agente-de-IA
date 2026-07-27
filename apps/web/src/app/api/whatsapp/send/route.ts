import { NextRequest, NextResponse } from 'next/server'

const baseUrl = process.env.EVOLUTION_API_URL ?? 'http://127.0.0.1:8080'
const apiKey = process.env.EVOLUTION_API_KEY
const instanceName = process.env.EVOLUTION_INSTANCE_NAME ?? 'nexo-teste'

export async function POST(request: NextRequest) {
  if (!apiKey) return NextResponse.json({ message: 'WhatsApp não configurado' }, { status: 503 })
  const { number, text } = await request.json()
  const normalized = String(number ?? '').replace(/\D/g, '')
  if (normalized.length < 10 || !String(text ?? '').trim()) {
    return NextResponse.json({ message: 'Informe telefone e mensagem válidos' }, { status: 400 })
  }
  try {
    const response = await fetch(`${baseUrl}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: { apikey: apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({ number: normalized, text: String(text).trim(), delay: 300, linkPreview: true }),
    })
    const data = await response.json()
    if (!response.ok) return NextResponse.json({ message: data?.response?.message?.[0] ?? data?.message ?? 'Falha ao enviar' }, { status: response.status })
    return NextResponse.json({ id: data?.key?.id, remoteJid: data?.key?.remoteJid, status: data?.status })
  } catch {
    return NextResponse.json({ message: 'Evolution API indisponível' }, { status: 503 })
  }
}
