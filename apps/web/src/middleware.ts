import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const publicPaths = ['/login', '/cadastro', '/recuperar-senha', '/redefinir-senha', '/auth/callback', '/politica-de-privacidade']
const publicApiPaths = ['/api/meta/whatsapp/webhook', '/api/whatsapp/webhook']

function isPublic(request: NextRequest) {
  const path = request.nextUrl.pathname
  return publicPaths.some((item) => path === item || path.startsWith(`${item}/`)) || publicApiPaths.some((item) => path === item || path.startsWith(`${item}/`))
}

export async function middleware(request: NextRequest) {
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
  if (!configured) {
    if (process.env.NODE_ENV === 'production') return new NextResponse('Configuração de autenticação ausente.', { status: 503 })
    return NextResponse.next({ request })
  }
  let response = NextResponse.next({ request })
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll() { return request.cookies.getAll() },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value))
      },
    },
  })
  const { data } = await supabase.auth.getClaims()
  if (data?.claims || isPublic(request)) return response
  if (request.nextUrl.pathname.startsWith('/api/')) return NextResponse.json({ message: 'Autenticação necessária.' }, { status: 401 })
  const url = request.nextUrl.clone()
  url.pathname = '/login'
  url.searchParams.set('next', request.nextUrl.pathname)
  return NextResponse.redirect(url)
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'] }
