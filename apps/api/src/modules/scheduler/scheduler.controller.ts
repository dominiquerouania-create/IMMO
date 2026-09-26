import { Body, Controller, Get, Headers, HttpCode, Post, Query } from '@nestjs/common';
import { findFreeSlots } from '@kairos/core';
import { randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { CurrentUser, Public, type AuthUser } from '../../common/auth.guard';
import { toCoreEvent } from '../../common/mappers';
import { PrismaService } from '../../common/prisma.service';
import { ZodPipe } from '../../common/zod.pipe';
import { CalendarService } from '../calendar/calendar.service';
import { SchedulerService } from './scheduler.service';

const eventSchema = z.object({
  title: z.string().min(1).max(300),
  start: z.string().datetime(),
  end: z.string().datetime(),
  location: z.string().max(300).optional(),
  description: z.string().max(5000).optional(),
});

@Controller()
export class SchedulerController {
  constructor(
    private readonly scheduler: SchedulerService,
    private readonly calendar: CalendarService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('schedule/replan')
  replan(@CurrentUser() user: AuthUser) {
    return this.scheduler.replan(user.id, 'demande manuelle');
  }

  @Get('schedule/preview')
  preview(@CurrentUser() user: AuthUser) {
    return this.scheduler.preview(user.id);
  }

  @Get('calendar/events')
  events(@CurrentUser() user: AuthUser, @Query('from') from: string, @Query('to') to: string) {
    const f = from ? new Date(from) : new Date();
    const t = to ? new Date(to) : new Date(f.getTime() + 7 * 86_400_000);
    return this.calendar.list(user.id, f, t);
  }

  @Post('calendar/events')
  async createEvent(@CurrentUser() user: AuthUser, @Body(new ZodPipe(eventSchema)) body: z.infer<typeof eventSchema>) {
    const ev = await this.calendar.createEvent(user.id, body);
    this.scheduler.requestReplan(user.id, 'nouvel évènement');
    return ev;
  }

  @Get('calendar/free-slots')
  async freeSlots(@CurrentUser() user: AuthUser, @Query('duration') duration = '60') {
    const settings = await this.scheduler.settingsFor(user.id);
    const events = await this.prisma.calendarEvent.findMany({ where: { userId: user.id, deletedAt: null, end: { gt: new Date() } } });
    return findFreeSlots(events.map(toCoreEvent), new Date(), Number(duration), settings, 10);
  }

  @Post('calendar/sync')
  async sync(@CurrentUser() user: AuthUser) {
    const changed = await this.calendar.pull(user.id);
    if (changed) this.scheduler.requestReplan(user.id, 'synchro agenda');
    return { changed };
  }

  /** Webhook Google Calendar (push notifications). */
  @Public()
  @Post('webhooks/google/calendar')
  @HttpCode(200)
  async googleWebhook(@Headers('x-goog-channel-token') token: string, @Headers('x-goog-resource-state') state: string) {
    if (!token || state === 'sync') return;
    // Le jeton de canal est un secret aléatoire enregistré lors du watch().
    const integ = await this.prisma.integration.findFirst({
      where: { provider: 'GOOGLE', syncState: { path: ['calendarChannelToken'], equals: token } },
      select: { userId: true },
    });
    if (!integ) return;
    const changed = await this.calendar.pull(integ.userId);
    if (changed) this.scheduler.requestReplan(integ.userId, 'webhook agenda');
  }

  /** Active les notifications push Google Calendar (nécessite une URL publique HTTPS). */
  @Post('calendar/watch')
  watch(@CurrentUser() user: AuthUser) {
    const base = process.env.API_URL ?? 'http://localhost:4000';
    return this.calendar.watch(user.id, `${base}/api/webhooks/google/calendar`, randomUUID(), randomBytes(24).toString('hex'));
  }
}
