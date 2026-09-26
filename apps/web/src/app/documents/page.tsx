'use client';

import { FileSpreadsheet, FileText, FolderTree, Receipt, ScrollText, ClipboardList, Mail as MailIcon, BookOpen, Search } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Badge, Button, Card, Empty } from '@/components/ui/primitives';
import { api, isDemoMode } from '@/lib/api';
import { fmtDay } from '@/lib/format';
import { useStore } from '@/lib/store';

const TEMPLATES: Array<{ type: string; label: string; icon: ReactNode; hint: string; category?: string }> = [
  { type: 'QUOTE', label: 'Devis', icon: <FileSpreadsheet size={18} />, hint: 'Lignes, TVA, totaux — Iris Renov', category: 'iris-renov' },
  { type: 'INVOICE', label: 'Facture', icon: <Receipt size={18} />, hint: 'Mentions légales incluses', category: 'iris-renov' },
  { type: 'MINUTES', label: 'Compte-rendu', icon: <ClipboardList size={18} />, hint: 'Décisions et actions' },
  { type: 'REPORT', label: 'Rapport', icon: <ScrollText size={18} />, hint: 'Constats, analyse, recommandations' },
  { type: 'LETTER', label: 'Courrier', icon: <MailIcon size={18} />, hint: 'Formel, prêt à signer' },
  { type: 'SUMMARY', label: 'Synthèse', icon: <BookOpen size={18} />, hint: 'Une page, points clés' },
  { type: 'CHECKLIST', label: 'Checklist', icon: <FileText size={18} />, hint: 'Opérationnelle' },
];

export default function DocumentsPage() {
  const documents = useStore((s) => s.documents);
  const categories = useStore((s) => s.categories);
  const addDocument = useStore((s) => s.addDocument);
  const [tpl, setTpl] = useState(TEMPLATES[0]);
  const [title, setTitle] = useState('');
  const [brief, setBrief] = useState('');
  const [format, setFormat] = useState<'pdf' | 'docx'>('pdf');
  const [category, setCategory] = useState('iris-renov');
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');

  async function generate() {
    if (!title) return;
    setBusy(true);
    try {
      if (!isDemoMode()) {
        await api('/documents/generate', { method: 'POST', json: { type: tpl.type, format, title, categoryId: category, brief } });
      }
      addDocument({ title, type: tpl.type, format, categoryId: category });
      setTitle('');
      setBrief('');
    } finally {
      setBusy(false);
    }
  }

  const found = documents.filter((d) => !q || d.title.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card title="Générer un document">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TEMPLATES.map((t) => (
              <button key={t.type} onClick={() => { setTpl(t); if (t.category) setCategory(t.category); }} className={`rounded-xl border p-3 text-left transition-colors ${tpl.type === t.type ? 'border-primary bg-primary-soft/60' : 'border-line hover:bg-surface-2'}`}>
                <span className="text-primary">{t.icon}</span>
                <p className="mt-1.5 text-sm font-medium">{t.label}</p>
                <p className="text-[11px] text-ink-3">{t.hint}</p>
              </button>
            ))}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre du document" className="h-9 rounded-lg border border-line bg-surface px-3 text-sm sm:col-span-3" />
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 rounded-lg border border-line bg-surface px-2 text-sm">
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={format} onChange={(e) => setFormat(e.target.value as 'pdf' | 'docx')} className="h-9 rounded-lg border border-line bg-surface px-2 text-sm">
              <option value="pdf">PDF</option>
              <option value="docx">Word (DOCX)</option>
            </select>
            <Button onClick={generate} disabled={busy || !title}>{busy ? 'Génération…' : 'Générer'}</Button>
            <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={4} placeholder="Consignes pour l'IA (contexte, points à couvrir, destinataire…) ou lignes du devis" className="rounded-lg border border-line bg-surface p-3 text-sm sm:col-span-3" />
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-3"><FolderTree size={13} /> Classement automatique dans Google Drive : Kairos / {categories.find((c) => c.id === category)?.name} / {new Date().getFullYear()} / {tpl.label}</p>
        </Card>

        <Card title="Documents récents" action={<label className="flex items-center gap-1 text-xs text-ink-3"><Search size={12} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Recherche" className="w-24 bg-transparent outline-none" /></label>}>
          {found.length ? (
            <ul className="space-y-2">
              {found.map((d) => (
                <li key={d.id} className="flex items-center gap-3 rounded-lg bg-surface-2 px-3 py-2">
                  <FileText size={16} className="text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{d.title}</p>
                    <p className="text-[11px] text-ink-3">{TEMPLATES.find((t) => t.type === d.type)?.label} · {fmtDay(d.createdAt)}</p>
                  </div>
                  <Badge>{d.format.toUpperCase()}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Aucun document généré pour l'instant.</Empty>
          )}
        </Card>
      </div>
    </div>
  );
}
