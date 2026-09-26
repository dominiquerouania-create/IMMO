import { rankTasks } from './scoring';
import {
  addMinutes,
  addZonedDays,
  ceilTo,
  dayKey,
  getZonedParts,
  minutesBetween,
  overlaps,
  parseHHmm,
  startOfZonedDay,
  subtractIntervals,
  zonedToUtc,
  type Interval,
} from './time';
import type { CalendarEvent, Category, SchedulerSettings, Task, Weekday } from './types';

export const DEFAULT_SCHEDULER_SETTINGS: SchedulerSettings = {
  workingHours: {
    timeZone: 'Europe/Paris',
    days: {
      1: [{ start: '08:30', end: '12:30' }, { start: '13:30', end: '18:30' }],
      2: [{ start: '08:30', end: '12:30' }, { start: '13:30', end: '18:30' }],
      3: [{ start: '08:30', end: '12:30' }, { start: '13:30', end: '18:30' }],
      4: [{ start: '08:30', end: '12:30' }, { start: '13:30', end: '18:30' }],
      5: [{ start: '08:30', end: '12:30' }, { start: '13:30', end: '17:30' }],
      6: [{ start: '09:00', end: '12:00' }],
    },
  },
  focusMinutesPerDay: 120,
  minFocusBlockMinutes: 60,
  bufferMinutes: 10,
  maxTaskMinutesPerDay: 360,
  horizonDays: 14,
  slotGranularityMinutes: 15,
};

export interface ScheduledBlock {
  taskId: string | null;
  kind: 'TASK_BLOCK' | 'FOCUS';
  title: string;
  start: string;
  end: string;
}

export interface AtRiskTask {
  taskId: string;
  dueAt: string;
  /** Fin prévisionnelle de la dernière session (null si non planifiable). */
  projectedEnd: string | null;
  missingMinutes: number;
  reason: 'DEADLINE_MISSED' | 'NOT_ENOUGH_CAPACITY' | 'ALREADY_OVERDUE';
}

export interface DayLoad {
  day: string;
  capacityMinutes: number;
  meetingMinutes: number;
  taskMinutes: number;
  focusMinutes: number;
  freeMinutes: number;
  /** Taux de charge 0-1+ (réunions + tâches) / capacité. */
  loadRatio: number;
}

export interface ScheduleResult {
  generatedAt: string;
  blocks: ScheduledBlock[];
  atRisk: AtRiskTask[];
  unscheduled: Array<{ taskId: string; reason: string }>;
  dayLoads: DayLoad[];
}

export interface ScheduleInput {
  tasks: Task[];
  events: CalendarEvent[];
  categories?: Category[];
  settings?: Partial<SchedulerSettings>;
  now: Date;
}

interface DayWindow {
  key: string;
  working: Interval[];
  free: Interval[];
  capacity: number;
  meetings: number;
  taskMinutes: number;
  focusMinutes: number;
}

const toIso = (d: Date) => d.toISOString();

function buildDayWindows(settings: SchedulerSettings, now: Date): Array<{ key: string; working: Interval[] }> {
  const tz = settings.workingHours.timeZone;
  const firstDay = startOfZonedDay(now, tz);
  const earliest = ceilTo(now, settings.slotGranularityMinutes);
  const windows: Array<{ key: string; working: Interval[] }> = [];

  for (let d = 0; d < settings.horizonDays; d++) {
    const day = addZonedDays(firstDay, d, tz);
    const p = getZonedParts(day, tz);
    const ranges = settings.workingHours.days[p.weekday as Weekday] ?? [];
    const working: Interval[] = [];
    for (const r of ranges) {
      const s = parseHHmm(r.start);
      const e = parseHHmm(r.end);
      let start = zonedToUtc(p.year, p.month, p.day, s.hour, s.minute, tz);
      const end = zonedToUtc(p.year, p.month, p.day, e.hour, e.minute, tz);
      if (end <= earliest) continue;
      if (start < earliest) start = earliest;
      if (end > start) working.push({ start, end });
    }
    windows.push({ key: dayKey(day, tz), working });
  }
  return windows;
}

/** Évènements qui bloquent l'agenda (les blocs Kairos existants sont re-planifiés). */
function busyIntervals(input: ScheduleInput, bufferMinutes: number): Interval[] {
  const busy: Interval[] = [];
  for (const e of input.events) {
    if (e.transparent || e.kind !== 'EVENT') continue;
    busy.push({
      start: addMinutes(new Date(e.start), -bufferMinutes),
      end: addMinutes(new Date(e.end), bufferMinutes),
    });
  }
  // Tâches placées manuellement (autoSchedule = false) : l'IA ne les déplace pas.
  for (const t of input.tasks) {
    if (!t.autoSchedule && t.scheduledStart && t.scheduledEnd && t.status !== 'DONE' && t.status !== 'CANCELLED') {
      busy.push({ start: new Date(t.scheduledStart), end: addMinutes(new Date(t.scheduledEnd), bufferMinutes) });
    }
  }
  return busy.sort((a, b) => a.start.getTime() - b.start.getTime());
}

