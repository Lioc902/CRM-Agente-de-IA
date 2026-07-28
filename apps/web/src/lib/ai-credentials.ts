import 'server-only'

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'
import { createAdminClient } from './supabase/admin'

export type AICredentialProvider = 'gemini' | 'openai' | 'custom'

type StoredCredential = {
  id: string; name: string; provider: AICredentialProvider; baseUrl?: string; model?: string
  encryptedKey: string; iv: string; tag: string; keySuffix: string; createdAt: string; updatedAt: string
}
export type PublicCredential = Omit<StoredCredential, 'encryptedKey' | 'iv' | 'tag'> & { maskedKey: string }

const runtimeDir = path.join(process.cwd(), '.runtime')
const vaultPath = path.join(runtimeDir, 'ai-credentials.json')
const masterKeyPath = path.join(runtimeDir, 'credential-master.key')
const databaseEnabled = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)

function rowToCredential(row: Record<string, string>): StoredCredential {
  return { id:row.id, name:row.name, provider:row.provider as AICredentialProvider, baseUrl:row.base_url||undefined, model:row.model||undefined, encryptedKey:row.encrypted_key, iv:row.iv, tag:row.tag, keySuffix:row.key_suffix, createdAt:row.created_at, updatedAt:row.updated_at }
}
function credentialToRow(item: StoredCredential) {
  return { id:item.id, name:item.name, provider:item.provider, base_url:item.baseUrl??null, model:item.model??null, encrypted_key:item.encryptedKey, iv:item.iv, tag:item.tag, key_suffix:item.keySuffix, created_at:item.createdAt, updated_at:item.updatedAt }
}

async function masterKey() {
  const configuredSecret = process.env.AI_CREDENTIAL_ENCRYPTION_KEY ?? process.env.SUPABASE_SECRET_KEY_ACTIVE ?? process.env.SUPABASE_SECRET_KEY
  if (configuredSecret) return createHash('sha256').update(configuredSecret).digest()
  if (process.env.NODE_ENV === 'production') throw new Error('Chave de criptografia das credenciais não configurada.')
  await fs.mkdir(runtimeDir, { recursive: true })
  try { return Buffer.from((await fs.readFile(masterKeyPath, 'utf8')).trim(), 'hex') }
  catch {
    const generated = randomBytes(32)
    try { await fs.writeFile(masterKeyPath, generated.toString('hex'), { encoding:'utf8', flag:'wx' }); return generated }
    catch { return Buffer.from((await fs.readFile(masterKeyPath, 'utf8')).trim(), 'hex') }
  }
}

async function readVault(): Promise<StoredCredential[]> {
  if (databaseEnabled()) {
    const { data, error } = await createAdminClient().from('ai_credentials').select('*').order('created_at', { ascending:true })
    if (error) throw new Error('Não foi possível acessar o cofre de credenciais.')
    return (data ?? []).map(rowToCredential)
  }
  try { const parsed = JSON.parse(await fs.readFile(vaultPath, 'utf8')); return Array.isArray(parsed) ? parsed : [] } catch { return [] }
}
async function writeVault(credentials: StoredCredential[]) {
  await fs.mkdir(runtimeDir, { recursive:true }); await fs.writeFile(vaultPath, JSON.stringify(credentials, null, 2), 'utf8')
}
function publicView(item: StoredCredential): PublicCredential {
  const { encryptedKey:_key, iv:_iv, tag:_tag, ...safe } = item
  return { ...safe, maskedKey:`••••••••${item.keySuffix}` }
}

export async function listCredentials() { return (await readVault()).map(publicView) }
export async function createCredential(input: { name:string; provider:AICredentialProvider; apiKey:string; baseUrl?:string; model?:string }) {
  const key = await masterKey(); if (key.length !== 32) throw new Error('Chave mestra inválida.')
  const iv=randomBytes(12), cipher=createCipheriv('aes-256-gcm',key,iv), encrypted=Buffer.concat([cipher.update(input.apiKey,'utf8'),cipher.final()]), now=new Date().toISOString()
  const credential:StoredCredential={ id:`credential-${Date.now()}-${randomBytes(3).toString('hex')}`, name:input.name.trim(), provider:input.provider, baseUrl:input.baseUrl?.replace(/\/+$/,''), model:input.model?.trim(), encryptedKey:encrypted.toString('base64'), iv:iv.toString('base64'), tag:cipher.getAuthTag().toString('base64'), keySuffix:input.apiKey.slice(-4), createdAt:now, updatedAt:now }
  if (databaseEnabled()) {
    const { error } = await createAdminClient().from('ai_credentials').insert(credentialToRow(credential))
    if (error) throw new Error('Não foi possível salvar a credencial no cofre.')
  } else { const credentials=await readVault(); credentials.push(credential); await writeVault(credentials) }
  return publicView(credential)
}
export async function deleteCredential(id:string) {
  if (databaseEnabled()) { const { data,error }=await createAdminClient().from('ai_credentials').delete().eq('id',id).select('id'); if(error)throw new Error('Não foi possível excluir a credencial.'); return Boolean(data?.length) }
  const credentials=await readVault(), next=credentials.filter(item=>item.id!==id); if(next.length===credentials.length)return false; await writeVault(next); return true
}
export async function getCredentialSecret(id:string) {
  const credential=(await readVault()).find(item=>item.id===id); if(!credential)return null
  const key=await masterKey(), decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(credential.iv,'base64')); decipher.setAuthTag(Buffer.from(credential.tag,'base64'))
  const apiKey=Buffer.concat([decipher.update(Buffer.from(credential.encryptedKey,'base64')),decipher.final()]).toString('utf8')
  return { id:credential.id,name:credential.name,provider:credential.provider,baseUrl:credential.baseUrl,model:credential.model,apiKey }
}
export async function testCredential(id:string) {
  const credential=await getCredentialSecret(id); if(!credential)return {ok:false,message:'Credencial não encontrada'}
  try {
    const response=credential.provider==='gemini' ? await fetch('https://generativelanguage.googleapis.com/v1beta/models',{headers:{'x-goog-api-key':credential.apiKey},cache:'no-store'}) : await fetch(`${credential.provider==='custom'?credential.baseUrl:'https://api.openai.com/v1'}/models`,{headers:{authorization:`Bearer ${credential.apiKey}`},cache:'no-store'})
    if(!response.ok)return {ok:false,message:response.status===401||response.status===403?'Chave recusada pelo provedor':`Provedor respondeu com erro ${response.status}`}
    return {ok:true,message:'Conexão confirmada'}
  } catch { return {ok:false,message:'Não foi possível acessar o provedor'} }
}
