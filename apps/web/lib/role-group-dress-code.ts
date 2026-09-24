/**
 * lib/role-group-dress-code.ts — ONE INSTRUCTION FOR A WHOLE GROUP.
 *
 * ── THE MEASUREMENT THAT JUSTIFIES THIS FILE ───────────────────────────────
 * 🛑 NOT thirty-five. The vocabulary has 35 roles, and an earlier draft of this
 * docblock said a couple fills 35 slots — which the SHIPPED editor contradicts
 * in its own comment: `role-attire-field.tsx` offers only the roles actually on
 * that event's guest list, because "a form with thirty rows is a form nobody
 * finishes". The vocabulary size was never what anybody faces.
 *
 * ✅ WHAT A REAL COUPLE FACES, measured against production 2026-09-24. The
 * busiest live event has **15 distinct roles across 83 people**, and those 15
 * fold into **SIX** groups — every one of which holds 2 or 3 roles, so there is
 * no row this does not save:
 *
 *     Principal Sponsors   3  ninong · ninang · principal_sponsor
 *     Secondary Sponsors   3  candle · veil · cord
 *     VIP · Immediate Fam  3  bride_parents · groom_parents · groom_immediate
 *     Groomsmen            2  groomsman · best_man
 *     Bridesmaids          2  bridesmaid · maid_of_honor
 *     Bride & Groom        2  bride · groom
 *
 * Fifteen sentences become six. The ninongs and ninangs alone are 39 people
 * wearing, in practice, two things. Typing the same sentence three times is not
 * a feature, it is the absence of one.
 *
 * 🔑 RE-MEASURE, NEVER CITE THIS BLOCK. Both numbers move with the guest list:
 *
 *     select event_id, count(distinct role) filter (where role <> 'guest')
 *     from guests where role is not null group by event_id order by 2 desc;
 *
 * ⚠ AND THE PLAN THIS CAME FROM MIS-DESCRIBES IT. It reads as though a per-role
 * instruction is being added. `RoleAttireMap` in `role-dress-code.ts` has
 * shipped per role — with `style`, `note` AND `callTime` — since 2026-09-20.
 * This is a COARSER tier over a finer one that already exists, which is the
 * only reason the precedence question below exists at all. The plan never asks
 * it.
 *
 * ── PRECEDENCE: THE FINER WINS ─────────────────────────────────────────────
 * 🔑 A role rule beats its group's rule. A couple who took the trouble to write
 * something for `principal_sponsor_ninang` specifically meant it, and a group
 * value quietly overwriting a months-old role value — nothing red anywhere, the
 * ninang told to wear the wrong thing on the morning — is the failure this
 * ordering exists to prevent.
 *
 * Same shape the codebase already uses twice: a canvas preset with per-field
 * overrides, and an absent background `kind` meaning photo. The group is the
 * default; the role is the override. House rule, not a new invention.
 *
 * ── 🛑 AND PRECEDENCE MUST NEVER BE SILENT ─────────────────────────────────
 * "Finer wins", applied quietly, creates a new silent failure of its own:
 *
 *   The couple opens `principal_sponsors`, writes "barong, ecru", saves — and
 *   ninang does not change, because she has an override. Nothing is wrong and
 *   NOTHING SAYS SO. They read that as the feature being broken, try again, and
 *   eventually report that it does not work.
 *
 * That is this codebase's signature defect wearing a new hat: a correct
 * behaviour rendering identically to a broken one. So `groupOverrides` is part
 * of this CONTRACT rather than a detail of one editor — the editor cannot show
 * what it was never handed, and any later surface that edits a group inherits
 * the warning for free.
 *
 * ⛔ NO `server-only` HERE, DELIBERATELY. The editor panel that consumes this is
 * a client component; a `server-only` import would make it unbuildable and push
 * the next person into duplicating the vocabulary on the client, which is how
 * one fact ends up with two homes. Pure: no I/O, no environment.
 */
import {
  isAttireStyle,
  sanitizeCallTime,
  type AttireStyle,
  type RoleAttireMap,
  type RoleAttireRule,
} from './role-dress-code';
import { ROLE_GROUP_LABELS, roleGroupOf, type RoleGroup } from './role-groups';
import { roleLabel } from './entourage';
import type { GuestRole } from './guests';

