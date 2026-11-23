/**
 * WHO GETS A NEW INQUIRY — Branch → Card → Event type → Last name (the #8013 Roles drawing, panel (e)).
 *
 * Decided 19 Nov (owner; drawing #8013 approved "build them all"):
 *  · each new inquiry goes to ONE Account Manager;
 *  · by the branch the service card is filed under, then the card (only the people who cover it), then the event
 *    type, then the main celebrant's last name (the groom, for a wedding; if the inquiry doesn't say, the sender);
 *  · FAIR, NOT ALPHABETICAL — cut points come from the shop's own past clients counted by the first letters of the
 *    celebrant's last name, so a busy letter (D, R, M, S, C, G…) is not dumped on one person. A cut may fall inside a
 *    letter (Ma | Me), and the letters stay in A–Z blocks so anyone can tell who has "Santos";
 *  · at most 5 Account Managers per card, per branch;
 *  · someone joining or leaving re-works the cuts the same way; a split a manager adjusted is NOT re-worked;
 *  · when that Account Manager is away: the next Account Manager in the branch, then the Branch Manager.
 *
 * Pure: no reads, no writes. The caller supplies the counts, the people and who is away. Nothing here guesses a
 * threshold — "how many past clients is enough" is an owner setting the caller decides with.
 */

/** At most this many Account Managers on one card, per branch (decided 19 Nov). */
export const MAX_ACCOUNT_MANAGERS_PER_CARD = 5;

/** Two-letter A–Z prefixes in order: AA, AB … ZZ. The cut points are drawn on this line. */
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const PREFIXES: ReadonlyArray<string> = (() => {
  const out: string[] = [];
  for (const a of LETTERS) for (const b of LETTERS) out.push(a + b);
  return out;
})();
const END = PREFIXES.length;

/**
 * The filing key of a last name: its letters, upper-cased, accents folded, spaces and punctuation dropped, FILED AS
 * WRITTEN ("Dela Cruz" → "DELACRUZ", under D — the drawn pick for compound names). A one-letter name pads with "A"
 * so it sorts at the top of its letter. Empty or letterless → null.
 */
export function surnameKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const letters = raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  if (!letters) return null;
  return letters.length === 1 ? `${letters}A` : letters;
}

/** The two-letter prefix a key is counted and cut under. */
export function prefixOf(key: string): string {
  return key.slice(0, 2);
}

/** Count past clients' last names by two-letter prefix. Names with no letters are skipped. */
export function countPrefixes(lastNames: Iterable<string | null | undefined>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const name of lastNames) {
    const key = surnameKey(name);
    if (!key) continue;
    const p = prefixOf(key);
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  return counts;
}

/**
 * One person's block: the first prefix they own (inclusive) up to the next person's first prefix (exclusive; `null`
 * = to the end of Z). `share` is the fraction of the counted past clients the block holds (0–1), for the "51%" label.
 */
export type SplitBlock = { from: string; to: string | null; share: number };

/**
 * Work out the fair cuts for `people` Account Managers from the prefix counts.
 *
 * ① turn the counts into shares · ② add them up A → Z · ③ cut where the running total first reaches k/people.
 * With no counts at all every prefix weighs the same (an even A–Z split). Whether the shop's own counts are enough,
 * or the caller should pass the all-Setnayan counts instead, is the caller's call — no threshold is invented here.
 */
export function fairSplit(counts: ReadonlyMap<string, number>, people: number): SplitBlock[] {
  const n = Math.max(1, Math.min(MAX_ACCOUNT_MANAGERS_PER_CARD, Math.floor(people) || 1));
  const raw = PREFIXES.map((p) => Math.max(0, counts.get(p) ?? 0));
  const counted = raw.reduce((a, b) => a + b, 0);
  const w = counted === 0 ? PREFIXES.map(() => 1) : raw;
  const total = counted === 0 ? END : counted;

  // starts[k] = the index of the first prefix person k owns. Person k (k ≥ 1) starts on the prefix AFTER the one
  // where the running total reaches k/n of the whole — and every later person keeps at least one prefix.
  const starts: number[] = [0];
  let running = 0;
  for (let i = 0; i < END && starts.length < n; i++) {
    running += w[i]!;
    while (starts.length < n && running >= (total * starts.length) / n) {
      const left = n - starts.length; // people still to place, this one included
      const at = Math.min(Math.max(i + 1, starts[starts.length - 1]! + 1), END - left);
      starts.push(at);
    }
  }

  return starts.map((s, k) => {
    const e = k + 1 < starts.length ? starts[k + 1]! : END;
    let held = 0;
    for (let i = s; i < e; i++) held += w[i]!;
    return { from: PREFIXES[s]!, to: e < END ? PREFIXES[e]! : null, share: held / total };
  });
}

/** Does this filing key fall in the block? */
export function inBlock(key: string, block: Pick<SplitBlock, 'from' | 'to'>): boolean {
  const p = prefixOf(key);
  return p >= block.from && (block.to === null || p < block.to);
}

/** Title-case a prefix for the screen: "MA" → "Ma". */
function cased(prefix: string): string {
  return prefix.charAt(0) + prefix.slice(1).toLowerCase();
}

/**
 * The words on a block, as drawn: "A – Ma", "Me – Z", "A – Z". A block starting on a letter's first prefix (xA)
 * reads as the bare letter; one ending on a letter's last prefix (xZ) reads as the bare letter. Inside a letter the
 * end reads as the last prefix that actually holds clients (so "Ma", not "Md"), when counts are given.
 */
