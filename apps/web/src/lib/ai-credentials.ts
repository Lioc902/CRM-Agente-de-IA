import 'server-only'

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'

export type AICredentialProvider = 'gemini' | 'openai'

type StoredCredential = {
  id: string
  name: string
  provider: AICredentialProvider
  encryptedKey: string
  iv: string
  tag: string
  keySuffix: string
  createdAt: string
  updatedAt: string
}

export type PublicCredential = Omit<StoredCredential, 'encryptedKey' | 'iv' | 'tag'> & {
  maskedKey: string
}

const runtimeDir = path.join(process.cwd(), '.runtime')
const vaultPath = path.join(runtimeDir, 'ai-credentials.json')
const masterKeyPath = path.join(runtimeDir, 'credential-master.key')

async function masterKey() {
  await fs.mkdir(runtimeDir, { recursive: true })
  try {
    const saved = await fs.readFile(masterKeyPath, 'utf8')
    return Buffer.from(saved.trim(), 'hex')
  } catch {
    const generated = randomBytes(32)
    try {
      await fs.writeFile(masterKeyPath, generated.toString('hex'), { encoding: 'utf8', flag: 'wx' })
      return generated
    } catch {
      return Buffer.from((await fs.readFile(masterKeyPath, 'utf8')).trim(), 'hex')
    }
  }
}

async function readVault(): Promise<StoredCredential[]> {
  try {
    const parsed = JSON.parse(await fs.readFile(vaultPath, 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeVault(credentials: StoredCredential[]) {
  await fs.mkdir(runtimeDir, { recursive: true })
  await fs.writeFile(vaultPath, JSON.stringify(credentials, null, 2), 'utf8')
}

function publicView(item: StoredCredential): PublicCredential {
  const { encryptedKey: _encryptedKey, iv: _iv, tag: _tag, ...safe } = item
  return { ...safe, maskedKey: `••••••••${item.keySuffix}` }
}

export async function listCredentials() {
  return (await readVault()).map(publicView)
}

export async function createCredential(input: { name: string; provider: AICredentialProvider; apiKey: string }) {
  const key = await masterKey()
  if (key.length !== 32) throw new Error('Chave mestra local inválida')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(input.apiKey, 'utf8'), cipher.final()])
  const now = new Date().toISOString()
  const credential: StoredCredential = {
    id: `credential-${Date.now()}-${randomBytes(3).toString('hex')}`,
    name: input.name.trim(),
    provider: input.provider,
    encryptedKey: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    keySuffix: input.apiKey.slice(-4),
    createdAt: now,
    updatedAt: now,
  }
  const credentials = await readVault()
  credentials.push(credential)
  await writeVault(credentials)
  return publicView(credential)
}

export async function deleteCredential(id: string) {
  const credentials = await readVault()
  const next = credentials.filter(item => item.id !== id)
  if (next.length === credentials.length) return false
  await writeVault(next)
  return true
}

export async function getCredentialSecret(id: string) {
  const credential = (await readVault()).find(item => item.id === id)
  if (!credential) return null
  const key = await masterKey()
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(credential.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(credential.tag, 'base64'))
  const apiKey = Buffer.concat([
    decipher.update(Buffer.from(credential.encryptedKey, 'base64')),
    decipher.final(),
  ]).toString('utf8')
  return { id: credential.id, name: credential.name, provider: credential.provider, apiKey }
}

export async function testCredential(id: string) {
  const credential = await getCredentialSecret(id)
  if (!credential) return { ok: false, message: 'Credencial não encontrada' }
  try {
    const response = credential.provider === 'gemini'
      ? await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
          headers: { 'x-goog-api-key': credential.apiKey },
          cache: 'no-store',
        })
      : await fetch('https://api.openai.com/v1/models', {
          headers: { authorization: `Bearer ${credential.apiKey}` },
          cache: 'no-store',
        })
    if (!response.ok) return { ok: false, message: response.status === 401 || response.status === 403 ? 'Chave recusada pelo provedor' : `Provedor respondeu com erro ${response.status}` }
    return { ok: true, message: 'Conexão confirmada' }
  } catch {
    return { ok: false, message: 'Não foi possível acessar o provedor' }
  }
}