function sumMinutes(intervals: Interval[]): number {
  return intervals.reduce((s, i) => s + minutesBetween(i.start, i.end), 0);
}

/**
 * Moteur de planification automatique (inspiré Motion + Reclaim).
 *
 * 1. Calcule les créneaux libres sur l'horizon (heures de travail − réunions − tampons).
 * 2. Classe les tâches par score dynamique (priorité × urgence × catégorie).
 * 3. Place chaque tâche au plus tôt, en la découpant si autorisé, sans dépasser la
 *    charge quotidienne maximale ; le travail profond privilégie les longs créneaux.
 * 4. Signale les tâches qui ne tiendront pas avant l'échéance (à risque).
 * 5. Protège ensuite le temps de concentration quotidien dans les créneaux restants.
 *
 * Fonction pure et déterministe : elle tourne côté serveur (cron, webhooks) et côté
 * client (mode hors ligne) avec le même résultat.
 */
export function planSchedule(input: ScheduleInput): ScheduleResult {
  const settings: SchedulerSettings = { ...DEFAULT_SCHEDULER_SETTINGS, ...input.settings };
  const { now } = input;
  const buffer = settings.bufferMinutes;
  const busy = busyIntervals(input, buffer);

  const days: DayWindow[] = buildDayWindows(settings, now).map(({ key, working }) => {
    const free = working
      .flatMap((w) => subtractIntervals(w, busy))
      .map((f) => ({ start: ceilTo(f.start, settings.slotGranularityMinutes), end: f.end }));
    const capacity = sumMinutes(working);
    return {
      key,
      working,
      free: free.filter((f) => minutesBetween(f.start, f.end) >= settings.slotGranularityMinutes),
      capacity,
      meetings: capacity - sumMinutes(working.flatMap((w) => subtractIntervals(w, busy))),
      taskMinutes: 0,
      focusMinutes: 0,
    };
  });

  const blocks: ScheduledBlock[] = [];
  const atRisk: AtRiskTask[] = [];
  const unscheduled: Array<{ taskId: string; reason: string }> = [];

  const candidates = rankTasks(input.tasks, now, input.categories).filter(
    ({ task }) => task.autoSchedule && task.status !== 'WAITING',
  );

  for (const { task } of candidates) {
    let remaining = Math.max(0, task.estimatedMinutes - (task.actualMinutes ?? 0));
    if (remaining === 0) continue;
    const minChunk = task.splittable ? Math.min(task.minChunkMinutes ?? 30, remaining) : remaining;
    const startAfter = task.startAfter ? new Date(task.startAfter) : null;
    let lastEnd: Date | null = null;

    for (const day of days) {
      if (remaining === 0) break;
      const capLeft = settings.maxTaskMinutesPerDay - day.taskMinutes;
      if (capLeft < Math.min(minChunk, remaining)) continue;

      // Deep work : essaie d'abord les créneaux assez longs pour un vrai bloc de concentration.
      const order = [...day.free.keys()];
      if (task.deepWork) {
        const need = Math.min(remaining, settings.minFocusBlockMinutes);
        order.sort((a, b) => {
          const la = minutesBetween(day.free[a]!.start, day.free[a]!.end) >= need ? 0 : 1;
          const lb = minutesBetween(day.free[b]!.start, day.free[b]!.end) >= need ? 0 : 1;
          return la - lb || a - b;
        });
      }

      for (const idx of order) {
        if (remaining === 0) break;
        const slot = day.free[idx]!;
        const slotStart = startAfter && startAfter > slot.start ? ceilTo(startAfter, settings.slotGranularityMinutes) : slot.start;
        const available = minutesBetween(slotStart, slot.end);
        const dayCap = settings.maxTaskMinutesPerDay - day.taskMinutes;
        const chunk = Math.min(remaining, available, dayCap);
        if (chunk <= 0 || chunk < minChunk) continue;

        const end = addMinutes(slotStart, chunk);
        blocks.push({ taskId: task.id, kind: 'TASK_BLOCK', title: task.title, start: toIso(slotStart), end: toIso(end) });
        day.taskMinutes += chunk;
        if (task.deepWork && chunk >= settings.minFocusBlockMinutes) day.focusMinutes += chunk;
        remaining -= chunk;
        lastEnd = end;

        // Le créneau est consommé depuis son début, tampon compris.
        const newStart = ceilTo(addMinutes(end, buffer), settings.slotGranularityMinutes);
        day.free[idx] = { start: newStart, end: slot.end };
        if (slotStart > slot.start) day.free.push({ start: slot.start, end: slotStart });
      }
      day.free = day.free
        .filter((f) => minutesBetween(f.start, f.end) >= settings.slotGranularityMinutes)
        .sort((a, b) => a.start.getTime() - b.start.getTime());
    }

    if (task.dueAt) {
      const due = new Date(task.dueAt);
      if (due < now) {
        atRisk.push({ taskId: task.id, dueAt: task.dueAt, projectedEnd: lastEnd ? toIso(lastEnd) : null, missingMinutes: remaining, reason: 'ALREADY_OVERDUE' });
      } else if (remaining > 0) {
        atRisk.push({ taskId: task.id, dueAt: task.dueAt, projectedEnd: lastEnd ? toIso(lastEnd) : null, missingMinutes: remaining, reason: 'NOT_ENOUGH_CAPACITY' });
      } else if (lastEnd && lastEnd > due) {
        atRisk.push({ taskId: task.id, dueAt: task.dueAt, projectedEnd: toIso(lastEnd), missingMinutes: 0, reason: 'DEADLINE_MISSED' });
      }
    }
    if (remaining > 0) {
      unscheduled.push({
        taskId: task.id,
        reason: task.splittable
          ? `Capacité insuffisante sur ${settings.horizonDays} jours (${remaining} min restantes)`
          : `Aucun créneau continu de ${remaining} min disponible`,
      });
    }
  }

  // Protection du temps de concentration (Reclaim) dans ce qui reste de libre.
  if (settings.focusMinutesPerDay > 0) {
    for (const day of days) {
      if (day.capacity === 0) continue;
      let deficit = settings.focusMinutesPerDay - day.focusMinutes;
      const bySize = [...day.free].sort(
        (a, b) => minutesBetween(b.start, b.end) - minutesBetween(a.start, a.end),
      );
      for (const slot of bySize) {
        if (deficit < settings.minFocusBlockMinutes) break;
        const len = Math.min(minutesBetween(slot.start, slot.end), deficit);
        if (len < settings.minFocusBlockMinutes) break;
        const end = addMinutes(slot.start, len);
        blocks.push({ taskId: null, kind: 'FOCUS', title: 'Temps de concentration', start: toIso(slot.start), end: toIso(end) });
        day.focusMinutes += len;
        deficit -= len;
        day.free = day.free.flatMap((f) => (f === slot ? subtractIntervals(f, [{ start: slot.start, end: addMinutes(end, buffer) }]) : [f]));
      }
    }
  }

  blocks.sort((a, b) => a.start.localeCompare(b.start));

  return {
    generatedAt: toIso(now),
    blocks,
    atRisk,
    unscheduled,
    dayLoads: days.map((d) => {
      const free = Math.max(0, d.capacity - d.meetings - d.taskMinutes);
      return {
        day: d.key,
        capacityMinutes: d.capacity,
        meetingMinutes: d.meetings,
        taskMinutes: d.taskMinutes,
        focusMinutes: d.focusMinutes,
        freeMinutes: free,
        loadRatio: d.capacity === 0 ? 0 : Number(((d.meetings + d.taskMinutes) / d.capacity).toFixed(2)),
      };
    }),
  };
}

