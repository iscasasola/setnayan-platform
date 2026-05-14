'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, MapPin, Clock } from 'lucide-react';
import { formatRelativeMs } from '@/lib/day-of-mode';

type Block = {
  block_id: string;
  label: string;
  start_at: string;
  end_at: string | null;
  location: string | null;
};

type Props = {
  blocks: Block[];
};

type State =
  | { kind: 'active'; block: Block; nextBlockStart: number | null }
  | { kind: 'between'; nextBlock: Block }
  | { kind: 'empty' };

function deriveState(blocks: Block[], now: number): State {
  const sorted = [...blocks].sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
  );
  for (let i = 0; i < sorted.length; i++) {
    const b = sorted[i];
    if (!b) continue;
    const start = new Date(b.start_at).getTime();
    const end = b.end_at
      ? new Date(b.end_at).getTime()
      : start + 30 * 60_000;
    if (start <= now && now < end) {
      const next = sorted[i + 1] ?? null;
      return {
        kind: 'active',
        block: b,
        nextBlockStart: next ? new Date(next.start_at).getTime() : null,
      };
    }
  }
  const next = sorted.find((b) => new Date(b.start_at).getTime() > now);
  if (next) return { kind: 'between', nextBlock: next };
  return { kind: 'empty' };
}

function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function WhatsHappeningCard({ blocks }: Props) {
  // tick re-renders every 60s so the countdown stays current.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const state = useMemo(() => deriveState(blocks, Date.now()), [blocks]);

  return (
    <article className="space-y-3 rounded-2xl border border-terracotta/30 bg-cream p-5">
      <header className="flex items-center justify-between">
        <p className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-terracotta">
          <Activity aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Happening now
        </p>
        <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-terracotta" />
      </header>

      {state.kind === 'active' ? (
        <>
          <h3 className="text-xl font-semibold tracking-tight text-ink">
            {state.block.label}
          </h3>
          <div className="space-y-1 text-sm text-ink/65">
            <p className="inline-flex items-center gap-1.5">
              <Clock aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              Started at {formatClock(state.block.start_at)}
              {state.block.end_at ? ` · ends ${formatClock(state.block.end_at)}` : null}
            </p>
            {state.block.location ? (
              <p className="inline-flex items-center gap-1.5">
                <MapPin aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                {state.block.location}
              </p>
            ) : null}
            {state.nextBlockStart !== null ? (
              <p className="pt-1 text-xs text-terracotta-700">
                Next block {formatRelativeMs(state.nextBlockStart - Date.now())}
              </p>
            ) : null}
          </div>
        </>
      ) : state.kind === 'between' ? (
        <>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
            Up next
          </p>
          <h3 className="text-xl font-semibold tracking-tight text-ink">
            {state.nextBlock.label}
          </h3>
          <p className="text-sm text-ink/65">
            Starts{' '}
            <span className="font-medium text-ink">
              {formatRelativeMs(new Date(state.nextBlock.start_at).getTime() - Date.now())}
            </span>
            {' · '}
            {formatClock(state.nextBlock.start_at)}
          </p>
          {state.nextBlock.location ? (
            <p className="inline-flex items-center gap-1.5 text-sm text-ink/65">
              <MapPin aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              {state.nextBlock.location}
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-ink/55">
          No active schedule block. Add one in Schedule to see live updates here.
        </p>
      )}
    </article>
  );
}
