import { NextRequest, NextResponse } from 'next/server'

const baseUrl = process.env.EVOLUTION_API_URL ?? 'http://127.0.0.1:8080'
const apiKey = process.env.EVOLUTION_API_KEY
const instanceName = process.env.EVOLUTION_INSTANCE_NAME ?? 'nexo-teste'

export async function POST(request: NextRequest) {
  if (!apiKey) return NextResponse.json({ message: 'WhatsApp não configurado' }, { status: 503 })
  const form = await request.formData()
  const file = form.get('file')
  const number = String(form.get('number') ?? '').replace(/\D/g, '')
  const caption = String(form.get('caption') ?? '')
  const requestedKind = String(form.get('kind') ?? '')
  if (!(file instanceof File) || number.length < 10) return NextResponse.json({ message: 'Arquivo ou telefone inválido' }, { status: 400 })
  if (file.size > 15 * 1024 * 1024) return NextResponse.json({ message: 'O arquivo deve ter no máximo 15 MB' }, { status: 400 })
  const rawBase64 = Buffer.from(await file.arrayBuffer()).toString('base64')
  const isAudio = file.type.startsWith('audio/')
  const isSticker = requestedKind === 'sticker'
  const mediatype = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'document'
  const endpoint = isSticker ? 'sendSticker' : isAudio ? 'sendWhatsAppAudio' : 'sendMedia'
  const body = isSticker
    ? { number, sticker: rawBase64 }
    : isAudio
    ? { number, audio: rawBase64, encoding: true }
    : { number, mediatype, mimetype: file.type, media: rawBase64, fileName: file.name, caption }
  try {
    const response = await fetch(`${baseUrl}/message/${endpoint}/${instanceName}`, {
      method: 'POST', headers: { apikey: apiKey, 'content-type': 'application/json' }, body: JSON.stringify(body),
    })
    const data = await response.json()
    if (!response.ok) return NextResponse.json({ message: data?.response?.message?.[0] ?? data?.message ?? 'Falha ao enviar arquivo' }, { status: response.status })
    return NextResponse.json({ id: data?.key?.id, status: data?.status })
  } catch {
    return NextResponse.json({ message: 'Evolution API indisponível' }, { status: 503 })
  }
}
