import { describe, expect, it } from 'vitest';
import { planReminders } from '../src';
import { MONDAY_8AM } from './fixtures';

const at = '2026-09-30T12:00:00.000Z'; // mercredi 14:00 Paris

describe('planReminders', () => {
  it('envoie la veille et 1 h avant par défaut', () => {
    const r = planReminders({ id: 't', title: 'RDV banque', priority: 'MEDIUM', at }, MONDAY_8AM);
    expect(r.map((x) => [x.kind, x.sendAt])).toEqual([
      ['EVE', '2026-09-29T17:00:00.000Z'],
      ['BEFORE_1H', '2026-09-30T11:00:00.000Z'],
    ]);
    expect(r[0]!.channel).toBe('WHATSAPP');
  });

  it('augmente les rappels pour une mission critique', () => {
    const r = planReminders({ id: 't', title: 'Contrôle', priority: 'CRITICAL', at }, MONDAY_8AM);
    expect(r.map((x) => x.kind)).toEqual(['EVE', 'MORNING', 'BEFORE_1H', 'BEFORE_15M', 'OVERDUE_FOLLOWUP']);
  });
});
