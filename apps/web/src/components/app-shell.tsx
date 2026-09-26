'use client';

import clsx from 'clsx';
import {
  BarChart3,
  Bell,
  Bot,
  CalendarDays,
  CheckSquare,
  CloudOff,
  FileText,
  LayoutDashboard,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Settings,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { isDemoMode } from '@/lib/api';
import { useStore } from '@/lib/store';
import { startSyncLoop } from '@/lib/sync';
import { CommandBar } from './command-bar';
import { TaskDrawer } from './tasks/task-drawer';
import { ThemeToggle, useApplyTheme } from './theme';
import { CategoryDot } from './ui/primitives';

const NAV = [
  { href: '/', label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/tasks', label: 'Tâches', icon: CheckSquare },
  { href: '/calendar', label: 'Calendrier', icon: CalendarDays },
  { href: '/inbox', label: 'Emails', icon: Mail },
  { href: '/documents', label: 'Documents', icon: FileText },
  { href: '/analytics', label: 'Productivité', icon: BarChart3 },
  { href: '/assistant', label: 'Assistant IA', icon: Bot },
];

export function AppShell({ children }: { children: ReactNode }) {
  useApplyTheme();
  const pathname = usePathname();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [online, setOnline] = useState(true);
  const categories = useStore((s) => s.categories);
  const tasks = useStore((s) => s.tasks);
  const outbox = useStore((s) => s.outbox.length);
  const unread = useStore((s) => s.notifications.filter((n) => !n.read).length);
  const hydrated = useStore((s) => s.hydrated);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    };
    const setNet = () => setOnline(navigator.onLine);
    setNet();
    window.addEventListener('keydown', onKey);
    window.addEventListener('online', setNet);
    window.addEventListener('offline', setNet);
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') void navigator.serviceWorker.register('/sw.js');
    const stop = startSyncLoop();
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('online', setNet);
      window.removeEventListener('offline', setNet);
      stop();
    };
  }, []);

  const openCount = (catId: string) => tasks.filter((t) => t.categoryId === catId && t.status !== 'DONE' && t.status !== 'CANCELLED').length;

  return (
    <div className="flex min-h-dvh">
      {/* Barre latérale (desktop) */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface px-3 py-4 lg:flex">
        <Link href="/" className="mb-6 flex items-center gap-2 px-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className="size-7" />
          <span className="text-[15px] font-semibold tracking-tight">Kairos</span>
        </Link>
        <button onClick={() => setCmdOpen(true)} className="mb-4 flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-white hover:bg-primary-hover">
          <Plus size={16} /> Nouvelle tâche
          <kbd className="ml-auto rounded bg-white/20 px-1.5 text-[10px]">⌘K</kbd>
        </button>
        <nav className="space-y-0.5" aria-label="Navigation principale">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={clsx('flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors', active ? 'bg-primary-soft font-medium text-primary-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink')}
              >
                <Icon size={17} /> {label}
              </Link>
            );
          })}
        </nav>
        <p className="mt-6 mb-1.5 px-2.5 text-[11px] font-semibold tracking-wide text-ink-3 uppercase">Espaces</p>
        <nav className="space-y-0.5 overflow-y-auto scrollbar-thin" aria-label="Catégories">
          {categories.map((c) => (
            <Link key={c.id} href={`/tasks?category=${c.id}`} className="flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink">
              <CategoryDot color={c.color} /> {c.name}
              <span className="ml-auto text-xs text-ink-3 tabular">{hydrated ? openCount(c.id) : ''}</span>
            </Link>
          ))}
        </nav>
        <div className="mt-auto space-y-0.5 pt-4">
          <Link href="/settings" className={clsx('flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm', pathname.startsWith('/settings') ? 'bg-primary-soft text-primary-ink' : 'text-ink-2 hover:bg-surface-2')}>
            <Settings size={17} /> Paramètres
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barre supérieure */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-surface/85 px-4 backdrop-blur">
          <Link href="/" className="flex items-center gap-2 lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="Kairos" className="size-7" />
          </Link>
          <button onClick={() => setCmdOpen(true)} className="flex h-9 min-w-0 max-w-md flex-1 items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 text-sm text-ink-3 hover:border-line-strong">
            <Search size={15} /> <span className="truncate">Rechercher, ajouter, demander à Kairos…</span>
          </button>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {!online ? (
              <span className="flex items-center gap-1 rounded-md bg-warning-soft px-2 py-1 text-xs text-warning"><CloudOff size={13} /> Hors ligne{outbox ? ` · ${outbox} en attente` : ''}</span>
            ) : isDemoMode() ? (
              <span className="hidden rounded-md bg-surface-2 px-2 py-1 text-xs text-ink-3 sm:inline">Mode démo local</span>
            ) : outbox ? (
              <span className="flex items-center gap-1 text-xs text-ink-3"><RefreshCw size={13} className="animate-spin" /> Synchronisation</span>
            ) : null}
            <Link href="/?panel=notifications" className="relative grid size-9 place-items-center rounded-lg text-ink-2 hover:bg-surface-2" aria-label={`Notifications (${unread} non lues)`}>
              <Bell size={18} />
              {unread > 0 && <span className="absolute top-1.5 right-1.5 grid size-4 place-items-center rounded-full bg-critical text-[9px] font-bold text-white">{unread}</span>}
            </Link>
            <ThemeToggle />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pt-5 pb-24 lg:px-8 lg:pb-10">
          {/* Les données vivent dans IndexedDB : rendu après réhydratation pour éviter tout décalage SSR. */}
          {hydrated ? children : <div className="h-40 animate-pulse rounded-2xl bg-surface-2" aria-busy="true" />}
        </main>
      </div>

      {/* Navigation mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Navigation mobile">
        {[NAV[0], NAV[1], null, NAV[2], NAV[6]].map((item, i) =>
          item ? (
            <Link key={item.href} href={item.href} className={clsx('flex flex-col items-center gap-0.5 py-2 text-[10px]', (item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)) ? 'text-primary' : 'text-ink-3')}>
              <item.icon size={20} /> {item.label.split(' ')[0]}
            </Link>
          ) : (
            <button key={i} onClick={() => setCmdOpen(true)} className="mx-auto -mt-5 grid size-12 place-items-center rounded-full bg-primary text-white shadow-pop" aria-label="Ajouter">
              <Plus size={22} />
            </button>
          ),
        )}
      </nav>

      <CommandBar open={cmdOpen} onClose={() => setCmdOpen(false)} />
      <TaskDrawer />
    </div>
  );
}
