/**
 * ConsoleTable — the ONE admin console table.
 *
 * ── Why this exists (measured on origin/main, 2026-08-17) ───────────────────
 * 108 admin routes. 34 files under `app/admin` hand-roll a raw `<table>`, and
 * `app/admin/_components` held 13 files, none of them a table. The markup was
 * already a convention nobody could import: 13 of the tables open with
 * `w-full text-left text-sm` and 12 carry the identical
 * `bg-ink/[0.03] text-[11px] uppercase tracking-[0.12em]` header recipe. So
 * this is NOT a new design — it is the shipped table, extracted once.
 *
 * Same reasoning as `KpiStatCard` three files away: admin-scoped on purpose,
 * not a repo-wide component the couple/vendor doorways import.
 *
 * ── The defect it closes STRUCTURALLY, which is the whole point ─────────────
 * 16 of those 34 files end their read with `(data ?? [])` and then branch on
 * `rows.length === 0`. Supabase RESOLVES with `{ error }` instead of throwing,
 * so a rejected query — a phantom column, a stale enum value, an unapplied
 * migration — arrives as an empty array and the page prints a calm sentence
 * saying there is nothing here. Measured, in production code today:
 *
 *   /admin/approvals   a failed read renders "No approvals pending. Set na 'yan."
 *                      on the queue whose ONLY job is that a second admin looks.
 *   /admin/fraud       a failed read renders "No open fraud signals."
 *   /admin/pax-changes a failed read renders "No pax-driven cost changes yet."
 *                      to a mediator answering "why did this vendor's cost jump?"
 *
 * ONE surface got it right — `browser-blocks-surface.tsx`, whose own comment
 * reads "A FAILED READ IS NOT AN EMPTY LIST". This component makes that the
 * default instead of a thing each author has to remember, by making the wrong
 * thing unwriteable:
 *
 *   • `rows` accepts `null | undefined` and treats it as NOT MEASURED. It can
 *     never fall through to Empty. `count === null` means "not measured", never
 *     "zero" — filing an unmeasured queue under "N queues are clear" puts it in
 *     the one place a reader has been told they need not look.
 *   • `readPermitted` is typed as the literal `true`. There is no way to pass
 *     `false`, exactly as in `EmptyState` — if you cannot write it honestly you
 *     are looking at Denied, never Empty.
 *   • Precedence is `resolveSurfaceState`'s, not this file's: error beats
 *     locked beats denied beats empty. One resolver, already tested.
 *
 * WHY `readPermitted` IS HONESTLY `true` ON ADMIN SURFACES, and where that
 * stops being true: these pages read through `createAdminClient()` (service
 * role), which RLS cannot silently filter, behind `requireAdmin()`, which
 * proved the role by reading it back. Both halves are required. A surface that
 * reads through the RLS browser/server client has NOT proven permission — an
 * RLS denial and an empty read are the same `count: 0` — so it must pass the
 * positively-proven value it holds, not a hardcoded `true`.
 *
 * ── No silent caps ─────────────────────────────────────────────────────────
 * 21 of the 34 tables `.limit(...)` their read and only 6 say so; the rest
 * silently truncate, which reads as "this is all of it". `/admin/approvals`
 * caps recently-decided at 10 with no note, `demo-vendors-surface` at 2000.
 * Pass the same number as `cap` and a full page discloses itself.
 *
 * ── Colour, measured in BOTH themes (do not "restore" the old value) ────────
 * The shipped header label is `text-ink/55`, which measures 3.24:1 on its own
 * `bg-ink/[0.03]` fill in the light theme — below the 4.5:1 AA floor for text,
 * on ~12 tables today. 11px uppercase gets no large-text exception. This uses
 * `text-ink/70`: 5.02:1 light, 8.32:1 dark. The structure is copied; the one
 * measured failure in it is not.
 *
 * TWO GOLDS, TWO RULES — the Tailwind slot named `terracotta` holds the atelier
 * GOLD #A9834B (3.37:1 on cream, non-text only) and the CTA terracotta #C24E25
 * lives in the slot named `mulberry` (4.61:1). Backwards, inherited, and it has
 * bitten twice. Nothing in this file paints text gold; the row hover keeps the
 * shipped 4% gold tint, which is decoration and carries no glyph.
 *
 * ── What this component deliberately does NOT have ─────────────────────────
 * No actions API. Judgement queues — disputes, fraud, user reports, erasure
 * requests, integrity watch, concierge abuse, force majeure — get NO button at
 * all, and a fast button is worst exactly where being wrong costs most. `note`
 * renders a sentence in the slot where controls would sit, so the absence reads
 * as a decision rather than an unfinished screen. A row that genuinely settles
 * on one click renders its own form inside its own `cell`; the archetype never
 * offers one.
 */

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { EmptyState } from '@/app/_components/states/empty-state';
import { ErrorState } from '@/app/_components/states/error-state';
import { resolveSurfaceState } from '@/app/_components/states/surface-state';

/**
 * Static class strings, never interpolated — Tailwind's scanner reads source
 * text, so a computed `md:table-cell` would be dropped from the build and the
 * column would simply never come back on a wide screen.
 */
const HIDE_BELOW = {
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
} as const;

