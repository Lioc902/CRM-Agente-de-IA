import { Injectable } from '@nestjs/common'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

@Injectable()
export class CryptoService {
  private key() {
    const source = process.env.ENCRYPTION_KEY ?? process.env.JWT_SECRET ?? 'development-only-key'
    return createHash('sha256').update(source).digest()
  }
  encrypt(value: unknown) {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv)
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()])
    return { version: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: encrypted.toString('base64') }
  }
  decrypt<T>(payload: any): T {
    const decipher = createDecipheriv('aes-256-gcm', this.key(), Buffer.from(payload.iv, 'base64'))
    decipher.setAuthTag(Buffer.from(payload.tag, 'base64'))
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(payload.data, 'base64')), decipher.final()]).toString()) as T
  }
}
