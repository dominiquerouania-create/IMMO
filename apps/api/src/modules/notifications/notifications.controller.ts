import { Body, Controller, ForbiddenException, Get, Headers, HttpCode, Module, Post, Query, Req, type RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { CurrentUser, Public, type AuthUser } from '../../common/auth.guard';
import { NotificationsService } from './notifications.service';
import { WhatsAppProvider } from './whatsapp.provider';

interface WhatsAppWebhook {
  entry?: Array<{ changes?: Array<{ value?: { messages?: Array<{ from: string; text?: { body: string } }> } }> }>;
}

@Controller()
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  @Get('notifications')
  list(@CurrentUser() user: AuthUser) {
    return this.notifications.inbox(user.id);
  }

  @Post('notifications/replan')
  async replan() {
    await this.notifications.planAll();
    return { ok: true };
  }

  /** Vérification du webhook par Meta. */
  @Public()
  @Get('webhooks/whatsapp')
  verify(@Query('hub.mode') mode: string, @Query('hub.verify_token') token: string, @Query('hub.challenge') challenge: string) {
    const expected = this.config.get<string>('WHATSAPP_VERIFY_TOKEN');
    if (mode === 'subscribe' && expected && token === expected) return challenge;
    throw new ForbiddenException();
  }

  @Public()
  @Post('webhooks/whatsapp')
  @HttpCode(200)
  async receive(@Body() body: WhatsAppWebhook, @Req() req: RawBodyRequest<Request>, @Headers('x-hub-signature-256') signature?: string) {
    // Authentifie l'appel Meta : HMAC-SHA256 du corps brut avec le secret de l'application.
    const secret = this.config.get<string>('WHATSAPP_APP_SECRET');
    if (!secret || !signature || !req.rawBody) throw new ForbiddenException();
    const expected = Buffer.from(`sha256=${createHmac('sha256', secret).update(req.rawBody).digest('hex')}`);
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) throw new ForbiddenException();
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        for (const msg of change.value?.messages ?? []) {
          if (msg.text?.body) await this.notifications.handleReply(msg.from, msg.text.body);
        }
      }
    }
    return { ok: true };
  }
}

@Module({ controllers: [NotificationsController], providers: [NotificationsService, WhatsAppProvider], exports: [NotificationsService] })
export class NotificationsModule {}
