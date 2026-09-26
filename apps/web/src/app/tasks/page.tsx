'use client';

import { CLOSED_STATUSES, rankTasks, TASK_STATUSES, TASK_STATUS_LABELS, type Task, type TaskStatus } from '@kairos/core';
import clsx from 'clsx';
import { CalendarRange, GanttChartSquare, List, Plus, Search } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { TaskRow } from '@/components/tasks/task-row';
import { Button, CategoryDot, Empty } from '@/components/ui/primitives';
import { addDays, fmtDay, startOfDay, startOfWeek } from '@/lib/format';
import { useStore } from '@/lib/store';

type View = 'list' | 'calendar' | 'timeline';

export default function TasksPage() {
  return (
    <Suspense>
      <TasksView />
    </Suspense>
  );
}

function TasksView() {
  const params = useSearchParams();
  const tasks = useStore((s) => s.tasks);
  const categories = useStore((s) => s.categories);
  const addTask = useStore((s) => s.addTask);
  const selectTask = useStore((s) => s.selectTask);
  const [view, setView] = useState<View>('list');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState(params.get('category') ?? 'all');
  const [status, setStatus] = useState<'open' | 'all' | TaskStatus>('open');
  const [urgentOnly, setUrgentOnly] = useState(params.get('filter') === 'urgent');
  const [newTitle, setNewTitle] = useState('');

  const filtered = useMemo(() => {
    const now = new Date();
    const ranked = rankTasks(tasks, now, categories);
    const scoreById = new Map(ranked.map((r) => [r.task.id, r.breakdown]));
    return tasks
      .filter((t) => !t.parentId)
      .filter((t) => category === 'all' || t.categoryId === category)
      .filter((t) => (status === 'all' ? true : status === 'open' ? !CLOSED_STATUSES.includes(t.status) : t.status === status))
      .filter((t) => !urgentOnly || scoreById.get(t.id)?.urgent)
      .filter((t) => !q || `${t.title} ${t.description ?? ''} ${t.tags.join(' ')}`.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => (scoreById.get(b.id)?.score ?? -1) - (scoreById.get(a.id)?.score ?? -1));
  }, [tasks, categories, category, status, urgentOnly, q]);

  const activeCat = categories.find((c) => c.id === category);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          {activeCat && <CategoryDot color={activeCat.color} className="size-3" />}
          {activeCat ? activeCat.name : 'Toutes les tâches'}
          <span className="text-base font-normal text-ink-3">{filtered.length}</span>
        </h1>
        <div className="flex rounded-lg border border-line bg-surface p-0.5" role="tablist" aria-label="Affichage">
          {([['list', 'Liste', List], ['calendar', 'Calendrier', CalendarRange], ['timeline', 'Chronologie', GanttChartSquare]] as const).map(([v, label, Icon]) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={clsx('flex h-8 items-center gap-1.5 rounded-md px-3 text-sm', view === v ? 'bg-primary-soft font-medium text-primary-ink' : 'text-ink-2 hover:text-ink')}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm">
          <Search size={15} className="text-ink-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher" className="w-40 bg-transparent outline-none" />
        </label>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 rounded-lg border border-line bg-surface px-2 text-sm" aria-label="Catégorie">
          <option value="all">Toutes catégories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="h-9 rounded-lg border border-line bg-surface px-2 text-sm" aria-label="Statut">
          <option value="open">Ouvertes</option>
          <option value="all">Tous statuts</option>
          {TASK_STATUSES.map((s) => <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>)}
        </select>
        <label className="flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm">
          <input type="checkbox" checked={urgentOnly} onChange={(e) => setUrgentOnly(e.target.checked)} /> Urgent uniquement
        </label>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!newTitle.trim()) return;
          addTask({ title: newTitle.trim(), categoryId: category === 'all' ? 'personnel' : category });
          setNewTitle('');
        }}
        className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 shadow-card"
      >
        <Plus size={17} className="text-primary" />
        <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Ajouter une tâche… (⌘K pour la saisie intelligente)" className="h-8 flex-1 bg-transparent text-sm outline-none" />
        <Button size="sm" type="submit">Ajouter</Button>
      </form>

      {view === 'list' && <ListView tasks={filtered} />}
      {view === 'calendar' && <MonthView tasks={filtered} onSelect={selectTask} />}
      {view === 'timeline' && <TimelineView tasks={filtered} onSelect={selectTask} />}
    </div>
  );
}

