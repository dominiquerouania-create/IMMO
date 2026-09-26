'use client';

import { CLOSED_STATUSES, computeMetrics, rankTasks, type AutomationEvent, type Goal } from '@kairos/core';
import clsx from 'clsx';
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  Clock,
  Flame,
  Focus,
  Gauge,
  Lightbulb,
  Mail,
  MapPin,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, type ReactNode } from 'react';
import { addDays, fmtDay, fmtMinutes, fmtTime, sameDay, startOfDay } from '@/lib/format';
import { useStore } from '@/lib/store';
import { StackedLoadBars } from '../charts/bar-charts';
import { TaskRow } from '../tasks/task-row';
import { Badge, Button, Card, Empty, Progress } from '../ui/primitives';

function useToday() {
  const now = new Date();
  return { now, start: startOfDay(now), end: addDays(startOfDay(now), 1) };
}

export function ProductivityScoreWidget() {
  const tasks = useStore((s) => s.tasks);
  const goals = useStore((s) => s.goals);
  const automations = useStore((s) => s.automations);
  const plan = useStore((s) => s.plan);
  const m = useMemo(() => {
    const now = new Date();
    return computeMetrics({
      tasks,
      goals,
      automations: automations.map((a) => ({ type: a.type as AutomationEvent['type'], at: a.at })),
      from: addDays(now, -7),
      to: addDays(now, 1),
      now,
    });
  }, [tasks, goals, automations]);
  const free = plan?.dayLoads[0]?.freeMinutes ?? 0;
  const tone = m.productivityScore >= 75 ? 'good' : m.productivityScore >= 50 ? 'primary' : 'warning';

  return (
    <Card title="Score de productivité" icon={<Gauge size={16} />} action={<Link href="/analytics" className="text-xs text-primary hover:underline">Détails</Link>}>
      <div className="flex items-end gap-3">
        <p className="text-5xl font-semibold tracking-tight text-ink tabular">{m.productivityScore}</p>
        <p className="mb-1.5 text-sm text-ink-3">/ 100 · 7 derniers jours</p>
      </div>
      <div className="mt-3">
        <Progress value={m.productivityScore} tone={tone} label="Score de productivité" />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <Kpi icon={<TrendingUp size={14} />} label="Terminées" value={m.completed} />
        <Kpi icon={<AlertTriangle size={14} />} label="En retard" value={m.overdue} alert={m.overdue > 0} />
        <Kpi icon={<Clock size={14} />} label="Temps libre aujourd'hui" value={fmtMinutes(free)} />
        <Kpi icon={<Zap size={14} />} label="Gagné grâce à l'IA" value={fmtMinutes(m.aiMinutesSaved)} />
      </dl>
    </Card>
  );
}

function Kpi({ icon, label, value, alert }: { icon: ReactNode; label: string; value: ReactNode; alert?: boolean }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2.5">
      <dt className="flex items-center gap-1.5 text-xs text-ink-3">{icon}{label}</dt>
      <dd className={clsx('mt-0.5 text-lg font-semibold tabular', alert ? 'text-critical' : 'text-ink')}>{value}</dd>
    </div>
  );
}

