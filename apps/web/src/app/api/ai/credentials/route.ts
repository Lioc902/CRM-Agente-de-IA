import { NextRequest, NextResponse } from 'next/server'

import {
  AICredentialProvider,
  createCredential,
  deleteCredential,
  listCredentials,
  testCredential,
} from '../../../../lib/ai-credentials'

export async function GET() {
  let credentials = await listCredentials()
  if (!credentials.length && process.env.GEMINI_API_KEY) {
    await createCredential({ name: 'Gemini principal', provider: 'gemini', apiKey: process.env.GEMINI_API_KEY })
    credentials = await listCredentials()
  }
  return NextResponse.json({ credentials })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const name = String(body.name ?? '').trim()
  const apiKey = String(body.apiKey ?? '').trim()
  const provider = String(body.provider ?? '') as AICredentialProvider
  if (name.length < 2) return NextResponse.json({ message: 'Informe um nome para identificar esta API' }, { status: 400 })
  if (!['gemini', 'openai'].includes(provider)) return NextResponse.json({ message: 'Selecione um provedor válido' }, { status: 400 })
  if (apiKey.length < 12) return NextResponse.json({ message: 'A chave informada parece incompleta' }, { status: 400 })
  const credential = await createCredential({ name, provider, apiKey })
  return NextResponse.json(credential, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const body = await request.json()
  const result = await testCredential(String(body.id ?? ''))
  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id') ?? ''
  const removed = await deleteCredential(id)
  return removed
    ? NextResponse.json({ removed: true })
    : NextResponse.json({ message: 'Credencial não encontrada' }, { status: 404 })
}
