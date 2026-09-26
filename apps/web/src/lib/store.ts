'use client';

import {
  DEFAULT_AI_ROUTING,
  DEFAULT_SCHEDULER_SETTINGS,
  parseCommand,
  planSchedule,
  type AiRoutingRule,
  type CalendarEvent,
  type Category,
  type Email,
  type Goal,
  type ScheduleResult,
  type SchedulerSettings,
  type SyncMutation,
  type Task,
} from '@kairos/core';
import { del, get, set } from 'idb-keyval';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { buildDemoData } from './demo-data';
import { TZ, uid } from './format';

export interface AppNotification {
  id: string;
  at: string;
  title: string;
  body?: string;
  level: 'info' | 'warning' | 'critical';
  read: boolean;
}

export interface Automation {
  id: string;
  at: string;
  type: string;
  summary: string;
}

export interface DocEntry {
  id: string;
  title: string;
  type: string;
  format: 'pdf' | 'docx';
  categoryId?: string;
  createdAt: string;
  driveUrl?: string | null;
}

export interface WidgetPref {
  key: string;
  visible: boolean;
}

export interface Preferences {
  theme: 'system' | 'light' | 'dark';
  autonomyLevel: 1 | 2 | 3 | 4 | 5;
  scheduler: SchedulerSettings;
  aiRouting: AiRoutingRule[];
  reminders: { eve: boolean; oneHour: boolean; escalateCritical: boolean; whatsappNumber: string };
  widgets: WidgetPref[];
}

export const WIDGETS: Array<{ key: string; label: string }> = [
  { key: 'productivity-score', label: 'Score de productivité' },
  { key: 'today-plan', label: 'Planning du jour' },
  { key: 'priorities', label: 'Tâches prioritaires' },
  { key: 'ai-recommendations', label: 'Recommandations IA' },
  { key: 'appointments', label: 'Rendez-vous' },
  { key: 'important-emails', label: 'Emails importants' },
  { key: 'workload', label: 'Charge de travail' },
  { key: 'overdue', label: 'Retards & risques' },
  { key: 'critical', label: 'Tâches critiques' },
  { key: 'weekly-goals', label: 'Objectifs de la semaine' },
  { key: 'monthly-goals', label: 'Objectifs du mois' },
  { key: 'notifications', label: 'Notifications' },
];

interface State {
  hydrated: boolean;
  tasks: Task[];
  categories: Category[];
  events: CalendarEvent[];
  emails: Email[];
  goals: Goal[];
  documents: DocEntry[];
  notifications: AppNotification[];
  automations: Automation[];
  prefs: Preferences;
  plan: ScheduleResult | null;
  /** File d'attente des mutations hors ligne, rejouée par sync.ts. */
  outbox: SyncMutation[];
  lastSyncAt: string | null;
  deviceId: string;
  selectedTaskId: string | null;

  addTask: (input: Partial<Task> & { title: string }) => Task;
  quickAdd: (text: string) => Task;
  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  toggleChecklist: (taskId: string, itemId: string) => void;
  addEvent: (e: Omit<CalendarEvent, 'id' | 'kind'>) => void;
  emailToTask: (emailId: string) => Task | null;
  replan: (reason?: string) => ScheduleResult;
  addCategory: (c: Omit<Category, 'id'>) => void;
  addDocument: (d: Omit<DocEntry, 'id' | 'createdAt'>) => void;
  markNotificationsRead: () => void;
  setPrefs: (patch: Partial<Preferences>) => void;
  selectTask: (id: string | null) => void;
  logAutomation: (type: string, summary: string) => void;
  resetDemo: () => void;
}

/** Stockage IndexedDB (plus robuste et plus volumineux que localStorage). */
const hasIdb = () => typeof indexedDB !== 'undefined';
const idbStorage: StateStorage = {
  getItem: async (name) => (hasIdb() ? ((await get<string>(name)) ?? null) : null),
  setItem: (name, value) => (hasIdb() ? set(name, value) : undefined),
  removeItem: (name) => (hasIdb() ? del(name) : undefined),
};