/** Détecte les chevauchements entre évènements bloquants (conflits d'agenda). */
export function detectConflicts(events: CalendarEvent[]): Array<[CalendarEvent, CalendarEvent]> {
  const blocking = events
    .filter((e) => !e.transparent && !e.allDay)
    .sort((a, b) => a.start.localeCompare(b.start));
  const conflicts: Array<[CalendarEvent, CalendarEvent]> = [];
  for (let i = 0; i < blocking.length; i++) {
    for (let j = i + 1; j < blocking.length; j++) {
      const a = blocking[i]!;
      const b = blocking[j]!;
      if (b.start >= a.end) break;
      if (overlaps({ start: new Date(a.start), end: new Date(a.end) }, { start: new Date(b.start), end: new Date(b.end) })) {
        conflicts.push([a, b]);
      }
    }
  }
  return conflicts;
}

/** Créneaux libres d'au moins `durationMinutes` (pour proposer un rendez-vous). */
export function findFreeSlots(
  events: CalendarEvent[],
  now: Date,
  durationMinutes: number,
  settings: Partial<SchedulerSettings> = {},
  limit = 5,
): Interval[] {
  const s: SchedulerSettings = { ...DEFAULT_SCHEDULER_SETTINGS, ...settings };
  const busy = busyIntervals({ tasks: [], events, now }, s.bufferMinutes);
  const out: Interval[] = [];
  for (const { working } of buildDayWindows(s, now)) {
    for (const w of working) {
      for (const raw of subtractIntervals(w, busy)) {
        const f = { start: ceilTo(raw.start, s.slotGranularityMinutes), end: raw.end };
        if (minutesBetween(f.start, f.end) >= durationMinutes) {
          out.push({ start: f.start, end: addMinutes(f.start, durationMinutes) });
          if (out.length >= limit) return out;
        }
      }
    }
  }
  return out;
}

/** Tâches dont la session planifiée est passée sans être terminée → à replanifier. */
export function findMissedTasks(tasks: Task[], now: Date): Task[] {
  return tasks.filter(
    (t) =>
      t.autoSchedule &&
      t.scheduledEnd &&
      new Date(t.scheduledEnd) < now &&
      (t.status === 'TODO' || t.status === 'IN_PROGRESS'),
  );
}
