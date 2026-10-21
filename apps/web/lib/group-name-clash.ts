/**
 * 👥 ONE NAME, ONE GROUP (owner 2026-10-20, on the guest card's one Group list showing Standard "Family" beside own
 * "Family" twice: *"also not allow to have a group name similarly written on the group already."*).
 *
 * A new or renamed own group is refused when its name — compared without case, spaces or punctuation ("family",
 * "Family ", "FAMILY." are one name) — is already:
 *   · a standard group (Family · Friends · Work · School · Officiant · Other), or
 *   · an own group that would show in the SAME list: its side and the new group's side share a guest
 *     (`sidesShareAList` — the same side, or either is both sides). The other side's namesake is another family's group
 *     and stays allowed (a bride-side "Relatives" beside a groom-side "Relatives"), as the table's unique key allows.
 * The answer names the existing group, so the place that asked can offer it in one tap ("Use “Family”").
 * Existing duplicates are never rewritten — this decides only what is written next.
 *
 * Pure: the picker (`guest-group-picker.tsx`) and the server (`group-edit-actions.ts`) run this same rule.
 */
import type { GuestGroupTeamSide } from '@/lib/guests';

/** The name as compared: lower case, letters and digits only. */
export function groupNameKey(name: string): string {
  return (name ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

/** Two groups show in one guest's list when they are of the same side, or either is both sides'. */
export function sidesShareAList(a: GuestGroupTeamSide, b: GuestGroupTeamSide): boolean {
  return a === 'both' || b === 'both' || a === b;
}

export type GroupNameClash = { kind: 'standard'; key: string; label: string } | { kind: 'own'; groupId: string; label: string };

export function groupNameClash(
  name: string,
  side: GuestGroupTeamSide,
  standard: readonly { key: string; label: string }[],
  own: readonly { groupId: string; label: string; teamSide: GuestGroupTeamSide }[],
  /** A rename: the group being renamed, which never clashes with itself. */
  except?: string,
): GroupNameClash | null {
  const key = groupNameKey(name);
  if (!key) return null;
  const std = standard.find((o) => groupNameKey(o.label) === key || groupNameKey(o.key) === key);
  if (std) return { kind: 'standard', key: std.key, label: std.label };
  const mine = ownTwin(name, side, own, except);
  return mine ? { kind: 'own', groupId: mine.groupId, label: mine.label } : null;
}

/**
 * 👥 THE OWN GROUP A NEW `(name, side)` WOULD TWIN (2026-10-21, the owner's Group list showing Bob · Bob · Loo · Loo ·
 * Mama · Mama · Relatives · Relatives: *"why do i see dupes on group names"*). The own group of the same name that would
 * show in the same list — or null when the name is free there. When several do, the one to reuse is the same side's,
 * then both sides', then the first in the given order. Every server path that makes a group asks this before it inserts
 * (`makeGuestGroupOnce`, lib/guest-group-made-once.ts), so a twin is never written — the existing group is used instead.
 */
export function ownTwin<T extends { groupId: string; label: string; teamSide: GuestGroupTeamSide }>(
  name: string,
  side: GuestGroupTeamSide,
  own: readonly T[],
  /** A rename: the group being renamed, which never twins itself. */
  except?: string,
): T | null {
  const key = groupNameKey(name);
  if (!key) return null;
  const twins = own.filter((g) => g.groupId !== except && sidesShareAList(g.teamSide, side) && groupNameKey(g.label) === key);
  return twins.find((g) => g.teamSide === side) ?? twins.find((g) => g.teamSide === 'both') ?? twins[0] ?? null;
}

/** The sentence under the box. */
export function clashWords(c: GroupNameClash): string {
  return `You already have “${c.label}”.`;
}
