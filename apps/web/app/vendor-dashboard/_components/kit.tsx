/**
 * kit.tsx — the supplier tree's ONE presentational kit.
 *
 * EXTRACTED, NOT DESIGNED — the same reasoning as the admin console's
 * `ConsoleTable` (app/admin/_components/console-table.tsx): the 63 supplier
 * screens were already drawing the same five shapes, each file with its own
 * hand-typed copy. Measured on origin/main @ beb9b5942 (2026-08-24), before
 * this file existed:
 *
 *   · the section card `rounded-2xl border border-ink/10 bg-white p-*`
 *     appeared 34 times across 47 slightly-different spellings;
 *   · the dashed empty panel had 8 competing spellings;
 *   · status pills re-derived their tone classes per file (two files even
 *     declared their own `StatusBadge`), and `clients/[eventId]/page.tsx`
 *     declared a local `Card` identical to the dominant recipe;
 *   · the form-control recipe `rounded-lg border border-ink/20 bg-white
 *     px-3 py-1.5 text-sm` was hand-typed 39 times in 7 files.
 *
 * Every class string below is the DOMINANT shipped spelling, not a new
 * design. The owner-approved archetypes (2026-08-04, binding) are the shapes
 * these screens already wear; converging the spellings is the port.
 *
 * SUPPLIER-TREE-SCOPED ON PURPOSE. The couple tree and the admin console
 * each extracted their own kits from their own conventions; a repo-wide
 * primitive would have to pick one tree's recipe and silently restyle the
 * other two.
 *
 * ── Colour rules this file makes unwriteable ────────────────────────────────
 * In this repo the Tailwind slot named `terracotta` is the decorative GOLD
 * (#A9834B, 3.37:1 on white — FAILS AA for text) and the action colour lives
 * in the slot named `mulberry`. So:
 *   · no tone below ever emits the bare gold text utility;
 *   · gold-toned TEXT uses `text-terracotta-700`, the dark text-gold;
 *   · the action tone uses `mulberry`.
 * Centralising the tone map means the contrast argument is made once, here,
 * instead of re-litigated per file.
 */
import type { ReactNode } from 'react';

/* ──────────────────────────────────────────────────────────────────────────
 * ShopCard — the section panel.
 * Dominant shipped recipe: `rounded-2xl border border-ink/10 bg-white p-4
 * sm:p-5` (the exact class string of the local `Card` this replaces).
 * Card separation is border + shadowless white on the white page, per the
 * 2026-08-20 owner ruling — do not add a second surface colour.
 * ────────────────────────────────────────────────────────────────────────── */
/**
 * The card recipe itself, for the places that must keep their own element —
 * an `<li>` in a roster, an `<article>` in a mapped list. `ShopCard` composes
 * this same constant, so the recipe exists exactly once.
 */
export const shopCardClass = 'rounded-2xl border border-ink/10 bg-white';

const CARD_PAD = {
  /** The dominant spelling (24 of the 34 shipped instances). */
  default: 'p-4 sm:p-5',
  /** The hero/summary spelling (`p-5 sm:p-6`). */
  roomy: 'p-5 sm:p-6',
  /** The compact spelling (`p-4` at every width). */
  tight: 'p-4',
  /** For cards whose children own the padding (media, tables). */
  none: '',
} as const;

