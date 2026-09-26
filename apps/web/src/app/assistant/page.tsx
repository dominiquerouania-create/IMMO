'use client';

import clsx from 'clsx';
import { Bot, Mic, Send, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/primitives';
import { runCommand } from '@/lib/assistant';
import { listen, speak, speechSupported } from '@/lib/voice';

interface Msg {
  role: 'user' | 'assistant';
  text: string;
  navigate?: string;
}

const EXAMPLES = [
  'Ajoute une réunion demain à 14h.',
  'Prépare mon planning de demain.',
  "Quelles sont mes priorités aujourd'hui ?",
  'Transforme cet email en tâche.',
  'Montre-moi tout ce qui est urgent.',
];

export default function AssistantPage() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'assistant', text: "Bonjour ! Je suis Kairos. Parlez-moi ou écrivez : je crée des tâches, organise votre agenda, trie vos emails et prépare vos documents." },
  ]);
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [voiceReplies, setVoiceReplies] = useState(true);
  const router = useRouter();
  const endRef = useRef<HTMLDivElement>(null);

  async function send(value = text) {
    if (!value.trim()) return;
    setMessages((m) => [...m, { role: 'user', text: value }]);
    setText('');
    const res = await runCommand(value);
    setMessages((m) => [...m, { role: 'assistant', text: res.speech, navigate: res.navigate }]);
    if (voiceReplies) speak(res.speech);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  function mic() {
    setListening(true);
    listen((t, final) => { setText(t); if (final) void send(t); }, () => setListening(false));
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-9rem)] max-w-3xl flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Assistant IA</h1>
        <label className="flex items-center gap-2 text-xs text-ink-2"><input type="checkbox" checked={voiceReplies} onChange={(e) => setVoiceReplies(e.target.checked)} /> Réponses vocales</label>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-line bg-surface p-4 shadow-card scrollbar-thin" aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={clsx('flex gap-2.5', m.role === 'user' && 'flex-row-reverse')}>
            <span className={clsx('grid size-8 shrink-0 place-items-center rounded-full', m.role === 'user' ? 'bg-surface-3 text-ink-2' : 'bg-primary text-white')}>
              {m.role === 'user' ? <User size={15} /> : <Bot size={15} />}
            </span>
            <div className={clsx('max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm', m.role === 'user' ? 'bg-primary text-white' : 'bg-surface-2 text-ink')}>
              {m.text}
              {m.navigate && <button onClick={() => router.push(m.navigate!)} className="mt-1.5 block text-xs font-medium text-primary underline">Ouvrir →</button>}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {EXAMPLES.map((ex) => <button key={ex} onClick={() => void send(ex)} className="rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink-2 hover:bg-surface-2">{ex}</button>)}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="mt-3 flex items-center gap-2 rounded-2xl border border-line bg-surface p-2 shadow-card">
        {speechSupported() && (
          <button type="button" onClick={mic} className={clsx('grid size-10 place-items-center rounded-xl', listening ? 'animate-pulse bg-critical text-white' : 'bg-primary-soft text-primary')} aria-label="Parler"><Mic size={18} /></button>
        )}
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={listening ? 'Je vous écoute…' : 'Demandez à Kairos…'} className="h-10 flex-1 bg-transparent px-2 text-sm outline-none" />
        <Button type="submit" aria-label="Envoyer"><Send size={15} /></Button>
      </form>
    </div>
  );
}
