'use client';

import { PRIORITIES, PRIORITY_LABELS, TASK_STATUSES, TASK_STATUS_LABELS, type Priority, type TaskStatus } from '@kairos/core';
import { CalendarClock, History, Paperclip, Sparkles, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fmtDay, fmtTime, uid } from '@/lib/format';
import { useStore } from '@/lib/store';
import { Badge, Button } from '../ui/primitives';

const toLocalInput = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

/** Panneau de détail d'une tâche : édition complète, checklist, sous-tâches, historique. */
export function TaskDrawer() {
  const id = useStore((s) => s.selectedTaskId);
  const task = useStore((s) => s.tasks.find((t) => t.id === s.selectedTaskId));
  const categories = useStore((s) => s.categories);
  const allTasks = useStore((s) => s.tasks);
  const subtasks = allTasks.filter((t) => t.parentId === id);
  const automations = useStore((s) => s.automations);
  const { updateTask, deleteTask, selectTask, toggleChecklist, addTask } = useStore.getState();
  const [newItem, setNewItem] = useState('');
  const [newSub, setNewSub] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && selectTask(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectTask]);

  if (!id || !task) return null;
  const category = categories.find((c) => c.id === task.categoryId);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/20" onClick={() => selectTask(null)}>
      <aside role="dialog" aria-label={task.title} onClick={(e) => e.stopPropagation()} className="animate-slide-in flex h-full w-full max-w-lg flex-col overflow-y-auto border-l border-line bg-surface shadow-modal scrollbar-thin">
        <header className="flex items-start gap-3 border-b border-line p-5">
          <textarea
            value={task.title}
            onChange={(e) => updateTask(task.id, { title: e.target.value })}
            rows={2}
            className="flex-1 resize-none bg-transparent text-lg font-semibold text-ink outline-none"
            aria-label="Titre"
          />
          <button onClick={() => selectTask(null)} className="grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-surface-2" aria-label="Fermer"><X size={18} /></button>
        </header>

        <div className="grid grid-cols-2 gap-3 border-b border-line p-5 text-sm">
          <label className="space-y-1">
            <span className="text-xs text-ink-3">Statut</span>
            <select value={task.status} onChange={(e) => updateTask(task.id, { status: e.target.value as TaskStatus })} className="h-9 w-full rounded-lg border border-line bg-surface px-2">
              {TASK_STATUSES.map((s) => <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-ink-3">Priorité</span>
            <select value={task.priority} onChange={(e) => updateTask(task.id, { priority: e.target.value as Priority })} className="h-9 w-full rounded-lg border border-line bg-surface px-2">
              {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-ink-3">Catégorie</span>
            <select value={task.categoryId} onChange={(e) => updateTask(task.id, { categoryId: e.target.value, subcategory: null })} className="h-9 w-full rounded-lg border border-line bg-surface px-2">
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-ink-3">Sous-catégorie</span>
            <select value={task.subcategory ?? ''} onChange={(e) => updateTask(task.id, { subcategory: e.target.value || null })} className="h-9 w-full rounded-lg border border-line bg-surface px-2">
              <option value="">—</option>
              {category?.subcategories.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-ink-3">Échéance (date et heure)</span>
            <input type="datetime-local" value={toLocalInput(task.dueAt)} onChange={(e) => updateTask(task.id, { dueAt: e.target.value ? new Date(e.target.value).toISOString() : null })} className="h-9 w-full rounded-lg border border-line bg-surface px-2" />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-ink-3">Durée estimée (min)</span>
            <input type="number" min={5} step={5} value={task.estimatedMinutes} onChange={(e) => updateTask(task.id, { estimatedMinutes: Math.max(5, Number(e.target.value)) })} className="h-9 w-full rounded-lg border border-line bg-surface px-2" />
          </label>
          <label className="col-span-2 flex items-center gap-2 text-xs text-ink-2">
            <input type="checkbox" checked={task.autoSchedule} onChange={(e) => updateTask(task.id, { autoSchedule: e.target.checked })} />
            <Sparkles size={13} className="text-primary" /> Planification automatique par l'IA
            <input type="checkbox" className="ml-4" checked={task.splittable} onChange={(e) => updateTask(task.id, { splittable: e.target.checked })} /> Découpable
            <input type="checkbox" className="ml-4" checked={!!task.deepWork} onChange={(e) => updateTask(task.id, { deepWork: e.target.checked })} /> Concentration
          </label>
          {task.scheduledStart && (
            <p className="col-span-2 flex items-center gap-1.5 rounded-lg bg-primary-soft px-3 py-2 text-xs text-primary-ink">
              <CalendarClock size={13} /> Planifiée {fmtDay(task.scheduledStart)} à {fmtTime(task.scheduledStart)} → {fmtTime(task.scheduledEnd!)}
            </p>
          )}
        </div>

        <section className="space-y-2 border-b border-line p-5">
          <h3 className="text-xs font-semibold tracking-wide text-ink-3 uppercase">Description</h3>
          <textarea value={task.description ?? ''} onChange={(e) => updateTask(task.id, { description: e.target.value })} rows={3} placeholder="Contexte, liens, informations…" className="w-full rounded-lg border border-line bg-surface p-2 text-sm outline-none focus:border-primary" />
          <h3 className="pt-2 text-xs font-semibold tracking-wide text-ink-3 uppercase">Notes</h3>
          <textarea value={task.notes ?? ''} onChange={(e) => updateTask(task.id, { notes: e.target.value })} rows={2} placeholder="Notes personnelles" className="w-full rounded-lg border border-line bg-surface p-2 text-sm outline-none focus:border-primary" />
        </section>

        <section className="space-y-2 border-b border-line p-5">
          <h3 className="text-xs font-semibold tracking-wide text-ink-3 uppercase">Checklist ({task.checklist.filter((c) => c.done).length}/{task.checklist.length})</h3>
          {task.checklist.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={c.done} onChange={() => toggleChecklist(task.id, c.id)} />
              <span className={c.done ? 'text-ink-3 line-through' : ''}>{c.label}</span>
            </label>
          ))}
          <form onSubmit={(e) => { e.preventDefault(); if (!newItem.trim()) return; updateTask(task.id, { checklist: [...task.checklist, { id: uid(), label: newItem.trim(), done: false }] }); setNewItem(''); }}>
            <input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="+ Ajouter un élément" className="h-8 w-full rounded-lg bg-surface-2 px-2 text-sm outline-none" />
          </form>
        </section>

        <section className="space-y-2 border-b border-line p-5">
          <h3 className="text-xs font-semibold tracking-wide text-ink-3 uppercase">Sous-tâches</h3>
          {subtasks.map((s) => (
            <button key={s.id} onClick={() => selectTask(s.id)} className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-2">
              <span className={s.status === 'DONE' ? 'text-ink-3 line-through' : ''}>{s.title}</span>
              <Badge>{TASK_STATUS_LABELS[s.status]}</Badge>
            </button>
          ))}
          <form onSubmit={(e) => { e.preventDefault(); if (!newSub.trim()) return; addTask({ title: newSub.trim(), parentId: task.id, categoryId: task.categoryId, dueAt: task.dueAt, estimatedMinutes: 30 }); setNewSub(''); }}>
            <input value={newSub} onChange={(e) => setNewSub(e.target.value)} placeholder="+ Ajouter une sous-tâche (avec sa propre échéance)" className="h-8 w-full rounded-lg bg-surface-2 px-2 text-sm outline-none" />
          </form>
        </section>

        <section className="space-y-2 border-b border-line p-5">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-ink-3 uppercase"><Paperclip size={12} /> Pièces jointes</h3>
          {task.attachments.length ? task.attachments.map((a) => <a key={a.id} href={a.url} className="block text-sm text-primary hover:underline">{a.name}</a>) : <p className="text-xs text-ink-3">Glissez un fichier ou liez un document Drive (connecté à l'API).</p>}
        </section>

        <section className="space-y-2 p-5">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-ink-3 uppercase"><History size={12} /> Historique</h3>
          <ul className="space-y-1.5 text-xs text-ink-2">
            <li>Créée le {fmtDay(task.createdAt)} à {fmtTime(task.createdAt)} {task.source === 'EMAIL' ? 'depuis un email' : ''}</li>
            <li>Dernière modification le {fmtDay(task.updatedAt)} à {fmtTime(task.updatedAt)}</li>
            {task.completedAt && <li>Terminée le {fmtDay(task.completedAt)} à {fmtTime(task.completedAt)}</li>}
            {automations.filter((a) => a.summary.includes(task.title)).slice(0, 5).map((a) => <li key={a.id}>IA · {a.summary}</li>)}
          </ul>
        </section>

        <footer className="mt-auto flex justify-between border-t border-line p-4">
          <Button variant="danger" size="sm" onClick={() => deleteTask(task.id)}><Trash2 size={14} /> Supprimer</Button>
          <Button size="sm" onClick={() => selectTask(null)}>Fermer</Button>
        </footer>
      </aside>
    </div>
  );
}
