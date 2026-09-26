'use client';

import { detectConflicts, findFreeSlots, type CalendarEvent } from '@kairos/core';
import clsx from 'clsx';
import { AlertTriangle, ChevronLeft, ChevronRight, Focus, Plus, Sparkles, Wand2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, Button, Card } from '@/components/ui/primitives';
import { addDays, fmtDay, fmtTime, sameDay, startOfDay, startOfWeek } from '@/lib/format';
import { useStore } from '@/lib/store';

type View = 'day' | 'week' | 'month';
const HOUR_START = 7;
const HOUR_END = 21;
const HOUR_PX = 52;

const kindStyle: Record<CalendarEvent['kind'], string> = {
  EVENT: 'bg-surface-3 border-l-ink-3 text-ink',
  TASK_BLOCK: 'bg-primary-soft border-l-primary text-primary-ink',
  FOCUS: 'bg-good-soft border-l-good text-good',
};

export default function CalendarPage() {
  const events = useStore((s) => s.events);
  const plan = useStore((s) => s.plan);
  const replan = useStore((s) => s.replan);
  const addEvent = useStore((s) => s.addEvent);
  const selectTask = useStore((s) => s.selectTask);
  const scheduler = useStore((s) => s.prefs.scheduler);
  const [view, setView] = useState<View>('week');
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [form, setForm] = useState<{ title: string; start: string; duration: number } | null>(null);

  const days = view === 'day' ? [cursor] : Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i));
  const conflicts = useMemo(() => detectConflicts(events.filter((e) => e.kind === 'EVENT' && new Date(e.end) > new Date())), [events]);
  const slots = useMemo(() => findFreeSlots(events, new Date(), 60, scheduler, 4), [events, scheduler]);

  const step = (d: number) => setCursor(view === 'month' ? new Date(cursor.getFullYear(), cursor.getMonth() + d, 1) : addDays(cursor, d * (view === 'day' ? 1 : 7)));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight first-letter:uppercase">
            {view === 'month' ? new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(cursor) : view === 'day' ? fmtDay(cursor) : `Semaine du ${fmtDay(days[0])}`}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center">
            <Button variant="ghost" size="sm" onClick={() => step(-1)} aria-label="Précédent"><ChevronLeft size={16} /></Button>
            <Button variant="secondary" size="sm" onClick={() => setCursor(startOfDay(new Date()))}>Aujourd'hui</Button>
            <Button variant="ghost" size="sm" onClick={() => step(1)} aria-label="Suivant"><ChevronRight size={16} /></Button>
          </div>
          <div className="flex rounded-lg border border-line bg-surface p-0.5">
            {(['day', 'week', 'month'] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={clsx('h-7 rounded-md px-3 text-sm', view === v ? 'bg-primary-soft font-medium text-primary-ink' : 'text-ink-2')}>
                {{ day: 'Jour', week: 'Semaine', month: 'Mois' }[v]}
              </button>
            ))}
          </div>
          <Button variant="secondary" size="sm" onClick={() => setForm({ title: '', start: '', duration: 60 })}><Plus size={14} /> Rendez-vous</Button>
          <Button size="sm" onClick={() => replan('planification demandée')}><Wand2 size={14} /> Planifier automatiquement</Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
        <div className="min-w-0 overflow-x-auto rounded-2xl border border-line bg-surface shadow-card scrollbar-thin">
          {view === 'month' ? (
            <MonthGrid cursor={cursor} events={events} onPick={(d) => { setCursor(d); setView('day'); }} />
          ) : (
            <div className={clsx(view === 'week' && 'min-w-[760px]')}>
              <div className="sticky top-0 z-10 grid border-b border-line bg-surface" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
                <span />
                {days.map((d) => (
                  <div key={d.toISOString()} className="py-2 text-center">
                    <p className="text-[11px] text-ink-3 uppercase">{new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }).format(d)}</p>
                    <p className={clsx('mx-auto grid size-7 place-items-center rounded-full text-sm tabular', sameDay(d, new Date()) ? 'bg-primary font-semibold text-white' : 'text-ink')}>{d.getDate()}</p>
                  </div>
                ))}
              </div>
              <div className="relative grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)`, height: (HOUR_END - HOUR_START) * HOUR_PX }}>
                <div className="relative">
                  {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => (
                    <span key={i} className="absolute right-2 -translate-y-1/2 text-[10px] text-ink-3 tabular" style={{ top: i * HOUR_PX }}>{i ? `${HOUR_START + i}:00` : ''}</span>
                  ))}
                </div>
                {days.map((d) => (
                  <DayColumn key={d.toISOString()} day={d} events={events} onSelectTask={selectTask} />
                ))}
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <Card title="Légende">
            <ul className="space-y-1.5 text-xs text-ink-2">
              <li className="flex items-center gap-2"><span className="h-3 w-1 rounded bg-ink-3" /> Rendez-vous (Google Calendar)</li>
              <li className="flex items-center gap-2"><span className="h-3 w-1 rounded bg-primary" /> Tâche planifiée par l'IA</li>
              <li className="flex items-center gap-2"><span className="h-3 w-1 rounded bg-good" /> Temps de concentration protégé</li>
            </ul>
          </Card>
          {conflicts.length > 0 && (
            <Card title="Conflits détectés" icon={<AlertTriangle size={15} />}>
              <ul className="space-y-2 text-xs">
                {conflicts.slice(0, 4).map(([a, b]) => (
                  <li key={a.id + b.id} className="rounded-lg bg-warning-soft p-2 text-warning">« {a.title} » chevauche « {b.title} » ({fmtDay(a.start)} {fmtTime(b.start)})</li>
                ))}
              </ul>
            </Card>
          )}
          <Card title="Prochains créneaux libres (1 h)" icon={<Sparkles size={15} />}>
            <ul className="space-y-1.5">
              {slots.map((s) => (
                <li key={s.start.toISOString()}>
                  <button onClick={() => setForm({ title: '', start: new Date(s.start.getTime() - s.start.getTimezoneOffset() * 60_000).toISOString().slice(0, 16), duration: 60 })} className="w-full rounded-lg bg-surface-2 px-2.5 py-1.5 text-left text-xs text-ink-2 hover:bg-surface-3">
                    {fmtDay(s.start)} · {fmtTime(s.start)} – {fmtTime(s.end)}
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          {plan && (
            <Card title="Plan de l'IA" icon={<Focus size={15} />}>
              <p className="text-xs text-ink-2">
                {plan.blocks.filter((b) => b.kind === 'TASK_BLOCK').length} sessions et {plan.blocks.filter((b) => b.kind === 'FOCUS').length} blocs de concentration sur {scheduler.horizonDays} jours.
              </p>
              {plan.atRisk.length > 0 && <Badge tone="warning" className="mt-2">{plan.atRisk.length} tâche(s) à risque</Badge>}
              {plan.unscheduled.length > 0 && <Badge tone="critical" className="mt-2 ml-1">{plan.unscheduled.length} non planifiable(s)</Badge>}
            </Card>
          )}
        </aside>
      </div>

      {form && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 px-4" onClick={() => setForm(null)}>
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.title || !form.start) return;
              const start = new Date(form.start);
              addEvent({ title: form.title, start: start.toISOString(), end: new Date(start.getTime() + form.duration * 60_000).toISOString() });
              setForm(null);
            }}
            className="animate-fade-up w-full max-w-sm space-y-3 rounded-2xl border border-line bg-surface p-5 shadow-modal"
          >
            <h2 className="font-semibold">Nouveau rendez-vous</h2>
            <input autoFocus required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Titre" className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm" />
            <input required type="datetime-local" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm" />
            <select value={form.duration} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })} className="h-9 w-full rounded-lg border border-line bg-surface px-2 text-sm">
              {[15, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m} minutes</option>)}
            </select>
            <p className="text-xs text-ink-3">Synchronisé avec Google Calendar ; les tâches seront replanifiées autour.</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setForm(null)}>Annuler</Button>
              <Button type="submit">Créer</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function DayColumn({ day, events, onSelectTask }: { day: Date; events: CalendarEvent[]; onSelectTask: (id: string) => void }) {
  const dayEvents = events.filter((e) => !e.allDay && sameDay(new Date(e.start), day));
  const now = new Date();
  const top = (d: Date) => ((d.getHours() + d.getMinutes() / 60 - HOUR_START) * HOUR_PX);
  return (
    <div className="relative border-l border-line">
      {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => <div key={i} className="absolute inset-x-0 border-t border-line/70" style={{ top: i * HOUR_PX }} />)}
      {sameDay(day, now) && now.getHours() >= HOUR_START && now.getHours() < HOUR_END && (
        <div className="absolute inset-x-0 z-20 h-0.5 bg-critical" style={{ top: top(now) }}>
          <span className="absolute -top-1 -left-1 size-2.5 rounded-full bg-critical" />
        </div>
      )}
      {dayEvents.map((e) => {
        const s = new Date(e.start);
        const en = new Date(e.end);
        const t = Math.max(0, top(s));
        const h = Math.max(18, top(en) - t - 2);
        return (
          <button
            key={e.id}
            onClick={() => e.taskId && onSelectTask(e.taskId)}
            className={clsx('absolute inset-x-1 overflow-hidden rounded-md border-l-[3px] px-1.5 py-0.5 text-left text-[11px] leading-tight shadow-card transition-transform hover:z-10 hover:scale-[1.02]', kindStyle[e.kind])}
            style={{ top: t, height: h }}
            title={`${e.title} — ${fmtTime(s)} → ${fmtTime(en)}`}
          >
            <p className="truncate font-medium">{e.kind === 'FOCUS' ? '🎯 Concentration' : e.title}</p>
            {h > 30 && <p className="opacity-75 tabular">{fmtTime(s)} – {fmtTime(en)}</p>}
          </button>
        );
      })}
    </div>
  );
}

