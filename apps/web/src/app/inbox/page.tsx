'use client';

import type { Email } from '@kairos/core';
import clsx from 'clsx';
import { CalendarClock, CheckCircle2, ListTodo, PenLine, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, Card, Empty } from '@/components/ui/primitives';
import { fmtDue, fmtTime, fmtDay } from '@/lib/format';
import { useStore } from '@/lib/store';

const IMPORTANCE: Record<NonNullable<Email['importance']>, { label: string; tone: 'critical' | 'warning' | 'neutral' | 'primary' }> = {
  URGENT: { label: 'Urgent', tone: 'critical' },
  IMPORTANT: { label: 'Important', tone: 'warning' },
  NORMAL: { label: 'Normal', tone: 'primary' },
  LOW: { label: 'Faible', tone: 'neutral' },
};

/** Brouillon local (mode démo) ; en ligne, l'API génère la réponse avec le moteur IA choisi. */
function localDraft(e: Email): string {
  const name = e.from.split('<')[0].trim().split(' ')[0] || 'Madame, Monsieur';
  const actions = e.detectedActions?.length ? `\n\nJe m'occupe des points suivants :\n${e.detectedActions.map((a) => `- ${a}`).join('\n')}` : '';
  return `Bonjour ${name},\n\nJe vous remercie pour votre message concernant « ${e.subject} ».${actions}\n\nJe reviens vers vous au plus vite${e.detectedDeadline ? `, et au plus tard ${fmtDue(e.detectedDeadline).toLowerCase()}` : ''}.\n\nBien cordialement,`;
}

export default function InboxPage() {
  const emails = useStore((s) => s.emails);
  const emailToTask = useStore((s) => s.emailToTask);
  const [filter, setFilter] = useState<'all' | 'URGENT' | 'IMPORTANT'>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const list = emails.filter((e) => filter === 'all' || e.importance === filter).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  const current = emails.find((e) => e.id === (selected ?? list[0]?.id));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Emails</h1>
        <div className="flex rounded-lg border border-line bg-surface p-0.5">
          {(['all', 'URGENT', 'IMPORTANT'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={clsx('h-7 rounded-md px-3 text-sm', filter === f ? 'bg-primary-soft font-medium text-primary-ink' : 'text-ink-2')}>
              {f === 'all' ? 'Tous' : IMPORTANCE[f].label}
            </button>
          ))}
        </div>
      </div>
      <p className="flex items-center gap-1.5 text-sm text-ink-2"><Sparkles size={14} className="text-primary" /> Gmail est analysé en continu : importance, résumé, actions demandées et échéances sont détectés automatiquement.</p>

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <ul className="space-y-1.5">
          {list.map((e) => (
            <li key={e.id}>
              <button onClick={() => setSelected(e.id)} className={clsx('w-full rounded-xl border p-3 text-left transition-colors', current?.id === e.id ? 'border-primary bg-primary-soft/50' : 'border-line bg-surface hover:bg-surface-2')}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-ink">{e.from.split('<')[0]}</span>
                  <span className="shrink-0 text-[11px] text-ink-3">{fmtDay(e.receivedAt)} {fmtTime(e.receivedAt)}</span>
                </div>
                <p className="truncate text-sm text-ink">{e.subject}</p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  {e.importance && <Badge tone={IMPORTANCE[e.importance].tone}>{IMPORTANCE[e.importance].label}</Badge>}
                  {e.linkedTaskId && <Badge tone="good"><CheckCircle2 size={11} /> Tâche</Badge>}
                  {e.detectedDeadline && <Badge><CalendarClock size={11} /> {fmtDue(e.detectedDeadline)}</Badge>}
                </div>
              </button>
            </li>
          ))}
        </ul>

        {current ? (
          <Card className="self-start">
            <div className="space-y-4">
              <div>
                <p className="text-xs text-ink-3">{current.from}</p>
                <h2 className="text-lg font-semibold text-ink">{current.subject}</h2>
              </div>
              <div className="rounded-xl bg-primary-soft/60 p-4">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-primary-ink"><Sparkles size={13} /> Résumé IA</p>
                <p className="text-sm text-ink">{current.summary}</p>
                {!!current.detectedActions?.length && (
                  <>
                    <p className="mt-3 mb-1 text-xs font-semibold text-primary-ink">Actions demandées</p>
                    <ul className="list-inside list-disc text-sm text-ink-2">{current.detectedActions.map((a) => <li key={a}>{a}</li>)}</ul>
                  </>
                )}
                {current.detectedDeadline && <p className="mt-3 text-xs text-ink-2">Échéance détectée : <strong>{fmtDue(current.detectedDeadline)}</strong></p>}
              </div>
              <p className="text-sm text-ink-2">{current.snippet}</p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => emailToTask(current.id)} disabled={!!current.linkedTaskId}><ListTodo size={15} /> {current.linkedTaskId ? 'Tâche créée' : 'Transformer en tâche'}</Button>
                <Button variant="secondary" onClick={() => setDrafts({ ...drafts, [current.id]: localDraft(current) })}><PenLine size={15} /> Générer un brouillon</Button>
              </div>
              {drafts[current.id] && (
                <div className="space-y-2">
                  <textarea value={drafts[current.id]} onChange={(e) => setDrafts({ ...drafts, [current.id]: e.target.value })} rows={9} className="w-full rounded-xl border border-line bg-surface p-3 text-sm" />
                  <p className="text-xs text-ink-3">Le brouillon est déposé dans Gmail : Kairos n'envoie jamais d'email sans votre validation.</p>
                </div>
              )}
            </div>
          </Card>
        ) : (
          <Empty>Aucun email.</Empty>
        )}
      </div>
    </div>
  );
}
