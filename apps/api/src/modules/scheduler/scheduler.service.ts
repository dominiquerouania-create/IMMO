import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  DEFAULT_SCHEDULER_SETTINGS,
  detectConflicts,
  findMissedTasks,
  planSchedule,
  rankTasks,
  type ScheduleResult,
  type SchedulerSettings,
  type WorkingHours,
} from '@kairos/core';
import { toCoreCategory, toCoreEvent, toCoreTask } from '../../common/mappers';
import { PrismaService } from '../../common/prisma.service';
import { CalendarService } from '../calendar/calendar.service';

/**
 * Orchestration de la planification autonome (niveau 5) :
 * - replanification déclenchée par les changements (debounce 3 s),
 * - passage périodique (toutes les 15 min) : import agenda, tâches manquées, conflits,
 * - chaque action est journalisée dans AutomationLog (annulable).
 */
@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly running = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly calendar: CalendarService,
  ) {}

  requestReplan(userId: string, reason: string) {
    clearTimeout(this.timers.get(userId));
    this.timers.set(
      userId,
      setTimeout(() => {
        this.timers.delete(userId);
        this.replan(userId, reason).catch((e) => this.logger.error(`Replanification échouée : ${String(e)}`));
      }, 3000),
    );
  }

  async settingsFor(userId: string): Promise<SchedulerSettings> {
    const [s, user] = await Promise.all([
      this.prisma.userSettings.findUnique({ where: { userId } }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { timeZone: true } }),
    ]);
    if (!s) return DEFAULT_SCHEDULER_SETTINGS;
    return {
      workingHours: { ...(s.workingHours as unknown as WorkingHours), timeZone: user?.timeZone ?? 'Europe/Paris' },
      focusMinutesPerDay: s.focusMinutesPerDay,
      minFocusBlockMinutes: s.minFocusBlockMinutes,
      bufferMinutes: s.bufferMinutes,
      maxTaskMinutesPerDay: s.maxTaskMinutesPerDay,
      horizonDays: s.horizonDays,
      slotGranularityMinutes: 15,
    };
  }

  /** Calcule le plan sans l'appliquer (aperçu « Que se passerait-il si… »). */
  async preview(userId: string, now = new Date()): Promise<ScheduleResult> {
    const settings = await this.settingsFor(userId);
    const horizonEnd = new Date(now.getTime() + settings.horizonDays * 86_400_000);
    const [tasks, events, categories] = await Promise.all([
      this.prisma.task.findMany({ where: { userId, deletedAt: null, status: { notIn: ['DONE', 'CANCELLED'] } }, include: { checklist: true } }),
      this.prisma.calendarEvent.findMany({ where: { userId, deletedAt: null, kind: 'EVENT', end: { gt: now }, start: { lt: horizonEnd } } }),
      this.prisma.category.findMany({ where: { userId } }),
    ]);
    return planSchedule({
      tasks: tasks.map(toCoreTask),
      events: events.map(toCoreEvent),
      categories: categories.map(toCoreCategory),
      settings,
      now,
    });
  }

  async replan(userId: string, reason = 'manual'): Promise<ScheduleResult | null> {
    if (this.running.has(userId)) {
      this.requestReplan(userId, reason);
      return null;
    }
    this.running.add(userId);
    try {
      const now = new Date();
      const result = await this.preview(userId, now);
      await this.calendar.applyBlocks(userId, result.blocks, now);

      // Met à jour chaque tâche : fenêtre planifiée, score, statut « à risque ».
      const byTask = new Map<string, { start: string; end: string }>();
      for (const b of result.blocks) {
        if (!b.taskId) continue;
        const cur = byTask.get(b.taskId);
        byTask.set(b.taskId, { start: cur?.start ?? b.start, end: b.end });
      }
      const risky = new Set(result.atRisk.map((r) => r.taskId));
      const tasks = await this.prisma.task.findMany({ where: { userId, deletedAt: null, status: { notIn: ['DONE', 'CANCELLED'] } } });
      const categories = await this.prisma.category.findMany({ where: { userId } });
      const scores = new Map(rankTasks(tasks.map(toCoreTask), now, categories.map(toCoreCategory)).map((r) => [r.task.id, r.breakdown.score]));

      await this.prisma.$transaction(
        tasks
          .filter((t) => t.autoSchedule)
          .map((t) => {
            const w = byTask.get(t.id);
            return this.prisma.task.update({
              where: { id: t.id },
              data: {
                scheduledStart: w ? new Date(w.start) : null,
                scheduledEnd: w ? new Date(w.end) : null,
                score: scores.get(t.id) ?? 0,
                atRisk: risky.has(t.id),
              },
            });
          }),
      );

      await this.prisma.automationLog.create({
        data: {
          userId,
          type: 'AUTO_SCHEDULED',
          summary: `Planning recalculé (${reason}) : ${result.blocks.length} blocs, ${result.atRisk.length} tâche(s) à risque`,
        },
      });
      return result;
    } finally {
      this.running.delete(userId);
    }
  }

  /** Boucle autonome : import agenda, tâches manquées, conflits, replanification. */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async autonomousLoop() {
    const users = await this.prisma.user.findMany({ select: { id: true } });
    for (const { id } of users) {
      try {
        await this.calendar.pull(id).catch((e) => this.logger.warn(`Pull agenda : ${String(e)}`));
        const open = await this.prisma.task.findMany({ where: { userId: id, deletedAt: null, status: { in: ['TODO', 'IN_PROGRESS'] } } });
        const missed = findMissedTasks(open.map(toCoreTask), new Date());
        for (const t of missed) {
          await this.prisma.taskEvent.create({ data: { taskId: t.id, actor: 'AI', action: 'rescheduled', details: { from: t.scheduledStart, reason: 'session manquée' } } });
          await this.prisma.automationLog.create({ data: { userId: id, type: 'RESCHEDULED', summary: `« ${t.title} » replanifiée (session manquée)`, entityType: 'task', entityId: t.id } });
        }
        const events = await this.prisma.calendarEvent.findMany({ where: { userId: id, deletedAt: null, kind: 'EVENT', start: { gte: new Date() } }, take: 500 });
        const conflicts = detectConflicts(events.map(toCoreEvent));
        for (const [a, b] of conflicts.slice(0, 5)) {
          await this.prisma.notification.upsert({
            where: { id: `conflict-${a.id}-${b.id}` },
            update: {},
            create: { id: `conflict-${a.id}-${b.id}`, userId: id, channel: 'IN_APP', kind: 'CONFLICT', message: `Conflit d'agenda : « ${a.title} » et « ${b.title} »`, sendAt: new Date(), status: 'SENT' },
          });
        }
        await this.replan(id, missed.length ? 'sessions manquées' : 'boucle autonome');
      } catch (e) {
        this.logger.error(`Boucle autonome (${id}) : ${String(e)}`);
      }
    }
  }
}
