'use client';

import { CLOSED_STATUSES } from '@kairos/core';
import { ChevronDown, ChevronUp, SlidersHorizontal, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { WIDGET_COMPONENTS } from '@/components/dashboard/widgets';
import { Button } from '@/components/ui/primitives';
import { addDays, fmtDayLong, fmtMinutes, greeting, startOfDay } from '@/lib/format';
import { useStore, WIDGETS } from '@/lib/store';

export default function DashboardPage() {
  const hydrated = useStore((s) => s.hydrated);
  const prefs = useStore((s) => s.prefs);
  const setPrefs = useStore((s) => s.setPrefs);
  const events = useStore((s) => s.events);
  const tasks = useStore((s) => s.tasks);
  const plan = useStore((s) => s.plan);
  const [editing, setEditing] = useState(false);

  if (!hydrated) return <DashboardSkeleton />;

  const now = new Date();
  const end = addDays(startOfDay(now), 1);
  const meetings = events.filter((e) => e.kind === 'EVENT' && new Date(e.start) >= now && new Date(e.start) < end).length;
  const blocks = events.filter((e) => e.kind === 'TASK_BLOCK' && new Date(e.start) >= startOfDay(now) && new Date(e.start) < end).length;
  const overdue = tasks.filter((t) => t.dueAt && !CLOSED_STATUSES.includes(t.status) && new Date(t.dueAt) < now).length;
  const free = plan?.dayLoads[0]?.freeMinutes ?? 0;

  const order = prefs.widgets;
  const move = (i: number, d: -1 | 1) => {
    const next = [...order];
    const [w] = next.splice(i, 1);
    next.splice(i + d, 0, w);
    setPrefs({ widgets: next });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-3 capitalize">{fmtDayLong(now)}</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-ink">{greeting(now)} 👋</h1>
          <p className="mt-1 text-sm text-ink-2">
            <Sparkles size={14} className="mr-1.5 inline align-[-2px] text-primary" />
            {meetings} rendez-vous à venir, {blocks} sessions planifiées, {fmtMinutes(free)} libres
            {overdue > 0 && <span className="font-medium text-critical"> · {overdue} en retard</span>}
          </p>
        </div>
        <Button variant={editing ? 'primary' : 'secondary'} size="sm" onClick={() => setEditing((e) => !e)}>
          <SlidersHorizontal size={14} /> {editing ? 'Terminer' : 'Personnaliser'}
        </Button>
      </div>

      {editing && (
        <div className="animate-fade-up rounded-2xl border border-dashed border-primary/40 bg-primary-soft/40 p-4">
          <p className="mb-3 text-sm font-medium text-ink">Widgets affichés et ordre</p>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {order.map((w, i) => (
              <li key={w.key} className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2 text-sm shadow-card">
                <input type="checkbox" checked={w.visible} onChange={(e) => setPrefs({ widgets: order.map((x) => (x.key === w.key ? { ...x, visible: e.target.checked } : x)) })} aria-label={`Afficher ${w.key}`} />
                <span className="flex-1">{WIDGETS.find((x) => x.key === w.key)?.label}</span>
                <button disabled={i === 0} onClick={() => move(i, -1)} className="text-ink-3 hover:text-ink disabled:opacity-30" aria-label="Monter"><ChevronUp size={16} /></button>
                <button disabled={i === order.length - 1} onClick={() => move(i, 1)} className="text-ink-3 hover:text-ink disabled:opacity-30" aria-label="Descendre"><ChevronDown size={16} /></button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="columns-1 gap-4 md:columns-2 xl:columns-3">
        {order
          .filter((w) => w.visible && WIDGET_COMPONENTS[w.key])
          .map((w) => {
            const { component: Widget } = WIDGET_COMPONENTS[w.key];
            return (
              <div key={w.key} className="mb-4 break-inside-avoid">
                <Widget />
              </div>
            );
          })}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid animate-pulse grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-56 rounded-2xl bg-surface-2" />)}
    </div>
  );
}
