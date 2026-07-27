import type { ReactNode } from 'react';

/**
 * Pahina materials for the vendor DAY-OF CONSOLE.
 *
 * ── WHY THESE EXIST INSTEAD OF `.pahina-*` ─────────────────────────────────
 *
 * The `.pahina-eyebrow` / `.pahina-plate` / `.pahina-rule` classes in
 * `globals.css` are all written as `.sn-editorial .pahina-x` descendant
 * selectors, and `.sn-editorial` is applied by `app/[slug]/layout.tsx` around
 * the guest tree only. They are therefore UNREACHABLE from a dashboard, by
 * design: "never leaks to dashboards/marketing" is the stated ground rule on
 * that CSS block, and the guest-tree ↔ chrome separation is owner-locked.
 *
 * There were two ways to get the Pahina look onto this console. We took the
 * second:
 *
 *   ✗ Lift the recipes out of `.sn-editorial`. Rejected — unscoping those
 *     selectors makes them match on EVERY dashboard and marketing page at once,
 *     which is precisely the leak the ground rule forbids. Adding a parallel
 *     `.sn-dayof-*` block to `globals.css` was rejected too: new global CSS
 *     surface for one route, and a second copy of a recipe that would then
 *     drift from the guest-site original.
 *
 *   ✓ Compose the same recipes from the PALETTE TOKENS directly. `gild`,
 *     `veil`, `paper-deep`, `ink`, `paper`/`cream` and `terracotta` are all
 *     `:root`-defined in `globals.css` (`paper` aliases `--color-cream`) and
 *     Tailwind-mapped in `tailwind.config.ts`, so they resolve anywhere. The
 *     `font-pahina` face (Fraunces, `--font-pahina-display`) is loaded on the
 *     root `<html>` in `app/layout.tsx`, so it is global too. Nothing here
 *     depends on a guest-tree scope, and nothing here can affect the guest tree.
 *
 * The visual result matches the guest site; the CSS coupling does not exist.
 * That is the point — same language, no shared scope, no leak in either
 * direction.
 *
 * ── CONTRAST RULES BAKED IN ────────────────────────────────────────────────
 *
 * Two traps in this palette, handled here once so call sites cannot reintroduce
 * them:
 *
 *   1. `gild` and `terracotta` resolve to the SAME rgb on light surfaces
 *      (`169 131 75` — globals.css lines 120 and 2467). Gild on a terracotta
 *      fill is invisible. Nothing here ever puts one on the other.
 *   2. `gild` fails contrast below ~0.85rem. So gild is used ONLY for rules,
 *      hairlines, borders and decorative marks — never for small type. Every
 *      eyebrow, label and caption below is `text-ink/70` or darker, and the
 *      only gild in the type scale is on display-sized text.
 */

/**
 * The eyebrow — small caps mono label with a short gild rule, the guest site's
 * `.pahina-eyebrow` recipe. The label itself is INK, not gild: at 0.66rem gild
 * does not carry (see trap 2 above). The gild lives in the rule beside it,
 * where it is decoration and carries no information.
 */
export function ConsoleEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-[0.6em] font-mono text-[0.66rem] uppercase tracking-[0.28em] text-ink/70">
      <span>{children}</span>
      <span aria-hidden className="h-px w-14 shrink-0 bg-gild/55" />
    </p>
  );
}

/**
 * The plate — a recessed paper-deep panel with a printed inner hairline frame,
 * the guest site's `.pahina-plate`. The frame is a real child element rather
 * than a `::after`, because a pseudo-element needs a class and a class needs a
 * scope (see the module doc).
 */
export function ConsolePlate({
  children,
  className = '',
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={`relative border border-ink/10 bg-paper-deep p-5 ${className}`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-2 border border-ink/[0.08]"
      />
      <div className="relative">{children}</div>
    </div>
  );
}

/** A section heading in the Pahina display face. Display-sized, so ink at full
 *  strength; the eyebrow above it carries the category. */
export function ConsoleHeading({
  children,
  as: Tag = 'h2',
}: {
  children: ReactNode;
  as?: 'h1' | 'h2' | 'h3';
}) {
  return (
    <Tag className="font-pahina text-xl font-light leading-snug tracking-tight text-ink">
      {children}
    </Tag>
  );
}

/** The hairline rule — `.pahina-rule`. Ink, not gild: it is a divider between
 *  content, so it should recede. */
export function ConsoleRule({ className = '' }: { className?: string }) {
  return <hr className={`h-px border-0 bg-ink/[0.12] ${className}`} />;
}
