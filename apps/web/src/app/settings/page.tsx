'use client';

import { AI_CAPABILITIES, AI_CAPABILITY_LABELS, AI_PROVIDERS, AI_PROVIDER_LABELS, type AiProviderId, type Weekday } from '@kairos/core';
import { Bot, CalendarCog, Link2, MessageCircle, Palette, Plus, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, Card, CategoryDot } from '@/components/ui/primitives';
import { isDemoMode, loginUrl } from '@/lib/api';
import { useStore } from '@/lib/store';

const DAYS: Array<[Weekday, string]> = [[1, 'Lundi'], [2, 'Mardi'], [3, 'Mercredi'], [4, 'Jeudi'], [5, 'Vendredi'], [6, 'Samedi'], [0, 'Dimanche']];

export default function SettingsPage() {
  const prefs = useStore((s) => s.prefs);
  const categories = useStore((s) => s.categories);
  const { setPrefs, addCategory, resetDemo } = useStore.getState();
  const [newCat, setNewCat] = useState({ name: '', color: '#2563EB' });
  const sch = prefs.scheduler;
  const setSch = (patch: Partial<typeof sch>) => setPrefs({ scheduler: { ...sch, ...patch } });

  return (
    <div className="max-w-4xl space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Paramètres</h1>

      <Card title="Intégrations" icon={<Link2 size={16} />}>
        <ul className="divide-y divide-line text-sm">
          {[
            ['Google (Calendar, Gmail, Drive)', 'Connexion OAuth — synchronisation bidirectionnelle'],
            ['WhatsApp Business', 'Rappels la veille et 1 h avant, réponses FAIT / REPORTER'],
            ['Microsoft Copilot', 'Documents Word / Excel (Entra ID)'],
            ['Skywork AI', 'Automatisations'],
            ['Claude Code', 'Scripts et développement (runner isolé)'],
          ].map(([name, desc]) => (
            <li key={name} className="flex items-center justify-between gap-3 py-2.5">
              <div><p className="font-medium">{name}</p><p className="text-xs text-ink-3">{desc}</p></div>
              {name.startsWith('Google') && !isDemoMode() ? <a href={loginUrl()}><Button size="sm">Connecter</Button></a> : <Badge>{isDemoMode() ? 'Mode démo' : 'Configurer côté serveur'}</Badge>}
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Planification automatique" icon={<CalendarCog size={16} />}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-xs text-ink-3">Niveau d'autonomie de l'IA : {prefs.autonomyLevel}/5</span>
            <input type="range" min={1} max={5} value={prefs.autonomyLevel} onChange={(e) => setPrefs({ autonomyLevel: Number(e.target.value) as 1 })} className="w-full" />
            <span className="block text-xs text-ink-3">{['', 'Suggestions uniquement', 'Propose, vous validez', 'Agit sur le calendrier', 'Agit sur calendrier et emails → tâches', 'Autonome : agit puis rend compte (annulable)'][prefs.autonomyLevel]}</span>
          </label>
          <NumberField label="Concentration protégée / jour (min)" value={sch.focusMinutesPerDay} onChange={(v) => setSch({ focusMinutesPerDay: v })} step={15} />
          <NumberField label="Tampon entre deux blocs (min)" value={sch.bufferMinutes} onChange={(v) => setSch({ bufferMinutes: v })} step={5} />
          <NumberField label="Travail planifié max / jour (min)" value={sch.maxTaskMinutesPerDay} onChange={(v) => setSch({ maxTaskMinutesPerDay: v })} step={30} />
          <NumberField label="Horizon de planification (jours)" value={sch.horizonDays} onChange={(v) => setSch({ horizonDays: Math.max(1, Math.min(60, v)) })} step={1} />
          <NumberField label="Bloc de concentration minimum (min)" value={sch.minFocusBlockMinutes} onChange={(v) => setSch({ minFocusBlockMinutes: v })} step={15} />
        </div>
        <h3 className="mt-5 mb-2 text-xs font-semibold tracking-wide text-ink-3 uppercase">Heures de travail</h3>
        <div className="space-y-1.5">
          {DAYS.map(([d, label]) => {
            const ranges = sch.workingHours.days[d] ?? [];
            const r = ranges[0];
            const r2 = ranges[1];
            const setDay = (next: typeof ranges) => setSch({ workingHours: { ...sch.workingHours, days: { ...sch.workingHours.days, [d]: next } } });
            return (
              <div key={d} className="flex flex-wrap items-center gap-2 text-sm">
                <label className="flex w-28 items-center gap-2"><input type="checkbox" checked={ranges.length > 0} onChange={(e) => setDay(e.target.checked ? [{ start: '09:00', end: '12:30' }, { start: '13:30', end: '18:00' }] : [])} /> {label}</label>
                {r && <><input type="time" value={r.start} onChange={(e) => setDay([{ ...r, start: e.target.value }, ...ranges.slice(1)])} className="h-8 rounded border border-line bg-surface px-1" /> – <input type="time" value={r.end} onChange={(e) => setDay([{ ...r, end: e.target.value }, ...ranges.slice(1)])} className="h-8 rounded border border-line bg-surface px-1" /></>}
                {r2 && <><span className="text-ink-3">et</span><input type="time" value={r2.start} onChange={(e) => setDay([r!, { ...r2, start: e.target.value }])} className="h-8 rounded border border-line bg-surface px-1" /> – <input type="time" value={r2.end} onChange={(e) => setDay([r!, { ...r2, end: e.target.value }])} className="h-8 rounded border border-line bg-surface px-1" /></>}
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Moteurs IA — qui fait quoi" icon={<Bot size={16} />}>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-ink-3"><tr><th className="pb-2 font-medium">Capacité</th><th className="pb-2 font-medium">Moteur principal</th><th className="pb-2 font-medium">Repli</th></tr></thead>
          <tbody>
            {AI_CAPABILITIES.map((cap) => {
              const rule = prefs.aiRouting.find((r) => r.capability === cap) ?? { capability: cap, provider: 'claude' as AiProviderId, fallbacks: [] };
              const update = (patch: Partial<typeof rule>) => setPrefs({ aiRouting: [...prefs.aiRouting.filter((r) => r.capability !== cap), { ...rule, ...patch }] });
              return (
                <tr key={cap} className="border-t border-line">
                  <td className="py-2 pr-3">{AI_CAPABILITY_LABELS[cap]}</td>
                  <td className="pr-3"><select value={rule.provider} onChange={(e) => update({ provider: e.target.value as AiProviderId })} className="h-8 rounded-lg border border-line bg-surface px-2">{AI_PROVIDERS.map((p) => <option key={p} value={p}>{AI_PROVIDER_LABELS[p]}</option>)}</select></td>
                  <td><select value={rule.fallbacks[0] ?? ''} onChange={(e) => update({ fallbacks: e.target.value ? [e.target.value as AiProviderId] : [] })} className="h-8 rounded-lg border border-line bg-surface px-2"><option value="">—</option>{AI_PROVIDERS.map((p) => <option key={p} value={p}>{AI_PROVIDER_LABELS[p]}</option>)}</select></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card title="Notifications WhatsApp" icon={<MessageCircle size={16} />}>
        <div className="space-y-2 text-sm">
          <input value={prefs.reminders.whatsappNumber} onChange={(e) => setPrefs({ reminders: { ...prefs.reminders, whatsappNumber: e.target.value } })} placeholder="+33 6 00 00 00 00" className="h-9 w-64 rounded-lg border border-line bg-surface px-3" />
          <label className="flex items-center gap-2"><input type="checkbox" checked={prefs.reminders.eve} onChange={(e) => setPrefs({ reminders: { ...prefs.reminders, eve: e.target.checked } })} /> La veille (19 h)</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={prefs.reminders.oneHour} onChange={(e) => setPrefs({ reminders: { ...prefs.reminders, oneHour: e.target.checked } })} /> 1 heure avant</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={prefs.reminders.escalateCritical} onChange={(e) => setPrefs({ reminders: { ...prefs.reminders, escalateCritical: e.target.checked } })} /> Rappels renforcés pour les missions critiques (J-3, matin, 15 min, suivi)</label>
        </div>
      </Card>

      <Card title="Catégories" icon={<Palette size={16} />}>
        <ul className="grid gap-2 sm:grid-cols-2">
          {categories.map((c) => (
            <li key={c.id} className="rounded-lg bg-surface-2 p-3">
              <p className="flex items-center gap-2 text-sm font-medium"><CategoryDot color={c.color} /> {c.name}</p>
              <p className="mt-1 text-xs text-ink-3">{c.subcategories.join(' · ') || 'Aucune sous-catégorie'}</p>
            </li>
          ))}
        </ul>
        <form onSubmit={(e) => { e.preventDefault(); if (!newCat.name) return; addCategory({ name: newCat.name, color: newCat.color, icon: 'folder', weight: 1, subcategories: [] }); setNewCat({ name: '', color: '#2563EB' }); }} className="mt-3 flex items-center gap-2">
          <input type="color" value={newCat.color} onChange={(e) => setNewCat({ ...newCat, color: e.target.value })} className="size-9 rounded" aria-label="Couleur" />
          <input value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} placeholder="Nouvelle catégorie personnalisée" className="h-9 flex-1 rounded-lg border border-line bg-surface px-3 text-sm" />
          <Button type="submit" size="sm"><Plus size={14} /> Ajouter</Button>
        </form>
      </Card>

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={resetDemo}><RotateCcw size={14} /> Réinitialiser les données de démonstration</Button>
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange, step }: { label: string; value: number; onChange: (v: number) => void; step: number }) {
  return (
    <label className="space-y-1 text-sm">
      <span className="text-xs text-ink-3">{label}</span>
      <input type="number" value={value} step={step} min={0} onChange={(e) => onChange(Number(e.target.value))} className="h-9 w-full rounded-lg border border-line bg-surface px-3" />
    </label>
  );
}
