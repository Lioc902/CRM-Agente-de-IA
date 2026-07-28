'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { createClient } from '../lib/supabase/client'

type Mode = 'login' | 'signup' | 'recovery' | 'update'
const copy = {
  login: { title: 'Entrar na ASAX', description: 'Use seu e-mail e senha para acessar o CRM.', button: 'Entrar' },
  signup: { title: 'Acesso por convite', description: 'Sua conta e criada pelo administrador da operacao.', button: 'Voltar ao login' },
  recovery: { title: 'Recuperar senha', description: 'Enviaremos um link seguro para redefinir sua senha.', button: 'Enviar link' },
  update: { title: 'Definir sua senha', description: 'Escolha uma senha forte e exclusiva para sua conta ASAX.', button: 'Salvar senha e entrar' },
} as const

export function AuthForm({ mode, next = '/' }: { mode: Mode; next?: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const content = copy[mode]

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mode === 'signup') { window.location.assign('/login'); return }
    setBusy(true); setMessage('')
    const supabase = createClient()
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMessage('Nao foi possivel entrar. Confira o e-mail e a senha.')
      else window.location.assign(next.startsWith('/') ? next : '/')
    }
    if (mode === 'recovery') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback?next=/redefinir-senha` })
      setMessage(error ? 'Nao foi possivel enviar o e-mail agora.' : 'Se o e-mail estiver cadastrado, o link seguro foi enviado.')
    }
    if (mode === 'update') {
      if (password !== confirmPassword) { setMessage('As senhas precisam ser iguais.'); setBusy(false); return }
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) { setMessage('Este link expirou ou ja foi usado. Peca um novo convite ao administrador.'); setBusy(false); return }
      const { error } = await supabase.auth.updateUser({ password })
      if (error) setMessage('Nao foi possivel atualizar a senha. Abra novamente o link recebido por e-mail.')
      else window.location.assign('/')
    }
    setBusy(false)
  }

  if (mode === 'signup') return <form className="asax-auth-form" onSubmit={submit}><header><small>ACESSO PROTEGIDO</small><h2>{content.title}</h2><p>{content.description}</p></header><button type="submit">{content.button}</button><footer><Link href="/login">Ja tenho acesso</Link></footer></form>

  return <form className="asax-auth-form" onSubmit={submit}><header><small>ACESSO PROTEGIDO</small><h2>{content.title}</h2><p>{content.description}</p></header>{mode !== 'update' && <label>E-mail<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>}{mode !== 'recovery' && <label>Senha<input required minLength={8} type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} /></label>}{mode === 'update' && <label>Confirmar senha<input required minLength={8} type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>}<button disabled={busy} type="submit">{busy ? 'Aguarde...' : content.button}</button>{message && <p className="asax-auth-message" role="status">{message}</p>}{mode === 'login' && <footer><Link href="/recuperar-senha">Esqueci minha senha</Link></footer>}{mode === 'recovery' && <footer><Link href="/login">Voltar ao acesso</Link></footer>}</form>
}