export function ShopCard({
  eyebrow,
  actions,
  pad = 'default',
  className = '',
  children,
}: {
  /** Small-caps section label, rendered with the shipped `sn-eye` class. */
  eyebrow?: ReactNode;
  /** Right-aligned header controls (links, small buttons). */
  actions?: ReactNode;
  pad?: keyof typeof CARD_PAD;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`${shopCardClass} ${CARD_PAD[pad]} ${className}`}>
      {eyebrow || actions ? (
        <div className="mb-3 flex items-start justify-between gap-3">
          {eyebrow ? <p className="sn-eye">{eyebrow}</p> : <span />}
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * There is deliberately NO stat-tile component here. The tree's stat blocks
 * (reviews StatsOverview, earnings tiles, the home's energy stats) differ in
 * structure, not just spelling — converging them is a redesign, not an
 * extraction, and a kit export with zero consumers is a gate with no handle
 * (this repo has shipped five). Add one only together with its first two
 * real consumers.
 * ────────────────────────────────────────────────────────────────────────── */

/* ──────────────────────────────────────────────────────────────────────────
 * ShopPill — the status pill, with the tone argument settled once.
 * `gold` deliberately emits text-terracotta-700 (the dark text-gold), never
 * the bare gold utility — see the colour rules in the header.
 * ────────────────────────────────────────────────────────────────────────── */
export type ShopPillTone = 'ink' | 'action' | 'gold' | 'success' | 'warn' | 'danger';

const PILL_TONE: Record<ShopPillTone, string> = {
  ink: 'bg-ink/[0.05] text-ink/70',
  action: 'bg-mulberry/10 text-mulberry',
  gold: 'bg-terracotta/10 text-terracotta-700',
  success: 'bg-success-50 text-success-800',
  warn: 'bg-warn-50 text-warn-900',
  danger: 'bg-danger-50 text-danger-800',
};

export function ShopPill({
  tone = 'ink',
  title,
  className = '',
  children,
}: {
  tone?: ShopPillTone;
  /** Native tooltip, for pills whose meaning needs a sentence. */
  title?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] ${PILL_TONE[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * ShopNotice — the tinted full-width band (the shipped success band appeared
 * 9×, the gold/terracotta info band 5×, byte-similar each time).
 * ────────────────────────────────────────────────────────────────────────── */
const NOTICE_TONE: Record<Exclude<ShopPillTone, 'ink' | 'action'>, string> = {
  gold: 'border-terracotta/30 bg-terracotta/10 text-terracotta-700',
  success: 'border-success-300/60 bg-success-50 text-success-800',
  warn: 'border-warn-300/60 bg-warn-50 text-warn-900',
  danger: 'border-danger-300/60 bg-danger-50 text-danger-800',
};

export function ShopNotice({
  tone,
  role,
  className = '',
  children,
}: {
  tone: Exclude<ShopPillTone, 'ink' | 'action'>;
  /** `status` for confirmations, `alert` for refusals — the shipped sites carry these. */
  role?: 'status' | 'alert';
  className?: string;
  children: ReactNode;
}) {
  return (
    <div role={role} className={`rounded-md border px-4 py-3 text-sm ${NOTICE_TONE[tone]} ${className}`}>
      {children}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * ShopEmpty — the dashed nothing-here panel.
 *
 * ⚠ THE SIX-STATE RULE STILL APPLIES ABOVE THIS COMPONENT. An RLS denial and
 * an empty read are the same value (`data: null → []`), so render this only
 * after the read's error was bound and checked — `reads-are-honest.test.ts`
 * in this tree fails a new unbound read. This component states the absence;
 * it cannot verify it.
 * ────────────────────────────────────────────────────────────────────────── */
/**
 * The inline spelling, exported for elements that must keep their own tag —
 * a lone `<li>` standing in for an empty roster. `ShopEmpty inline` composes
 * this same constant. text-ink/60, not the ink/45 three of the shipped list
 * empties carried — ink/45 measures 2.62:1 on white, a hard AA fail the
 * states kit corrected once already.
 */
export const shopEmptyInlineClass =
  'rounded-xl border border-dashed border-ink/15 px-3 py-4 text-center text-sm text-ink/60';

export function ShopEmpty({
  inline = false,
  className = '',
  children,
}: {
  /** Inline note inside a card or list, instead of the standalone panel. */
  inline?: boolean;
  className?: string;
  children: ReactNode;
}) {
  if (inline) {
    return <p className={`${shopEmptyInlineClass} ${className}`}>{children}</p>;
  }
  return (
    <div
      className={`rounded-2xl border border-dashed border-ink/15 p-8 text-center text-sm text-ink/60 ${className}`}
    >
      {children}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * shopInputClass — the shipped form-control recipe, hand-typed 39 times in 7
 * files before this constant existed. A string on purpose: the call sites are
 * native <input>/<select>/<textarea> elements whose props vary too much for a
 * wrapper to earn its keep, and a class constant converges the spelling
 * without changing a single element's behaviour.
 * ────────────────────────────────────────────────────────────────────────── */
export const shopInputClass = 'rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm';
