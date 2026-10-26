/**
 * service-card-checks.ts — the checks a service card must pass BEFORE it is created (or saved).
 *
 * ⚖ Owner 2026-10-26 (DECISION_LOG "SERVICE CARD CHECKS — FIX BEFORE CREATE"; "CARD CHECKS — NO PRICE BAND; ONE
 * PHOTO, ONE SERVICE CARD"; "NO PRICE CHECK ON SERVICE CARDS AT ALL"; corpus prototypes/service_card_checks_2026-10-26/
 * PLAN §2 + §4): *"when there is something they need to change, they must fix it before the service card is
 * created … they resolve it by themselves."* Three checks, nothing about price:
 *
 *   1 · words    — a phrase from the admin list (`card_claim_words`), whole word, any case, in the name, an
 *                  inclusion line or an add-on name.
 *   2 · service  — the name + inclusion lines match ANOTHER service's words (its display names + reviewed search
 *                  words) and NONE of the card's own service family. Both halves, so "Package A" passes.
 *   3 · photo    — the cover or a showcase photo is already on another service card (any shop, the same shop
 *                  included). The answer comes from the upload-time check (`lib/card-photo-check.server.ts`); this
 *                  file only turns an answer into a problem.
 *
 * ONE PURE EVALUATOR, TWO CALLERS. The maker runs `evaluateCardChecks` on its live read (every change) and disables
 * Create/Save while it reports anything; `commitVendorService` runs the SAME function before the save and REFUSES on
 * any problem. The client is the courtesy; the server is the fence.
 *
 * 🔒 FAIL-CLOSED. A context that could not be read (`null`) or a photo whose answer never came back is a problem
 * (`unavailable` / a waiting photo), never a pass — "we could not check" is not "there was nothing to find".
 *
 * Browser-safe on purpose: no imports, no lookbehind regex (older iPhone Safari cannot parse it).
 */

// ── the inputs ───────────────────────────────────────────────────────────────

/** What the card says, read from the maker's form (or the save's parsed fields). */
export type CardCheckInput = {
  /** `vendor_services.category` — a leaf key (or a legacy key). */
  category: string;
  /** The card's name as it will be saved. */
  title: string | null;
  inclusionLabels: readonly string[];
  /** `null` = the add-ons could not be read — the words check cannot finish. */
  addonLabels: readonly string[] | null;
  cover: string | null;
  showcase: readonly string[];
};

/**
 * The words the service check compares, read by the page that renders the maker (and by the save). Plain objects so
 * they cross the server → client boundary as props.
 */
export type ServiceWords = {
  /** service key → its words, lower-case: display names (en/tl/ceb) + reviewed search words. */
  words: Readonly<Record<string, readonly string[]>>;
  /** service key → the label a supplier reads ("Catering"). */
  label: Readonly<Record<string, string>>;
  /** service key → its family (the tier-1 folder in Admin › Categories). Keys in one family are each other's own. */
  family: Readonly<Record<string, string>>;
};

/** Everything the checks read. `null` on any part = it could not be read → the card cannot be created yet. */
export type CardCheckContext = {
  claimWords: readonly string[] | null;
  services: ServiceWords | null;
};

/** The upload-time answer for one photo. */
export type PhotoAnswer =
  | { status: 'ok' }
  | { status: 'checking' }
  | { status: 'unavailable' }
  /** Already on one of THIS shop's cards — named, no report link. */
  | { status: 'own_card'; serviceId: string; title: string }
  /** Already on another shop's card — never which shop. `flagId` is the repost-watch row a report stamps. */
  | { status: 'other_card'; flagId: number | null; reported: boolean };

export type PhotoProblemAnswer = Exclude<PhotoAnswer, { status: 'ok' }>;

// ── the result ───────────────────────────────────────────────────────────────

/** The maker row a problem is shown under. */
export type CheckRow = 'offer' | 'name' | 'photos' | 'included' | 'addons' | 'status';

export type CardProblem =
  | { code: 'words'; row: 'name' | 'included' | 'addons'; hits: string[] }
  | { code: 'service'; row: 'offer'; filedLabel: string; matched: string; matchedLabel: string; words: string[] }
  | { code: 'photo'; row: 'photos'; ref: string; which: 'cover' | 'showcase'; answer: PhotoProblemAnswer }
  | { code: 'unavailable'; row: 'status'; checks: Array<'words' | 'service'> };

