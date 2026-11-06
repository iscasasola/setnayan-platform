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

/**
 * 🏷 A SECTION'S KEY in the same map (owner 2026-10-19, on the guest Event Hub's entourage: *"Immediate Family change
 * it to VIP."* → *"or how can we rename this?"* → *"on guests?"*). A section heading — "Immediate Family", "Principal
 * Sponsors", "Bearers" — is a word the couple may own exactly as a role's is, so it lives beside the role words in
 * `events.role_names`, under its own key space: `section:<entourage group key>` → `{ one }`. One column, one
 * sanitiser, one compare-and-set writer (`lib/role-names.server.ts` `writeRoleNames`); a role and a section can never
 * collide (no role key holds a colon). Read with `sectionName`; printed only through the resolvers that call it
 * (`lib/entourage.ts` `groupHeading`, `lib/role-groups.ts` `roleGroupLabel`).
 */
export const SECTION_NAME_PREFIX = 'section:';
export type SectionNameKey = `${typeof SECTION_NAME_PREFIX}${string}`;
export const sectionNameKey = (sectionKey: string): SectionNameKey => `${SECTION_NAME_PREFIX}${sectionKey}`;

/** `events.role_names`, sanitised: only renamed roles (and renamed sections, `section:<key>`) appear. */
export type RoleNames = Partial<Record<GuestRole, RoleName>> & { [section: SectionNameKey]: RoleName | undefined };

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
  /** A section key the entourage knows (`isRenamableSection`) — by default any plain key (the lookups are by known key only). */
  isKnownSection: (v: string) => boolean = (v) => /^[a-z][a-z_]{0,39}$/.test(v),
): RoleNames {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: RoleNames = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    /* 🏷 A section's word: one form only (a heading is never beside one person). */
    if (key.startsWith(SECTION_NAME_PREFIX)) {
      const section = key.slice(SECTION_NAME_PREFIX.length);
      const one = isKnownSection(section) ? cleanRoleName((value as { one?: unknown }).one) : '';
      if (one) out[sectionNameKey(section)] = { one };
      continue;
    }
    if (!isRenamableRole(key) || !isKnownRole(key)) continue;
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

/**
 * 🏷 The couple's word for one entourage SECTION's heading ("Immediate Family" → "VIP"), or null when they kept the
 * usual heading. The ONE reader of a section word — every heading resolver asks it (owner 2026-10-19).
 */
export function sectionName(sectionKey: string | null | undefined, names: RoleNames | null | undefined): string | null {
  if (!sectionKey || !names) return null;
  return names[sectionNameKey(sectionKey)]?.one ?? null;
}

/**
 * The stored map with ONE word changed — a role's (`{ one, many? }`) or a section's (`section:<key>` → `{ one }`) —
 * every other key kept as stored (sanitised). Blank removes the key: blank means "the usual word". `null` when
 * nothing is left (the column's "never renamed"). Pure: the compare-and-set writer runs it on the value AS IT IS when
 * the write lands, so another host's word, landed meanwhile, stays.
 */
export function withOneWord(
  stored: RoleNames,
  key: GuestRole | SectionNameKey,
  one: string,
  many?: string | null,
): Record<string, RoleName> | null {
  const next: Record<string, RoleName> = { ...(stored as unknown as Record<string, RoleName>) };
  const cleanOne = cleanRoleName(one);
  const cleanMany = key.startsWith(SECTION_NAME_PREFIX) ? '' : cleanRoleName(many ?? '');
  if (!cleanOne) delete next[key];
  else next[key] = cleanMany && cleanMany !== cleanOne ? { one: cleanOne, many: cleanMany } : { one: cleanOne };
  return Object.keys(next).length > 0 ? next : null;
}

/**
 * ✍ THE MAKER'S DRAFTED SECTION HEADINGS (owner 2026-10-19 — the Wedding March's Edit; like every Maker edit, guests
 * see them only at ✓ Apply). The draft holds `{ "section:<key>": word }` and ONLY section keys — a role's word is the
 * Guest list's, live, and is never drafted, overlaid away or written by Apply. '' = back to the usual heading. Pure:
 * the draft's sanitiser, the host canvas's overlay and Apply all read it through here.
 */
export function sanitizeDraftedSectionWords(raw: unknown): Record<SectionNameKey, string> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const out: Record<SectionNameKey, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!key.startsWith(SECTION_NAME_PREFIX) || !/^[a-z][a-z_]{0,39}$/.test(key.slice(SECTION_NAME_PREFIX.length))) continue;
    if (typeof value !== 'string' && value !== null) continue;
    out[key as SectionNameKey] = cleanRoleName(value ?? '');
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** The stored `role_names` with the drafted section words laid on — every role's word kept. Raw in, raw out (the readers sanitise). */
export function withDraftedSectionWords(stored: unknown, drafted: unknown): Record<string, unknown> | null {
  const words = sanitizeDraftedSectionWords(drafted);
  const base: Record<string, unknown> = stored && typeof stored === 'object' && !Array.isArray(stored) ? { ...(stored as Record<string, unknown>) } : {};
  for (const [key, one] of Object.entries(words ?? {})) {
    if (one) base[key] = { one };
    else delete base[key];
  }
  return Object.keys(base).length > 0 ? base : null;
}

/** Has the couple renamed anything at all? (A cheap "nothing to do" check.) */
export function hasRoleNames(names: RoleNames | null | undefined): boolean {
  return !!names && Object.keys(names).length > 0;
}
