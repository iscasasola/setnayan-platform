/**
 * lib/march-place.ts — WHERE ONE PERSON WALKS IN THE MARCH.
 *
 * Owner 2026-09-29 (DECISION_LOG "THE WEDDING MARCH ON THE INVITATION TELLS
 * EACH ENTOURAGE MEMBER THEIR ROLE AND HOW THEY ARE PRESENTED"), verbatim:
 * *"so they know their role"* · *"and how they will be presented"*. A keyed
 * guest who walks reads, on their own invitation, their place in the march,
 * who they walk with, and who walks just before them.
 *
 * 🔑 ONE ORDER. This reads the groups `buildEntourage` built — the SAME
 * function the invitation's entourage section, The Entourage print and
 * Details › the march all draw from (sections in the couple's order, lines in
 * the couple's order). The walking order is those lines, top to bottom; a pair
 * is one line and steps off together. Nothing here sorts.
 *
 * 🔑 ONE ROLE SOURCE. The role itself is NOT said here — the dress code's
 * shipped "You are <role>" line says it; this only adds the place.
 *
 * Pure. No I/O.
 */
import type { EntourageGroup, EntouragePerson } from '@/lib/entourage';

export type MarchPlace = {
  /** 1-based: the line this person walks in, counted across the whole march. */
  position: number;
  /** How many lines walk. */
  total: number;
  /** Who shares their line, or null when they walk alone. */
  partner: string | null;
  /** The line just before theirs, as names ("Carlos Reyes and Nena Reyes"), or null when they lead. */
  after: string | null;
};

const namesOf = (line: readonly (EntouragePerson | null)[]): string =>
  line
    .filter((p): p is EntouragePerson => p !== null)
    .map((p) => p.name)
    .join(' and ');

/**
 * Where `guestId` walks — their FIRST appearance, when they hold two roles
 * (a bridesmaid who is also a candle sponsor walks twice on a real programme;
 * the first is when she leaves her seat). Null when they do not walk.
 */
export function marchPlaceOf(groups: readonly EntourageGroup[], guestId: string | null | undefined): MarchPlace | null {
  if (!guestId) return null;
  /* 🚶 The "Not walking" tray (owner 2026-10-06): a person there still prints
     under their role, but is no place in the walking ORDER — never "You walk
     Nth", never counted, never the one somebody walks after. */
  const lines = groups
    .flatMap((g) => g.rows)
    .map((line) => line.map((p) => (p && p.notWalking ? null : p)) as unknown as typeof line)
    .filter((line) => line.some((p) => p !== null));
  const at = lines.findIndex((line) => line.some((p) => p?.id === guestId));
  if (at === -1) return null;
  const line = lines[at]!;
  const partner = line.find((p) => p !== null && p.id !== guestId) ?? null;
  const before = at > 0 ? namesOf(lines[at - 1]!) : '';
  return {
    position: at + 1,
    total: lines.length,
    partner: partner ? partner.name : null,
    after: before || null,
  };
}

/** 1 → "first", 2 → "2nd", 11 → "11th", 23 → "23rd". */
export function marchOrdinal(n: number): string {
  if (n === 1) return 'first';
  const mod100 = n % 100;
  const suffix = mod100 >= 11 && mod100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${suffix}`;
}

/**
 * The sentence under "You are <role>": "You walk 5th, with Tito Ben, after
 * Carlos Reyes and Nena Reyes." Plain words; nothing is said that is not known.
 */
export function marchPlaceLine(p: MarchPlace): string {
  const parts = [`You walk ${marchOrdinal(p.position)}`];
  if (p.partner) parts.push(`with ${p.partner}`);
  if (p.after) parts.push(`after ${p.after}`);
  return `${parts.join(', ')}.`;
}
