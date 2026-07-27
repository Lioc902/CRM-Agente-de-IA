import { NextRequest, NextResponse } from 'next/server'

const baseUrl = process.env.EVOLUTION_API_URL ?? 'http://127.0.0.1:8080'
const apiKey = process.env.EVOLUTION_API_KEY
const instanceName = process.env.EVOLUTION_INSTANCE_NAME ?? 'nexo-teste'

export async function GET(request: NextRequest) {
  if (!apiKey) return NextResponse.json({ message: 'WhatsApp não configurado' }, { status: 503 })
  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ message: 'Mensagem inválida' }, { status: 400 })
  try {
    const messageResponse = await fetch(`${baseUrl}/chat/findMessages/${instanceName}`, {
      method: 'POST',
      headers: { apikey: apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({ where: { key: { id } }, page: 1, offset: 1 }),
      cache: 'no-store',
    })
    const messageData = await messageResponse.json()
    const record = messageData?.messages?.records?.[0]
    if (!record) return NextResponse.json({ message: 'Mídia não encontrada' }, { status: 404 })
    const mediaResponse = await fetch(`${baseUrl}/chat/getBase64FromMediaMessage/${instanceName}`, {
      method: 'POST',
      headers: { apikey: apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({ message: { key: record.key, message: record.message } }),
    })
    const media = await mediaResponse.json()
    if (!mediaResponse.ok || !media?.base64) return NextResponse.json({ message: media?.message ?? 'Não foi possível baixar a mídia' }, { status: mediaResponse.status || 502 })
    return NextResponse.json({ dataUrl: `data:${media.mimetype};base64,${media.base64}`, mimetype: media.mimetype, fileName: media.fileName })
  } catch {
    return NextResponse.json({ message: 'Falha ao baixar a mídia' }, { status: 503 })
  }
}