const defaultPrefs: Preferences = {
  theme: 'system',
  autonomyLevel: 5,
  scheduler: DEFAULT_SCHEDULER_SETTINGS,
  aiRouting: DEFAULT_AI_ROUTING,
  reminders: { eve: true, oneHour: true, escalateCritical: true, whatsappNumber: '' },
  widgets: WIDGETS.map((w) => ({ key: w.key, visible: true })),
};

const now = () => new Date().toISOString();

function mutation(op: SyncMutation['op'], entityId: string, payload: Record<string, unknown>, baseVersion?: number): SyncMutation {
  return { clientMutationId: uid(), entity: 'task', op, entityId, payload, baseVersion, occurredAt: now() };
}

/** Applique un plan : remplace les blocs Kairos, garde les évènements externes. */
function applyPlan(state: Pick<State, 'tasks' | 'events'>, plan: ScheduleResult) {
  const external = state.events.filter((e) => e.kind === 'EVENT');
  const blocks: CalendarEvent[] = plan.blocks.map((b) => ({
    id: `blk-${b.taskId ?? 'focus'}-${b.start}`,
    title: b.title,
    start: b.start,
    end: b.end,
    kind: b.kind,
    taskId: b.taskId,
  }));
  const windows = new Map<string, { start: string; end: string }>();
  for (const b of plan.blocks) {
    if (!b.taskId) continue;
    const w = windows.get(b.taskId);
    windows.set(b.taskId, { start: w?.start ?? b.start, end: b.end });
  }
  const tasks = state.tasks.map((t) =>
    t.autoSchedule ? { ...t, scheduledStart: windows.get(t.id)?.start ?? null, scheduledEnd: windows.get(t.id)?.end ?? null } : t,
  );
  return { events: [...external, ...blocks], tasks };
}