export function blockWords(block: Pick<SplitBlock, 'from' | 'to'>, counts?: ReadonlyMap<string, number>): string {
  const s = PREFIXES.indexOf(block.from);
  const e = block.to === null ? END : PREFIXES.indexOf(block.to);
  const start = block.from.endsWith('A') ? block.from.charAt(0) : cased(block.from);
  if (e === END) return `${start} – Z`;
  let last = e - 1;
  const endOfLetter = PREFIXES[last]!.endsWith('Z');
  if (counts && !endOfLetter) {
    for (let i = e - 1; i >= s && PREFIXES[i]!.charAt(0) === PREFIXES[e - 1]!.charAt(0); i--) {
      if ((counts.get(PREFIXES[i]!) ?? 0) > 0) {
        last = i;
        break;
      }
    }
  }
  const endPrefix = PREFIXES[last]!;
  const end = endPrefix.endsWith('Z') ? endPrefix.charAt(0) : cased(endPrefix);
  return `${start} – ${end}`;
}

/** The words on a share: 0.512 → "51%". */
export function shareWords(share: number): string {
  return `${Math.round(share * 100)}%`;
}

// ── Picking the person ─────────────────────────────────────────────────────────────────────────────────────────

export type SplitMember = { memberId: string; block: Pick<SplitBlock, 'from' | 'to'> };

export type PickInput = {
  /** The celebrant's last name (groom for a wedding), else the sender's. */
  lastName: string | null | undefined;
  /** The split for this card + event type on this branch (already narrowed by the caller), A → Z. */
  split: ReadonlyArray<SplitMember>;
  /** The branch's Account Managers, in the order "next" means (for the away rule). */
  branchAccountManagers: ReadonlyArray<string>;
  /** The branch's Branch Manager, if it has one. */
  branchManagerId: string | null;
  /** Who is away (or paused) right now. */
  away: ReadonlySet<string>;
};

export type PickResult =
  | { memberId: string; why: 'split' | 'no-name-first-on-card' | 'away-next-account-manager' | 'away-branch-manager' }
  | { memberId: null; why: 'nobody' };

/**
 * Pick ONE Account Manager for a new inquiry.
 *
 * The split's holder of the last name gets it. If they are away: the next Account Manager in the branch who is in,
 * then the Branch Manager. An inquiry with no usable last name goes to the first person on the card who is in.
 * A card nobody covers is NOT decided here (an open owner rule): the caller passes an empty split and gets
 * `{ memberId: null, why: 'nobody' }` back.
 */
export function pickAccountManager(input: PickInput): PickResult {
  const { split, away } = input;
  if (split.length === 0) return { memberId: null, why: 'nobody' };

  const key = surnameKey(input.lastName);
  const holder = key ? split.find((m) => inBlock(key, m.block)) : undefined;
  if (holder && !away.has(holder.memberId)) return { memberId: holder.memberId, why: 'split' };
  if (!holder) {
    const firstIn = split.find((m) => !away.has(m.memberId));
    if (firstIn) return { memberId: firstIn.memberId, why: 'no-name-first-on-card' };
  }

  const ams = input.branchAccountManagers;
  const at = holder ? ams.indexOf(holder.memberId) : -1;
  const order = at >= 0 ? [...ams.slice(at + 1), ...ams.slice(0, at)] : [...ams];
  const next = order.find((id) => !away.has(id) && id !== holder?.memberId);
  if (next) return { memberId: next, why: 'away-next-account-manager' };

  if (input.branchManagerId && !away.has(input.branchManagerId)) {
    return { memberId: input.branchManagerId, why: 'away-branch-manager' };
  }
  return { memberId: null, why: 'nobody' };
}

// ── Adjust (drawing (e) "Adjust · Wedding") ────────────────────────────────────────────────────────────────────

/** The share each side gets for one cut between two people: everything before `cut`, and the rest. */
export function twoWayShares(counts: ReadonlyMap<string, number>, cut: string): [number, number] {
  const at = PREFIXES.indexOf(cut);
  const raw = PREFIXES.map((p) => Math.max(0, counts.get(p) ?? 0));
  const counted = raw.reduce((a, b) => a + b, 0);
  const w = counted === 0 ? PREFIXES.map(() => 1) : raw;
  const total = counted === 0 ? END : counted;
  let before = 0;
  for (let i = 0; i < Math.max(0, at); i++) before += w[i]!;
  return [before / total, 1 - before / total];
}

/**
 * The cuts a manager may pick between two people: the fair cut, and the letter starts around it ("L · Ma | Me · N" —
 * a cut may fall inside a busy letter). Ordered A → Z, never the very first prefix (each person keeps a block).
 */
export function cutChoices(counts: ReadonlyMap<string, number>, fairCut: string): Array<{ cut: string; shares: [number, number] }> {
  const i = PREFIXES.indexOf(fairCut);
  if (i <= 0) return [];
  const letter = (k: number) => LETTERS.indexOf(PREFIXES[k]!.charAt(0));
  const startOf = (l: number) => (l >= 0 && l < LETTERS.length ? LETTERS[l]! + 'A' : null);
  const set = new Set<string>([fairCut]);
  for (const l of [letter(i) - 1, letter(i), letter(i) + 1]) {
    const p = startOf(l);
    if (p && p !== 'AA') set.add(p);
  }
  return [...set].sort((a, b) => PREFIXES.indexOf(a) - PREFIXES.indexOf(b)).map((cut) => ({ cut, shares: twoWayShares(counts, cut) }));
}
