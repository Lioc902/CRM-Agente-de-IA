const graphVersion = process.env.META_GRAPH_API_VERSION ?? 'v25.0'
const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN
const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID

export const isMetaWhatsAppConfigured = () => Boolean(accessToken && phoneNumberId)

export async function getMetaWhatsAppStatus() {
  if (!accessToken || !phoneNumberId) return { configured: false, connected: false, message: 'Credenciais da Meta ainda não configuradas.' }
  try {
    const response = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}?fields=display_phone_number,verified_name`, {
      headers: { authorization: `Bearer ${accessToken}` }, cache: 'no-store',
    })
    const data = await response.json().catch(() => null)
    if (!response.ok) return { configured: true, connected: false, message: data?.error?.message ?? 'A Meta recusou a verificação da conexão.' }
    return { configured: true, connected: true, phone: data?.display_phone_number ?? null, name: data?.verified_name ?? null, message: 'Canal oficial da Meta conectado e verificado.' }
  } catch { return { configured: true, connected: false, message: 'Não foi possível verificar a conexão com a Meta.' } }
}

export async function subscribeMetaWhatsAppWebhook() {
  if (!accessToken || !phoneNumberId) throw new Error('META_WHATSAPP_NOT_CONFIGURED')

  const accountResponse = await fetch(`https://graph.facebook.com/${graphVersion}/me/whatsapp_business_accounts?fields=id,phone_numbers.limit(100){id}`, {
    headers: { authorization: `Bearer ${accessToken}` }, cache: 'no-store',
  })
  const accountData = await accountResponse.json().catch(() => null)
  const account = accountData?.data?.find((item: { phone_numbers?: { data?: Array<{ id?: string }> } }) => item.phone_numbers?.data?.some((phone) => phone.id === phoneNumberId))
  const wabaId = account?.id
  if (!accountResponse.ok || !wabaId) throw new Error(accountData?.error?.message ?? 'O token não encontrou a conta do WhatsApp Business deste número.')

  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${wabaId}/subscribed_apps`, {
    method: 'POST', headers: { authorization: `Bearer ${accessToken}` }, cache: 'no-store',
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.success) throw new Error(data?.error?.message ?? 'A Meta recusou a assinatura de eventos.')
  return { subscribed: true, message: 'Recebimento de mensagens ativado na Meta.' }
}

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
