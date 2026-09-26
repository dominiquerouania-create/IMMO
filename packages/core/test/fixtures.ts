import type { Task } from '../src';

let n = 0;
export function task(partial: Partial<Task> = {}): Task {
  n += 1;
  return {
    id: partial.id ?? `t${n}`,
    title: partial.title ?? `Tâche ${n}`,
    priority: 'MEDIUM',
    status: 'TODO',
    categoryId: 'personnel',
    estimatedMinutes: 60,
    autoSchedule: true,
    splittable: true,
    checklist: [],
    attachments: [],
    tags: [],
    createdAt: '2026-09-20T08:00:00.000Z',
    updatedAt: '2026-09-20T08:00:00.000Z',
    ...partial,
  };
}

/** Lundi 28 septembre 2026, 08:00 à Paris (UTC+2). */
export const MONDAY_8AM = new Date('2026-09-28T06:00:00.000Z');
