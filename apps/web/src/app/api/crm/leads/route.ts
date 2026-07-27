import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

const leadsPath = path.join(process.cwd(), '.runtime', 'leads.json')
export async function GET() {
  try { return NextResponse.json({ leads: JSON.parse(await fs.readFile(leadsPath, 'utf8')) }) }
  catch { return NextResponse.json({ leads: [] }) }
}
