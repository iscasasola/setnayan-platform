/**
 * BRANCHES, FOR TWO NEW DOORS — the pure rules (no database).
 *
 * ⚖ OWNER, 2026-11-14 (specs DECISION_LOG "SIMPLER SUPPLIER PLANS — APPROVED AS DRAWN …", items 9 and 10; drawing
 * artifact Eiwc64wF1VHLfZ52Sjbs8c §§ 6–7):
 *   (9)  Shop › Team › Who works what — a "Whole branch" choice above the services, ONLY when the shop has more than
 *        one location; services grouped under their branch and named by card title.
 *   (10) "Copy to another branch" on a card, ONLY when the shop has another location — asks the branch and the price
 *        there; the copy is the same service, so it does not use up a card.
 *
 * A LOCATION is the main one (cards with no `branch_id`) or a branch that may be USED (`branchIsUsable` — paid and
 * live, owner 2026-08-28 "paid"). One rule for both doors, so the Team screen and the card can never disagree about
 * whether a shop "has branches".
 */
import { branchIsUsable, type BranchStatus } from '@/lib/vendor-branches';
import { formatCount } from '@/lib/format-number';

/** The key the main location goes by — in `vendor_team_members.whole_branch_keys` and in the copy sheet. */
export const MAIN_BRANCH_KEY = 'main';

export type BranchLite = { id: string; label: string; status: BranchStatus };
export type Location = { key: string; label: string };

/** The shop's locations: Main first, then each usable branch in the order it was added. */
export function shopLocations(branches: readonly BranchLite[], mainCity?: string | null): Location[] {
  const main: Location = { key: MAIN_BRANCH_KEY, label: mainCity?.trim() ? `Main · ${mainCity.trim()}` : 'Main' };
  return [main, ...branches.filter((b) => branchIsUsable(b.status)).map((b) => ({ key: b.id, label: b.label }))];
}

/** Does this shop show the two branch doors? Two or more locations. */
export function hasManyLocations(branches: readonly BranchLite[]): boolean {
  return shopLocations(branches).length >= 2;
}

/** Where a card may be copied to: every location except the one it is at. */
export function branchCopyTargets(branches: readonly BranchLite[], currentBranchId: string | null, mainCity?: string | null): Location[] {
  const here = currentBranchId ?? MAIN_BRANCH_KEY;
  return shopLocations(branches, mainCity).filter((l) => l.key !== here);
}

/** "Price there" as typed → whole pesos, or null when it is not a usable price. */
export function parseBranchCopyPrice(raw: unknown): number | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/[₱,\s]/g, '');
  if (!/^\d{1,9}$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return n > 0 && n <= 100_000_000 ? n : null;
}

/** A location key → the `branch_id` it stands for (null = main). */
export function branchIdOfKey(key: string): string | null {
  return key === MAIN_BRANCH_KEY ? null : key;
}

/** A card's `branch_id` → its location key. */
export function keyOfBranchId(branchId: string | null | undefined): string {
  return branchId ?? MAIN_BRANCH_KEY;
}

// ── (9) Who works what ────────────────────────────────────────────────────────────────────────────────────────────

/** What the Team screen needs to draw "Whole branch": the shop's locations and each person's whole-branch keys. */
export type BranchScope = { locations: Location[]; wholeKeys: Record<string, string[]> };

/** A service as Who works what draws it — named by its card title, filed under its location. */
export type ScopedService = { id: string; name: string; key: string; active: boolean };

/** Services grouped under their location, in the shop's location order; a card under a branch that is not usable
 *  (unpaid, lapsed) is still listed — under its own group — so an admin never loses sight of an assignment. */
export function groupByLocation(
  services: readonly ScopedService[],
  locations: readonly Location[],
): { key: string; label: string; services: ScopedService[] }[] {
  const groups = locations.map((l) => ({ key: l.key, label: l.label, services: [] as ScopedService[] }));
  const byKey = new Map(groups.map((g) => [g.key, g]));
  for (const s of services) {
    let g = byKey.get(s.key);
    if (!g) {
      g = { key: s.key, label: 'A branch that is not active', services: [] };
      groups.push(g);
      byKey.set(s.key, g);
    }
    g.services.push(s);
  }
  return groups.filter((g) => g.services.length > 0 || locations.some((l) => l.key === g.key));
}

/** The Fold's summary for one person — "Rina · all of Cebu" · "Paolo · 2 services" · "Ana · all of Cebu + 1 service". */
export function whoWorksWhatLine(
  name: string,
  assignedServiceIds: readonly string[],
  wholeKeys: readonly string[],
  services: readonly ScopedService[],
  locations: readonly Location[],
): string {
  const whole = locations.filter((l) => wholeKeys.includes(l.key));
  const wholeSet = new Set(whole.map((l) => l.key));
  const others = services.filter((s) => assignedServiceIds.includes(s.id) && !wholeSet.has(s.key)).length;
  const parts: string[] = [];
  if (whole.length > 0) parts.push(`all of ${whole.map((l) => l.label.replace(/^Main · /, '')).join(' and ')}`);
  if (others > 0 || whole.length === 0) parts.push(`${formatCount(others)} ${others === 1 ? 'service' : 'services'}`);
  return `${name} · ${parts.join(' + ')}`;
}
