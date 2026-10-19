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
  const mine = own.find((g) => g.groupId !== except && sidesShareAList(g.teamSide, side) && groupNameKey(g.label) === key);
  return mine ? { kind: 'own', groupId: mine.groupId, label: mine.label } : null;
}

/** The sentence under the box. */
export function clashWords(c: GroupNameClash): string {
  return `You already have “${c.label}”.`;
}
