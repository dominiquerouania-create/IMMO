import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { planReminders } from '@kairos/core';
import { PrismaService } from '../../common/prisma.service';
import { WhatsAppProvider } from './whatsapp.provider';

const MAX_ATTEMPTS = 3;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsAppProvider,
    private readonly config: ConfigService,
  ) {}

  /**
   * (Re)calcule les rappels de toutes les échéances et rendez-vous à venir.
   * Idempotent : les rappels en attente sont remplacés, ceux déjà envoyés conservés.
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async planAll() {
    const now = new Date();
    const horizon = new Date(now.getTime() + 8 * 86_400_000);
    const users = await this.prisma.user.findMany({ include: { settings: true } });
    for (const user of users) {
      const s = user.settings;
      const policy = {
        timeZone: user.timeZone,
        eveHour: s?.reminderEveHour ?? 19,
        channels: (s?.reminderChannels ?? ['WHATSAPP']) as Array<'WHATSAPP' | 'PUSH' | 'EMAIL' | 'IN_APP'>,
        quietHours: { start: s?.quietHoursStart ?? 22, end: s?.quietHoursEnd ?? 7 },
      };
      const tasks = await this.prisma.task.findMany({
        where: { userId: user.id, deletedAt: null, status: { notIn: ['DONE', 'CANCELLED'] }, dueAt: { gt: now, lt: horizon } },
      });
      const events = await this.prisma.calendarEvent.findMany({
        where: { userId: user.id, deletedAt: null, kind: 'EVENT', allDay: false, start: { gt: now, lt: horizon } },
      });

      await this.prisma.notification.deleteMany({ where: { userId: user.id, status: 'PENDING', sendAt: { gt: now }, kind: { not: 'CONFLICT' } } });
      const sent = await this.prisma.notification.findMany({ where: { userId: user.id, status: 'SENT', sendAt: { gt: new Date(now.getTime() - 8 * 86_400_000) } }, select: { taskId: true, eventId: true, kind: true } });
      const already = new Set(sent.map((n) => `${n.taskId ?? n.eventId}:${n.kind}`));

      const rows = [
        ...tasks.flatMap((t) =>
          planReminders({ id: t.id, title: t.title, priority: t.priority, at: t.dueAt!.toISOString() }, now, { policy, atRisk: t.atRisk }).map((r) => ({ ...r, taskId: t.id, eventId: null as string | null })),
        ),
        ...events.flatMap((e) =>
          planReminders({ id: e.id, title: e.title, priority: 'MEDIUM', at: e.start.toISOString() }, now, { policy }).map((r) => ({ ...r, taskId: null as string | null, eventId: e.id })),
        ),
      ].filter((r) => !already.has(`${r.taskId ?? r.eventId}:${r.kind}`));

      if (rows.length) {
        await this.prisma.notification.createMany({
          data: rows.map((r) => ({ userId: user.id, taskId: r.taskId, eventId: r.eventId, channel: r.channel, kind: r.kind, message: r.message, sendAt: new Date(r.sendAt) })),
        });
      }
    }
  }

  /** Envoi des rappels échus, avec reprise sur erreur. */
  @Cron(CronExpression.EVERY_MINUTE)
  async dispatch() {
    const due = await this.prisma.notification.findMany({
      where: { status: 'PENDING', sendAt: { lte: new Date() }, attempts: { lt: MAX_ATTEMPTS } },
      include: { user: true },
      take: 50,
    });
    for (const n of due) {
      try {
        let providerId: string | undefined;
        if (n.channel === 'WHATSAPP') {
          const to = n.user.phoneE164 ?? this.config.get<string>('WHATSAPP_RECIPIENT');
          if (!to) throw new Error('Numéro WhatsApp non configuré');
          providerId = await this.whatsapp.send(to, n.message);
        }
        await this.prisma.notification.update({ where: { id: n.id }, data: { status: 'SENT', providerId, attempts: { increment: 1 } } });
        await this.prisma.automationLog.create({ data: { userId: n.userId, type: 'REMINDER_SENT', summary: n.message } });
      } catch (err) {
        const attempts = n.attempts + 1;
        await this.prisma.notification.update({
          where: { id: n.id },
          data: { attempts, error: String(err), status: attempts >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING', sendAt: new Date(Date.now() + attempts * 60_000) },
        });
        this.logger.warn(`Rappel ${n.id} : ${String(err)}`);
      }
    }
  }

  /** Réponses WhatsApp : « FAIT » termine la tâche, « REPORTER » la décale à demain. */
  async handleReply(from: string, text: string) {
    const user = await this.prisma.user.findFirst({ where: { OR: [{ phoneE164: from }, { phoneE164: `+${from}` }] } });
    if (!user) return;
    const last = await this.prisma.notification.findFirst({ where: { userId: user.id, status: 'SENT', taskId: { not: null } }, orderBy: { sendAt: 'desc' } });
    if (!last?.taskId) return;
    const cmd = text.trim().toUpperCase();
    if (cmd.startsWith('FAIT')) {
      await this.prisma.task.update({ where: { id: last.taskId }, data: { status: 'DONE', completedAt: new Date(), version: { increment: 1 } } });
      await this.prisma.taskEvent.create({ data: { taskId: last.taskId, actor: 'USER', action: 'status_changed', details: { via: 'whatsapp', status: 'DONE' } } });
    } else if (cmd.startsWith('REPORTER')) {
      const task = await this.prisma.task.findUnique({ where: { id: last.taskId } });
      const newDue = new Date((task?.dueAt ?? new Date()).getTime() + 86_400_000);
      await this.prisma.task.update({ where: { id: last.taskId }, data: { status: 'POSTPONED', dueAt: newDue, version: { increment: 1 } } });
      await this.prisma.taskEvent.create({ data: { taskId: last.taskId, actor: 'USER', action: 'postponed', details: { via: 'whatsapp', dueAt: newDue } } });
    }
  }

  inbox(userId: string) {
    return this.prisma.notification.findMany({ where: { userId, status: { in: ['SENT', 'PENDING'] } }, orderBy: { sendAt: 'desc' }, take: 50 });
  }
}
