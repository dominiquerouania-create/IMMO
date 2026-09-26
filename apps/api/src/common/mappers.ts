import type {
  Category as CoreCategory,
  CalendarEvent as CoreEvent,
  Task as CoreTask,
} from '@kairos/core';
import type { Category, CalendarEvent, ChecklistItem, Attachment, Task } from '@prisma/client';

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

type TaskWithRelations = Task & { checklist?: ChecklistItem[]; attachments?: Attachment[]; category?: Category };

/** Convertit une entité Prisma vers le modèle du domaine partagé. */
export function toCoreTask(t: TaskWithRelations): CoreTask {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    notes: t.notes,
    priority: t.priority,
    status: t.status,
    categoryId: t.categoryId,
    subcategory: t.subcategory,
    parentId: t.parentId,
    dueAt: iso(t.dueAt),
    startAfter: iso(t.startAfter),
    estimatedMinutes: t.estimatedMinutes,
    actualMinutes: t.actualMinutes,
    autoSchedule: t.autoSchedule,
    splittable: t.splittable,
    minChunkMinutes: t.minChunkMinutes ?? undefined,
    deepWork: t.deepWork,
    scheduledStart: iso(t.scheduledStart),
    scheduledEnd: iso(t.scheduledEnd),
    checklist: (t.checklist ?? []).map((c) => ({ id: c.id, label: c.label, done: c.done, dueAt: iso(c.dueAt) })),
    attachments: (t.attachments ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      mimeType: a.mimeType,
      url: a.storagePath ?? '',
      driveFileId: a.driveFileId,
      sizeBytes: a.sizeBytes ?? undefined,
    })),
    tags: t.tags,
    source: t.source,
    sourceRef: t.sourceRef,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    completedAt: iso(t.completedAt),
  };
}

export function toCoreCategory(c: Category): CoreCategory {
  return {
    id: c.id,
    name: c.name,
    color: c.color,
    icon: c.icon,
    weight: c.weight,
    subcategories: c.subcategories,
    isSystem: c.isSystem,
  };
}

export function toCoreEvent(e: CalendarEvent): CoreEvent {
  return {
    id: e.id,
    title: e.title,
    start: e.start.toISOString(),
    end: e.end.toISOString(),
    allDay: e.allDay,
    location: e.location,
    kind: e.kind,
    taskId: e.taskId,
    googleEventId: e.googleEventId,
    transparent: e.transparent,
  };
}
