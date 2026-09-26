'use client';

import type { Task } from '@kairos/core';
import clsx from 'clsx';
import { CalendarClock, CheckCircle2, Circle, ListChecks, Mail, Timer } from 'lucide-react';
import { fmtDue, fmtMinutes } from '@/lib/format';
import { useStore } from '@/lib/store';
import { CategoryDot, PriorityBadge, RiskIcon, StatusBadge } from '../ui/primitives';

export function TaskRow({ task, compact = false, showStatus = false }: { task: Task; compact?: boolean; showStatus?: boolean }) {
  const category = useStore((s) => s.categories.find((c) => c.id === task.categoryId));
  const updateTask = useStore((s) => s.updateTask);
  const selectTask = useStore((s) => s.selectTask);
  const atRisk = useStore((s) => s.plan?.atRisk.some((r) => r.taskId === task.id));
  const done = task.status === 'DONE';
  const overdue = !!task.dueAt && !done && new Date(task.dueAt) < new Date();
  const checklistDone = task.checklist.filter((c) => c.done).length;

  return (
    <div className="group flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface-2">
      <button
        onClick={() => updateTask(task.id, { status: done ? 'TODO' : 'DONE' })}
        className={clsx('mt-0.5 shrink-0 transition-colors', done ? 'text-good' : 'text-ink-3 hover:text-primary')}
        aria-label={done ? 'Marquer comme à faire' : 'Marquer comme terminée'}
      >
        {done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
      </button>
      <button onClick={() => selectTask(task.id)} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-2">
          <span className={clsx('truncate text-sm', done ? 'text-ink-3 line-through' : 'text-ink')}>{task.title}</span>
          {atRisk && !done && <RiskIcon />}
        </div>
        {!compact && (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
            {category && (
              <span className="flex items-center gap-1.5">
                <CategoryDot color={category.color} /> {category.name}
                {task.subcategory ? ` · ${task.subcategory}` : ''}
              </span>
            )}
            <span className={clsx('flex items-center gap-1', overdue && 'font-medium text-critical')}>
              <CalendarClock size={12} /> {fmtDue(task.dueAt)}
            </span>
            <span className="flex items-center gap-1"><Timer size={12} /> {fmtMinutes(task.estimatedMinutes)}</span>
            {task.checklist.length > 0 && <span className="flex items-center gap-1"><ListChecks size={12} /> {checklistDone}/{task.checklist.length}</span>}
            {task.source === 'EMAIL' && <span className="flex items-center gap-1"><Mail size={12} /> Email</span>}
          </div>
        )}
      </button>
      <div className="flex shrink-0 items-center gap-1.5">
        {showStatus && <StatusBadge status={task.status} />}
        <PriorityBadge priority={task.priority} />
      </div>
    </div>
  );
}
