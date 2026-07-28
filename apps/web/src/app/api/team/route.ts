import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'
import { createAdminClient } from '../../../lib/supabase/admin'

const roles = { Administrador: 'admin', Supervisor: 'supervisor', Atendente: 'agent' } as const
type DbRole = (typeof roles)[keyof typeof roles]
const labelForRole = (role: string) => Object.entries(roles).find(([, value]) => value === role)?.[0] ?? 'Atendente'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { error: NextResponse.json({ message: 'Autenticacao necessaria.' }, { status: 401 }) }
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return { error: NextResponse.json({ message: 'Apenas administradores podem gerenciar a equipe.' }, { status: 403 }) }
  return { admin, user }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ message: 'Autenticacao necessaria.' }, { status: 401 })
  try {
    const admin = createAdminClient()
    const { data, error: queryError } = await admin.from('profiles').select('id, full_name, email, role, created_at').order('created_at', { ascending: true })
    if (queryError) throw queryError
    return NextResponse.json({ members: (data ?? []).map((member) => ({ id: member.id, name: member.full_name || member.email, email: member.email, role: labelForRole(member.role), createdAt: member.created_at })) })
  } catch { return NextResponse.json({ message: 'A equipe ainda nao esta pronta no banco de dados.' }, { status: 503 }) }
}

export async function POST(request: NextRequest) {
  const access = await requireAdmin()
  if ('error' in access) return access.error
  const data = await request.json()
  const name = String(data.name ?? '').trim()
  const email = String(data.email ?? '').trim().toLowerCase()
  const roleLabel = String(data.role ?? 'Atendente') as keyof typeof roles
  const role: DbRole | undefined = roles[roleLabel]
  if (!name || !email.includes('@') || !role) return NextResponse.json({ message: 'Informe nome, e-mail e funcao validos.' }, { status: 400 })

  const redirectTo = new URL('/auth/callback?next=/redefinir-senha', request.nextUrl.origin).toString()
  const { data: invited, error } = await access.admin.auth.admin.inviteUserByEmail(email, { redirectTo, data: { full_name: name } })
  if (error || !invited.user) return NextResponse.json({ message: error?.message ?? 'Nao foi possivel enviar o convite.' }, { status: 400 })

  const { error: profileError } = await access.admin.from('profiles').upsert(
    { id: invited.user.id, email, full_name: name, role },
    { onConflict: 'id' },
  )
  if (profileError) return NextResponse.json({ message: 'Convite enviado, mas a funcao nao foi aplicada.' }, { status: 500 })
  return NextResponse.json({ member: { id: invited.user.id, name, email, role: roleLabel, createdAt: invited.user.created_at } }, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const access = await requireAdmin()
  if ('error' in access) return access.error
  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ message: 'Membro nao informado.' }, { status: 400 })
  if (id === access.user.id) return NextResponse.json({ message: 'O administrador nao pode remover a propria conta.' }, { status: 400 })
  const { error } = await access.admin.auth.admin.deleteUser(id, true)
  if (error) return NextResponse.json({ message: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
