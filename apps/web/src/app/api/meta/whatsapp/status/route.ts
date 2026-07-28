import { NextResponse } from 'next/server'
import { isMetaWhatsAppConfigured } from '../../../../../lib/whatsapp/meta'

export const runtime = 'nodejs'

export async function GET() {
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID
  return NextResponse.json({ provider: 'meta', connected: isMetaWhatsAppConfigured(), phoneNumberId: phoneNumberId ? `…${phoneNumberId.slice(-4)}` : null })
}
