import { NextResponse } from 'next/server'
import { getMetaTokenFingerprint, getMetaWhatsAppStatus } from '../../../../../lib/whatsapp/meta'

export const runtime = 'nodejs'

export async function GET() {
  const status = await getMetaWhatsAppStatus()
  return NextResponse.json({ provider: 'meta', ...status, tokenFingerprint: getMetaTokenFingerprint() }, { status: status.connected || !status.configured ? 200 : 502 })
}
