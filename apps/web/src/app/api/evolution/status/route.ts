import { NextResponse } from 'next/server'

const baseUrl = process.env.EVOLUTION_API_URL ?? 'http://127.0.0.1:8080'
const apiKey = process.env.EVOLUTION_API_KEY
const instanceName = process.env.EVOLUTION_INSTANCE_NAME ?? 'nexo-teste'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!apiKey) {
    return NextResponse.json({ state: 'unconfigured', message: 'Evolution API não configurada' }, { status: 503 })
  }

  try {
    const response = await fetch(`${baseUrl}/instance/connectionState/${instanceName}`, {
      headers: { apikey: apiKey },
      cache: 'no-store',
    })
    const data = await response.json()
    if (!response.ok) {
      return NextResponse.json({ state: 'error', message: data?.message ?? 'Não foi possível consultar o WhatsApp' }, { status: response.status })
    }

    return NextResponse.json({
      instanceName,
      state: data?.instance?.state ?? 'close',
    })
  } catch {
    return NextResponse.json({ state: 'offline', message: 'O serviço do WhatsApp está desligado' }, { status: 503 })
  }
}
