import { Injectable } from '@nestjs/common';
import { computeMetrics, type AutomationEvent, type Goal } from '@kairos/core';
import { toCoreTask } from '../../common/mappers';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async metrics(userId: string, from: Date, to: Date) {
    const [tasks, goals, automations, blocks] = await Promise.all([
      this.prisma.task.findMany({ where: { userId, deletedAt: null } }),
      this.prisma.goal.findMany({ where: { userId, periodStart: { lte: to } } }),
      this.prisma.automationLog.findMany({ where: { userId, at: { gte: from, lt: to }, undoneAt: null }, select: { type: true, at: true } }),
      this.prisma.calendarEvent.findMany({ where: { userId, deletedAt: null, kind: { in: ['TASK_BLOCK', 'FOCUS'] }, start: { gte: from, lt: to } }, select: { start: true, end: true, kind: true } }),
    ]);
    const metrics = computeMetrics({
      tasks: tasks.map(toCoreTask),
      goals: goals.map((g): Goal => ({ id: g.id, title: g.title, period: g.period, periodStart: g.periodStart.toISOString(), target: g.target, current: g.current, unit: g.unit, categoryId: g.categoryId })),
      automations: automations.map((a) => ({ type: a.type as AutomationEvent['type'], at: a.at.toISOString() })),
      from,
      to,
      now: new Date(),
    });
    const scheduledMinutes = blocks.reduce((s, b) => s + (b.end.getTime() - b.start.getTime()) / 60_000, 0);
    return { ...metrics, scheduledMinutes: Math.round(scheduledMinutes) };
  }

  /** Série hebdomadaire : terminées vs créées, charge planifiée (8 dernières semaines). */
  async weeklySeries(userId: string, weeks = 8) {
    const out = [];
    const now = new Date();
    for (let i = weeks - 1; i >= 0; i--) {
      const to = new Date(now.getTime() - i * 7 * 86_400_000);
      const from = new Date(to.getTime() - 7 * 86_400_000);
      const [completed, created, blocks] = await Promise.all([
        this.prisma.task.count({ where: { userId, completedAt: { gte: from, lt: to } } }),
        this.prisma.task.count({ where: { userId, createdAt: { gte: from, lt: to } } }),
        this.prisma.calendarEvent.findMany({ where: { userId, kind: 'TASK_BLOCK', start: { gte: from, lt: to } }, select: { start: true, end: true } }),
      ]);
      out.push({ weekStart: from.toISOString().slice(0, 10), completed, created, plannedMinutes: Math.round(blocks.reduce((s, b) => s + (b.end.getTime() - b.start.getTime()) / 60_000, 0)) });
    }
    return out;
  }

  goals(userId: string) {
    return this.prisma.goal.findMany({ where: { userId }, orderBy: [{ period: 'asc' }, { periodStart: 'desc' }] });
  }
}
