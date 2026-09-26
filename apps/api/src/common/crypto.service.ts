import { Global, Injectable, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Chiffrement AES-256-GCM des secrets stockés en base (jetons OAuth).
 * Format : base64(iv[12] | tag[16] | ciphertext).
 */
@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const raw = config.get<string>('ENCRYPTION_KEY');
    // En dev sans clé : dérivée du JWT_SECRET (refusé en production par le bootstrap).
    this.key = raw
      ? Buffer.from(raw, 'base64')
      : createHash('sha256').update(config.getOrThrow<string>('JWT_SECRET')).digest();
    if (this.key.length !== 32) throw new Error('ENCRYPTION_KEY doit faire 32 octets (base64)');
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64');
  }

  decrypt(payload: string): string {
    const buf = Buffer.from(payload, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', this.key, buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8');
  }

  hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  token(bytes = 48): string {
    return randomBytes(bytes).toString('base64url');
  }
}

@Global()
@Module({ providers: [CryptoService], exports: [CryptoService] })
export class CryptoModule {}
