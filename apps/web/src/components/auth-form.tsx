'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { createClient } from '../lib/supabase/client'

type Mode = 'login' | 'signup' | 'recovery' | 'update'
const copy = {
  login: { title: 'Entrar na ASAX', description: 'Use seu e-mail e senha para acessar o CRM.', button: 'Entrar' },
  signup: { title: 'Criar acesso', description: 'Um e-mail de confirmação será enviado para você.', button: 'Criar conta' },
  recovery: { title: 'Recuperar senha', description: 'Enviaremos um link seguro para redefinir sua senha.', button: 'Enviar link' },
  update: { title: 'Definir nova senha', description: 'Escolha uma senha forte para sua conta ASAX.', button: 'Salvar nova senha' },
} as const

export function AuthForm({ mode, next = '/' }: { mode: Mode; next?: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const content = copy[mode]
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(''); const supabase = createClient()
    if (mode === 'login') { const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) setMessage('Não foi possível entrar. Confira o e-mail e a senha.'); else window.location.assign(next.startsWith('/') ? next : '/') }
    if (mode === 'signup') { const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } }); setMessage(error ? 'Não foi possível criar a conta. Use uma senha mais forte ou tente outro e-mail.' : 'Conta criada. Confira seu e-mail para confirmar o acesso.') }
    if (mode === 'recovery') { const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback?next=/redefinir-senha` }); setMessage(error ? 'Não foi possível enviar o e-mail agora.' : 'Se o e-mail estiver cadastrado, o link seguro foi enviado.') }
    if (mode === 'update') { const { error } = await supabase.auth.updateUser({ password }); if (error) setMessage('Não foi possível atualizar a senha. Abra novamente o link recebido por e-mail.'); else window.location.assign('/') }
    setBusy(false)
  }
  return <form className="asax-auth-form" onSubmit={submit}><header><small>ACESSO PROTEGIDO</small><h2>{content.title}</h2><p>{content.description}</p></header>{mode !== 'update' && <label>E-mail<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>}{mode !== 'recovery' && <label>Senha<input required minLength={8} type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} /></label>}<button disabled={busy} type="submit">{busy ? 'Aguarde…' : content.button}</button>{message && <p className="asax-auth-message" role="status">{message}</p>}{mode === 'login' && <footer><Link href="/recuperar-senha">Esqueci minha senha</Link><Link href="/cadastro">Criar uma conta</Link></footer>}{mode === 'signup' && <footer><Link href="/login">Já tenho acesso</Link></footer>}{mode === 'recovery' && <footer><Link href="/login">Voltar ao acesso</Link></footer>}</form>
}
