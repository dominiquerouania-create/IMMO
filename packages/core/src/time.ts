/**
 * Utilitaires temporels sans dépendance, conscients des fuseaux horaires (via Intl).
 * Toutes les instants sont des `Date` (UTC) ; les "heures murales" sont exprimées
 * dans le fuseau de l'utilisateur (ex. Europe/Paris), changements d'heure inclus.
 */

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0 = dimanche
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      weekday: 'short',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = formatter(timeZone).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '0';
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    weekday: WEEKDAYS[get('weekday')] ?? 0,
  };
}

/** Décalage (minutes) du fuseau par rapport à UTC à un instant donné. */
export function tzOffsetMinutes(date: Date, timeZone: string): number {
  const p = getZonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  const truncated = Math.floor(date.getTime() / MINUTE) * MINUTE;
  return Math.round((asUtc - truncated) / MINUTE);
}

/** Convertit une heure murale (dans `timeZone`) en instant UTC. */
export function zonedToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const off1 = tzOffsetMinutes(new Date(guess), timeZone);
  const candidate = guess - off1 * MINUTE;
  const off2 = tzOffsetMinutes(new Date(candidate), timeZone);
  return new Date(off1 === off2 ? candidate : guess - off2 * MINUTE);
}

export function parseHHmm(value: string): { hour: number; minute: number } {
  const [h, m] = value.split(':');
  return { hour: Number(h), minute: Number(m ?? 0) };
}

/** Début de journée locale (00:00 dans le fuseau) contenant `date`. */
export function startOfZonedDay(date: Date, timeZone: string): Date {
  const p = getZonedParts(date, timeZone);
  return zonedToUtc(p.year, p.month, p.day, 0, 0, timeZone);
}

/** Ajoute `n` jours calendaires locaux (robuste aux changements d'heure). */
export function addZonedDays(date: Date, n: number, timeZone: string): Date {
  const p = getZonedParts(date, timeZone);
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day + n));
  return zonedToUtc(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), p.hour, p.minute, timeZone);
}

export function dayKey(date: Date, timeZone: string): string {
  const p = getZonedParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

export function minutesBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MINUTE);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * MINUTE);
}

export function ceilTo(date: Date, granularityMinutes: number): Date {
  const g = granularityMinutes * MINUTE;
  return new Date(Math.ceil(date.getTime() / g) * g);
}

export interface Interval {
  start: Date;
  end: Date;
}

/** Soustrait une liste d'intervalles occupés d'un intervalle libre. */
export function subtractIntervals(free: Interval, busy: Interval[]): Interval[] {
  let result: Interval[] = [free];
  for (const b of busy) {
    const next: Interval[] = [];
    for (const f of result) {
      if (b.end <= f.start || b.start >= f.end) {
        next.push(f);
        continue;
      }
      if (b.start > f.start) next.push({ start: f.start, end: b.start });
      if (b.end < f.end) next.push({ start: b.end, end: f.end });
    }
    result = next;
  }
  return result;
}

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}
