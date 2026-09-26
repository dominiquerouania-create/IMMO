import { Body, Controller, Get, Put } from '@nestjs/common';
import { AI_CAPABILITIES, AI_PROVIDERS, AI_PROVIDER_LABELS } from '@kairos/core';
import { z } from 'zod';
import { CurrentUser, type AuthUser } from '../../common/auth.guard';
import { PrismaService } from '../../common/prisma.service';
import { ZodPipe } from '../../common/zod.pipe';
import { AiRouterService } from './ai-router.service';

const rulesSchema = z.array(
  z.object({ capability: z.enum(AI_CAPABILITIES), provider: z.enum(AI_PROVIDERS), fallbacks: z.array(z.enum(AI_PROVIDERS)).max(3) }),
);

@Controller('ai')
export class AiController {
  constructor(
    private readonly router: AiRouterService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('providers')
  providers() {
    const available = new Set(this.router.available());
    return AI_PROVIDERS.map((id) => ({ id, label: AI_PROVIDER_LABELS[id], available: available.has(id) }));
  }

  @Get('routing')
  routing(@CurrentUser() user: AuthUser) {
    return this.router.rules(user.id);
  }

  @Put('routing')
  async setRouting(@CurrentUser() user: AuthUser, @Body(new ZodPipe(rulesSchema)) rules: z.infer<typeof rulesSchema>) {
    await this.prisma.$transaction(
      rules.map((r) =>
        this.prisma.aiRoutingRule.upsert({
          where: { userId_capability: { userId: user.id, capability: r.capability } },
          update: { provider: r.provider, fallbacks: r.fallbacks },
          create: { userId: user.id, ...r },
        }),
      ),
    );
    return this.router.rules(user.id);
  }

  @Get('runs')
  runs(@CurrentUser() user: AuthUser) {
    return this.prisma.aiRun.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 100 });
  }
}
