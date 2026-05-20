import Link from 'next/link';
import { Star } from 'lucide-react';

import type { TaxonomyEntry, TaxonomyPhase } from '@/lib/taxonomy';
import type { VendorCount } from '@/lib/vendor-counts';

export type CategoryTileData = {
  canonicalService: string;
  displayNameEn: string;
  displayNameTl: string | null;
  meta: TaxonomyEntry;
  count: VendorCount | null;
};

const LIVE_PHASES: ReadonlySet<TaxonomyPhase> = new Set([
  'V1.1 base',
  'V1.1.1',
  'V1.1.2',
  'V1.1.3',
  'V1.1.4',
  'V1.1.5',
  'V1.1.6',
]);

function isLivePhase(phase: TaxonomyPhase): boolean {
  return LIVE_PHASES.has(phase);
}

type TileState =
  | { kind: 'populated'; verified: number; comingSoon: number }
  | { kind: 'recruiting' }
  | { kind: 'future' }
  | { kind: 'setnayan' };

function deriveState(data: CategoryTileData): TileState {
  if (data.meta.setnayan) return { kind: 'setnayan' };
  const total = data.count?.total ?? 0;
  if (total > 0) {
    return {
      kind: 'populated',
      verified: data.count?.verified ?? 0,
      comingSoon: data.count?.coming_soon ?? 0,
    };
  }
  return isLivePhase(data.meta.phase) ? { kind: 'recruiting' } : { kind: 'future' };
}

export function CategoryTile({ data }: { data: CategoryTileData }) {
  const state = deriveState(data);
  const href = `/vendors?category=${encodeURIComponent(data.canonicalService)}`;

  const containerClass =
    state.kind === 'setnayan'
      ? 'group flex h-full flex-col gap-2 rounded-2xl border border-terracotta/40 bg-terracotta/5 p-4 transition-colors hover:border-terracotta hover:bg-terracotta/10'
      : state.kind === 'future'
        ? 'group flex h-full flex-col gap-2 rounded-2xl border border-dashed border-ink/20 bg-cream p-4 transition-colors hover:border-ink/40'
        : 'group flex h-full flex-col gap-2 rounded-2xl border border-ink/10 bg-cream p-4 transition-colors hover:border-terracotta/50 hover:bg-terracotta/5';

  const ariaLabel = ariaLabelFor(data, state);

  return (
    <Link href={href} aria-label={ariaLabel} className={containerClass}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-ink group-hover:text-terracotta">
            {state.kind === 'setnayan' ? (
              <span className="inline-flex items-center gap-1">
                <Star
                  aria-hidden
                  className="h-3.5 w-3.5 fill-terracotta text-terracotta"
                  strokeWidth={1.75}
                />
                {data.displayNameEn}
              </span>
            ) : (
              data.displayNameEn
            )}
          </h3>
          {data.displayNameTl ? (
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
              {data.displayNameTl}
            </p>
          ) : null}
        </div>
        <StatePill state={state} />
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-1">
        {data.meta.faith ? <MiniBadge tone="faith">{data.meta.faith}</MiniBadge> : null}
        {data.meta.ph ? <MiniBadge tone="ph">PH</MiniBadge> : null}
        {data.meta.rental ? <MiniBadge tone="rental">Rental</MiniBadge> : null}
      </div>

      <CtaLine state={state} />
    </Link>
  );
}

function ariaLabelFor(data: CategoryTileData, state: TileState): string {
  const name = data.displayNameEn;
  switch (state.kind) {
    case 'populated':
      return `${name}, ${state.verified} verified, ${state.comingSoon} coming soon`;
    case 'recruiting':
      return `${name}, recruiting vendors now`;
    case 'future':
      return `${name}, planned for ${data.meta.phase}`;
    case 'setnayan':
      return `${name}, Setnayan first-party service`;
  }
}

function StatePill({ state }: { state: TileState }) {
  switch (state.kind) {
    case 'setnayan':
      return (
        <span className="shrink-0 rounded-full bg-terracotta px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-cream">
          Setnayan
        </span>
      );
    case 'populated':
      return (
        <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-emerald-800">
          {state.verified + state.comingSoon} listed
        </span>
      );
    case 'recruiting':
      return (
        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-amber-900">
          Recruiting
        </span>
      );
    case 'future':
      return (
        <span className="shrink-0 rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-ink/55">
          Coming soon
        </span>
      );
  }
}

function CtaLine({ state }: { state: TileState }) {
  let copy: string;
  switch (state.kind) {
    case 'populated':
      copy =
        state.verified > 0
          ? `Browse ${state.verified} vendor${state.verified === 1 ? '' : 's'} →`
          : `Preview ${state.comingSoon} coming-soon vendor${state.comingSoon === 1 ? '' : 's'} →`;
      break;
    case 'recruiting':
      copy = 'Be the first to list →';
      break;
    case 'future':
      copy = 'Notify me when it opens →';
      break;
    case 'setnayan':
      copy = 'Book Setnayan →';
      break;
  }
  return (
    <p className="text-xs font-medium text-terracotta group-hover:underline">{copy}</p>
  );
}

function MiniBadge({
  tone,
  children,
}: {
  tone: 'faith' | 'ph' | 'rental';
  children: React.ReactNode;
}) {
  const cls =
    tone === 'faith'
      ? 'bg-violet-100 text-violet-800'
      : tone === 'ph'
        ? 'bg-sky-100 text-sky-800'
        : 'bg-ink/5 text-ink/60';
  return (
    <span
      className={`inline-flex items-center rounded-full px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] ${cls}`}
    >
      {children}
    </span>
  );
}
