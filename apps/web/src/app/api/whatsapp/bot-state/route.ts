import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

const statePath = path.join(process.cwd(), '.runtime', 'automation-state.json')
type ContactAutomationState={paused:boolean;reason?:string;updatedAt:string;reactivatedManually?:boolean;[key:string]:unknown}
async function readState(): Promise<Record<string, ContactAutomationState>> {
  try { return JSON.parse(await fs.readFile(statePath, 'utf8')) } catch { return {} }
}

export async function GET(request: NextRequest) {
  const number = String(request.nextUrl.searchParams.get('number') ?? '').replace(/\D/g, '')
  const state = await readState()
  return NextResponse.json({ number, ...state[number], paused: Boolean(state[number]?.paused) })
}

export async function PATCH(request: NextRequest) {
  const body = await request.json()
  const number = String(body.number ?? '').replace(/\D/g, '')
  if (!number) return NextResponse.json({ message: 'Contato inválido' }, { status: 400 })
  const state = await readState()
  state[number] = body.paused
    ? { ...state[number], paused:true, reactivatedManually:false, reason:String(body.reason ?? 'Atendimento humano'), updatedAt:new Date().toISOString() }
    : { paused:false, reactivatedManually:true, reason:String(body.reason ?? 'Reativado manualmente'), updatedAt:new Date().toISOString() }
  await fs.mkdir(path.dirname(statePath), { recursive: true })
  await fs.writeFile(statePath, JSON.stringify(state, null, 2), 'utf8')
  return NextResponse.json({ number, ...state[number] })
}
