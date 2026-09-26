import { Global, Injectable, Module, PreconditionFailedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, type Auth } from 'googleapis';
import { CryptoService } from '../../common/crypto.service';
import { PrismaService } from '../../common/prisma.service';

/** Portées demandées en une seule fois lors de la connexion Google. */
export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/drive.file',
];

/**
 * Fournit un client OAuth2 Google authentifié pour l'utilisateur,
 * avec rafraîchissement automatique et persistance chiffrée des jetons.
 */
@Injectable()
export class GoogleClientService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  get configured(): boolean {
    return !!this.config.get('GOOGLE_CLIENT_ID') && !!this.config.get('GOOGLE_CLIENT_SECRET');
  }

  createOAuthClient(): Auth.OAuth2Client {
    return new google.auth.OAuth2(
      this.config.get('GOOGLE_CLIENT_ID'),
      this.config.get('GOOGLE_CLIENT_SECRET'),
      this.config.get('GOOGLE_REDIRECT_URI'),
    );
  }

  async forUser(userId: string): Promise<Auth.OAuth2Client> {
    const integ = await this.prisma.integration.findUnique({
      where: { userId_provider: { userId, provider: 'GOOGLE' } },
    });
    if (!integ?.refreshTokenEnc) {
      throw new PreconditionFailedException('Compte Google non connecté');
    }
    const client = this.createOAuthClient();
    client.setCredentials({
      access_token: integ.accessTokenEnc ? this.crypto.decrypt(integ.accessTokenEnc) : undefined,
      refresh_token: this.crypto.decrypt(integ.refreshTokenEnc),
      expiry_date: integ.expiresAt?.getTime(),
    });
    client.on('tokens', (tokens) => {
      void this.prisma.integration.update({
        where: { id: integ.id },
        data: {
          accessTokenEnc: tokens.access_token ? this.crypto.encrypt(tokens.access_token) : undefined,
          refreshTokenEnc: tokens.refresh_token ? this.crypto.encrypt(tokens.refresh_token) : undefined,
          expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        },
      });
    });
    return client;
  }

  async syncState(userId: string): Promise<Record<string, string>> {
    const integ = await this.prisma.integration.findUnique({
      where: { userId_provider: { userId, provider: 'GOOGLE' } },
      select: { syncState: true },
    });
    return (integ?.syncState as Record<string, string>) ?? {};
  }

  async saveSyncState(userId: string, patch: Record<string, string | null>): Promise<void> {
    const current = await this.syncState(userId);
    await this.prisma.integration.update({
      where: { userId_provider: { userId, provider: 'GOOGLE' } },
      data: { syncState: { ...current, ...patch }, lastSyncAt: new Date() },
    });
  }
}

@Global()
@Module({ providers: [GoogleClientService], exports: [GoogleClientService] })
export class GoogleModule {}
