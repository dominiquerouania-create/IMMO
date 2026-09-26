'use client';

import { PRIORITY_LABELS, TASK_STATUS_LABELS, type Priority, type TaskStatus } from '@kairos/core';
import clsx from 'clsx';
import { AlertTriangle, ArrowDown, ArrowUp, Flame, Minus } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function Card({ title, icon, action, children, className, bodyClassName }: {
  title?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={clsx('animate-fade-up rounded-2xl border border-line bg-surface shadow-card', className)}>
      {title && (
        <header className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            {icon && <span className="text-primary">{icon}</span>}
            {title}
          </h2>
          {action}
        </header>
      )}
      <div className={clsx('px-4 pb-4', !title && 'pt-4', bodyClassName)}>{children}</div>
    </section>
  );
}

export function Button({ variant = 'primary', size = 'md', className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
}) {
  return (
    <button
      {...props}
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-50',
        size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-9 px-3.5 text-sm',
        variant === 'primary' && 'bg-primary text-white hover:bg-primary-hover',
        variant === 'secondary' && 'border border-line bg-surface text-ink hover:bg-surface-2',
        variant === 'ghost' && 'text-ink-2 hover:bg-surface-2 hover:text-ink',
        variant === 'danger' && 'bg-critical-soft text-critical hover:opacity-80',
        className,
      )}
    />
  );
}

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'primary' | 'good' | 'warning' | 'critical'; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap',
        tone === 'neutral' && 'bg-surface-2 text-ink-2',
        tone === 'primary' && 'bg-primary-soft text-primary-ink',
        tone === 'good' && 'bg-good-soft text-good',
        tone === 'warning' && 'bg-warning-soft text-warning',
        tone === 'critical' && 'bg-critical-soft text-critical',
        className,
      )}
    >
      {children}
    </span>
  );
}

const PRIORITY_UI: Record<Priority, { tone: 'critical' | 'warning' | 'primary' | 'neutral'; icon: ReactNode }> = {
  CRITICAL: { tone: 'critical', icon: <Flame size={11} /> },
  HIGH: { tone: 'warning', icon: <ArrowUp size={11} /> },
  MEDIUM: { tone: 'primary', icon: <Minus size={11} /> },
  LOW: { tone: 'neutral', icon: <ArrowDown size={11} /> },
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  const ui = PRIORITY_UI[priority];
  return (
    <Badge tone={ui.tone}>
      {ui.icon}
      {PRIORITY_LABELS[priority]}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  const tone = status === 'DONE' ? 'good' : status === 'IN_PROGRESS' ? 'primary' : status === 'WAITING' || status === 'POSTPONED' ? 'warning' : 'neutral';
  return <Badge tone={tone}>{TASK_STATUS_LABELS[status]}</Badge>;
}

export function CategoryDot({ color, className }: { color: string; className?: string }) {
  return <span aria-hidden className={clsx('inline-block size-2 shrink-0 rounded-full', className)} style={{ background: color }} />;
}

export function Progress({ value, tone = 'primary', label }: { value: number; tone?: 'primary' | 'good' | 'warning' | 'critical'; label?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div
        className={clsx('h-full rounded-full transition-[width] duration-500', {
          'bg-primary': tone === 'primary',
          'bg-good': tone === 'good',
          'bg-warning': tone === 'warning',
          'bg-critical': tone === 'critical',
        })}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-line py-6 text-center text-xs text-ink-3">{children}</p>;
}

export function RiskIcon() {
  return <AlertTriangle size={13} className="text-warning" aria-label="À risque" />;
}
