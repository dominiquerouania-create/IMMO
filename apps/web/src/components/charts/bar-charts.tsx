'use client';

/**
 * Graphiques légers en HTML/CSS (pas de dépendance) :
 * - séries en ordre fixe (--series-1 bleu, --series-2 orange), palette validée daltonisme ;
 * - barres fines à extrémité arrondie ancrées sur la ligne de base, 2 px d'écart ;
 * - légende dès 2 séries, info-bulle au survol / focus sur chaque barre ;
 * - un seul axe, grille discrète, textes en couleurs de texte (jamais la couleur de série).
 */

export interface SeriesDef {
  key: string;
  label: string;
  color: string; // variable CSS, ex. 'var(--series-1)'
}

export function Legend({ series }: { series: SeriesDef[] }) {
  return (
    <ul className="flex flex-wrap gap-3 text-xs text-ink-2">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm" style={{ background: s.color }} />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

export function GroupedBarChart({
  data,
  series,
  labelKey,
  height = 160,
  format = (v: number) => String(v),
}: {
  data: Array<Record<string, number | string>>;
  series: SeriesDef[];
  labelKey: string;
  height?: number;
  format?: (v: number) => string;
}) {
  const max = Math.max(1, ...data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0)));
  const ticks = [0, 0.5, 1].map((f) => Math.round(max * f));
  return (
    <figure className="space-y-3">
      {series.length > 1 && <Legend series={series} />}
      <div className="relative" style={{ height }}>
        {ticks.map((t) => (
          <div key={t} className="absolute inset-x-0 flex items-center gap-2" style={{ bottom: `${(t / max) * 100}%` }}>
            <span className="w-6 text-right text-[10px] text-ink-3 tabular">{t}</span>
            <div className="h-px flex-1 bg-grid" />
          </div>
        ))}
        <div className="absolute inset-0 left-8 flex items-end gap-2">
          {data.map((d, i) => (
            <div key={i} className="group relative flex h-full flex-1 items-end justify-center gap-[2px]" tabIndex={0}>
              {series.map((s) => (
                <div
                  key={s.key}
                  className="w-full max-w-4 rounded-t-[4px] transition-opacity group-hover:opacity-90"
                  style={{ height: `${((Number(d[s.key]) || 0) / max) * 100}%`, background: s.color, minHeight: Number(d[s.key]) ? 2 : 0 }}
                />
              ))}
              <div role="tooltip" className="pointer-events-none absolute bottom-full z-10 mb-1 hidden min-w-28 rounded-lg border border-line bg-surface px-2.5 py-2 text-xs shadow-pop group-hover:block group-focus:block">
                <p className="mb-1 font-medium text-ink">{String(d[labelKey])}</p>
                {series.map((s) => (
                  <p key={s.key} className="flex items-center justify-between gap-3 text-ink-2">
                    <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm" style={{ background: s.color }} />{s.label}</span>
                    <span className="font-medium text-ink tabular">{format(Number(d[s.key]) || 0)}</span>
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="ml-8 flex gap-2">
        {data.map((d, i) => (
          <span key={i} className="flex-1 truncate text-center text-[10px] text-ink-3">{String(d[labelKey])}</span>
        ))}
      </div>
    </figure>
  );
}

/** Barres horizontales empilées (réunions / tâches / libre) — charge par jour. */
export function StackedLoadBars({
  rows,
  series,
  format,
}: {
  rows: Array<{ label: string; values: Record<string, number>; total: number; highlight?: boolean }>;
  series: SeriesDef[];
  format: (v: number) => string;
}) {
  return (
    <figure className="space-y-3">
      <Legend series={series} />
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.label} className="group relative flex items-center gap-3" tabIndex={0}>
            <span className={`w-20 shrink-0 text-xs ${r.highlight ? 'font-semibold text-ink' : 'text-ink-2'}`}>{r.label}</span>
            <div className="flex h-3 flex-1 gap-[2px] overflow-hidden rounded bg-surface-3">
              {r.total > 0 &&
                series.map((s) => {
                  const v = r.values[s.key] ?? 0;
                  return v > 0 ? <div key={s.key} className="h-full first:rounded-l last:rounded-r" style={{ width: `${(v / r.total) * 100}%`, background: s.color }} /> : null;
                })}
            </div>
            <span className="w-14 shrink-0 text-right text-xs text-ink-2 tabular">{r.total ? `${Math.round(((r.values.meetings ?? 0) + (r.values.tasks ?? 0)) / r.total * 100)} %` : 'Repos'}</span>
            {r.total > 0 && (
              <div role="tooltip" className="pointer-events-none absolute bottom-full left-20 z-10 mb-1 hidden rounded-lg border border-line bg-surface px-2.5 py-2 text-xs shadow-pop group-hover:block group-focus:block">
                {series.map((s) => (
                  <p key={s.key} className="flex justify-between gap-4 text-ink-2">
                    {s.label}<span className="font-medium text-ink tabular">{format(r.values[s.key] ?? 0)}</span>
                  </p>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </figure>
  );
}
