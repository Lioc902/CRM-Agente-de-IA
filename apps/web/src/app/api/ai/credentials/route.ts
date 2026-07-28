import { NextRequest, NextResponse } from 'next/server'
import { AICredentialProvider, createCredential, deleteCredential, listCredentials, testCredential } from '../../../../lib/ai-credentials'

const errorResponse = (error: unknown, fallback: string) => NextResponse.json({ message: error instanceof Error ? error.message : fallback }, { status: 500 })

export async function GET() {
  try {
    let credentials = await listCredentials()
    if (!credentials.length && process.env.GEMINI_API_KEY) {
      await createCredential({ name: 'Gemini principal', provider: 'gemini', apiKey: process.env.GEMINI_API_KEY })
      credentials = await listCredentials()
    }
    return NextResponse.json({ credentials })
  } catch (error) { return errorResponse(error, 'Não foi possível abrir o cofre de credenciais.') }
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ message: 'Dados da credencial inválidos.' }, { status: 400 }) }
  const name = String(body.name ?? '').trim()
  const apiKey = String(body.apiKey ?? '').trim()
  const provider = String(body.provider ?? '') as AICredentialProvider
  const baseUrl = String(body.baseUrl ?? '').trim().replace(/\/+$/, '')
  const model = String(body.model ?? '').trim()
  if (name.length < 2) return NextResponse.json({ message: 'Informe um nome para identificar esta API.' }, { status: 400 })
  if (!['gemini', 'openai', 'custom'].includes(provider)) return NextResponse.json({ message: 'Selecione um provedor válido.' }, { status: 400 })
  if (apiKey.length < 12) return NextResponse.json({ message: 'A chave informada parece incompleta.' }, { status: 400 })
  if (provider === 'custom') {
    try { const parsed = new URL(baseUrl); if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error() }
    catch { return NextResponse.json({ message: 'Informe um endereço de API válido, começando com http:// ou https://.' }, { status: 400 }) }
    if (!model) return NextResponse.json({ message: 'Informe o modelo usado por esta API.' }, { status: 400 })
  }
  try {
    const credential = await createCredential({ name, provider, apiKey, baseUrl: provider === 'custom' ? baseUrl : undefined, model: provider === 'custom' ? model : undefined })
    return NextResponse.json(credential, { status: 201 })
  } catch (error) { return errorResponse(error, 'Não foi possível salvar a credencial.') }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const result = await testCredential(String(body.id ?? ''))
    return NextResponse.json(result, { status: result.ok ? 200 : 400 })
  } catch (error) { return errorResponse(error, 'Não foi possível testar a credencial.') }
}

export async function DELETE(request: NextRequest) {
  try {
    const removed = await deleteCredential(request.nextUrl.searchParams.get('id') ?? '')
    return removed ? NextResponse.json({ removed: true }) : NextResponse.json({ message: 'Credencial não encontrada.' }, { status: 404 })
  } catch (error) { return errorResponse(error, 'Não foi possível excluir a credencial.') }
}
