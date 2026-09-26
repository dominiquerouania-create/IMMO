import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_CATEGORIES, parseCommand, planSchedule, type CalendarEvent, type ScheduleResult, type SyncMutation, type Task } from '@kairos/core';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const now = () => new Date().toISOString();

interface State {
  tasks: Task[];
  events: CalendarEvent[];
  plan: ScheduleResult | null;
  outbox: SyncMutation[];
  token: string | null;
  quickAdd: (text: string) => Task;
  toggleDone: (id: string) => void;
  replan: () => void;
  sync: () => Promise<void>;
}

/** Store local-first (AsyncStorage) : consultation et édition hors ligne, synchro à la reconnexion. */
export const useStore = create<State>()(
  persist(
    (set, get) => ({
      tasks: [],
      events: [],
      plan: null,
      outbox: [],
      token: null,

      quickAdd: (text) => {
        const { entities: e } = parseCommand(text, new Date(), 'Europe/Paris');
        const task: Task = {
          id: uid(),
          title: e.title || text,
          priority: e.priority ?? 'MEDIUM',
          status: 'TODO',
          categoryId: e.categoryId ?? 'personnel',
          dueAt: e.date ?? null,
          estimatedMinutes: e.durationMinutes ?? 30,
          autoSchedule: true,
          splittable: true,
          checklist: [],
          attachments: [],
          tags: e.tags ?? [],
          source: 'VOICE',
          createdAt: now(),
          updatedAt: now(),
        };
        set((s) => ({
          tasks: [task, ...s.tasks],
          outbox: [...s.outbox, { clientMutationId: uid(), entity: 'task', op: 'create', entityId: task.id, payload: { ...task }, occurredAt: now() }],
        }));
        get().replan();
        return task;
      },

      toggleDone: (id) => {
        const t = get().tasks.find((x) => x.id === id);
        if (!t) return;
        const status = t.status === 'DONE' ? 'TODO' : 'DONE';
        set((s) => ({
          tasks: s.tasks.map((x) => (x.id === id ? { ...x, status, completedAt: status === 'DONE' ? now() : null, updatedAt: now() } : x)),
          outbox: [...s.outbox, { clientMutationId: uid(), entity: 'task', op: 'update', entityId: id, payload: { status }, occurredAt: now() }],
        }));
        get().replan();
      },

      replan: () => {
        const { tasks, events } = get();
        set({ plan: planSchedule({ tasks, events, categories: DEFAULT_CATEGORIES, now: new Date() }) });
      },

      sync: async () => {
        const { token, outbox } = get();
        if (!API_URL || !token) return;
        const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
        if (outbox.length) {
          const res = await fetch(`${API_URL}/sync/push`, { method: 'POST', headers, body: JSON.stringify({ deviceId: 'mobile', mutations: outbox }) });
          if (res.ok) set({ outbox: [] });
        }
        const pull = await fetch(`${API_URL}/sync/pull`, { headers });
        if (pull.ok) {
          const data = (await pull.json()) as { tasks: Array<Task & { deleted: boolean }> };
          set({ tasks: data.tasks.filter((t) => !t.deleted) });
          get().replan();
        }
      },
    }),
    { name: 'kairos-mobile', storage: createJSONStorage(() => AsyncStorage), partialize: ({ plan: _p, ...rest }) => rest },
  ),
);
