import { CLOSED_STATUSES, type Category, type Priority, type Task } from './types';
import { DAY, HOUR } from './time';

const PRIORITY_BASE: Record<Priority, number> = { CRITICAL: 45, HIGH: 32, MEDIUM: 20, LOW: 8 };

export interface ScoreBreakdown {
  score: number;
  priority: number;
  urgency: number;
  age: number;
  category: number;
  urgent: boolean;
  overdue: boolean;
  /** Marge (heures) entre le temps restant avant l'échéance et le travail restant. */
  slackHours: number | null;
}

/**
 * Score de priorité dynamique 0-100 (façon Motion) :
 *   priorité déclarée + urgence (marge avant échéance) + ancienneté, pondéré par la catégorie.
 * Recalculé à chaque planification : une tâche "Moyenne" dont l'échéance approche
 * finit par passer devant une tâche "Haute" sans date.
 */
export function scoreTask(task: Task, now: Date, category?: Pick<Category, 'weight'>): ScoreBreakdown {
  const priority = PRIORITY_BASE[task.priority];
  let urgency = 0;
  let slackHours: number | null = null;
  let overdue = false;

  if (task.dueAt) {
    const due = new Date(task.dueAt).getTime();
    const remainingWork = Math.max(task.estimatedMinutes - (task.actualMinutes ?? 0), 0) / 60;
    const hoursLeft = (due - now.getTime()) / HOUR;
    slackHours = hoursLeft - remainingWork;
    overdue = hoursLeft < 0;
    if (overdue) urgency = 45;
    else if (slackHours <= 2) urgency = 40;
    else if (slackHours <= 24) urgency = 32;
    else if (slackHours <= 72) urgency = 22;
    else if (slackHours <= 7 * 24) urgency = 12;
    else urgency = Math.max(0, 8 - Math.floor(slackHours / (7 * 24)));
  }

  const ageDays = (now.getTime() - new Date(task.createdAt).getTime()) / DAY;
  const age = Math.min(10, Math.max(0, Math.floor(ageDays / 3)));
  const weight = category?.weight ?? 1;
  const raw = (priority + urgency + age) * weight;
  const categoryBonus = raw - (priority + urgency + age);
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  const urgent =
    !CLOSED_STATUSES.includes(task.status) &&
    (overdue || task.priority === 'CRITICAL' || (slackHours !== null && slackHours <= 24));

  return {
    score,
    priority,
    urgency,
    age,
    category: Math.round(categoryBonus),
    urgent,
    overdue,
    slackHours,
  };
}

export function isOverdue(task: Task, now: Date): boolean {
  return !!task.dueAt && !CLOSED_STATUSES.includes(task.status) && new Date(task.dueAt) < now;
}

/** Trie les tâches ouvertes par score décroissant, puis échéance la plus proche. */
export function rankTasks(
  tasks: Task[],
  now: Date,
  categories: Category[] = [],
): Array<{ task: Task; breakdown: ScoreBreakdown }> {
  const byId = new Map(categories.map((c) => [c.id, c]));
  return tasks
    .filter((t) => !CLOSED_STATUSES.includes(t.status))
    .map((task) => ({ task, breakdown: scoreTask(task, now, byId.get(task.categoryId)) }))
    .sort((a, b) => {
      if (b.breakdown.score !== a.breakdown.score) return b.breakdown.score - a.breakdown.score;
      const da = a.task.dueAt ? new Date(a.task.dueAt).getTime() : Infinity;
      const db = b.task.dueAt ? new Date(b.task.dueAt).getTime() : Infinity;
      return da - db;
    });
}