export type CardCheckResult = { problems: CardProblem[]; count: number; blocked: boolean };

/** The order rows sit in the maker — the status line's "go to the first" follows it. */
export const ROW_ORDER: readonly CheckRow[] = ['status', 'offer', 'name', 'photos', 'included', 'addons'];

// ── matching ─────────────────────────────────────────────────────────────────

/** Lower-case, collapse whitespace. Both sides of every match go through this. */
export function normaliseText(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

const WORD_CHAR = /[\p{L}\p{N}]/u;

/**
 * Whole-phrase match that also works for phrases made of symbols ("#1", "100%"): the phrase may not be glued to a
 * letter or a digit on either side. "#1" matches "#1 Buffet" not "#10"; "100%" matches "100% sure" not "1100%";
 * "best in" matches "Best  in Tagaytay" not "bestinclass"; "official" does not match "Officially".
 */
export function containsWholePhrase(text: string, phrase: string): boolean {
  const p = normaliseText(phrase);
  if (!p) return false;
  const t = normaliseText(text);
  let from = 0;
  for (;;) {
    const i = t.indexOf(p, from);
    if (i < 0) return false;
    const before = i > 0 ? t.charAt(i - 1) : '';
    const after = i + p.length < t.length ? t.charAt(i + p.length) : '';
    // Only a WORD edge of the phrase can be glued: "#1" checks its right side, "100%" its left.
    const gluedBefore = WORD_CHAR.test(p.charAt(0)) && before !== '' && WORD_CHAR.test(before);
    const gluedAfter = WORD_CHAR.test(p.charAt(p.length - 1)) && after !== '' && WORD_CHAR.test(after);
    if (!gluedBefore && !gluedAfter) return true;
    from = i + 1;
  }
}

/** The list's phrases found in one piece of text, in the list's own (lower-case) form, de-duplicated. */
export function findClaimWords(text: string | null | undefined, words: readonly string[]): string[] {
  if (!text || !text.trim()) return [];
  const hits: string[] = [];
  for (const w of words) {
    const p = normaliseText(w);
    if (p && !hits.includes(p) && containsWholePhrase(text, p)) hits.push(p);
  }
  return hits;
}

/** The card's own family: its key, and every key in the same tier-1 folder. */
export function ownServiceKeys(category: string, services: ServiceWords): Set<string> {
  const own = new Set<string>([category]);
  const fam = services.family[category];
  if (fam) for (const [k, f] of Object.entries(services.family)) if (f === fam) own.add(k);
  return own;
}

/** "Filed under X, reads like Y": another service's words AND none of its own. Null on a pass. */
export function findServiceMismatch(
  texts: readonly (string | null | undefined)[],
  category: string,
  services: ServiceWords,
): { matched: string; words: string[] } | null {
  const joined = texts.filter((t): t is string => typeof t === 'string' && t.trim().length > 0).join(' \n ');
  if (!joined) return null;
  const own = ownServiceKeys(category, services);
  const ownWords = new Set<string>();
  for (const k of own) for (const w of services.words[k] ?? []) ownWords.add(normaliseText(w));
  const ownLabel = services.label[category];
  if (ownLabel) ownWords.add(normaliseText(ownLabel));
  for (const w of ownWords) if (w && containsWholePhrase(joined, w)) return null;

  let best: { key: string; found: string[] } | null = null;
  for (const [key, list] of Object.entries(services.words)) {
    if (own.has(key)) continue;
    const found: string[] = [];
    for (const w of list) {
      const p = normaliseText(w);
      if (!p || ownWords.has(p) || found.includes(p)) continue;
      if (containsWholePhrase(joined, p)) found.push(p);
    }
    if (found.length > 0 && (!best || found.length > best.found.length)) best = { key, found };
  }
  return best ? { matched: best.key, words: best.found } : null;
}

// ── the evaluator ────────────────────────────────────────────────────────────

/**
 * Every problem the card has right now. `photos` answers one photo ref; a ref with no answer is treated as still
 * checking (it blocks — the server would refuse it anyway).
 */
export function evaluateCardChecks(
  input: CardCheckInput,
  ctx: CardCheckContext,
  photos: (ref: string) => PhotoAnswer | undefined,
): CardCheckResult {
  const problems: CardProblem[] = [];
  const unavailable: Array<'words' | 'service'> = [];

  // 2 · the service (shown under What you offer — the fix is usually the service, not the name)
  if (ctx.services === null) unavailable.push('service');
  else if (input.category && knownService(input.category, ctx.services)) {
    const hit = findServiceMismatch([input.title, ...input.inclusionLabels], input.category, ctx.services);
    if (hit) {
      problems.push({
        code: 'service',
        row: 'offer',
        filedLabel: ctx.services.label[input.category] ?? input.category,
        matched: hit.matched,
        matchedLabel: ctx.services.label[hit.matched] ?? hit.matched,
        words: hit.words,
      });
    }
  }

  // 1 · the words, under the row they are on
  if (ctx.claimWords === null || input.addonLabels === null) unavailable.push('words');
  else {
    const list = ctx.claimWords;
    const name = findClaimWords(input.title, list);
    if (name.length) problems.push({ code: 'words', row: 'name', hits: name });
    const inc = uniq(input.inclusionLabels.flatMap((l) => findClaimWords(l, list)));
    if (inc.length) problems.push({ code: 'words', row: 'included', hits: inc });
    const add = uniq(input.addonLabels.flatMap((l) => findClaimWords(l, list)));
    if (add.length) problems.push({ code: 'words', row: 'addons', hits: add });
  }

  // 3 · the photos
  const refs: Array<{ ref: string; which: 'cover' | 'showcase' }> = [];
  if (input.cover && input.cover.trim()) refs.push({ ref: input.cover, which: 'cover' });
  for (const r of input.showcase) if (r && r.trim() && r !== input.cover) refs.push({ ref: r, which: 'showcase' });
  for (const { ref, which } of refs) {
    const a = photos(ref) ?? { status: 'checking' as const };
    if (a.status !== 'ok') problems.push({ code: 'photo', row: 'photos', ref, which, answer: a });
  }

  if (unavailable.length) problems.unshift({ code: 'unavailable', row: 'status', checks: unavailable });
  problems.sort((x, y) => ROW_ORDER.indexOf(x.row) - ROW_ORDER.indexOf(y.row));
  return { problems, count: problems.length, blocked: problems.length > 0 };
}

/**
 * A key the taxonomy knows nothing about has no "own words" to stand on — judging it would call every card under
 * it "wrong". So an unknown key is never checked for a service mismatch (the conservative side).
 */
function knownService(category: string, services: ServiceWords): boolean {
  return Boolean(services.family[category] || services.words[category]?.length || services.label[category]);
}

function uniq(xs: readonly string[]): string[] {
  return [...new Set(xs)];
}

/** The problems a given maker row shows. */
export function problemsFor(result: CardCheckResult, row: CheckRow): CardProblem[] {
  return result.problems.filter((p) => p.row === row);
}

/** A stable key for a result, so the maker re-renders only when the problems change. */
export function checkResultKey(r: CardCheckResult): string {
  return JSON.stringify(r.problems);
}

/** Read the check's input off the maker's form (the same field names the save parses). */
export function readCardCheckInput(fd: { get(k: string): unknown; getAll(k: string): unknown[] }): CardCheckInput {
  const s = (v: unknown) => (typeof v === 'string' ? v : '');
  const addonsShown = s(fd.get('addons_present')) === '1';
  return {
    category: s(fd.get('category')).trim(),
    title: s(fd.get('title')).trim() || null,
    inclusionLabels: fd.getAll('inclusion_label').map(s).map((v) => v.trim()).filter(Boolean),
    addonLabels: addonsShown ? fd.getAll('addon_label').map(s).map((v) => v.trim()).filter(Boolean) : [],
    cover: s(fd.get('primary_photo_r2_key')).trim() || null,
    showcase: fd.getAll('showcase_photo_r2_keys').map(s).map((v) => v.trim()).filter(Boolean),
  };
}
