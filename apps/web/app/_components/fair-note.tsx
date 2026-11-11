'use client';

import { InfoTip } from '@/app/_components/info-tip';
import { FAIR_WHY_WE_CHECK, fairLine, type FairField, type FairHit } from '@/lib/fair-presentation';

/**
 * 🚫 THE FAIR-PRESENTATION NOTE — one plain message under the line it is about (owner 2026-11-08: *"Each = a plain
 * message under the line, Save/Publish off until fixed, the fair-presentation copy above"*).
 *
 * ONE note per field row: every problem on that row is folded into the ruled sentence's "[what to change]" (a list
 * field names its line — "on line 2"), and the ⓘ holds "Why we check" plus each problem's own why. No box, no frame —
 * the same quiet danger line the card maker's rows already draw (`card-checks.tsx` · `NOTE`).
 *
 * Drawn by the card maker (name · what's included · extras), the shop name (Shop ⚙ and /open-shop), the tagline,
 * About and the bundle maker's name. The page keeps its Save off while `hits.length > 0`; the save asks again
 * (`lib/fair-presentation.server.ts`).
 */

const DANGER = { color: 'rgb(var(--color-danger))' } as const;
/** A note line owns a 46 px row — its ⓘ press halo is 46 × 46 (`card-checks.tsx` · the 44 px press rule). */
const NOTE = 'flex min-h-[46px] items-center gap-2 text-[13px] font-medium leading-snug';

const LIST_FIELD: Partial<Record<FairField, true>> = { included: true, extras: true };

export function FairNote({ hits, field, className }: { hits: ReadonlyArray<FairHit>; field: FairField; className?: string }) {
  const mine = hits.filter((h) => h.field === field);
  if (mine.length === 0) return null;
  const fixes = mine.map((h) => (LIST_FIELD[field] ? `${h.fix} on line ${h.index + 1}` : h.fix));
  const whys = Array.from(new Map(mine.map((h) => [`${h.check}\u0001${h.sample}`, h])).values());
  const claimed = mine.some((h) => h.check === 'claim');
  return (
    <div data-card-check="fair" data-fair-note={field} className={className}>
      <p role="alert" className={NOTE} style={DANGER}>
        <span className="min-w-0 flex-1">{fairLine(fixes)}</span>
        <InfoTip label="" ariaLabel="Why we check" align="end">
          <span className="mb-1.5 block">{FAIR_WHY_WE_CHECK}</span>
          {whys.map((h) => (
            <span key={`${h.check}-${h.sample}`} className="mb-1 block">
              <b className="font-semibold">“{h.sample}”</b> — {h.why}
            </span>
          ))}
          {claimed ? (
            <span className="mt-1 block text-ink/60">If you hold the right to say it, ask us — we can allow it for your shop.</span>
          ) : null}
        </InfoTip>
      </p>
    </div>
  );
}
