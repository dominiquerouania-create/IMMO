import { describe, expect, it } from 'vitest';
import { addZonedDays, getZonedParts, subtractIntervals, zonedToUtc } from '../src';

describe('time', () => {
  it('convertit une heure murale Paris en UTC (été et hiver)', () => {
    expect(zonedToUtc(2026, 7, 1, 9, 0, 'Europe/Paris').toISOString()).toBe('2026-07-01T07:00:00.000Z');
    expect(zonedToUtc(2026, 12, 1, 9, 0, 'Europe/Paris').toISOString()).toBe('2026-12-01T08:00:00.000Z');
  });

  it('ajoute des jours locaux à travers le changement d\'heure', () => {
    const sat = zonedToUtc(2026, 10, 24, 9, 0, 'Europe/Paris');
    const mon = addZonedDays(sat, 2, 'Europe/Paris');
    const p = getZonedParts(mon, 'Europe/Paris');
    expect([p.day, p.hour, p.weekday]).toEqual([26, 9, 1]);
  });

  it('soustrait des intervalles occupés', () => {
    const d = (h: number) => new Date(Date.UTC(2026, 0, 1, h));
    const free = subtractIntervals({ start: d(8), end: d(18) }, [
      { start: d(10), end: d(11) },
      { start: d(14), end: d(16) },
    ]);
    expect(free.map((f) => [f.start.getUTCHours(), f.end.getUTCHours()])).toEqual([[8, 10], [11, 14], [16, 18]]);
  });
});
