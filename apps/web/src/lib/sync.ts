'use client';

import type { Task } from '@kairos/core';
import { api, isDemoMode } from './api';
import { useStore } from './store';

interface PushResult {
  results: Array<{ clientMutationId: string; status: 'APPLIED' | 'DUPLICATE' | 'CONFLICT' | 'REJECTED'; entity?: Task }>;
}
interface PullResult {
  serverTime: string;
  tasks: Array<Task & { deleted: boolean }>;
}

let running = false;

/**
 * Synchronisation local-first :
 * 1. rejoue la file d'attente (outbox) → /sync/push (idempotent) ;
 * 2. récupère les changements serveur depuis le dernier curseur → /sync/pull ;
 * 3. en cas de conflit, la version serveur remplace la version locale.
 * Déclenchée au démarrage, au retour du réseau et toutes les 60 s.
 */
export async function syncNow(): Promise<'offline' | 'demo' | 'ok' | 'error'> {
  if (isDemoMode()) return 'demo';
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'offline';
  if (running) return 'ok';
  running = true;
  try {
    const { outbox, deviceId, lastSyncAt } = useStore.getState();
    if (outbox.length) {
      const res = await api<PushResult>('/sync/push', { method: 'POST', json: { deviceId, mutations: outbox } });
      const done = new Set(res.results.map((r) => r.clientMutationId));
      const conflicts = res.results.filter((r) => r.status === 'CONFLICT' && r.entity).map((r) => r.entity!);
      useStore.setState((s) => ({
        outbox: s.outbox.filter((m) => !done.has(m.clientMutationId)),
        tasks: s.tasks.map((t) => conflicts.find((c) => c.id === t.id) ?? t),
      }));
    }
    const pull = await api<PullResult>(`/sync/pull${lastSyncAt ? `?since=${encodeURIComponent(lastSyncAt)}` : ''}`);
    useStore.setState((s) => {
      const byId = new Map(s.tasks.map((t) => [t.id, t]));
      for (const t of pull.tasks) {
        if (t.deleted) byId.delete(t.id);
        else byId.set(t.id, t);
      }
      return { tasks: [...byId.values()], lastSyncAt: pull.serverTime };
    });
    useStore.getState().replan('silent');
    return 'ok';
  } catch {
    return 'error';
  } finally {
    running = false;
  }
}

export function startSyncLoop(): () => void {
  void syncNow();
  const onOnline = () => void syncNow();
  window.addEventListener('online', onOnline);
  const timer = setInterval(() => void syncNow(), 60_000);
  return () => {
    window.removeEventListener('online', onOnline);
    clearInterval(timer);
  };
}
