import { NextResponse } from 'next/server'

const baseUrl = process.env.EVOLUTION_API_URL ?? 'http://127.0.0.1:8080'
const apiKey = process.env.EVOLUTION_API_KEY
const instanceName = process.env.EVOLUTION_INSTANCE_NAME ?? 'nexo-teste'

export async function POST() {
  if (!apiKey) {
    return NextResponse.json({ message: 'Evolution API não configurada' }, { status: 503 })
  }

  try {
    const stateResponse = await fetch(`${baseUrl}/instance/connectionState/${instanceName}`, {
      headers: { apikey: apiKey },
      cache: 'no-store',
    })
    const stateData = await stateResponse.json()
    if (stateData?.instance?.state === 'open') {
      return NextResponse.json({ state: 'open' })
    }

    const response = await fetch(`${baseUrl}/instance/connect/${instanceName}`, {
      headers: { apikey: apiKey },
      cache: 'no-store',
    })
    const data = await response.json()
    if (!response.ok || !data?.base64) {
      return NextResponse.json({ message: data?.message ?? 'Não foi possível gerar um novo QR Code' }, { status: response.status || 502 })
    }

    return NextResponse.json({
      state: 'connecting',
      qrCode: data.base64,
      count: data.count,
    })
  } catch {
    return NextResponse.json({ message: 'O serviço do WhatsApp está desligado' }, { status: 503 })
  }
}