export const useStore = create<State>()(
  persist(
    (setState, getState) => {
      const demo = buildDemoData();
      return {
        hydrated: false,
        ...demo,
        documents: [],
        notifications: [
          { id: uid(), at: now(), title: 'Mission critique demain', body: 'PV de contrôle — entrepôt Lesquin (12:00)', level: 'critical', read: false },
          { id: uid(), at: now(), title: 'Email urgent de la banque', body: 'Pièces du prêt SCI attendues avant jeudi', level: 'warning', read: false },
        ],
        prefs: defaultPrefs,
        plan: null,
        outbox: [],
        lastSyncAt: null,
        deviceId: uid(),
        selectedTaskId: null,

        addTask: (input) => {
          const task: Task = {
            id: uid(),
            priority: 'MEDIUM',
            status: 'TODO',
            categoryId: 'personnel',
            estimatedMinutes: 30,
            autoSchedule: true,
            splittable: true,
            checklist: [],
            attachments: [],
            tags: [],
            source: 'MANUAL',
            createdAt: now(),
            updatedAt: now(),
            ...input,
          };
          setState((s) => ({
            tasks: [task, ...s.tasks],
            outbox: [...s.outbox, mutation('create', task.id, { ...task, checklist: task.checklist })],
          }));
          getState().replan('nouvelle tâche');
          return task;
        },

        quickAdd: (text) => {
          const { entities: e } = parseCommand(text, new Date(), TZ);
          return getState().addTask({
            title: e.title || text,
            priority: e.priority ?? 'MEDIUM',
            categoryId: e.categoryId ?? 'personnel',
            dueAt: e.date ?? null,
            estimatedMinutes: e.durationMinutes ?? 30,
            tags: e.tags ?? [],
          });
        },

        updateTask: (id, patch) => {
          setState((s) => ({
            tasks: s.tasks.map((t) =>
              t.id === id
                ? {
                    ...t,
                    ...patch,
                    updatedAt: now(),
                    completedAt: patch.status === 'DONE' && t.status !== 'DONE' ? now() : patch.status && patch.status !== 'DONE' ? null : t.completedAt,
                  }
                : t,
            ),
            outbox: [...s.outbox, mutation('update', id, patch as Record<string, unknown>)],
          }));
          getState().replan('tâche modifiée');
        },

        deleteTask: (id) => {
          setState((s) => ({
            tasks: s.tasks.filter((t) => t.id !== id),
            selectedTaskId: s.selectedTaskId === id ? null : s.selectedTaskId,
            outbox: [...s.outbox, mutation('delete', id, {})],
          }));
          getState().replan('tâche supprimée');
        },

        toggleChecklist: (taskId, itemId) => {
          const task = getState().tasks.find((t) => t.id === taskId);
          if (!task) return;
          const checklist = task.checklist.map((c) => (c.id === itemId ? { ...c, done: !c.done } : c));
          setState((s) => ({
            tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, checklist, updatedAt: now() } : t)),
            outbox: [...s.outbox, mutation('update', taskId, { checklist })],
          }));
        },

        addEvent: (e) => {
          setState((s) => ({ events: [...s.events, { ...e, id: uid(), kind: 'EVENT' }] }));
          getState().replan('nouveau rendez-vous');
        },

        emailToTask: (emailId) => {
          const email = getState().emails.find((m) => m.id === emailId);
          if (!email) return null;
          if (email.linkedTaskId) return getState().tasks.find((t) => t.id === email.linkedTaskId) ?? null;
          const task = getState().addTask({
            title: email.detectedActions?.[0] ? `${email.detectedActions[0]} (${email.subject})` : `Traiter : ${email.subject}`,
            description: `${email.summary ?? email.snippet}\n\nDe : ${email.from}`,
            priority: email.importance === 'URGENT' ? 'CRITICAL' : email.importance === 'IMPORTANT' ? 'HIGH' : 'MEDIUM',
            dueAt: email.detectedDeadline ?? null,
            estimatedMinutes: 20,
            splittable: false,
            source: 'EMAIL',
            sourceRef: email.id,
            checklist: (email.detectedActions ?? []).map((label) => ({ id: uid(), label, done: false })),
          });
          setState((s) => ({ emails: s.emails.map((m) => (m.id === emailId ? { ...m, linkedTaskId: task.id } : m)) }));
          getState().logAutomation('TASK_CREATED_FROM_EMAIL', `Tâche créée depuis « ${email.subject} »`);
          return task;
        },

        replan: (reason = 'manuel') => {
          const s = getState();
          const plan = planSchedule({ tasks: s.tasks, events: s.events, categories: s.categories, settings: s.prefs.scheduler, now: new Date() });
          setState({ ...applyPlan(s, plan), plan });
          if (reason !== 'silent') getState().logAutomation('AUTO_SCHEDULED', `Planning recalculé (${reason}) — ${plan.blocks.length} blocs`);
          return plan;
        },

        addCategory: (c) => setState((s) => ({ categories: [...s.categories, { ...c, id: uid() }] })),
        addDocument: (d) => {
          setState((s) => ({ documents: [{ ...d, id: uid(), createdAt: now() }, ...s.documents] }));
          getState().logAutomation('DOCUMENT_GENERATED', `Document « ${d.title} » généré`);
        },
        markNotificationsRead: () => setState((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
        setPrefs: (patch) => {
          setState((s) => ({ prefs: { ...s.prefs, ...patch } }));
          if (patch.scheduler) getState().replan('paramètres');
        },
        selectTask: (id) => setState({ selectedTaskId: id }),
        logAutomation: (type, summary) =>
          setState((s) => ({ automations: [{ id: uid(), at: now(), type, summary }, ...s.automations].slice(0, 200) })),
        resetDemo: () => {
          setState({ ...buildDemoData(), documents: [], outbox: [], plan: null });
          getState().replan('silent');
        },
      };
    },
    {
      name: 'kairos-store-v1',
      storage: createJSONStorage(() => idbStorage),
      partialize: ({ hydrated: _h, plan: _p, selectedTaskId: _s, ...rest }) => rest,
      onRehydrateStorage: () => (state) => {
        useStore.setState({ hydrated: true });
        state?.replan('silent');
      },
    },
  ),
);