export type ConsoleColumn<Row> = {
  /** Column heading. Say what a person reads, not the column name. */
  header: string;
  /** Renders one cell. Free-form so a row can carry its own link or form. */
  cell: (row: Row) => ReactNode;
  /**
   * Drop the column below this breakpoint — the shipped `hidden md:table-cell`
   * idiom. Admin is used on a phone (there is an admin bottom nav and a mobile
   * landing grid), and 20 of the 34 tables set no min-width at all, so they
   * crush instead of scrolling. Mark everything but the identifying columns.
   */
  hideBelow?: keyof typeof HIDE_BELOW;
  /** Right-align numerics so they compare down the column. */
  align?: 'right';
  /** Space Mono data face — ids, money, dates, counts. */
  mono?: boolean;
};

type Props<Row> = {
  /**
   * The rows to render — or `null`/`undefined` for NOT MEASURED, which renders
   * the "we do not know" report and can never render Empty.
   */
  rows: Row[] | null | undefined;
  columns: ConsoleColumn<Row>[];
  /** Stable key per row. Compose one from the row's own columns if it has no id. */
  rowKey: (row: Row, index: number) => string;
  /** Accessible name for the table. "Receipts", not "table". */
  label: string;
  /** What lands here and what starts it, for the permitted-and-zero case. */
  empty: {
    Icon: LucideIcon;
    title: string;
    blurb: string;
    action?: ReactNode;
    verifiedNote?: string;
  };
  /**
   * Read `true` ONLY when permission was positively proven — on admin surfaces
   * `requireAdmin()` plus the service-role client. See the file docblock.
   */
  readPermitted: true;
  /** The `{ error }` Supabase resolved with. Reported, never swallowed. */
  readError?: { message?: string } | null;
  /** Name the thing that could not be read: "the violation log". */
  reads?: string;
  /** The `.limit(...)` the read applied, so a full page can disclose itself. */
  cap?: number;
  /** Horizontal floor before the wrapper scrolls instead of crushing columns. */
  minWidth?: string;
  /**
   * The sentence that sits where buttons would be on a judgement queue. Its
   * presence is the decision; do not replace it with a control.
   */
  note?: ReactNode;
};

export function ConsoleTable<Row>({
  rows,
  columns,
  rowKey,
  label,
  empty,
  readPermitted,
  readError,
  reads,
  cap,
  minWidth = '48rem',
  note,
}: Props<Row>) {
  const measured = Array.isArray(rows);
  const state = resolveSurfaceState({
    // Not measured is an error, not an empty list: nothing was counted, so
    // there is no count to call zero.
    error: Boolean(readError) || !measured,
    readPermitted,
    count: measured ? rows.length : 0,
  });

  if (state === 'error') {
    const subject = reads ?? label.toLowerCase();
    return (
      <ErrorState
        title={`Couldn't read ${subject}`}
        broke={
          readError?.message
            ? `The read was refused: ${readError.message}`
            : 'The read did not complete.'
        }
        survived={`Nothing loaded, so this is NOT a statement that there are no ${subject} — it is a statement that we do not know.`}
        todo="Reload. If it repeats, the query is being rejected rather than returning nothing, and the column, value or migration it names is the thing to check."
      />
    );
  }

  if (state === 'denied') {
    // Unreachable through the type — kept so a future `readPermitted: boolean`
    // caller gets Denied rather than a page that renders nothing at all.
    return (
      <ErrorState
        title={`Not cleared to read ${reads ?? label.toLowerCase()}`}
        broke="This account's permission for this read was not proven."
        survived="No rows were shown, and none were ruled out."
        todo="Open this from an admin account."
      />
    );
  }

  if (state === 'empty') {
    return (
      <EmptyState
        Icon={empty.Icon}
        title={empty.title}
        blurb={empty.blurb}
        action={empty.action}
        readPermitted
        verifiedNote={empty.verifiedNote}
      />
    );
  }

  const list = rows as Row[];
  const capped = typeof cap === 'number' && list.length >= cap;

  return (
    <>
      {note ? <p className="mb-3 text-sm text-ink/70">{note}</p> : null}

      <div className="overflow-x-auto rounded-xl border border-ink/10">
        <table
          aria-label={label}
          className="w-full text-left text-sm"
          style={{ minWidth }}
        >
          <thead className="bg-ink/[0.03] text-[11px] uppercase tracking-[0.12em] text-ink/70">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.header}
                  scope="col"
                  className={[
                    'px-3 py-3 font-medium',
                    col.align === 'right' ? 'text-right' : '',
                    col.hideBelow ? HIDE_BELOW[col.hideBelow] : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((row, index) => (
              <tr
                key={rowKey(row, index)}
                className="border-t border-ink/5 align-top hover:bg-terracotta/[0.04]"
              >
                {columns.map((col) => (
                  <td
                    key={col.header}
                    className={[
                      'px-3 py-3',
                      col.align === 'right' ? 'text-right tabular-nums' : '',
                      col.mono ? 'font-mono text-xs' : '',
                      col.hideBelow ? HIDE_BELOW[col.hideBelow] : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {capped ? (
        <p className="mt-3 text-xs text-ink/70">
          Showing the first {cap?.toLocaleString()}. There are more — this is not
          the whole list.
        </p>
      ) : null}
    </>
  );
}
