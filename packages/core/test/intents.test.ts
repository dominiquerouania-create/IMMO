import { describe, expect, it } from 'vitest';
import { parseCommand } from '../src';
import { MONDAY_8AM } from './fixtures';

const parse = (s: string) => parseCommand(s, MONDAY_8AM, 'Europe/Paris');

describe('parseCommand', () => {
  it('« Ajoute une réunion demain à 14h. »', () => {
    const r = parse('Ajoute une réunion demain à 14h.');
    expect(r.intent).toBe('CREATE_EVENT');
    expect(r.entities.date).toBe('2026-09-29T12:00:00.000Z');
    expect(r.entities.title).toBe('Réunion');
    expect(r.entities.durationMinutes).toBe(60);
  });

  it('« Prépare mon planning de demain. »', () => {
    const r = parse('Prépare mon planning de demain.');
    expect(r.intent).toBe('PLAN_DAY');
    expect(r.entities.date?.startsWith('2026-09-29')).toBe(true);
  });

  it('« Quelles sont mes priorités aujourd\'hui ? »', () => {
    expect(parse("Quelles sont mes priorités aujourd'hui ?").intent).toBe('QUERY_PRIORITIES');
  });

  it('« Transforme cet email en tâche. »', () => {
    expect(parse('Transforme cet email en tâche.').intent).toBe('EMAIL_TO_TASK');
  });

  it('« Montre-moi tout ce qui est urgent. »', () => {
    expect(parse('Montre-moi tout ce qui est urgent.').intent).toBe('SHOW_URGENT');
  });

  it('saisie rapide façon Todoist', () => {
    const r = parse('Appeler la banque vendredi 10h30 #sci !urgent 30min');
    expect(r.intent).toBe('CREATE_TASK');
    expect(r.entities).toMatchObject({
      title: 'Appeler la banque',
      categoryId: 'sci-cambraie',
      priority: 'HIGH',
      durationMinutes: 30,
      date: '2026-10-02T08:30:00.000Z',
      hasTime: true,
    });
  });

  it('devine la catégorie par mots-clés', () => {
    expect(parse('Relancer le fournisseur pour le devis chantier').entities.categoryId).toBe('iris-renov');
  });

  it('date littérale', () => {
    expect(parse('Déposer le permis le 15 octobre').entities.date).toBe('2026-10-15T16:00:00.000Z');
  });
});
