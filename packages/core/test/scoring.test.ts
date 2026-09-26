import { describe, expect, it } from 'vitest';
import { rankTasks, scoreTask } from '../src';
import { MONDAY_8AM, task } from './fixtures';

describe('scoring', () => {
  it('une tâche moyenne à échéance imminente passe devant une haute sans date', () => {
    const soon = task({ id: 'soon', priority: 'MEDIUM', dueAt: '2026-09-28T12:00:00.000Z' });
    const high = task({ id: 'high', priority: 'HIGH' });
    expect(rankTasks([high, soon], MONDAY_8AM).map((r) => r.task.id)).toEqual(['soon', 'high']);
  });

  it('marque comme urgente une tâche en retard', () => {
    const late = scoreTask(task({ dueAt: '2026-09-27T12:00:00.000Z' }), MONDAY_8AM);
    expect(late.overdue).toBe(true);
    expect(late.urgent).toBe(true);
  });

  it('borne le score à 100', () => {
    const s = scoreTask(task({ priority: 'CRITICAL', dueAt: '2026-09-27T00:00:00.000Z', createdAt: '2025-01-01T00:00:00.000Z' }), MONDAY_8AM, { weight: 2 });
    expect(s.score).toBe(100);
  });
});
