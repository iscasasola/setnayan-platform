/**
 * apps/web/lib/role-dress-code.ts
 *
 * WHAT *YOU* WEAR — the dress code, answered for one person.
 *
 * Owner, 2026-09-20: *"each role has their specific color code, and outfit
 * style to wear 'long gown' 'suit' 'filipiniana', etc. if they have a role,
 * only show their specific role and what their role is."*
 *
 * A ninang reading the invitation does not need the whole palette and every
 * other role's instructions. She needs three facts: that she is a ninang, what
 * she is being asked to wear, and in which colour. This resolves exactly that,
 * for one guest.
 *
 * ── WHERE EACH FACT COMES FROM, AND WHY NONE OF IT IS INVENTED ─────────────
 *   • THE ROLE: `guests.role`, already on the guest list, already labelled by
 *     `roleLabel()` in lib/entourage.ts. Not re-spelled here.
 *   • THE COLOUR: the couple's own mood board, through the shipped resolver
 *     `resolveAttirePaletteColor()` — the same colour their 3D seat plan
 *     dresses this role in, so a ninang cannot be told two different colours by
 *     two surfaces of one product.
 *   • THE STYLE: `dress_code_config.roles[<role>]`, which the couple sets in
 *     the dress-code editor. **There is no default.** Filipino attire is not
 *     guessable from a role — a ninong may be asked for a barong, a suit or
 *     black tie, and this product telling a sponsor to buy the wrong thing is
 *     worse than telling them nothing. An unset style renders as "the couple
 *     has not said yet", never as an assumption.
 *
 * 🔑 THE STYLE VOCABULARY IS A LIST, NOT FREE TEXT, because it has to be
 * mirrored by the editor's picker and read back on the invitation. Adding a
 * style means adding it here, once, and both ends follow.
 *
 * Pure. No I/O.
 */

import type { GuestRole } from '@/lib/guests';
import { roleLabel } from '@/lib/entourage';
import { resolveAttirePaletteColor, type RolePalette } from '@/lib/mood-board';

/** The styles a couple may ask a role to wear. Owner's three, plus the ones a Filipino wedding actually uses. */
export const ATTIRE_STYLES = [
  'long_gown',
  'cocktail_dress',
  'filipiniana',
  'barong_tagalog',
  'suit',
  'formal',
  'smart_casual',
] as const;
export type AttireStyle = (typeof ATTIRE_STYLES)[number];

export const ATTIRE_STYLE_LABEL: Record<AttireStyle, string> = {
  long_gown: 'Long gown',
  cocktail_dress: 'Cocktail dress',
  filipiniana: 'Filipiniana',
  barong_tagalog: 'Barong Tagalog',
  suit: 'Suit',
  formal: 'Formal',
  smart_casual: 'Smart casual',
};

export function isAttireStyle(v: unknown): v is AttireStyle {
  return typeof v === 'string' && (ATTIRE_STYLES as readonly string[]).includes(v);
}

/** One role's instruction, as the couple set it. */
export type RoleAttireRule = {
  style: AttireStyle;
  /** An optional line from the couple, e.g. "ivory, not white". */
  note?: string;
  /**
   * WHEN SHE HAS TO BE THERE — `HH:MM`, 24-hour, on the event's own day.
   *
   * Owner, 2026-09-23: a ninang needs her role, what to wear, and “what she
   * needs most is her call time”. The first two shipped on 2026-09-20; this is
   * the third, and until now the entourage had nowhere to read it at all.
   *
   * 🔑 TYPED, NOT DERIVED — and that is not an oversight. Suppliers already get
   * a call time WITHOUT typing one: `deriveVendorCallTimes` in
   * `lib/coordinator-broadcasts.ts` reads the earliest run-of-show block the
   * vendor is tagged responsible on, through P2's `responsible_vendor_ids`.
   * There is no role equivalent of that tag — a block can name a vendor and
   * cannot name “the principal sponsors” — so there is no schedule row to
   * derive this from. Deriving it would mean building role tagging on the run
   * of show first. If that tagging ever ships, THIS is the field that should
   * stop being typed; do not add a second one beside it.
   *
   * Optional on purpose. A couple who has not decided must not have a time
   * invented for them — the same rule the style already follows.
   */
  callTime?: string;
};