function ListView({ tasks }: { tasks: Task[] }) {
  const groups: Array<[string, Task[]]> = [
    ['En cours', tasks.filter((t) => t.status === 'IN_PROGRESS')],
    ['À faire', tasks.filter((t) => t.status === 'TODO' || t.status === 'POSTPONED')],
    ['En attente', tasks.filter((t) => t.status === 'WAITING')],
    ['Terminées', tasks.filter((t) => t.status === 'DONE')],
    ['Annulées', tasks.filter((t) => t.status === 'CANCELLED')],
  ];
  if (!tasks.length) return <Empty>Aucune tâche ne correspond aux filtres.</Empty>;
  return (
    <div className="space-y-4">
      {groups.filter(([, g]) => g.length).map(([label, g]) => (
        <section key={label} className="rounded-2xl border border-line bg-surface p-2 shadow-card">
          <h2 className="px-2 pt-1 pb-2 text-xs font-semibold tracking-wide text-ink-3 uppercase">{label} · {g.length}</h2>
          {g.map((t) => <TaskRow key={t.id} task={t} />)}
        </section>
      ))}
    </div>
  );
}

function MonthView({ tasks, onSelect }: { tasks: Task[]; onSelect: (id: string) => void }) {
  const categories = useStore((s) => s.categories);
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = startOfWeek(first);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const today = startOfDay(new Date()).getTime();
  return (
    <div className="rounded-2xl border border-line bg-surface p-3 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>←</Button>
        <p className="text-sm font-semibold capitalize">{new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(first)}</p>
        <Button variant="ghost" size="sm" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>→</Button>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-line text-xs">
        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => <div key={d} className="bg-surface-2 py-1.5 text-center font-medium text-ink-3">{d}</div>)}
        {days.map((d) => {
          const dayTasks = tasks.filter((t) => t.dueAt && startOfDay(new Date(t.dueAt)).getTime() === d.getTime());
          return (
            <div key={d.toISOString()} className={clsx('min-h-24 bg-surface p-1', d.getMonth() !== first.getMonth() && 'bg-surface-2/60 text-ink-3')}>
              <p className={clsx('mb-1 grid size-6 place-items-center rounded-full tabular', d.getTime() === today && 'bg-primary font-semibold text-white')}>{d.getDate()}</p>
              {dayTasks.slice(0, 3).map((t) => (
                <button key={t.id} onClick={() => onSelect(t.id)} className="mb-0.5 flex w-full items-center gap-1 truncate rounded bg-surface-2 px-1 py-0.5 text-left text-[11px] hover:bg-surface-3">
                  <CategoryDot color={categories.find((c) => c.id === t.categoryId)?.color ?? '#94a3b8'} />
                  <span className={clsx('truncate', t.status === 'DONE' && 'line-through opacity-60')}>{t.title}</span>
                </button>
              ))}
              {dayTasks.length > 3 && <p className="px-1 text-[10px] text-ink-3">+{dayTasks.length - 3}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TimelineView({ tasks, onSelect }: { tasks: Task[]; onSelect: (id: string) => void }) {
  const categories = useStore((s) => s.categories);
  const start = startOfDay(new Date());
  const DAYS = 14;
  const span = DAYS * 86_400_000;
  const rows = tasks.filter((t) => t.dueAt || t.scheduledStart).slice(0, 30);
  const pos = (iso: string) => Math.max(0, Math.min(100, ((new Date(iso).getTime() - start.getTime()) / span) * 100));
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface p-3 shadow-card scrollbar-thin">
      <div className="min-w-[760px]">
        <div className="ml-56 grid text-[10px] text-ink-3" style={{ gridTemplateColumns: `repeat(${DAYS}, 1fr)` }}>
          {Array.from({ length: DAYS }, (_, i) => <span key={i} className="border-l border-line pl-1">{fmtDay(addDays(start, i))}</span>)}
        </div>
        {rows.length === 0 && <Empty>Aucune tâche datée.</Empty>}
        {rows.map((t) => {
          const color = categories.find((c) => c.id === t.categoryId)?.color ?? '#94a3b8';
          const from = t.scheduledStart ?? t.dueAt!;
          const to = t.dueAt ?? t.scheduledEnd ?? from;
          const left = pos(from < to ? from : to);
          const width = Math.max(1.2, pos(from < to ? to : from) - left);
          const late = t.dueAt && t.scheduledEnd && t.scheduledEnd > t.dueAt;
          return (
            <div key={t.id} className="flex items-center border-t border-line py-1.5">
              <button onClick={() => onSelect(t.id)} className="w-56 shrink-0 truncate pr-3 text-left text-sm text-ink hover:text-primary">{t.title}</button>
              <div className="relative h-5 flex-1">
                <div className="absolute top-1 h-3 rounded-full" style={{ left: `${left}%`, width: `${width}%`, background: color, opacity: t.status === 'DONE' ? 0.4 : 0.85 }} title={`${t.title}`} />
                {t.dueAt && <div className={clsx('absolute top-0 h-5 w-0.5', late ? 'bg-critical' : 'bg-ink-2')} style={{ left: `${pos(t.dueAt)}%` }} title="Échéance" />}
              </div>
            </div>
          );
        })}
        <p className="mt-2 text-xs text-ink-3">Barre : de la session planifiée par l'IA jusqu'à l'échéance · trait : échéance (rouge si la planification la dépasse).</p>
      </div>
    </div>
  );
}
