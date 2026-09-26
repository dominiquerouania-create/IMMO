import { describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { CryptoService } from '../src/common/crypto.service';

describe('CryptoService', () => {
  const crypto = new CryptoService(new ConfigService({ JWT_SECRET: 'x'.repeat(40) }));

  it('chiffre et déchiffre (AES-256-GCM)', () => {
    const enc = crypto.encrypt('ya29.secret-token');
    expect(enc).not.toContain('secret');
    expect(crypto.decrypt(enc)).toBe('ya29.secret-token');
  });

  it('refuse un message altéré', () => {
    const enc = Buffer.from(crypto.encrypt('abc'), 'base64');
    enc[enc.length - 1] ^= 1;
    expect(() => crypto.decrypt(enc.toString('base64'))).toThrow();
  });
});
