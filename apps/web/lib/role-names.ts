/**
 * lib/role-names.ts — WHAT THIS COUPLE CALLS A ROLE.
 *
 * ⚖ Owner, 2026-09-30: *"Bride'smaid can be renamed as what - for us we picked
 * Bride's Crew. Groomsmen can be renamed as what - for us we picked Groom's
 * Crew"*. Any entourage role can be given the couple's own word — Bridesmaid →
 * "Bride's Crew", Flower Girl → "Little Angel" — for their event.
 *
 * ── THE WORD CHANGES, THE ROLE DOES NOT ────────────────────────────────────
 * 🔑 This is a DISPLAY override and nothing else. `guests.role` still says
 * `bridesmaid`, so the Wedding March order, the dress-code colour, the seat
 * plan's tiers, the emcee script's order and every permission keep keying off
 * the role. Only the words a person reads come from here. A rename can never
 * move anybody, re-colour anybody or change what anybody may do.
 *
 * ── WHERE IT LIVES ─────────────────────────────────────────────────────────
 * `events.role_names` (jsonb, migration events_role_names): role key →
 * `{ one, many? }`. NULL / `{}` = the couple renamed nothing, which reads
 * byte-identically to before this existed.
 *
 * ── ONE WORD, OR TWO ───────────────────────────────────────────────────────
 * `one` is what sits beside ONE person ("Anna · Bride's Crew", "You are in the
 * Bride's Crew"). `many` is the heading over several ("Little Angels"). Most of
 * the names couples pick are group words that read the same either way —
 * "Bride's Crew" — so `many` is optional and falls back to `one`.
 *
 * 🔑 EMPTY FALLS BACK. A blank or whitespace-only name is never stored and never
 * shown: it means "use the usual word". A couple who clears the box gets
 * "Bridesmaid" back, not an empty chip.
 *
 * Pure. No I/O, no React — read by server loaders AND client pickers.
 */
import type { GuestRole } from './guests';

/** The couple's words for one role. */
export type RoleName = {
  /** Beside one person. Never empty once sanitised. */
  one: string;
  /** Over several people. Absent → `one` is used. */
  many?: string;
};

/** `events.role_names`, sanitised: only renamed roles appear. */
export type RoleNames = Partial<Record<GuestRole, RoleName>>;

/** Long enough for "Groom's Barkada", short enough to fit a chip and a print line. */
export const ROLE_NAME_MAX = 40;

/**
 * Roles a couple may NOT rename, and why:
 *   · `guest` — not a role anybody is given; it is the absence of one.
 *   · `bride` / `groom` / `celebrant` — the people the event is for. Their names
 *     are the masthead; a "role word" for them is not what this is.
 */
const NOT_RENAMABLE: ReadonlySet<string> = new Set(['guest', 'bride', 'groom', 'celebrant']);

/** May the couple give this role their own word? */
export function isRenamableRole(role: string): boolean {
  return role.length > 0 && !NOT_RENAMABLE.has(role);
}

/**
 * Trim, collapse inner whitespace, cap the length. Returns '' for anything that
 * is not a usable name — and '' always means "use the usual word".
 */
export function cleanRoleName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/\s+/g, ' ').trim().slice(0, ROLE_NAME_MAX).trim();
}

/**
 * Read `events.role_names` from whatever is stored. Stored jsonb is data a
 * human typed, not a promise about shape: an unknown role, a non-object value
 * or an empty `one` is DROPPED, never repaired into something the couple did
 * not write.
 *
 * `isKnownRole` is passed in (as `sanitizeRoleAttire` does) so this module
 * needs no runtime import of the role vocabulary.
 */
export function sanitizeRoleNames(
  raw: unknown,
  isKnownRole: (v: string) => boolean = () => true,
): RoleNames {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: RoleNames = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isRenamableRole(key) || !isKnownRole(key)) continue;
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const one = cleanRoleName((value as { one?: unknown }).one);
    if (!one) continue;
    const many = cleanRoleName((value as { many?: unknown }).many);
    out[key as GuestRole] = many && many !== one ? { one, many } : { one };
  }
  return out;
}

/** The couple's word for ONE person in this role, or null when they kept the usual one. */
export function roleNameOne(role: string | null | undefined, names: RoleNames | null | undefined): string | null {
  if (!role || !names) return null;
  return names[role as GuestRole]?.one ?? null;
}

/** The couple's word for SEVERAL people in this role (falls back to their `one`), or null. */
export function roleNameMany(role: string | null | undefined, names: RoleNames | null | undefined): string | null {
  if (!role || !names) return null;
  const n = names[role as GuestRole];
  return n ? (n.many ?? n.one) : null;
}

/** Has the couple renamed anything at all? (A cheap "nothing to do" check.) */
export function hasRoleNames(names: RoleNames | null | undefined): boolean {
  return !!names && Object.keys(names).length > 0;
}
