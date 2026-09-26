import { Body, Controller, Get, Module, Post, Query } from '@nestjs/common';
import { syncPushSchema, updateTaskSchema, createTaskSchema, type SyncMutation } from '@kairos/core';
import { ConflictException } from '@nestjs/common';
import type { z } from 'zod';
import { CurrentUser, type AuthUser } from '../../common/auth.guard';
import { toCoreTask } from '../../common/mappers';
import { PrismaService } from '../../common/prisma.service';
import { ZodPipe } from '../../common/zod.pipe';
import { TasksModule } from '../tasks/tasks.module';
import { TasksService } from '../tasks/tasks.service';

/**
 * Synchronisation hors ligne (clients web PWA et mobile).
 * - push : rejoue les mutations en file d'attente (idempotence par clientMutationId,
 *   verrouillage optimiste par version → conflit renvoyé au client, « le serveur gagne »
 *   champ par champ sauf si le client est plus récent).
 * - pull : renvoie tout ce qui a changé depuis le curseur (horodatage serveur).
 */
@Controller('sync')
export class SyncController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasks: TasksService,
  ) {}

  @Post('push')
  async push(@CurrentUser() user: AuthUser, @Body(new ZodPipe(syncPushSchema)) body: z.infer<typeof syncPushSchema>) {
    const results: Array<{ clientMutationId: string; status: 'APPLIED' | 'DUPLICATE' | 'CONFLICT' | 'REJECTED'; entity?: unknown; error?: string }> = [];
    for (const m of body.mutations.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))) {
      const seen = await this.prisma.syncMutation.findUnique({ where: { clientMutationId: m.clientMutationId } });
      if (seen) {
        results.push({ clientMutationId: m.clientMutationId, status: 'DUPLICATE' });
        continue;
      }
      let status: 'APPLIED' | 'CONFLICT' | 'REJECTED' = 'APPLIED';
      let entity: unknown;
      let error: string | undefined;
      try {
        entity = await this.apply(user.id, m);
      } catch (e) {
        status = e instanceof ConflictException ? 'CONFLICT' : 'REJECTED';
        error = String(e);
        entity = e instanceof ConflictException ? (e.getResponse() as { task?: unknown }).task : undefined;
      }
      await this.prisma.syncMutation.create({
        data: { clientMutationId: m.clientMutationId, userId: user.id, deviceId: body.deviceId, entity: m.entity, op: m.op, entityId: m.entityId, status },
      });
      results.push({ clientMutationId: m.clientMutationId, status, entity, error });
    }
    return { results, serverTime: new Date().toISOString() };
  }

  private async apply(userId: string, m: SyncMutation) {
    if (m.entity !== 'task') throw new Error(`Entité non synchronisable : ${m.entity}`);
    if (m.op === 'create') {
      const input = createTaskSchema.parse(m.payload);
      const existing = await this.prisma.task.findFirst({ where: { id: m.entityId, userId } });
      if (existing) return toCoreTask(existing);
      // Conserve l'identifiant généré hors ligne pour que le client garde ses références.
      return this.tasks.create(userId, input, 'USER', m.entityId);
    }
    if (m.op === 'update') {
      const input = updateTaskSchema.parse({ ...m.payload, version: m.baseVersion });
      return this.tasks.update(userId, m.entityId, input);
    }
    return this.tasks.remove(userId, m.entityId);
  }

  @Get('pull')
  async pull(@CurrentUser() user: AuthUser, @Query('since') since?: string) {
    const cursor = since ? new Date(since) : new Date(0);
    const serverTime = new Date().toISOString();
    const [tasks, categories, events, documents] = await Promise.all([
      this.prisma.task.findMany({ where: { userId: user.id, updatedAt: { gt: cursor } }, include: { checklist: true, attachments: true } }),
      this.prisma.category.findMany({ where: { userId: user.id, updatedAt: { gt: cursor } } }),
      this.prisma.calendarEvent.findMany({ where: { userId: user.id, updatedAt: { gt: cursor }, end: { gt: new Date(Date.now() - 7 * 86_400_000) } } }),
      this.prisma.document.findMany({ where: { userId: user.id, updatedAt: { gt: cursor } }, orderBy: { updatedAt: 'desc' }, take: 30, select: { id: true, title: true, type: true, format: true, driveUrl: true, textContent: true, updatedAt: true } }),
    ]);
    return {
      serverTime,
      tasks: tasks.map((t) => ({ ...toCoreTask(t), version: t.version, deleted: !!t.deletedAt })),
      categories,
      events: events.map((e) => ({ ...e, deleted: !!e.deletedAt })),
      documents,
    };
  }
}

@Module({ imports: [TasksModule], controllers: [SyncController] })
export class SyncModule {}
