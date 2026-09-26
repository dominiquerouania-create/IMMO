import { describe, expect, it } from 'vitest';
import { computeMetrics, resolveProviders } from '../src';
import { MONDAY_8AM, task } from './fixtures';

describe('computeMetrics', () => {
  it('calcule les indicateurs de la période', () => {
    const m = computeMetrics({
      tasks: [
        task({ status: 'DONE', completedAt: '2026-09-27T10:00:00.000Z', dueAt: '2026-09-27T12:00:00.000Z', estimatedMinutes: 60, actualMinutes: 60 }),
        task({ dueAt: '2026-09-26T12:00:00.000Z' }),
      ],
      automations: [{ type: 'DOCUMENT_GENERATED', at: '2026-09-25T10:00:00.000Z' }],
      goals: [{ id: 'g', title: 'x', period: 'WEEK', periodStart: '2026-09-21', target: 4, current: 2, unit: 'tâches' }],
      from: new Date('2026-09-21T00:00:00.000Z'),
      to: new Date('2026-09-28T00:00:00.000Z'),
      now: MONDAY_8AM,
    });
    expect(m).toMatchObject({ completed: 1, overdue: 1, onTimeRate: 0.5, aiMinutesSaved: 20, estimationAccuracy: 1 });
    expect(m.productivityScore).toBeGreaterThan(0);
    expect(m.productivityScore).toBeLessThanOrEqual(100);
  });
});

describe('resolveProviders', () => {
  it('suit la table de routage et ignore les moteurs non configurés', () => {
    expect(resolveProviders('documents-microsoft', new Set(['claude']))).toEqual(['claude']);
    expect(resolveProviders('code', new Set(['claude', 'claude-code']))).toEqual(['claude-code', 'claude']);
  });
});
