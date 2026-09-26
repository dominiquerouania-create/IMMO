'use client';

import { computeMetrics, type AutomationEvent } from '@kairos/core';
import { useMemo } from 'react';
import { GroupedBarChart } from '@/components/charts/bar-charts';
import { Card } from '@/components/ui/primitives';
import { addDays, fmtMinutes, startOfWeek } from '@/lib/format';
import { useStore } from '@/lib/store';

export default function AnalyticsPage() {
  const tasks = useStore((s) => s.tasks);
  const goals = useStore((s) => s.goals);
  const automations = useStore((s) => s.automations);
  const plan = useStore((s) => s.plan);
  const categories = useStore((s) => s.categories);

  const { week, month, series } = useMemo(() => {
    const now = new Date();
    const autos = automations.map((a) => ({ type: a.type as AutomationEvent['type'], at: a.at }));
    const base = { tasks, goals, automations: autos, now };
    const week = computeMetrics({ ...base, from: startOfWeek(now), to: addDays(now, 1) });
    const month = computeMetrics({ ...base, from: new Date(now.getFullYear(), now.getMonth(), 1), to: addDays(now, 1) });
    const series = Array.from({ length: 8 }, (_, i) => {
      const from = addDays(startOfWeek(now), -7 * (7 - i));
      const to = addDays(from, 7);
      const inRange = (iso?: string | null) => !!iso && new Date(iso) >= from && new Date(iso) < to;
      return {
        label: new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(from),
        completed: tasks.filter((t) => inRange(t.completedAt)).length,
        created: tasks.filter((t) => inRange(t.createdAt)).length,
      };
    });
    return { week, month, series };
  }, [tasks, goals, automations]);

  const weekPlanned = (plan?.dayLoads ?? []).slice(0, 7).reduce((s, d) => s + d.taskMinutes, 0);
  const weekMeetings = (plan?.dayLoads ?? []).slice(0, 7).reduce((s, d) => s + d.meetingMinutes, 0);

  const kpis = [
    { label: 'Tâches terminées (semaine)', value: week.completed },
    { label: 'Tâches en retard', value: week.overdue, alert: week.overdue > 0 },
    { label: 'Charge planifiée (7 j)', value: fmtMinutes(weekPlanned + weekMeetings) },
    { label: 'Charge mensuelle réalisée', value: fmtMinutes(month.actualMinutes) },
    { label: 'Temps planifié vs réel', value: `${fmtMinutes(week.plannedMinutes)} / ${fmtMinutes(week.actualMinutes)}` },
    { label: 'Taux de ponctualité', value: `${Math.round(week.onTimeRate * 100)} %` },
    { label: "Temps gagné grâce à l'IA", value: fmtMinutes(month.aiMinutesSaved) },
    { label: 'Objectifs atteints', value: `${month.goalsAchieved} / ${month.goalsTotal}` },
  ];

  const byCategory = categories.map((c) => ({
    label: c.name,
    open: tasks.filter((t) => t.categoryId === c.id && t.status !== 'DONE' && t.status !== 'CANCELLED').length,
    done: tasks.filter((t) => t.categoryId === c.id && t.status === 'DONE').length,
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Productivité</h1>
        <div className="text-right">
          <p className="text-xs text-ink-3">Taux de productivité (semaine en cours)</p>
          <p className="text-3xl font-semibold text-ink tabular">{week.productivityScore}<span className="text-base text-ink-3">/100</span></p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="animate-fade-up rounded-2xl border border-line bg-surface p-4 shadow-card">
            <dt className="text-xs text-ink-3">{k.label}</dt>
            <dd className={`mt-1 text-2xl font-semibold tabular ${k.alert ? 'text-critical' : 'text-ink'}`}>{k.value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Tâches créées vs terminées — 8 semaines">
          <GroupedBarChart
            data={series}
            labelKey="label"
            series={[
              { key: 'created', label: 'Créées', color: 'var(--series-1)' },
              { key: 'completed', label: 'Terminées', color: 'var(--series-2)' },
            ]}
          />
        </Card>
        <Card title="Par espace — ouvertes vs terminées">
          <GroupedBarChart
            data={byCategory}
            labelKey="label"
            series={[
              { key: 'open', label: 'Ouvertes', color: 'var(--series-1)' },
              { key: 'done', label: 'Terminées', color: 'var(--series-2)' },
            ]}
          />
        </Card>
      </div>

      <Card title="Journal des automatisations IA">
        {automations.length ? (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-ink-3"><tr><th className="py-1 font-medium">Date</th><th className="font-medium">Action</th></tr></thead>
            <tbody>
              {automations.slice(0, 12).map((a) => (
                <tr key={a.id} className="border-t border-line">
                  <td className="py-1.5 pr-4 text-xs whitespace-nowrap text-ink-3">{new Date(a.at).toLocaleString('fr-FR')}</td>
                  <td className="text-ink-2">{a.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-ink-3">Les actions autonomes de l'IA (planification, tri des emails, documents…) apparaîtront ici, annulables.</p>
        )}
      </Card>
    </div>
  );
}
