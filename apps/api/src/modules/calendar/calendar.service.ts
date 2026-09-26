import { Injectable, Logger } from '@nestjs/common';
import type { ScheduledBlock } from '@kairos/core';
import { google, type calendar_v3 } from 'googleapis';
import { PrismaService } from '../../common/prisma.service';
import { GoogleClientService } from '../google/google-client.service';

const KAIROS_MARK = 'kairos';

/**
 * Synchronisation bidirectionnelle avec Google Calendar.
 * - Pull incrémental (syncToken) des évènements externes → table CalendarEvent (kind=EVENT).
 * - Push des blocs Kairos (tâches planifiées, concentration) marqués par une propriété privée,
 *   pour ne jamais les ré-importer comme des réunions.
 */
@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly google: GoogleClientService,
  ) {}

  private async api(userId: string) {
    return google.calendar({ version: 'v3', auth: await this.google.forUser(userId) });
  }

  async list(userId: string, from: Date, to: Date) {
    return this.prisma.calendarEvent.findMany({
      where: { userId, deletedAt: null, start: { lt: to }, end: { gt: from } },
      orderBy: { start: 'asc' },
      include: { task: { select: { id: true, title: true, priority: true, status: true, categoryId: true } } },
    });
  }

  /** Import incrémental. Retourne le nombre d'évènements modifiés. */
  async pull(userId: string): Promise<number> {
    if (!this.google.configured) return 0;
    const cal = await this.api(userId);
    const state = await this.google.syncState(userId);
    let pageToken: string | undefined;
    let syncToken = state.calendarSyncToken;
    let changed = 0;

    try {
      do {
        const { data } = await cal.events.list({
          calendarId: 'primary',
          singleEvents: true,
          showDeleted: true,
          maxResults: 250,
          pageToken,
          ...(syncToken ? { syncToken } : { timeMin: new Date(Date.now() - 30 * 86_400_000).toISOString() }),
        });
        for (const ev of data.items ?? []) {
          if (ev.extendedProperties?.private?.[KAIROS_MARK]) continue;
          changed += await this.upsertExternal(userId, ev);
        }
        pageToken = data.nextPageToken ?? undefined;
        if (data.nextSyncToken) syncToken = data.nextSyncToken;
      } while (pageToken);
    } catch (err: unknown) {
      // 410 Gone : le syncToken a expiré → resynchronisation complète.
      if ((err as { code?: number }).code === 410) {
        await this.google.saveSyncState(userId, { calendarSyncToken: null });
        return this.pull(userId);
      }
      throw err;
    }

    await this.google.saveSyncState(userId, { calendarSyncToken: syncToken ?? null });
    return changed;
  }

  private async upsertExternal(userId: string, ev: calendar_v3.Schema$Event): Promise<number> {
    if (!ev.id) return 0;
    if (ev.status === 'cancelled') {
      const r = await this.prisma.calendarEvent.updateMany({ where: { userId, googleEventId: ev.id }, data: { deletedAt: new Date() } });
      return r.count;
    }
    const allDay = !!ev.start?.date;
    const start = new Date(ev.start?.dateTime ?? `${ev.start?.date}T00:00:00Z`);
    const end = new Date(ev.end?.dateTime ?? `${ev.end?.date}T00:00:00Z`);
    const data = {
      title: ev.summary ?? '(Sans titre)',
      description: ev.description,
      location: ev.location,
      start,
      end,
      allDay,
      transparent: ev.transparency === 'transparent',
      etag: ev.etag,
      meetingUrl: ev.hangoutLink,
      attendees: (ev.attendees ?? []).map((a) => ({ email: a.email, status: a.responseStatus })),
      deletedAt: null,
    };
    await this.prisma.calendarEvent.upsert({
      where: { userId_googleEventId: { userId, googleEventId: ev.id } },
      update: data,
      create: { ...data, userId, kind: 'EVENT', googleEventId: ev.id, googleCalendarId: 'primary' },
    });
    return 1;
  }

  /**
   * Remplace les blocs Kairos futurs par le nouveau plan, en réutilisant
   * les évènements Google existants (patch) pour limiter le bruit de notifications.
   */
  async applyBlocks(userId: string, blocks: ScheduledBlock[], from: Date) {
    const existing = await this.prisma.calendarEvent.findMany({
      where: { userId, kind: { in: ['TASK_BLOCK', 'FOCUS'] }, deletedAt: null, end: { gt: from } },
    });
    const pool = [...existing];
    const kept: string[] = [];

    for (const b of blocks) {
      const idx = pool.findIndex((e) => e.taskId === b.taskId && e.kind === b.kind);
      const data = { title: b.title, start: new Date(b.start), end: new Date(b.end), kind: b.kind, taskId: b.taskId };
      if (idx >= 0) {
        const [reuse] = pool.splice(idx, 1);
        const changed = reuse.start.getTime() !== data.start.getTime() || reuse.end.getTime() !== data.end.getTime();
        if (changed) await this.prisma.calendarEvent.update({ where: { id: reuse.id }, data });
        kept.push(reuse.id);
      } else {
        const created = await this.prisma.calendarEvent.create({ data: { ...data, userId } });
        kept.push(created.id);
      }
    }
    if (pool.length) {
      await this.prisma.calendarEvent.updateMany({ where: { id: { in: pool.map((p) => p.id) } }, data: { deletedAt: new Date() } });
    }
    if (this.google.configured) {
      await this.pushToGoogle(userId, kept, pool.map((p) => p.googleEventId).filter((x): x is string => !!x)).catch((e) =>
        this.logger.warn(`Push Google Calendar échoué : ${String(e)}`),
      );
    }
  }

  private async pushToGoogle(userId: string, ids: string[], toDelete: string[]) {
    const cal = await this.api(userId);
    for (const gid of toDelete) {
      await cal.events.delete({ calendarId: 'primary', eventId: gid }).catch(() => undefined);
    }
    const events = await this.prisma.calendarEvent.findMany({ where: { id: { in: ids } }, include: { task: true } });
    for (const e of events) {
      const body: calendar_v3.Schema$Event = {
        summary: e.kind === 'FOCUS' ? '🎯 Concentration' : `✅ ${e.title}`,
        description: e.task?.description ?? 'Planifié automatiquement par Kairos',
        start: { dateTime: e.start.toISOString() },
        end: { dateTime: e.end.toISOString() },
        colorId: e.kind === 'FOCUS' ? '9' : '7',
        transparency: 'opaque',
        reminders: { useDefault: false, overrides: [] },
        extendedProperties: { private: { [KAIROS_MARK]: '1', kairosId: e.id } },
      };
      if (e.googleEventId) {
        await cal.events.patch({ calendarId: 'primary', eventId: e.googleEventId, requestBody: body });
      } else {
        const { data } = await cal.events.insert({ calendarId: 'primary', requestBody: body });
        await this.prisma.calendarEvent.update({ where: { id: e.id }, data: { googleEventId: data.id } });
      }
    }
  }

  /** Création d'un rendez-vous (UI ou commande vocale), propagé à Google. */
  async createEvent(userId: string, input: { title: string; start: string; end: string; location?: string; description?: string }) {
    let googleEventId: string | undefined;
    if (this.google.configured) {
      const cal = await this.api(userId);
      const { data } = await cal.events.insert({
        calendarId: 'primary',
        requestBody: { summary: input.title, location: input.location, description: input.description, start: { dateTime: input.start }, end: { dateTime: input.end } },
      });
      googleEventId = data.id ?? undefined;
    }
    return this.prisma.calendarEvent.create({
      data: { userId, kind: 'EVENT', title: input.title, location: input.location, description: input.description, start: new Date(input.start), end: new Date(input.end), googleEventId, googleCalendarId: 'primary' },
    });
  }

  /** Abonnement aux notifications push Google (webhook → pull immédiat). */
  async watch(userId: string, webhookUrl: string, channelId: string, channelToken: string) {
    const cal = await this.api(userId);
    const { data } = await cal.events.watch({
      calendarId: 'primary',
      requestBody: { id: channelId, type: 'web_hook', address: webhookUrl, token: channelToken },
    });
    await this.google.saveSyncState(userId, { calendarChannelId: data.id ?? null, calendarResourceId: data.resourceId ?? null, calendarChannelToken: channelToken });
    return data;
  }
}
