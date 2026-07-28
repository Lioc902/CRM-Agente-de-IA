const graphVersion = process.env.META_GRAPH_API_VERSION ?? 'v25.0'
const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN
const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID

export const isMetaWhatsAppConfigured = () => Boolean(accessToken && phoneNumberId)

export async function sendMetaWhatsAppText(number: string, text: string) {
  if (!accessToken || !phoneNumberId) throw new Error('META_WHATSAPP_NOT_CONFIGURED')

  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp', recipient_type: 'individual', to: number,
      type: 'text', text: { body: text, preview_url: true },
    }),
    cache: 'no-store',
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const error = new Error(data?.error?.message ?? 'Meta WhatsApp recusou o envio.')
    ;(error as Error & { status?: number }).status = response.status
    throw error
  }
  return { id: data?.messages?.[0]?.id, contactId: data?.contacts?.[0]?.wa_id }
}
