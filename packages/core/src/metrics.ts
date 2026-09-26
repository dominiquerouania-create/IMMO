import { isOverdue } from './scoring';
import type { Goal, Task } from './types';

export interface AutomationEvent {
  /** Type d'action réalisée automatiquement par l'IA. */
  type:
    | 'TASK_CREATED_FROM_EMAIL'
    | 'EMAIL_SUMMARIZED'
    | 'DRAFT_GENERATED'
    | 'AUTO_SCHEDULED'
    | 'RESCHEDULED'
    | 'DOCUMENT_GENERATED'
    | 'FILE_CLASSIFIED'
    | 'REMINDER_SENT';
  at: string;
}

/** Estimation conservatrice du temps humain économisé par action automatisée (minutes). */
export const MINUTES_SAVED_PER_AUTOMATION: Record<AutomationEvent['type'], number> = {
  TASK_CREATED_FROM_EMAIL: 3,
  EMAIL_SUMMARIZED: 2,
  DRAFT_GENERATED: 6,
  AUTO_SCHEDULED: 2,
  RESCHEDULED: 3,
  DOCUMENT_GENERATED: 20,
  FILE_CLASSIFIED: 1,
  REMINDER_SENT: 0.5,
};

export interface ProductivityMetrics {
  completed: number;
  overdue: number;
  open: number;
  plannedMinutes: number;
  actualMinutes: number;
  /** Tâches terminées à temps / tâches arrivées à échéance sur la période. */
  onTimeRate: number;
  /** Temps réel / temps planifié (≈ 1 = estimation fiable). */
  estimationAccuracy: number;
  aiMinutesSaved: number;
  goalsAchieved: number;
  goalsTotal: number;
  /** Score global 0-100. */
  productivityScore: number;
}

export interface MetricsInput {
  tasks: Task[];
  goals?: Goal[];
  automations?: AutomationEvent[];
  from: Date;
  to: Date;
  now: Date;
}

const inRange = (iso: string | null | undefined, from: Date, to: Date) => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= from.getTime() && t < to.getTime();
};

export function computeMetrics({ tasks, goals = [], automations = [], from, to, now }: MetricsInput): ProductivityMetrics {
  const completedTasks = tasks.filter((t) => t.status === 'DONE' && inRange(t.completedAt, from, to));
  const overdue = tasks.filter((t) => isOverdue(t, now)).length;
  const open = tasks.filter((t) => t.status !== 'DONE' && t.status !== 'CANCELLED').length;

  const plannedMinutes = completedTasks.reduce((s, t) => s + t.estimatedMinutes, 0);
  const actualMinutes = completedTasks.reduce((s, t) => s + (t.actualMinutes ?? t.estimatedMinutes), 0);

  const dueInPeriod = tasks.filter((t) => t.status !== 'CANCELLED' && inRange(t.dueAt, from, to) && new Date(t.dueAt!) <= now);
  const onTime = dueInPeriod.filter((t) => t.status === 'DONE' && t.completedAt && t.completedAt <= t.dueAt!).length;
  const onTimeRate = dueInPeriod.length ? onTime / dueInPeriod.length : 1;

  const estimationAccuracy = plannedMinutes ? actualMinutes / plannedMinutes : 1;
  const aiMinutesSaved = Math.round(
    automations.filter((a) => inRange(a.at, from, to)).reduce((s, a) => s + MINUTES_SAVED_PER_AUTOMATION[a.type], 0),
  );

  const goalsAchieved = goals.filter((g) => g.current >= g.target).length;
  const goalProgress = goals.length
    ? goals.reduce((s, g) => s + Math.min(1, g.target ? g.current / g.target : 0), 0) / goals.length
    : 1;

  // Pondérations : ponctualité 40 %, retards 20 %, objectifs 25 %, fiabilité des estimations 15 %.
  const overduePenalty = Math.min(1, overdue / Math.max(5, open));
  const accuracyScore = 1 - Math.min(1, Math.abs(1 - estimationAccuracy));
  const productivityScore = Math.round(
    100 * (0.4 * onTimeRate + 0.2 * (1 - overduePenalty) + 0.25 * goalProgress + 0.15 * accuracyScore),
  );

  return {
    completed: completedTasks.length,
    overdue,
    open,
    plannedMinutes,
    actualMinutes,
    onTimeRate: Number(onTimeRate.toFixed(2)),
    estimationAccuracy: Number(estimationAccuracy.toFixed(2)),
    aiMinutesSaved,
    goalsAchieved,
    goalsTotal: goals.length,
    productivityScore,
  };
}
