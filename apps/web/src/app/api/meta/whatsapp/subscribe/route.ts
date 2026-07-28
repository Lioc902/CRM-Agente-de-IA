import { NextResponse } from 'next/server'
import { subscribeMetaWhatsAppWebhook } from '../../../../../lib/whatsapp/meta'

export const runtime = 'nodejs'

export async function POST() {
  try {
    return NextResponse.json(await subscribeMetaWhatsAppWebhook())
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível ativar o recebimento da Meta.'
    return NextResponse.json({ subscribed: false, message }, { status: 502 })
  }
}
