import { Controller, Get, NotFoundException, Post, Query, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import { CryptoService } from '../../common/crypto.service';
import { CurrentUser, Public, type AuthUser } from '../../common/auth.guard';
import { PrismaService } from '../../common/prisma.service';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
    private readonly crypto: CryptoService,
    private readonly prisma: PrismaService,
  ) {}

  private cookie(maxAgeMs: number, path = '/'): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      path,
      maxAge: maxAgeMs,
    };
  }

  private setSession(res: Response, s: { accessToken: string; refreshToken: string }) {
    res.cookie('kairos_at', s.accessToken, this.cookie(15 * 60_000));
    res.cookie('kairos_rt', s.refreshToken, this.cookie(30 * 86_400_000, '/api/auth'));
  }

  @Public()
  @Get('google')
  start(@Res() res: Response) {
    const state = this.crypto.token(16);
    res.cookie('kairos_oauth_state', state, this.cookie(10 * 60_000, '/api/auth'));
    res.redirect(this.auth.googleAuthUrl(state));
  }

  @Public()
  @Get('google/callback')
  async callback(@Query('code') code: string, @Query('state') state: string, @Req() req: Request, @Res() res: Response) {
    if (!state || state !== req.cookies?.kairos_oauth_state) throw new UnauthorizedException('État OAuth invalide');
    const session = await this.auth.handleGoogleCallback(code, { ip: req.ip, userAgent: req.headers['user-agent'] });
    res.clearCookie('kairos_oauth_state', { path: '/api/auth' });
    this.setSession(res, session);
    res.redirect(this.config.getOrThrow('APP_URL'));
  }

  /** Développement uniquement : ouvre une session pour OWNER_EMAIL sans passer par Google. */
  @Public()
  @Post('dev-login')
  async devLogin(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (this.config.get('NODE_ENV') === 'production' || this.config.get('ALLOW_DEV_LOGIN') !== 'true') throw new NotFoundException();
    const email = this.config.getOrThrow<string>('OWNER_EMAIL').toLowerCase();
    const user = await this.prisma.user.upsert({ where: { email }, update: {}, create: { email, name: 'Développeur' } });
    await this.auth.bootstrapUser(user.id);
    const session = await this.auth.issueSession(user.id, email, { ip: req.ip, userAgent: req.headers['user-agent'] });
    this.setSession(res, session);
    return { accessToken: session.accessToken };
  }

  @Public()
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.kairos_rt;
    if (!token) throw new UnauthorizedException();
    const session = await this.auth.refresh(token, { ip: req.ip, userAgent: req.headers['user-agent'] });
    this.setSession(res, session);
    return { accessToken: session.accessToken };
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.kairos_rt);
    res.clearCookie('kairos_at').clearCookie('kairos_rt', { path: '/api/auth' });
    return { ok: true };
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.prisma.user.findUnique({
      where: { id: user.id },
      include: { settings: true, integrations: { select: { provider: true, status: true, accountEmail: true, lastSyncAt: true } } },
    });
  }
}
