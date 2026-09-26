import { Body, Controller, Get, Module, Param, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser, type AuthUser } from '../../common/auth.guard';
import { PrismaService } from '../../common/prisma.service';
import { ZodPipe } from '../../common/zod.pipe';
import { AnalyticsService } from './analytics.service';

const goalSchema = z.object({
  title: z.string().min(1).max(200),
  period: z.enum(['WEEK', 'MONTH', 'QUARTER', 'YEAR']),
  periodStart: z.string().datetime(),
  target: z.number().positive(),
  current: z.number().min(0).default(0),
  unit: z.string().max(30).default('tâches'),
  categoryId: z.string().optional(),
});

@Controller()
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('analytics/metrics')
  metrics(@CurrentUser() user: AuthUser, @Query('from') from?: string, @Query('to') to?: string) {
    const t = to ? new Date(to) : new Date();
    const f = from ? new Date(from) : new Date(t.getTime() - 7 * 86_400_000);
    return this.analytics.metrics(user.id, f, t);
  }

  @Get('analytics/weekly')
  weekly(@CurrentUser() user: AuthUser) {
    return this.analytics.weeklySeries(user.id);
  }

  @Get('goals')
  goals(@CurrentUser() user: AuthUser) {
    return this.analytics.goals(user.id);
  }

  @Post('goals')
  createGoal(@CurrentUser() user: AuthUser, @Body(new ZodPipe(goalSchema)) body: z.infer<typeof goalSchema>) {
    return this.prisma.goal.create({ data: { ...body, periodStart: new Date(body.periodStart), userId: user.id } });
  }

  @Patch('goals/:id')
  updateGoal(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(goalSchema.partial())) body: Partial<z.infer<typeof goalSchema>>) {
    return this.prisma.goal.update({ where: { id, userId: user.id }, data: { ...body, periodStart: body.periodStart ? new Date(body.periodStart) : undefined } });
  }

  @Get('automations')
  automations(@CurrentUser() user: AuthUser) {
    return this.prisma.automationLog.findMany({ where: { userId: user.id }, orderBy: { at: 'desc' }, take: 100 });
  }
}

@Module({ controllers: [AnalyticsController], providers: [AnalyticsService], exports: [AnalyticsService] })
export class AnalyticsModule {}
