import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'

type Member = { id: string; name: string; email: string; role: string; createdAt: string }
const teamPath=path.join(process.cwd(),'.runtime','team.json')

async function readMembers():Promise<Member[]> {
  try {
    const data=JSON.parse(await fs.readFile(teamPath,'utf8'))
    return Array.isArray(data)?data:[]
  } catch { return [] }
}

async function writeMembers(members:Member[]) {
  await fs.mkdir(path.dirname(teamPath),{recursive:true})
  await fs.writeFile(teamPath,JSON.stringify(members,null,2),'utf8')
}

export async function GET() {
  return NextResponse.json({members:await readMembers()})
}

export async function POST(request:NextRequest) {
  const data=await request.json()
  const name=String(data.name??'').trim()
  const email=String(data.email??'').trim().toLowerCase()
  const role=String(data.role??'Atendente').trim()
  if(!name||!email||!email.includes('@')) return NextResponse.json({message:'Informe nome e e-mail válidos.'},{status:400})
  const members=await readMembers()
  if(members.some(member=>member.email===email)) return NextResponse.json({message:'Este e-mail já está cadastrado.'},{status:409})
  const member={id:crypto.randomUUID(),name,email,role,createdAt:new Date().toISOString()}
  members.push(member)
  await writeMembers(members)
  return NextResponse.json({member},{status:201})
}

export async function DELETE(request:NextRequest) {
  const id=request.nextUrl.searchParams.get('id')
  if(!id) return NextResponse.json({message:'Membro não informado.'},{status:400})
  const members=await readMembers()
  const next=members.filter(member=>member.id!==id)
  if(next.length===members.length) return NextResponse.json({message:'Membro não encontrado.'},{status:404})
  await writeMembers(next)
  return NextResponse.json({ok:true})
}