function MonthGrid({ cursor, events, onPick }: { cursor: Date; events: CalendarEvent[]; onPick: (d: Date) => void }) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = startOfWeek(first);
  return (
    <div className="grid grid-cols-7 gap-px bg-line text-xs">
      {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => <div key={d} className="bg-surface-2 py-2 text-center font-medium text-ink-3">{d}</div>)}
      {Array.from({ length: 42 }, (_, i) => addDays(start, i)).map((d) => {
        const list = events.filter((e) => sameDay(new Date(e.start), d));
        return (
          <button key={d.toISOString()} onClick={() => onPick(d)} className={clsx('min-h-24 bg-surface p-1.5 text-left hover:bg-surface-2', d.getMonth() !== first.getMonth() && 'text-ink-3')}>
            <span className={clsx('grid size-6 place-items-center rounded-full tabular', sameDay(d, new Date()) && 'bg-primary text-white')}>{d.getDate()}</span>
            {list.slice(0, 3).map((e) => (
              <p key={e.id} className={clsx('mt-0.5 truncate rounded border-l-2 px-1 text-[10px]', kindStyle[e.kind])}>{fmtTime(e.start)} {e.kind === 'FOCUS' ? 'Concentration' : e.title}</p>
            ))}
            {list.length > 3 && <p className="mt-0.5 text-[10px] text-ink-3">+{list.length - 3} autres</p>}
          </button>
        );
      })}
    </div>
  );
}
