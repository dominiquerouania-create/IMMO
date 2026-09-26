export const TZ = 'Europe/Paris';

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, ...opts });
const time = fmt({ hour: '2-digit', minute: '2-digit' });
const dayShort = fmt({ weekday: 'short', day: 'numeric', month: 'short' });
const dayLong = fmt({ weekday: 'long', day: 'numeric', month: 'long' });

export const fmtTime = (iso: string | Date) => time.format(new Date(iso));
export const fmtDay = (iso: string | Date) => dayShort.format(new Date(iso));
export const fmtDayLong = (iso: string | Date) => dayLong.format(new Date(iso));

export function fmtDue(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return 'Sans échéance';
  const d = new Date(iso);
  const days = Math.round((startOfDay(d).getTime() - startOfDay(now).getTime()) / 86_400_000);
  const t = time.format(d);
  if (days === 0) return `Aujourd'hui ${t}`;
  if (days === 1) return `Demain ${t}`;
  if (days === -1) return `Hier ${t}`;
  if (days < 0) return `Il y a ${-days} j`;
  if (days < 7) return `${fmt({ weekday: 'long' }).format(d)} ${t}`;
  return dayShort.format(d);
}

export function fmtMinutes(min: number): string {
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  const day = (x.getDay() + 6) % 7; // lundi = 0
  return addDays(x, -day);
}

export const sameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime();

export function greeting(now = new Date()): string {
  const h = now.getHours();
  return h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
}

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
