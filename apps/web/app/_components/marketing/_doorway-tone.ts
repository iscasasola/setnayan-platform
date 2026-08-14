/**
 * _doorway-tone.ts — the doorway palette tokens, on their own.
 *
 * Split out of `_doorway.tsx` on 2026-08-15 because that file now imports the
 * shared shell (`AppRailShell`, which is `server-only` and pulls
 * `front-door.css`). `/alaala` imports the TONE and nothing else — it does not
 * render `DoorwayPage` — so leaving the constant there would have pulled the
 * whole shell into a page that keeps `force-static` and never renders it.
 *
 * ⚠ Re-exported from `_doorway.tsx`, so every existing import keeps working.
 */
export const DOORWAY_TONE = {
  /** Body copy, and the struck-through half of a differentiator row. */
  muted: 'text-[var(--m-slate-2)]',
  /** Mono eyebrows and step numerals. UI-scale gold only — never a fill. */
  gold: 'text-[var(--m-orange-2)]',
  /** A card on the cream page: same cream, told apart by a line and a shadow. */
  card: 'rounded-2xl border border-[var(--m-line)] bg-[var(--m-paper)] shadow-[var(--m-shadow-sm)]',
  /** The closing panel: a gold hairline on the pale gold wash, never a gold fill. */
  closingPanel:
    'rounded-3xl border border-[var(--m-orange)]/40 bg-[var(--m-orange-4)]',
} as const;
