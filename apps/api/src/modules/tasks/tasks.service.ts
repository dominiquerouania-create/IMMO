import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  parseCommand,
  rankTasks,
  type CreateTaskInput,
  type UpdateTaskInput,
} from '@kairos/core';
import { Prisma, type TaskStatus } from '@prisma/client';
import { toCoreCategory, toCoreTask } from '../../common/mappers';
import { PrismaService } from '../../common/prisma.service';
import { SchedulerService } from '../scheduler/scheduler.service';

export interface TaskFilters {
  status?: TaskStatus[];
  categoryId?: string;
  from?: string;
  to?: string;
  q?: string;
  parentId?: string | null;
}

const include = { checklist: { orderBy: { position: 'asc' } }, attachments: true } satisfies Prisma.TaskInclude;

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduler: SchedulerService,
  ) {}

  async list(userId: string, f: TaskFilters) {
    const tasks = await this.prisma.task.findMany({
      where: {
        userId,
        deletedAt: null,
        status: f.status?.length ? { in: f.status } : undefined,
        categoryId: f.categoryId,
        parentId: f.parentId === undefined ? undefined : f.parentId,
        dueAt: f.from || f.to ? { gte: f.from ? new Date(f.from) : undefined, lte: f.to ? new Date(f.to) : undefined } : undefined,
        OR: f.q
          ? [
              { title: { contains: f.q, mode: 'insensitive' } },
              { description: { contains: f.q, mode: 'insensitive' } },
              { tags: { has: f.q.toLowerCase() } },
            ]
          : undefined,
      },
      include,
      orderBy: [{ score: 'desc' }, { dueAt: 'asc' }],
    });
    return tasks.map(toCoreTask);
  }

  async get(userId: string, id: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, userId, deletedAt: null },
      include: { ...include, subtasks: { where: { deletedAt: null }, include }, history: { orderBy: { at: 'desc' }, take: 100 } },
    });
    if (!task) throw new NotFoundException('Tâche introuvable');
    return { ...toCoreTask(task), subtasks: task.subtasks.map(toCoreTask), history: task.history };
  }

  /** `id` : identifiant généré côté client (création hors ligne). */
  async create(userId: string, input: CreateTaskInput, actor: 'USER' | 'AI' | 'SYSTEM' = 'USER', id?: string) {
    const categoryId = await this.resolveCategoryId(userId, input.categoryId);
    const task = await this.prisma.task.create({
      data: {
        id,
        userId,
        categoryId,
        title: input.title,
        description: input.description,
        notes: input.notes,
        priority: input.priority,
        status: input.status,
        subcategory: input.subcategory,
        parentId: input.parentId,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        startAfter: input.startAfter ? new Date(input.startAfter) : null,
        estimatedMinutes: input.estimatedMinutes,
        autoSchedule: input.autoSchedule,
        splittable: input.splittable,
        minChunkMinutes: input.minChunkMinutes,
        deepWork: input.deepWork ?? false,
        tags: input.tags,
        source: input.source,
        sourceRef: input.sourceRef,
        checklist: { create: input.checklist.map((c, position) => ({ label: c.label, done: c.done, dueAt: c.dueAt ? new Date(c.dueAt) : null, position })) },
        history: { create: { actor, action: 'created', details: { source: input.source } } },
      },
      include,
    });
    this.scheduler.requestReplan(userId, 'task_created');
    return toCoreTask(task);
  }

  /** Saisie rapide en langage naturel : « Appeler la banque vendredi 10h #sci !urgent 30min ». */
  async quickAdd(userId: string, text: string, timeZone: string) {
    const parsed = parseCommand(text, new Date(), timeZone);
    const e = parsed.entities;
    return this.create(userId, {
      title: e.title || text,
      priority: e.priority ?? 'MEDIUM',
      status: 'TODO',
      categoryId: e.categoryId ?? 'personnel',
      dueAt: e.date ?? null,
      estimatedMinutes: e.durationMinutes ?? 30,
      autoSchedule: true,
      splittable: true,
      checklist: [],
      tags: e.tags ?? [],
      source: 'MANUAL',
    });
  }

  async update(userId: string, id: string, input: UpdateTaskInput, actor: 'USER' | 'AI' | 'SYSTEM' = 'USER') {
    const existing = await this.prisma.task.findFirst({ where: { id, userId, deletedAt: null } });
    if (!existing) throw new NotFoundException('Tâche introuvable');
    if (input.version !== undefined && input.version !== existing.version) {
      throw new ConflictException({ message: 'Version obsolète', serverVersion: existing.version, task: toCoreTask(existing) });
    }

    const { checklist, version: _v, categoryId, ...rest } = input;
    const data: Prisma.TaskUncheckedUpdateInput = {
      ...rest,
      dueAt: rest.dueAt === undefined ? undefined : rest.dueAt ? new Date(rest.dueAt) : null,
      startAfter: rest.startAfter === undefined ? undefined : rest.startAfter ? new Date(rest.startAfter) : null,
      scheduledStart: rest.scheduledStart === undefined ? undefined : rest.scheduledStart ? new Date(rest.scheduledStart) : null,
      scheduledEnd: rest.scheduledEnd === undefined ? undefined : rest.scheduledEnd ? new Date(rest.scheduledEnd) : null,
      version: { increment: 1 },
    };
    if (categoryId) data.categoryId = await this.resolveCategoryId(userId, categoryId);
    if (input.status === 'DONE' && existing.status !== 'DONE') data.completedAt = new Date();
    if (input.status && input.status !== 'DONE') data.completedAt = null;
    // Déplacement manuel dans le calendrier : l'IA ne doit plus y toucher.
    if (actor === 'USER' && input.scheduledStart !== undefined && input.autoSchedule === undefined) data.autoSchedule = false;

    const changes = Object.fromEntries(
      Object.entries(rest).filter(([k, v]) => String((existing as Record<string, unknown>)[k] ?? '') !== String(v ?? '')),
    );

    const task = await this.prisma.$transaction(async (tx) => {
      if (checklist) {
        await tx.checklistItem.deleteMany({ where: { taskId: id } });
        await tx.checklistItem.createMany({
          data: checklist.map((c, position) => ({ taskId: id, label: c.label, done: c.done, dueAt: c.dueAt ? new Date(c.dueAt) : null, position })),
        });
      }
      const updated = await tx.task.update({ where: { id }, data, include });
      await tx.taskEvent.create({
        data: {
          taskId: id,
          actor,
          action: input.status && input.status !== existing.status ? 'status_changed' : 'updated',
          details: changes as Prisma.InputJsonValue,
        },
      });
      return updated;
    });

    this.scheduler.requestReplan(userId, 'task_updated');
    return toCoreTask(task);
  }

  async remove(userId: string, id: string) {
    const res = await this.prisma.task.updateMany({ where: { id, userId }, data: { deletedAt: new Date(), version: { increment: 1 } } });
    if (!res.count) throw new NotFoundException();
    await this.prisma.calendarEvent.updateMany({ where: { taskId: id, kind: 'TASK_BLOCK' }, data: { deletedAt: new Date() } });
    this.scheduler.requestReplan(userId, 'task_deleted');
    return { ok: true };
  }

  async toggleChecklistItem(userId: string, taskId: string, itemId: string) {
    const item = await this.prisma.checklistItem.findFirst({ where: { id: itemId, task: { id: taskId, userId } } });
    if (!item) throw new NotFoundException();
    return this.prisma.checklistItem.update({ where: { id: itemId }, data: { done: !item.done } });
  }

  /** Priorités du moment, calculées à la volée avec le moteur de scoring. */
  async priorities(userId: string, limit = 10) {
    const [tasks, categories] = await Promise.all([
      this.prisma.task.findMany({ where: { userId, deletedAt: null, status: { notIn: ['DONE', 'CANCELLED'] } }, include }),
      this.prisma.category.findMany({ where: { userId } }),
    ]);
    return rankTasks(tasks.map(toCoreTask), new Date(), categories.map(toCoreCategory))
      .slice(0, limit)
      .map(({ task, breakdown }) => ({ ...task, score: breakdown.score, urgent: breakdown.urgent, overdue: breakdown.overdue }));
  }

  /** Accepte un id ou un slug (« douane », « sci-cambraie »…). */
  private async resolveCategoryId(userId: string, idOrSlug: string): Promise<string> {
    const cat = await this.prisma.category.findFirst({
      where: { userId, OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      select: { id: true },
    });
    if (cat) return cat.id;
    const fallback = await this.prisma.category.findFirst({ where: { userId, slug: 'personnel' }, select: { id: true } });
    if (!fallback) throw new NotFoundException('Catégorie introuvable');
    return fallback.id;
  }
}