/**
 * The twelve, in the order the couple reads them.
 *
 * 🔑 DERIVED FROM THE EXHAUSTIVE `Record`, NEVER RETYPED. `ROLE_GROUP_LABELS`
 * is `Record<RoleGroup, string>`, so TypeScript refuses to compile if a group
 * is missing from it — which makes its key order the only list of the twelve
 * that cannot silently fall out of date.
 *
 * ⚠ THIS IS NOT PEDANTRY. Counting these groups produced THREE different
 * answers in one day: a `grep -c "| '"` said 17 (it counted five
 * `RoleGroup | 'guest'` widenings), a regex `(.*?);` said 3 (it stopped at a
 * semicolon INSIDE A COMMENT), and the plan said 12. Only the exhaustive
 * `Record` was right, because the compiler enforces it. Count the Record,
 * never the union text.
 */
export const ROLE_GROUPS_IN_ORDER = Object.keys(ROLE_GROUP_LABELS) as readonly RoleGroup[];

const NOTE_MAX = 120;

/** `dress_code_config.groups` — group key → what that whole group wears. */
export type GroupAttireMap = Partial<Record<RoleGroup, RoleAttireRule>>;

/**
 * Read `dress_code_config.groups` from whatever is stored, dropping anything
 * that is not a known group with a known style.
 *
 * ⛔ DROPPED, NEVER REPAIRED — the same rule `sanitizeRoleAttire` follows. A
 * style this product does not know came from some other version of it, and
 * guessing what it meant is how two surfaces start telling a ninang different
 * things.
 */
export function sanitizeGroupAttire(raw: unknown): GroupAttireMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const known = new Set<string>(ROLE_GROUPS_IN_ORDER as readonly string[]);
  const out: GroupAttireMap = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!known.has(key)) continue;
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const style = (value as { style?: unknown }).style;
    if (!isAttireStyle(style)) continue;
    const rawNote = (value as { note?: unknown }).note;
    const note = typeof rawNote === 'string' ? rawNote.trim().slice(0, NOTE_MAX) : '';
    const callTime = sanitizeCallTime((value as { callTime?: unknown }).callTime);
    const rule: RoleAttireRule = { style: style as AttireStyle };
    if (note) rule.note = note;
    if (callTime) rule.callTime = callTime;
    out[key as RoleGroup] = rule;
  }
  return out;
}

/**
 * THE ONE PLACE PRECEDENCE IS DECIDED.
 *
 * A role's own rule, or its group's, or nothing. Every surface that asks "what
 * does this person wear" goes through here, so the guest page and the editor
 * preview cannot disagree about which tier won.
 *
 * 🔑 IT IS ALL-OR-NOTHING PER TIER, NOT FIELD-BY-FIELD. A role rule with a
 * style and no call time does NOT borrow the group's call time. Merging the
 * tiers would mean a couple editing the group changes half of what a ninang
 * reads and not the other half — a rule made of two authors, which neither of
 * them can predict. One tier answers, and `source` says which.
 */
export type ResolvedAttire = {
  rule: RoleAttireRule;
  source: 'role' | 'group';
} | null;

export function resolveAttireFor(
  role: GuestRole | null | undefined,
  roles: RoleAttireMap,
  groups: GroupAttireMap,
): ResolvedAttire {
  if (!role || role === 'guest') return null;
  const own = roles[role];
  if (own) return { rule: own, source: 'role' };
  const group = roleGroupOf(role);
  if (group === 'guest') return null;
  const shared = groups[group];
  return shared ? { rule: shared, source: 'group' } : null;
}

/**
 * WHICH ROLES IN THIS GROUP WILL IGNORE WHAT THE COUPLE IS ABOUT TO TYPE.
 *
 * 🛑 THIS IS THE ANTI-SILENCE HALF OF PRECEDENCE, and it is in the contract on
 * purpose. Without it the editor is a form that accepts a sentence and, for
 * some of the people it names, changes nothing — correct behaviour and a broken
 * feature being pixel-identical, which is the defect this whole build exists
 * to remove.
 *
 * Returns the labels a person recognises ("Ninang"), not role keys, because it
 * is written to be read by a couple and not by us.
 */
export function groupOverrides(group: RoleGroup, roles: RoleAttireMap): string[] {
  const out: string[] = [];
  for (const key of Object.keys(roles) as GuestRole[]) {
    if (!roles[key]) continue;
    if (roleGroupOf(key) !== group) continue;
    out.push(roleLabel(key) ?? key);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

/** How many of the 35 roles this one group speaks for. Sharp label, no sentence. */
export function groupRoleCount(group: RoleGroup, every: readonly GuestRole[]): number {
  let n = 0;
  for (const r of every) if (roleGroupOf(r) === group) n += 1;
  return n;
}
