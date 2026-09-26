import { z } from 'zod';
import { PRIORITIES, TASK_STATUSES } from './types';

/** Schémas de validation partagés (formulaires front + DTO API). */

export const checklistItemSchema = z.object({
  id: z.string(),
  label: z.string().min(1).max(500),
  done: z.boolean().default(false),
  dueAt: z.string().datetime().nullish(),
});

export const createTaskSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(20_000).nullish(),
  notes: z.string().max(20_000).nullish(),
  priority: z.enum(PRIORITIES).default('MEDIUM'),
  status: z.enum(TASK_STATUSES).default('TODO'),
  categoryId: z.string().min(1),
  subcategory: z.string().max(100).nullish(),
  parentId: z.string().nullish(),
  dueAt: z.string().datetime().nullish(),
  startAfter: z.string().datetime().nullish(),
  estimatedMinutes: z.number().int().min(5).max(60 * 40).default(30),
  autoSchedule: z.boolean().default(true),
  splittable: z.boolean().default(true),
  minChunkMinutes: z.number().int().min(15).max(480).optional(),
  deepWork: z.boolean().optional(),
  checklist: z.array(checklistItemSchema).default([]),
  tags: z.array(z.string().max(40)).max(20).default([]),
  source: z.enum(['MANUAL', 'EMAIL', 'VOICE', 'AI', 'CALENDAR']).default('MANUAL'),
  sourceRef: z.string().nullish(),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = createTaskSchema.partial().extend({
  actualMinutes: z.number().int().min(0).optional(),
  scheduledStart: z.string().datetime().nullish(),
  scheduledEnd: z.string().datetime().nullish(),
  /** Version connue du client (verrouillage optimiste, mode hors ligne). */
  version: z.number().int().optional(),
});
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const categorySchema = z.object({
  name: z.string().min(1).max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  icon: z.string().max(40).default('folder'),
  weight: z.number().min(0.5).max(2).default(1),
  subcategories: z.array(z.string().max(60)).default([]),
});

/** Mutation hors ligne rejouée à la reconnexion. */
export const syncMutationSchema = z.object({
  clientMutationId: z.string().uuid(),
  entity: z.enum(['task', 'category', 'goal', 'note']),
  op: z.enum(['create', 'update', 'delete']),
  entityId: z.string(),
  payload: z.record(z.string(), z.unknown()).default({}),
  baseVersion: z.number().int().optional(),
  occurredAt: z.string().datetime(),
});
export type SyncMutation = z.infer<typeof syncMutationSchema>;

export const syncPushSchema = z.object({
  deviceId: z.string().min(1),
  mutations: z.array(syncMutationSchema).max(500),
});
