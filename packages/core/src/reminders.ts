import { addZonedDays, getZonedParts, HOUR, MINUTE, zonedToUtc } from './time';
import type { NotificationChannel, Task } from './types';

export interface ReminderPlan {
  sendAt: string;
  channel: NotificationChannel;
  kind: 'EVE' | 'BEFORE_1H' | 'BEFORE_15M' | 'MORNING' | 'D_MINUS_3' | 'OVERDUE_FOLLOWUP';
  message: string;
}

export interface ReminderPolicy {
  timeZone: string;
  /** Heure d'envoi du rappel de la veille. */
  eveHour: number;
  /** Heure du rappel matinal (missions critiques). */
  morningHour: number;
  channels: NotificationChannel[];
  /** Pas d'envoi entre ces heures (sauf critique à < 1h). */
  quietHours: { start: number; end: number };
}

export const DEFAULT_REMINDER_POLICY: ReminderPolicy = {
  timeZone: 'Europe/Paris',
  eveHour: 19,
  morningHour: 7,
  channels: ['WHATSAPP'],
  quietHours: { start: 22, end: 7 },
};

const fmtTime = (d: Date, tz: string) =>
  new Intl.DateTimeFormat('fr-FR', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(d);
const fmtDay = (d: Date, tz: string) =>
  new Intl.DateTimeFormat('fr-FR', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' }).format(d);

/**
 * Calcule les rappels d'une tâche ou d'un rendez-vous.
 * Base : la veille + 1 h avant. L'IA "augmente" automatiquement pour les missions
 * critiques (J-3, matin même, 15 min avant) et pour les tâches à risque/en retard.
 */
export function planReminders(
  item: Pick<Task, 'id' | 'title' | 'priority'> & { at: string },
  now: Date,
  opts: { policy?: Partial<ReminderPolicy>; atRisk?: boolean } = {},
): ReminderPlan[] {
  const policy = { ...DEFAULT_REMINDER_POLICY, ...opts.policy };
  const tz = policy.timeZone;
  const at = new Date(item.at);
  const escalate: boolean = item.priority === 'CRITICAL' || !!opts.atRisk;
  const plans: Array<Omit<ReminderPlan, 'channel'>> = [];
  const label = `« ${item.title} »`;

  const at_ = getZonedParts(at, tz);
  const eveDay = getZonedParts(addZonedDays(at, -1, tz), tz);
  plans.push({
    kind: 'EVE',
    sendAt: zonedToUtc(eveDay.year, eveDay.month, eveDay.day, policy.eveHour, 0, tz).toISOString(),
    message: `📅 Demain ${fmtTime(at, tz)} : ${label}`,
  });
  plans.push({
    kind: 'BEFORE_1H',
    sendAt: new Date(at.getTime() - HOUR).toISOString(),
    message: `⏰ Dans 1 heure (${fmtTime(at, tz)}) : ${label}`,
  });

  if (escalate) {
    const d3 = getZonedParts(addZonedDays(at, -3, tz), tz);
    plans.push({
      kind: 'D_MINUS_3',
      sendAt: zonedToUtc(d3.year, d3.month, d3.day, policy.morningHour + 1, 0, tz).toISOString(),
      message: `🔴 Mission critique ${fmtDay(at, tz)} : ${label}. Préparez-la dès maintenant.`,
    });
    if (at_.hour > policy.morningHour + 1) {
      plans.push({
        kind: 'MORNING',
        sendAt: zonedToUtc(at_.year, at_.month, at_.day, policy.morningHour, 30, tz).toISOString(),
        message: `🔴 Aujourd'hui ${fmtTime(at, tz)} : ${label}`,
      });
    }
    plans.push({
      kind: 'BEFORE_15M',
      sendAt: new Date(at.getTime() - 15 * MINUTE).toISOString(),
      message: `🚨 Dans 15 minutes : ${label}`,
    });
    plans.push({
      kind: 'OVERDUE_FOLLOWUP',
      sendAt: new Date(at.getTime() + 2 * HOUR).toISOString(),
      message: `❓ ${label} est-elle terminée ? Répondez FAIT ou REPORTER.`,
    });
  }

  const inQuietHours = (iso: string) => {
    const h = getZonedParts(new Date(iso), tz).hour;
    const { start, end } = policy.quietHours;
    return start > end ? h >= start || h < end : h >= start && h < end;
  };

  return plans
    .filter((p) => new Date(p.sendAt) > now)
    .filter((p) => !inQuietHours(p.sendAt) || (escalate && p.kind === 'BEFORE_15M'))
    .flatMap((p) => policy.channels.map((channel) => ({ ...p, channel })))
    .sort((a, b) => a.sendAt.localeCompare(b.sendAt));
}