/**
 * `HH:MM`, 24-hour, or null. Anything else is dropped rather than repaired:
 * a call time is a number somebody will set an alarm by, and a half-read
 * “7” that renders as 07:00 is worse than no time at all.
 */
export function sanitizeCallTime(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(raw.trim());
  return m ? `${m[1]}:${m[2]}` : null;
}

/**
 * `14:30` → `2:30 PM`. Deliberately the same shape `formatWallClock` emits in
 * `lib/schedule-datetime-local.ts`, so the entourage's call time and the run of
 * show read alike; not imported from there because that function takes a stored
 * ISO instant and this is a bare wall clock with no date behind it.
 */
export function formatCallTime(hhmm: string | null | undefined): string | null {
  const v = sanitizeCallTime(hhmm);
  if (!v) return null;
  const h = Number(v.slice(0, 2));
  const suffix = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${v.slice(3)} ${suffix}`;
}

/** `dress_code_config.roles` — role key → what that role wears. */
export type RoleAttireMap = Partial<Record<GuestRole, RoleAttireRule>>;

const NOTE_MAX = 120;

/**
 * Read `dress_code_config.roles` from whatever is stored, dropping anything
 * that is not a known role with a known style. Stored config is data a human
 * typed into a form some months ago, not a promise about shape.
 */
export function sanitizeRoleAttire(raw: unknown, isKnownRole: (v: string) => boolean): RoleAttireMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: RoleAttireMap = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isKnownRole(key)) continue;
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const style = (value as { style?: unknown }).style;
    if (!isAttireStyle(style)) continue;
    const rawNote = (value as { note?: unknown }).note;
    const note = typeof rawNote === 'string' ? rawNote.trim().slice(0, NOTE_MAX) : '';
    const callTime = sanitizeCallTime((value as { callTime?: unknown }).callTime);
    const rule: RoleAttireRule = { style };
    if (note) rule.note = note;
    if (callTime) rule.callTime = callTime;
    out[key as GuestRole] = rule;
  }
  return out;
}

/** What one guest is told. `null` where the couple has not said. */
export type GuestDressCode = {
  /** "Ninang", "Bridesmaid" — null when the role is not a published one. */
  roleLabel: string | null;
  style: AttireStyle | null;
  styleLabel: string | null;
  note: string | null;
  /** `2:30 PM`, already formatted — or null where the couple has not said. */
  callTime: string | null;
  /** Hex from the couple's mood board, or null when they have not set one. */
  hex: string | null;
};

/**
 * Resolve the three facts for ONE guest.
 *
 * Returns `null` when this guest has no role worth answering for — a plain
 * `guest` gets the general dress code, not a personal panel that repeats it.
 * That is the owner's "if they have a role" in code: no role, no panel.
 */
export function resolveGuestDressCode(input: {
  role: GuestRole | null | undefined;
  roles: RoleAttireMap;
  palette: RolePalette | null | undefined;
  sideColor?: string | null;
}): GuestDressCode | null {
  const role = input.role;
  if (!role || role === 'guest') return null;

  const label = roleLabel(role);
  const rule = input.roles[role] ?? null;
  const hex = input.palette
    ? resolveAttirePaletteColor(role, input.palette, input.sideColor ?? null)
    : null;

  // Nothing to say at all — no label, no style, no colour — is not a panel.
  if (!label && !rule && !hex) return null;

  return {
    roleLabel: label,
    style: rule?.style ?? null,
    styleLabel: rule ? ATTIRE_STYLE_LABEL[rule.style] : null,
    note: rule?.note ?? null,
    callTime: formatCallTime(rule?.callTime),
    hex,
  };
}

/** Said where the style is unset, so the gap is a state and not a blank. */
export const STYLE_UNSET_LINE = 'The couple hasn’t said what to wear for this role yet.';
