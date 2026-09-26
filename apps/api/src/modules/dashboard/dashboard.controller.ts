import { Body, Controller, Get, Module, Put } from '@nestjs/common';
import { addZonedDays, startOfZonedDay } from '@kairos/core';
import { z } from 'zod';
import { CurrentUser, type AuthUser } from '../../common/auth.guard';
import { PrismaService } from '../../common/prisma.service';
import { ZodPipe } from '../../common/zod.pipe';
import { AiTasksService } from '../ai/ai-tasks.service';
import { AnalyticsModule } from '../analytics/analytics.controller';
import { AnalyticsService } from '../analytics/analytics.service';
import { SchedulerModule } from '../scheduler/scheduler.module';
import { SchedulerService } from '../scheduler/scheduler.service';
import { TasksModule } from '../tasks/tasks.module';
import { TasksService } from '../tasks/tasks.service';

export const DEFAULT_WIDGETS = [
  'today-plan', 'priorities', 'appointments', 'important-emails', 'workload', 'time-left', 'overdue',
  'weekly-goals', 'monthly-goals', 'critical', 'notifications', 'ai-recommendations', 'productivity-score',
];

const layoutSchema = z.array(z.object({ key: z.string(), position: z.number().int(), visible: z.boolean(), size: z.enum(['sm', 'md', 'lg']).default('md') }));

/** Agrégat unique pour l'écran d'accueil : une seule requête au lancement de l'app. */
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasks: TasksService,
    private readonly scheduler: SchedulerService,
    private readonly analytics: AnalyticsService,
    private readonly ai: AiTasksService,
  ) {}

  @Get()
  async get(@CurrentUser() user: AuthUser) {
    const now = new Date();
    const { timeZone } = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { timeZone: true } });
    const dayStart = startOfZonedDay(now, timeZone);
    const dayEnd = addZonedDays(dayStart, 1, timeZone);

    const [priorities, today, emails, plan, metrics, goals, notifications, layout] = await Promise.all([
      this.tasks.priorities(user.id, 15),
      this.prisma.calendarEvent.findMany({ where: { userId: user.id, deletedAt: null, start: { lt: dayEnd }, end: { gt: dayStart } }, orderBy: { start: 'asc' } }),
      this.prisma.emailMessage.findMany({ where: { userId: user.id, archivedAt: null, importance: { in: ['URGENT', 'IMPORTANT'] } }, orderBy: { receivedAt: 'desc' }, take: 8 }),
      this.scheduler.preview(user.id, now),
      this.analytics.metrics(user.id, new Date(now.getTime() - 7 * 86_400_000), now),
      this.prisma.goal.findMany({ where: { userId: user.id, period: { in: ['WEEK', 'MONTH'] }, periodStart: { lte: now } }, orderBy: { periodStart: 'desc' }, take: 10 }),
      this.prisma.notification.findMany({ where: { userId: user.id, status: 'SENT', readAt: null }, orderBy: { sendAt: 'desc' }, take: 10 }),
      this.prisma.dashboardWidget.findMany({ where: { userId: user.id }, orderBy: { position: 'asc' } }),
    ]);

    const todayLoad = plan.dayLoads[0];
    return {
      generatedAt: now.toISOString(),
      layout: layout.length ? layout : DEFAULT_WIDGETS.map((key, position) => ({ key, position, visible: true, size: 'md' })),
      todayPlan: today,
      priorities: priorities.slice(0, 7),
      critical: priorities.filter((t) => t.priority === 'CRITICAL'),
      overdue: priorities.filter((t) => t.overdue),
      appointments: today.filter((e) => e.kind === 'EVENT'),
      importantEmails: emails,
      workload: plan.dayLoads.slice(0, 7),
      timeLeftMinutes: todayLoad?.freeMinutes ?? 0,
      atRisk: plan.atRisk,
      weeklyGoals: goals.filter((g) => g.period === 'WEEK'),
      monthlyGoals: goals.filter((g) => g.period === 'MONTH'),
      notifications,
      metrics,
    };
  }

  @Get('recommendations')
  async recommendations(@CurrentUser() user: AuthUser) {
    const [priorities, plan] = await Promise.all([this.tasks.priorities(user.id, 10), this.scheduler.preview(user.id)]);
    return this.ai.recommendations(user.id, {
      now: new Date().toISOString(),
      priorities: priorities.map((t) => ({ title: t.title, priority: t.priority, dueAt: t.dueAt, score: t.score, overdue: t.overdue })),
      atRisk: plan.atRisk,
      load: plan.dayLoads.slice(0, 3),
    });
  }

  @Put('layout')
  async layout(@CurrentUser() user: AuthUser, @Body(new ZodPipe(layoutSchema)) widgets: z.infer<typeof layoutSchema>) {
    await this.prisma.$transaction(
      widgets.map((w) =>
        this.prisma.dashboardWidget.upsert({
          where: { userId_key: { userId: user.id, key: w.key } },
          update: { position: w.position, visible: w.visible, size: w.size },
          create: { userId: user.id, ...w },
        }),
      ),
    );
    return { ok: true };
  }
}

@Module({ imports: [TasksModule, SchedulerModule, AnalyticsModule], controllers: [DashboardController] })
export class DashboardModule {}
