import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

const leadsPath = path.join(process.cwd(), '.runtime', 'leads.json')
export async function GET() {
  try { return NextResponse.json({ leads: JSON.parse(await fs.readFile(leadsPath, 'utf8')) }) }
  catch { return NextResponse.json({ leads: [] }) }
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ message: 'Lead não informado.' }, { status: 400 })
  let leads: any[] = []
  try { leads = JSON.parse(await fs.readFile(leadsPath, 'utf8')) } catch { return NextResponse.json({ message: 'Nenhum lead encontrado.' }, { status: 404 }) }
  const next = leads.filter(lead => String(lead.id) !== id)
  if (next.length === leads.length) return NextResponse.json({ message: 'Lead não encontrado.' }, { status: 404 })
  await fs.writeFile(leadsPath, JSON.stringify(next, null, 2), 'utf8')
  return NextResponse.json({ ok: true })
}
