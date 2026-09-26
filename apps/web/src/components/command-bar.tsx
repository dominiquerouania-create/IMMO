'use client';

import { parseCommand, PRIORITY_LABELS } from '@kairos/core';
import clsx from 'clsx';
import { CalendarClock, CornerDownLeft, Mic, Sparkles, Tag, Timer } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { runCommand } from '@/lib/assistant';
import { fmtDue, fmtMinutes, TZ } from '@/lib/format';
import { useStore } from '@/lib/store';
import { listen, speak, speechSupported } from '@/lib/voice';

/**
 * Barre de commande universelle (⌘K / Ctrl+K) : saisie rapide façon Todoist,
 * commandes en langage naturel et dictée vocale. Aperçu instantané de l'analyse.
 */
export function CommandBar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [reply, setReply] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const categories = useStore((s) => s.categories);
  const router = useRouter();

  useEffect(() => {
    if (open) {
      setReply(null);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const preview = useMemo(() => (text.trim() ? parseCommand(text, new Date(), TZ) : null), [text]);
  const cat = categories.find((c) => c.id === preview?.entities.categoryId);

  async function submit(value = text) {
    if (!value.trim()) return;
    const res = await runCommand(value);
    setReply(res.speech);
    speak(res.speech);
    setText('');
    if (res.navigate) setTimeout(() => { router.push(res.navigate!); onClose(); }, 1400);
  }

  function toggleVoice() {
    if (listening) return;
    setListening(true);
    listen(
      (t, final) => {
        setText(t);
        if (final) void submit(t);
      },
      () => setListening(false),
    );
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 px-4 pt-[12vh] backdrop-blur-[2px]" onClick={onClose}>
      <div role="dialog" aria-label="Barre de commande" className="animate-fade-up w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-modal" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-line px-4">
          <Sparkles size={18} className="text-primary" />
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit();
              if (e.key === 'Escape') onClose();
            }}
            placeholder="Ajouter une tâche ou demander quelque chose…"
            className="h-14 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
          />
          {speechSupported() && (
            <button
              onClick={toggleVoice}
              className={clsx('grid size-9 place-items-center rounded-full transition-colors', listening ? 'animate-pulse bg-critical text-white' : 'text-ink-2 hover:bg-surface-2')}
              aria-label="Dicter une commande"
            >
              <Mic size={18} />
            </button>
          )}
        </div>

        {preview && (
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-2 px-4 py-2.5 text-xs text-ink-2">
            <span className="font-medium text-primary">{preview.intent === 'CREATE_TASK' ? 'Nouvelle tâche' : preview.intent === 'CREATE_EVENT' ? 'Nouveau rendez-vous' : 'Commande'}</span>
            {preview.entities.title && <span className="font-medium text-ink">« {preview.entities.title} »</span>}
            {preview.entities.date && <span className="flex items-center gap-1"><CalendarClock size={12} />{fmtDue(preview.entities.date)}</span>}
            {preview.entities.durationMinutes && <span className="flex items-center gap-1"><Timer size={12} />{fmtMinutes(preview.entities.durationMinutes)}</span>}
            {preview.entities.priority && <span>{PRIORITY_LABELS[preview.entities.priority]}</span>}
            {cat && <span className="flex items-center gap-1"><Tag size={12} style={{ color: cat.color }} />{cat.name}</span>}
          </div>
        )}

        {reply ? (
          <p className="px-4 py-4 text-sm text-ink" aria-live="polite">{reply}</p>
        ) : (
          <ul className="space-y-1 px-2 py-3 text-sm">
            {[
              'Appeler la banque vendredi 10h #sci !urgent 30min',
              'Ajoute une réunion demain à 14h',
              'Prépare mon planning de demain',
              "Quelles sont mes priorités aujourd'hui ?",
              'Montre-moi tout ce qui est urgent',
            ].map((ex) => (
              <li key={ex}>
                <button onClick={() => setText(ex)} className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-ink-2 hover:bg-surface-2 hover:text-ink">
                  {ex}
                  <CornerDownLeft size={13} className="text-ink-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
