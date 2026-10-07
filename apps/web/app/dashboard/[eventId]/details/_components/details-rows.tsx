import type { ReactNode } from 'react';
import { InfoTip } from '@/app/_components/info-tip';
import { DetailsRowText } from './details-fold';
import { RecordRowLink } from './record-row-link';

/**
 * Event Details' row shapes (owner 2026-10-07, "approve all" — one row shape):
 * a label, a one-line summary, and ONE thing on the right.
 *
 *   · `JumpRow` — › : the fact lives elsewhere; the row is a plain `<Link>`
 *     (`RecordRowLink`) to its home. It never edits here and never says "Edit
 *     in X ↗" (owner 2026-09-28: no go-edit-elsewhere links).
 *   · `PlainRow` — nothing on the right: shown, not changed here (a Settled
 *     fact, or a part this viewer may not change).
 *   · `DetailsFold` (`details-fold.tsx`) — ⌄ : unfolds here.
 */
export function JumpRow({
  row,
  href,
  label,
  summary,
  fact,
  money = false,
  quiet = false,
}: {
  /** The row's name (`data-details-row`). */
  row: string;
  /** Its home — never Event Details itself. */
  href: string;
  label: string;
  summary: string;
  /** The MAP facts this row carries, space-separated (`data-fact`). */
  fact?: string;
  /** A money figure — never kept as last-seen data (lib/last-seen). */
  money?: boolean;
  /** Settled: quiet type. */
  quiet?: boolean;
}) {
  return (
    <div className="border-t border-ink/10 first:border-t-0" data-details-row={row} data-jump="" data-fact={fact} data-money={money ? '' : undefined}>
      <RecordRowLink row={row} href={href} recordHref={href}>
        <DetailsRowText label={label} summary={summary} quiet={quiet} />
      </RecordRowLink>
    </div>
  );
}

export function PlainRow({
  row,
  label,
  summary,
  fact,
  money = false,
  quiet = false,
}: {
  row: string;
  label: string;
  summary: string;
  fact?: string;
  money?: boolean;
  quiet?: boolean;
}) {
  return (
    <div className="flex min-h-11 items-center border-t border-ink/10 py-2.5 first:border-t-0" data-details-row={row} data-fact={fact} data-money={money ? '' : undefined}>
      <DetailsRowText label={label} summary={summary} quiet={quiet} />
    </div>
  );
}

/** A plain heading over a group of rows ("Still yours to change"), with an optional ⓘ. */
export function Eyebrow({ children, tip }: { children: string; tip?: string }) {
  const cls = 'font-mono text-[11px] uppercase tracking-[0.14em] text-ink/60';
  return (
    <div className="flex items-center gap-1.5 pb-1 pt-4" data-details-eyebrow="">
      {tip ? (
        <InfoTip label={children} labelAs="h3" labelClassName={cls} align="start" className="inline-flex items-center gap-1.5">
          {tip}
        </InfoTip>
      ) : (
        <h3 className={cls}>{children}</h3>
      )}
    </div>
  );
}

/**
 * SETTLED — what a booking holds (owner 2026-10-07: *"Whatever is finalized
 * should be grouped together as well"*). One quiet group, ONE ⓘ note
 * (`SETTLED_NOTE`) in place of a padlock on every row; its rows mount no editor.
 */
export function SettledGroup({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <div data-details-settled="">
      <Eyebrow tip={note}>{title}</Eyebrow>
      <div>{children}</div>
    </div>
  );
}

/**
 * ✍ A row that opens Event settings in place (the `@field` sheet,
 * `record-field-slot.tsx`) — the one live editor left. Only Kind and the guest
 * estimate, and only while no booking holds them; once one does they are
 * Settled and open nothing.
 */
export function FieldRow({
  row,
  href,
  recordHref,
  label,
  summary,
  fact,
}: {
  row: string;
  href: string;
  recordHref: string;
  label: string;
  summary: string;
  fact?: string;
}) {
  return (
    <div className="border-t border-ink/10 first:border-t-0" data-details-row={row} data-record-row={row} data-fact={fact}>
      <RecordRowLink row={row} href={href} recordHref={recordHref}>
        <DetailsRowText label={label} summary={summary} />
      </RecordRowLink>
    </div>
  );
}
