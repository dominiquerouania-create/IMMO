'use client';

import { addMinutes, CLOSED_STATUSES, parseCommand, rankTasks } from '@kairos/core';
import { api, isDemoMode } from './api';
import { fmtDayLong, fmtTime, TZ } from './format';
import { useStore } from './store';

export interface AssistantReply {
  intent: string;
  speech: string;
  navigate?: string;
}

/**
 * Exécute une commande vocale/texte. En ligne : l'API (repli LLM inclus).
 * Hors ligne ou mode démo : parseur local + store (mêmes intentions).
 */
export async function runCommand(text: string): Promise<AssistantReply> {
  if (!isDemoMode() && navigator.onLine) {
    try {
      return await api<AssistantReply>('/assistant/command', { method: 'POST', json: { text } });
    } catch {
      /* repli local */
    }
  }
  const s = useStore.getState();
  const { intent, entities: e } = parseCommand(text, new Date(), TZ);
  const now = new Date();

  switch (intent) {
    case 'CREATE_EVENT': {
      if (!e.date) return { intent, speech: 'Pour quand dois-je planifier ce rendez-vous ?' };
      s.addEvent({ title: e.title || 'Réunion', start: e.date, end: addMinutes(new Date(e.date), e.durationMinutes ?? 60).toISOString() });
      return { intent, speech: `C'est noté : « ${e.title || 'Réunion'} » ${fmtDayLong(e.date)} à ${fmtTime(e.date)}.`, navigate: '/calendar' };
    }
    case 'CREATE_TASK': {
      const t = s.quickAdd(text);
      return { intent, speech: `Tâche ajoutée : « ${t.title} ». Je l'ai planifiée.` };
    }
    case 'PLAN_DAY': {
      const plan = s.replan('commande vocale');
      const day = e.date ? new Date(e.date).toDateString() : now.toDateString();
      const blocks = plan.blocks.filter((b) => new Date(b.start).toDateString() === day);
      return {
        intent,
        speech: `Planning prêt : ${blocks.filter((b) => b.kind === 'TASK_BLOCK').length} sessions de travail et ${blocks.filter((b) => b.kind === 'FOCUS').length} bloc(s) de concentration.${plan.atRisk.length ? ` ${plan.atRisk.length} tâche(s) à risque.` : ''}`,
        navigate: '/calendar',
      };
    }
    case 'QUERY_PRIORITIES': {
      const top = rankTasks(s.tasks, now, s.categories).slice(0, 5);
      return { intent, speech: top.length ? `Vos priorités : ${top.map((r, i) => `${i + 1}. ${r.task.title}`).join(' ; ')}.` : 'Aucune tâche ouverte.', navigate: '/tasks' };
    }
    case 'SHOW_URGENT': {
      const urgent = rankTasks(s.tasks, now, s.categories).filter((r) => r.breakdown.urgent);
      const mails = s.emails.filter((m) => m.importance === 'URGENT').length;
      return { intent, speech: `${urgent.length} tâche(s) urgente(s) et ${mails} email(s) urgent(s).${urgent[0] ? ` La plus pressante : ${urgent[0].task.title}.` : ''}`, navigate: '/tasks?filter=urgent' };
    }
    case 'EMAIL_TO_TASK': {
      const email = s.emails.find((m) => !m.linkedTaskId && m.importance !== 'LOW');
      if (!email) return { intent, speech: "Je n'ai pas trouvé d'email à transformer." };
      const t = s.emailToTask(email.id);
      return { intent, speech: `Email transformé en tâche : « ${t?.title} ».` };
    }
    case 'SUMMARIZE_EMAILS': {
      const important = s.emails.filter((m) => m.importance === 'URGENT' || m.importance === 'IMPORTANT');
      return { intent, speech: `${important.length} emails importants. ${important.map((m) => m.summary).join(' ')}`, navigate: '/inbox' };
    }
    case 'RESCHEDULE':
      s.replan('demande de report');
      return { intent, speech: "J'ai réorganisé votre agenda.", navigate: '/calendar' };
    default: {
      const open = s.tasks.filter((t) => !CLOSED_STATUSES.includes(t.status)).length;
      return { intent: 'UNKNOWN', speech: `Je n'ai pas compris. Vous avez ${open} tâches ouvertes. Essayez : « Quelles sont mes priorités aujourd'hui ? »` };
    }
  }
}
