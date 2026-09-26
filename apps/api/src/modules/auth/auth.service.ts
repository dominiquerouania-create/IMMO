import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DEFAULT_AI_ROUTING, DEFAULT_CATEGORIES, DEFAULT_SCHEDULER_SETTINGS } from '@kairos/core';
import { google } from 'googleapis';
import { CryptoService } from '../../common/crypto.service';
import { PrismaService } from '../../common/prisma.service';
import { GOOGLE_SCOPES, GoogleClientService } from '../google/google-client.service';

const REFRESH_TTL_DAYS = 30;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly crypto: CryptoService,
    private readonly google: GoogleClientService,
  ) {}

  googleAuthUrl(state: string): string {
    return this.google.createOAuthClient().generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: GOOGLE_SCOPES,
      include_granted_scopes: true,
      state,
    });
  }

  /** Échange le code OAuth, vérifie que c'est bien le propriétaire, crée la session. */
  async handleGoogleCallback(code: string, meta: { ip?: string; userAgent?: string }) {
    const client = this.google.createOAuthClient();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);
    const { data: profile } = await google.oauth2({ version: 'v2', auth: client }).userinfo.get();

    const owner = this.config.getOrThrow<string>('OWNER_EMAIL').toLowerCase();
    if (!profile.email || profile.email.toLowerCase() !== owner || !profile.verified_email) {
      throw new ForbiddenException('Ce compte Google n’est pas autorisé sur cette instance Kairos.');
    }

    const user = await this.prisma.user.upsert({
      where: { email: owner },
      update: { name: profile.name, avatarUrl: profile.picture },
      create: { email: owner, name: profile.name, avatarUrl: profile.picture },
    });
    await this.bootstrapUser(user.id);

    await this.prisma.integration.upsert({
      where: { userId_provider: { userId: user.id, provider: 'GOOGLE' } },
      update: {
        accessTokenEnc: tokens.access_token ? this.crypto.encrypt(tokens.access_token) : undefined,
        refreshTokenEnc: tokens.refresh_token ? this.crypto.encrypt(tokens.refresh_token) : undefined,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        scopes: tokens.scope?.split(' ') ?? GOOGLE_SCOPES,
        accountEmail: profile.email,
        status: 'ACTIVE',
      },
      create: {
        userId: user.id,
        provider: 'GOOGLE',
        accountEmail: profile.email,
        scopes: tokens.scope?.split(' ') ?? GOOGLE_SCOPES,
        accessTokenEnc: tokens.access_token ? this.crypto.encrypt(tokens.access_token) : null,
        refreshTokenEnc: tokens.refresh_token ? this.crypto.encrypt(tokens.refresh_token) : null,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      },
    });

    return this.issueSession(user.id, user.email, meta);
  }

  async issueSession(userId: string, email: string, meta: { ip?: string; userAgent?: string }) {
    const refreshToken = this.crypto.token();
    await this.prisma.session.create({
      data: {
        userId,
        refreshHash: this.crypto.hash(refreshToken),
        ip: meta.ip,
        userAgent: meta.userAgent,
        expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * 86_400_000),
      },
    });
    const accessToken = await this.jwt.signAsync({ sub: userId, email }, { expiresIn: '15m' });
    return { accessToken, refreshToken };
  }

  /** Rotation du refresh token (un jeton réutilisé révoque la session). */
  async refresh(refreshToken: string, meta: { ip?: string; userAgent?: string }) {
    const session = await this.prisma.session.findUnique({
      where: { refreshHash: this.crypto.hash(refreshToken) },
      include: { user: true },
    });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      if (session && session.revokedAt) {
        await this.prisma.session.updateMany({ where: { userId: session.userId }, data: { revokedAt: new Date() } });
      }
      throw new UnauthorizedException();
    }
    await this.prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    return this.issueSession(session.userId, session.user.email, meta);
  }

  async logout(refreshToken: string | undefined) {
    if (!refreshToken) return;
    await this.prisma.session.updateMany({
      where: { refreshHash: this.crypto.hash(refreshToken) },
      data: { revokedAt: new Date() },
    });
  }

  /** Premier démarrage : paramètres, catégories, routage IA, widgets. Idempotent. */
  async bootstrapUser(userId: string) {
    await this.prisma.userSettings.upsert({
      where: { userId },
      update: {},
      create: { userId, workingHours: DEFAULT_SCHEDULER_SETTINGS.workingHours as object },
    });
    for (const [position, c] of DEFAULT_CATEGORIES.entries()) {
      await this.prisma.category.upsert({
        where: { userId_slug: { userId, slug: c.id } },
        update: {},
        create: { userId, slug: c.id, name: c.name, color: c.color, icon: c.icon, weight: c.weight, subcategories: c.subcategories, isSystem: true, position },
      });
    }
    for (const r of DEFAULT_AI_ROUTING) {
      await this.prisma.aiRoutingRule.upsert({
        where: { userId_capability: { userId, capability: r.capability } },
        update: {},
        create: { userId, capability: r.capability, provider: r.provider, fallbacks: r.fallbacks },
      });
    }
  }
}