export function TodayPlanWidget() {
  const events = useStore((s) => s.events);
  const tasks = useStore((s) => s.tasks);
  const selectTask = useStore((s) => s.selectTask);
  const { now, start, end } = useToday();
  const items = events
    .filter((e) => new Date(e.start) < end && new Date(e.end) > start)
    .sort((a, b) => a.start.localeCompare(b.start));

  return (
    <Card title="Planning du jour" icon={<CalendarDays size={16} />} action={<Link href="/calendar" className="text-xs text-primary hover:underline">Calendrier</Link>}>
      {items.length === 0 ? (
        <Empty>Journée libre — aucun rendez-vous ni bloc planifié.</Empty>
      ) : (
        <ol className="relative space-y-1 border-l border-line pl-4">
          {items.map((e) => {
            const past = new Date(e.end) < now;
            const current = new Date(e.start) <= now && new Date(e.end) > now;
            const task = e.taskId ? tasks.find((t) => t.id === e.taskId) : undefined;
            return (
              <li key={e.id} className={clsx('relative', past && 'opacity-50')}>
                <span className={clsx('absolute top-2.5 -left-[21px] size-2.5 rounded-full border-2 border-surface', current ? 'bg-primary ring-4 ring-primary-soft' : e.kind === 'EVENT' ? 'bg-ink-3' : e.kind === 'FOCUS' ? 'bg-series-3' : 'bg-series-1')} />
                <button onClick={() => task && selectTask(task.id)} className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-surface-2">
                  <span className="w-24 shrink-0 text-xs text-ink-3 tabular">{fmtTime(e.start)} – {fmtTime(e.end)}</span>
                  <span className="flex min-w-0 items-center gap-1.5 text-sm text-ink">
                    {e.kind === 'FOCUS' && <Focus size={13} className="shrink-0 text-series-3" />}
                    {e.kind === 'TASK_BLOCK' && <Sparkles size={13} className="shrink-0 text-primary" />}
                    <span className="truncate">{e.title}</span>
                  </span>
                  {current && <Badge tone="primary" className="ml-auto">En cours</Badge>}
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}

export function PrioritiesWidget() {
  const tasks = useStore((s) => s.tasks);
  const categories = useStore((s) => s.categories);
  const ranked = useMemo(() => rankTasks(tasks.filter((t) => !t.parentId), new Date(), categories).slice(0, 6), [tasks, categories]);
  return (
    <Card title="Tâches prioritaires" icon={<Target size={16} />} action={<Link href="/tasks" className="text-xs text-primary hover:underline">Tout voir</Link>} bodyClassName="px-2">
      {ranked.length ? ranked.map(({ task }) => <TaskRow key={task.id} task={task} />) : <Empty>Rien d'urgent. 🎉</Empty>}
    </Card>
  );
}

export function RecommendationsWidget() {
  const plan = useStore((s) => s.plan);
  const tasks = useStore((s) => s.tasks);
  const emails = useStore((s) => s.emails);
  const replan = useStore((s) => s.replan);
  const recos = useMemo(() => {
    const out: Array<{ icon: ReactNode; title: string; detail: string }> = [];
    const byId = new Map(tasks.map((t) => [t.id, t]));
    for (const r of plan?.atRisk.slice(0, 2) ?? []) {
      const t = byId.get(r.taskId);
      if (!t) continue;
      out.push({
        icon: <AlertTriangle size={15} className="text-warning" />,
        title: r.reason === 'ALREADY_OVERDUE' ? `« ${t.title} » est en retard` : `« ${t.title} » risque de déborder`,
        detail: r.reason === 'ALREADY_OVERDUE' ? 'Traitez-la en premier ou renégociez l’échéance.' : `Il manque ${fmtMinutes(r.missingMinutes || 30)} avant l’échéance : déléguez ou libérez un créneau.`,
      });
    }
    const heavy = plan?.dayLoads.find((d) => d.loadRatio > 0.9);
    if (heavy) out.push({ icon: <Flame size={15} className="text-critical" />, title: `Journée surchargée le ${fmtDay(heavy.day + 'T12:00:00')}`, detail: `Charge à ${Math.round(heavy.loadRatio * 100)} % : je peux déplacer les tâches basses priorités.` });
    const urgentMail = emails.find((e) => e.importance === 'URGENT' && !e.linkedTaskId);
    if (urgentMail) out.push({ icon: <Mail size={15} className="text-primary" />, title: 'Email urgent sans tâche associée', detail: `« ${urgentMail.subject} » — transformez-le en tâche depuis la boîte de réception.` });
    const focus = plan?.dayLoads[0]?.focusMinutes ?? 0;
    out.push({ icon: <Lightbulb size={15} className="text-primary" />, title: focus >= 60 ? `${fmtMinutes(focus)} de concentration protégés aujourd'hui` : 'Peu de temps de concentration aujourd’hui', detail: focus >= 60 ? 'Coupez les notifications pendant ces blocs.' : 'Déplacez une réunion pour libérer un bloc de 90 min.' });
    return out.slice(0, 4);
  }, [plan, tasks, emails]);

  return (
    <Card title="Recommandations de l'IA" icon={<Sparkles size={16} />} action={<Button size="sm" variant="secondary" onClick={() => replan('optimisation demandée')}>Optimiser</Button>}>
      <ul className="space-y-2.5">
        {recos.map((r, i) => (
          <li key={i} className="flex gap-2.5 rounded-xl bg-surface-2 p-3">
            <span className="mt-0.5">{r.icon}</span>
            <div>
              <p className="text-sm font-medium text-ink">{r.title}</p>
              <p className="text-xs text-ink-2">{r.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function AppointmentsWidget() {
  const events = useStore((s) => s.events);
  const { now } = useToday();
  const upcoming = events
    .filter((e) => e.kind === 'EVENT' && new Date(e.end) > now && new Date(e.start) < addDays(startOfDay(now), 2))
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 5);
  return (
    <Card title="Rendez-vous" icon={<Clock size={16} />}>
      {upcoming.length ? (
        <ul className="space-y-2">
          {upcoming.map((e) => (
            <li key={e.id} className="flex items-center gap-3">
              <div className="w-14 shrink-0 rounded-lg bg-primary-soft py-1 text-center">
                <p className="text-[10px] text-primary-ink uppercase">{sameDay(new Date(e.start), now) ? 'Auj.' : 'Dem.'}</p>
                <p className="text-sm font-semibold text-primary-ink tabular">{fmtTime(e.start)}</p>
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm text-ink">{e.title}</p>
                {e.location && <p className="flex items-center gap-1 truncate text-xs text-ink-3"><MapPin size={11} /> {e.location}</p>}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>Aucun rendez-vous aujourd'hui ni demain.</Empty>
      )}
    </Card>
  );
}

export function ImportantEmailsWidget() {
  const all = useStore((s) => s.emails);
  const emails = all.filter((e) => e.importance === 'URGENT' || e.importance === 'IMPORTANT').slice(0, 4);
  const emailToTask = useStore((s) => s.emailToTask);
  return (
    <Card title="Emails importants" icon={<Mail size={16} />} action={<Link href="/inbox" className="text-xs text-primary hover:underline">Boîte</Link>}>
      <ul className="space-y-3">
        {emails.map((e) => (
          <li key={e.id} className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge tone={e.importance === 'URGENT' ? 'critical' : 'warning'}>{e.importance === 'URGENT' ? 'Urgent' : 'Important'}</Badge>
              <p className="truncate text-sm font-medium text-ink">{e.subject}</p>
            </div>
            <p className="line-clamp-2 text-xs text-ink-2">{e.summary}</p>
            {e.linkedTaskId ? (
              <p className="text-xs text-good">✓ Tâche créée</p>
            ) : (
              <button onClick={() => emailToTask(e.id)} className="text-xs font-medium text-primary hover:underline">Transformer en tâche</button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function WorkloadWidget() {
  const plan = useStore((s) => s.plan);
  const rows = (plan?.dayLoads ?? []).slice(0, 7).map((d, i) => ({
    label: i === 0 ? "Aujourd'hui" : new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric' }).format(new Date(`${d.day}T12:00:00`)),
    highlight: i === 0,
    total: d.capacityMinutes,
    values: { meetings: d.meetingMinutes, tasks: d.taskMinutes, free: d.freeMinutes },
  }));
  return (
    <Card title="Charge de travail" icon={<Gauge size={16} />}>
      <StackedLoadBars
        rows={rows}
        format={fmtMinutes}
        series={[
          { key: 'meetings', label: 'Réunions', color: 'var(--series-2)' },
          { key: 'tasks', label: 'Tâches planifiées', color: 'var(--series-1)' },
        ]}
      />
    </Card>
  );
}

export function OverdueWidget() {
  const tasks = useStore((s) => s.tasks);
  const plan = useStore((s) => s.plan);
  const now = new Date();
  const overdue = tasks.filter((t) => t.dueAt && !CLOSED_STATUSES.includes(t.status) && new Date(t.dueAt) < now);
  const risky = (plan?.atRisk ?? []).filter((r) => r.reason !== 'ALREADY_OVERDUE').map((r) => tasks.find((t) => t.id === r.taskId)).filter((t) => !!t);
  return (
    <Card title="Retards & risques" icon={<AlertTriangle size={16} />} bodyClassName="px-2">
      {overdue.length + risky.length === 0 ? (
        <Empty>Aucun retard. Tout est sous contrôle.</Empty>
      ) : (
        <>
          {overdue.map((t) => <TaskRow key={t.id} task={t} />)}
          {risky.map((t) => <TaskRow key={t.id} task={t} />)}
        </>
      )}
    </Card>
  );
}

export function CriticalWidget() {
  const tasks = useStore((s) => s.tasks);
  const critical = tasks.filter((t) => t.priority === 'CRITICAL' && !CLOSED_STATUSES.includes(t.status));
  return (
    <Card title="Tâches critiques" icon={<Flame size={16} />} bodyClassName="px-2">
      {critical.length ? critical.map((t) => <TaskRow key={t.id} task={t} />) : <Empty>Aucune mission critique en cours.</Empty>}
    </Card>
  );
}

function GoalsList({ goals }: { goals: Goal[] }) {
  const fmt = (v: number, unit: string) => (unit === '€' ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v) : `${v} ${unit}`);
  return goals.length ? (
    <ul className="space-y-3.5">
      {goals.map((g) => {
        const pct = (g.current / g.target) * 100;
        return (
          <li key={g.id}>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="text-ink">{g.title}</span>
              <span className="text-xs text-ink-2 tabular">{fmt(g.current, g.unit)} / {fmt(g.target, g.unit)}</span>
            </div>
            <Progress value={pct} tone={pct >= 100 ? 'good' : 'primary'} label={g.title} />
          </li>
        );
      })}
    </ul>
  ) : (
    <Empty>Aucun objectif défini.</Empty>
  );
}

export function WeeklyGoalsWidget() {
  const all = useStore((s) => s.goals);
  const goals = all.filter((g) => g.period === 'WEEK');
  return <Card title="Objectifs de la semaine" icon={<Target size={16} />}><GoalsList goals={goals} /></Card>;
}

export function MonthlyGoalsWidget() {
  const all = useStore((s) => s.goals);
  const goals = all.filter((g) => g.period === 'MONTH');
  return <Card title="Objectifs du mois" icon={<TrendingUp size={16} />}><GoalsList goals={goals} /></Card>;
}

export function NotificationsWidget() {
  const notifications = useStore((s) => s.notifications);
  const markRead = useStore((s) => s.markNotificationsRead);
  return (
    <Card title="Notifications importantes" icon={<Bell size={16} />} action={<button onClick={markRead} className="text-xs text-primary hover:underline">Tout lire</button>}>
      <ul className="space-y-2">
        {notifications.slice(0, 5).map((n) => (
          <li key={n.id} className={clsx('flex gap-2.5 rounded-lg p-2', !n.read && 'bg-surface-2')}>
            <span className={clsx('mt-1.5 size-2 shrink-0 rounded-full', n.level === 'critical' ? 'bg-critical' : n.level === 'warning' ? 'bg-warning' : 'bg-primary')} />
            <div>
              <p className="text-sm text-ink">{n.title}</p>
              {n.body && <p className="text-xs text-ink-2">{n.body}</p>}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export const WIDGET_COMPONENTS: Record<string, { component: () => ReactNode; span: string }> = {
  'productivity-score': { component: ProductivityScoreWidget, span: 'xl:col-span-1' },
  'today-plan': { component: TodayPlanWidget, span: 'xl:col-span-1 xl:row-span-2' },
  priorities: { component: PrioritiesWidget, span: 'xl:col-span-1' },
  'ai-recommendations': { component: RecommendationsWidget, span: 'xl:col-span-1' },
  appointments: { component: AppointmentsWidget, span: '' },
  'important-emails': { component: ImportantEmailsWidget, span: '' },
  workload: { component: WorkloadWidget, span: '' },
  overdue: { component: OverdueWidget, span: '' },
  critical: { component: CriticalWidget, span: '' },
  'weekly-goals': { component: WeeklyGoalsWidget, span: '' },
  'monthly-goals': { component: MonthlyGoalsWidget, span: '' },
  notifications: { component: NotificationsWidget, span: '' },
};
