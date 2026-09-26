import { describe, expect, it } from 'vitest';
import { detectConflicts, findFreeSlots, planSchedule, type CalendarEvent } from '../src';
import { MONDAY_8AM, task } from './fixtures';

const noFocus = { focusMinutesPerDay: 0, horizonDays: 5 };
const meeting = (start: string, end: string, id = 'e1'): CalendarEvent => ({ id, title: 'Réunion', start, end, kind: 'EVENT' });

describe('planSchedule', () => {
  it('place les tâches dans les heures de travail, par score décroissant', () => {
    const low = task({ id: 'low', priority: 'LOW', estimatedMinutes: 60 });
    const crit = task({ id: 'crit', priority: 'CRITICAL', estimatedMinutes: 60 });
    const res = planSchedule({ tasks: [low, crit], events: [], now: MONDAY_8AM, settings: noFocus });
    expect(res.blocks[0]).toMatchObject({ taskId: 'crit', start: '2026-09-28T06:30:00.000Z' }); // 08:30 Paris
    expect(res.blocks[1]).toMatchObject({ taskId: 'low', start: '2026-09-28T07:45:00.000Z' }); // + 10 min tampon, arrondi au 1/4 h
    expect(res.unscheduled).toEqual([]);
  });

  it('évite les réunions et respecte le tampon', () => {
    const t = task({ id: 'a', estimatedMinutes: 60, splittable: false });
    const res = planSchedule({
      tasks: [t],
      events: [meeting('2026-09-28T06:30:00.000Z', '2026-09-28T08:00:00.000Z')], // 08:30-10:00
      now: MONDAY_8AM,
      settings: noFocus,
    });
    expect(res.blocks[0]!.start).toBe('2026-09-28T08:15:00.000Z'); // 10:10 arrondi au 1/4 h → 10:15
  });

  it('découpe une tâche longue et signale le risque avant échéance', () => {
    const big = task({ id: 'big', estimatedMinutes: 600, dueAt: '2026-09-28T16:00:00.000Z', minChunkMinutes: 60 });
    const res = planSchedule({ tasks: [big], events: [], now: MONDAY_8AM, settings: noFocus });
    const chunks = res.blocks.filter((b) => b.taskId === 'big');
    expect(chunks.length).toBeGreaterThan(1);
    expect(res.atRisk[0]).toMatchObject({ taskId: 'big', reason: 'DEADLINE_MISSED' });
  });

  it('ne planifie ni les tâches terminées, ni en attente, ni manuelles', () => {
    const res = planSchedule({
      tasks: [task({ status: 'DONE' }), task({ status: 'WAITING' }), task({ autoSchedule: false })],
      events: [],
      now: MONDAY_8AM,
      settings: noFocus,
    });
    expect(res.blocks).toEqual([]);
  });

  it('respecte startAfter', () => {
    const t = task({ id: 's', startAfter: '2026-09-29T12:00:00.000Z' });
    const res = planSchedule({ tasks: [t], events: [], now: MONDAY_8AM, settings: noFocus });
    expect(new Date(res.blocks[0]!.start) >= new Date('2026-09-29T12:00:00.000Z')).toBe(true);
  });

  it('protège le temps de concentration quotidien', () => {
    const res = planSchedule({ tasks: [], events: [], now: MONDAY_8AM, settings: { horizonDays: 1, focusMinutesPerDay: 120 } });
    const focus = res.blocks.filter((b) => b.kind === 'FOCUS');
    expect(focus).toHaveLength(1);
    expect(res.dayLoads[0]!.focusMinutes).toBe(120);
  });

  it('plafonne la charge quotidienne', () => {
    const tasks = Array.from({ length: 10 }, (_, i) => task({ id: `x${i}`, estimatedMinutes: 60, splittable: false }));
    const res = planSchedule({ tasks, events: [], now: MONDAY_8AM, settings: { ...noFocus, maxTaskMinutesPerDay: 240 } });
    expect(res.dayLoads[0]!.taskMinutes).toBe(240);
  });
});

describe('agenda', () => {
  it('détecte les conflits', () => {
    const c = detectConflicts([
      meeting('2026-09-28T08:00:00.000Z', '2026-09-28T09:00:00.000Z', 'a'),
      meeting('2026-09-28T08:30:00.000Z', '2026-09-28T09:30:00.000Z', 'b'),
      meeting('2026-09-28T10:00:00.000Z', '2026-09-28T11:00:00.000Z', 'c'),
    ]);
    expect(c.map(([a, b]) => `${a.id}-${b.id}`)).toEqual(['a-b']);
  });

  it('trouve des créneaux libres', () => {
    const slots = findFreeSlots([meeting('2026-09-28T06:30:00.000Z', '2026-09-28T10:30:00.000Z')], MONDAY_8AM, 60);
    expect(slots[0]!.start.toISOString()).toBe('2026-09-28T11:30:00.000Z'); // 13:30 Paris
  });
});
