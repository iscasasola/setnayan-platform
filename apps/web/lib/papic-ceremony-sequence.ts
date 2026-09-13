/**
 * THE SEQUENCE IS THE CLOCK — a ceremony moment's candidate challenges.
 *
 * Build order § 5: `lib/kwento-moments.ts` has carried the ten moments in order
 * since the editorial work, `papic_challenge_library` has carried the prompts
 * since the 631-row pool, and NOTHING JOINED THEM. Joining them is what lets a
 * coordinator set a celebration up in two minutes instead of writing prompts
 * from scratch — that is the whole value being bought, and every decision in
 * this file is answerable to it.
 *
 * ── 🔴 THIS FILE HAS NO CLOCK OF ITS OWN, AND MUST NEVER GROW ONE ───────────
 * Owner ruling 2026-09-01: a challenge's window is RELATIVE — it opens when the
 * challenge is ARMED and closes when the next one is. THE SEQUENCE IS THE
 * CLOCK: a moment arms its challenge through `papic_arm_challenge()`, which
 * closes the previous one in the same transaction, and whether anything is open
 * is decided by `papic_challenge_is_open()` and by nothing else.
 *
 * ⚠ SO: no duration, no default duration number, and no comparison against
 * `armed_at` anywhere in here — the same standing rule as
 * `papic-challenge-clock.ts`, for the same reason. A moment is a POSITION in an
 * order, not a length of time, and giving it one would put a second answer
 * beside the resolver's.
 *
 * ── THE DEGRADE IS THE RULE, NOT THE ERROR PATH ────────────────────────────
 * § 5: "An UNMAPPED moment must degrade to the general pool, never to nothing.
 * A ceremony that reaches a moment with no mapping still has to offer the
 * guests something."
 *
 * 🔑 AND IT IS NOT HYPOTHETICAL. `event_types` is applied on top of the
 * mapping, so at a birthday `bridal_march` maps only to wedding-scoped rows,
 * every one is filtered out, and the moment degrades. The fallback runs at
 * every non-wedding celebration, on the first screen, every time.
 *
 * ── AND THE SCREEN MUST SAY WHICH ──────────────────────────────────────────
 * `basis` is returned for the same reason `rankedByPicks` is returned by the
 * picker: presenting a general-pool fallback as "what we suggest for the first
 * kiss" is a claim that is not true, and it is exactly the claim an empty
 * mapping invites. A caller that ignores `basis` has thrown away the honesty
 * this function exists to preserve.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { KWENTO_MOMENTS, type KwentoMomentKey } from './kwento-moments';
import { MOMENT_CHALLENGES } from './papic-challenge-pool';

/**
 * How many prompts a moment offers.
 *
 * DERIVED, NOT PICKED. It is the length of the longest authored moment list, so
 * a degraded moment offers exactly as many choices as a mapped one — the
 * coordinator's screen looks the same either way, which is the point of
 * degrading rather than emptying. Nothing about money or capture depends on it;
 * it is a shelf length.
 */
export const SEQUENCE_SUGGESTIONS = Math.max(
  ...Object.values(MOMENT_CHALLENGES).map((list) => list.length),
);

/** One suggestion, as the run-of-show screen renders it. */
export type SequenceCandidate = {
  library_id: number;
  slug: string;
  title: string;
  prompt: string;
  capture_kind: string;
  mission_type: string;
};

export type SuggestionBasis =
  /** These prompts were authored FOR this moment. */
  | 'sequence'
  /** Nothing authored for this moment fits this celebration — the general pool. */
  | 'general';

export type MomentSuggestions = {
  moment: KwentoMomentKey;
  basis: SuggestionBasis;
  /**
   * NEVER EMPTY WHEN IT EXISTS. § 5: "an UNMAPPED moment must degrade to the
   * general pool, never to nothing."
   *
   * ⚠ AND THERE IS DELIBERATELY NO `readable` FLAG ON A SHELF. Whether the
   * library could be read is a fact about the REQUEST, not about a moment —
   * `fetchSequenceSuggestions` returns it once, and a caller that cannot read
   * gets NO shelves rather than ten empty ones. A per-shelf flag that could
   * only ever be `true` is a field that reads like a check and performs none.
   */
  candidates: SequenceCandidate[];
};

type LibraryRow = {
  library_id: number;
  slug: string;
  title: string;
  prompt: string;
  capture_kind: string;
  mission_type: string;
};

function toCandidate(r: LibraryRow): SequenceCandidate {
  return {
    library_id: Number(r.library_id),
    slug: r.slug,
    title: r.title,
    prompt: r.prompt,
    capture_kind: r.capture_kind,
    mission_type: r.mission_type,
  };
}

/** An event type out of the database, made safe to put in a filter string. */
function sanitizeEventType(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/[^a-z_]/g, '');
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Is this a moment we know? Every entry point takes the key as a string off a
 * URL or a form, and an unrecognised one must be refused rather than queried.
 */
export function isKwentoMomentKey(raw: unknown): raw is KwentoMomentKey {
  return typeof raw === 'string' && KWENTO_MOMENTS.some((m) => m.key === raw);
}

/**
 * PUT A MOMENT'S CANDIDATES IN THE ORDER THE COORDINATOR SHOULD SEE THEM.
 *
 * Pure, and separated from the query for the reason `orderForShelf` was: the
 * ordering is the part most likely to quietly stop being true, and inside a
 * function that needs a Supabase client it could not be tested at all.
 *
 * The order is the one authored in `MOMENT_CHALLENGES` — first in the list is
 * the obvious prompt for that moment. A row that names the moment but is not in
 * the authored list (possible only mid-deploy, between a seed landing and this
 * module shipping) sorts last by `library_id` rather than being dropped:
 * showing a coordinator one extra sensible prompt is a smaller failure than
 * showing them nothing.
 */
export function orderMomentCandidates<T extends { slug: string; library_id: number }>(
  rows: T[],
  moment: KwentoMomentKey,
): T[] {
  const authored = MOMENT_CHALLENGES[moment];
  const rank = (slug: string) => {
    const i = authored.indexOf(slug);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...rows].sort(
    (a, b) => rank(a.slug) - rank(b.slug) || a.library_id - b.library_id,
  );
}

/**
 * The library query both lanes share.
 *
 * 🔑 ONE QUERY BUILDER, TWO LANES. The scope rules — active only, no
 * `face_verified` (the resolver never boards one, so offering it is a button
 * that does nothing), and the event-type filter that keeps a birthday from
 * being asked about newlyweds — are the picker's rules, and writing them twice
 * is how the run of show would start offering something the picker refuses.
 */
function scopedLibrary(supabase: SupabaseClient, eventType: string | null) {
  const type = sanitizeEventType(eventType);
  let q = supabase
    .from('papic_challenge_library')
    .select('library_id,slug,title,prompt,capture_kind,mission_type')
    .eq('is_active', true)
    .neq('mission_type', 'face_verified');
  // A null type leaves ONLY the unscoped rows, which fails closed — plain
  // wording, never a wedding word at something that is not one.
  q = type
    ? q.or(`event_types.is.null,event_types.cs.{${type}}`)
    : q.is('event_types', null);
  return q;
}

/**
 * THE DECISION, WITH NO DATABASE IN IT.
 *
 * Given every in-scope row that names ANY moment, and the general pool in house
 * order, decide what each of the ten moments offers and on what basis.
 *
 * 🔑 PULLED OUT OF THE FETCH DELIBERATELY, THE WAY `orderForShelf` WAS. The
 * degrade is the ruled behaviour of this whole item — "an UNMAPPED moment must
 * degrade to the general pool, never to nothing" — and inside a function that
 * needs a Supabase client it could not be tested at all. The picker's own
 * comment records what that costs: a mutation run deleted half of its ordering
 * condition and NOTHING went red, because the rule had nowhere to be asserted.
 *
 * ⚠ `taken` IS SUBTRACTED BEFORE THE DEGRADE IS DECIDED, NOT AFTER. A moment
 * whose only mapped prompt is already placed at an earlier moment has, for this
 * celebration, nothing authored left to offer — so it must degrade. Filtering
 * afterwards would leave it holding an empty "we suggest these" shelf, which is
 * the exact "degrades to nothing" the rule forbids.
 */
export function suggestForMoments(
  mapped: LibraryRow[],
  general: LibraryRow[],
  moments: readonly KwentoMomentKey[],
  taken: ReadonlySet<number>,
): Map<KwentoMomentKey, MomentSuggestions> {
  const free = (rows: LibraryRow[]) => rows.filter((r) => !taken.has(Number(r.library_id)));
  const freeMapped = free(mapped);
  const freeGeneral = free(general);
  const out = new Map<KwentoMomentKey, MomentSuggestions>();

  // ⚠ TWO MOMENTS THAT BOTH DEGRADE ON ONE RENDER SEE THE SAME SHELF, and that
  // is correct rather than a bug to design around: they are being offered "the
  // strongest prompts in your library", which is one list. Placing one removes
  // it from the other on the next render, because `taken` is what moves.
  for (const moment of moments) {
    const authored = new Set(MOMENT_CHALLENGES[moment]);
    const forThisMoment = freeMapped.filter((r) => authored.has(r.slug));

    if (forThisMoment.length > 0) {
      out.set(moment, {
        moment,
        basis: 'sequence',
        candidates: orderMomentCandidates(forThisMoment, moment)
          .slice(0, SEQUENCE_SUGGESTIONS)
          .map(toCandidate),
      });
      continue;
    }

    // THE DEGRADE. Never to nothing.
    out.set(moment, {
      moment,
      basis: 'general',
      candidates: freeGeneral.slice(0, SEQUENCE_SUGGESTIONS).map(toCandidate),
    });
  }
  return out;
}

/**
 * WHAT EVERY MOMENT OFFERS — TWO READS FOR THE WHOLE SEQUENCE.
 *
 * ⚠ TWO QUERIES, NOT TWENTY. The obvious build asks the library once per
 * moment; ten round-trips to render one screen is a page a coordinator opens
 * on a phone in a function hall with the reception starting. One read fetches
 * every row that names any moment (`moment_keys IS NOT NULL`, a GIN-indexed
 * partial slice of 37 rows today), one fetches the head of the general pool for
 * the degrade, and `suggestForMoments` does the rest in memory.
 *
 * @param eventType this celebration's type, so the scope rules apply.
 * @param taken     library ids already placed in this run of show. A prompt can
 *                  sit at only one moment (the database refuses the second), so
 *                  offering a taken one is a button that fails.
 */
export async function fetchSequenceSuggestions(
  supabase: SupabaseClient,
  eventType: string | null,
  taken: ReadonlySet<number>,
): Promise<{ readable: boolean; byMoment: Map<KwentoMomentKey, MomentSuggestions> }> {
  const moments = KWENTO_MOMENTS.map((m) => m.key);

  const [mappedRes, generalRes] = await Promise.all([
    scopedLibrary(supabase, eventType).not('moment_keys', 'is', null),
    scopedLibrary(supabase, eventType)
      .order('priority_rank', { ascending: true, nullsFirst: false })
      .order('library_id', { ascending: true })
      // The degrade never needs more than one shelf, plus room for whatever is
      // already placed.
      .limit(SEQUENCE_SUGGESTIONS + taken.size),
  ]);

  // 🔑 A REJECTED READ RESOLVES WITH `{ error }` AND NULL DATA — IT DOES NOT
  // THROW, and `?? []` would turn "we could not read the mapping" into "nothing
  // is mapped" and degrade every moment in the sequence while looking perfectly
  // healthy. EITHER read failing makes the whole screen unmeasured: a good
  // mapping read with a failed general read would silently show blank shelves
  // at exactly the degraded moments.
  if (mappedRes.error || generalRes.error) {
    logQueryError(
      'fetchSequenceSuggestions',
      mappedRes.error ?? generalRes.error!,
      {},
      'graceful_degrade',
    );
    return { readable: false, byMoment: new Map() };
  }

  return {
    readable: true,
    byMoment: suggestForMoments(
      (mappedRes.data ?? []) as LibraryRow[],
      (generalRes.data ?? []) as LibraryRow[],
      moments,
      taken,
    ),
  };
}

/** One moment's placed challenge, as the run of show holds it. */
export type PlacedChallenge = {
  moment: KwentoMomentKey;
  missionId: string;
  libraryId: number | null;
  prompt: string;
  captureKind: string | null;
  /** FALSE when the couple has hidden it — it is placed but reaches nobody. */
  isActive: boolean;
};

/**
 * ⚠ `measured: false` MEANS "WE DO NOT KNOW", NOT "NOTHING IS PLACED".
 * Same contract as `fetchArmedChallenge`, and for the same reason: a refused
 * read and an empty run of show are the same shape, and a coordinator told
 * their run of show is empty an hour before the march would rebuild it.
 */
export type RunOfShowReading =
  | { measured: true; placed: Map<KwentoMomentKey, PlacedChallenge> }
  | { measured: false; placed: Map<KwentoMomentKey, PlacedChallenge> };

export async function fetchRunOfShow(
  supabase: SupabaseClient,
  eventId: string,
): Promise<RunOfShowReading> {
  const { data, error } = await supabase
    .from('papic_missions')
    .select('mission_id,moment_key,library_id,prompt,capture_kind,is_active')
    .eq('event_id', eventId)
    .not('moment_key', 'is', null);

  if (error) {
    logQueryError('fetchRunOfShow', error, { event_id: eventId }, 'graceful_degrade');
    return { measured: false, placed: new Map() };
  }

  const placed = new Map<KwentoMomentKey, PlacedChallenge>();
  for (const row of data ?? []) {
    const key = row.moment_key as string;
    // A key the app does not know is skipped rather than rendered. The CHECK
    // constraint makes this unreachable today; it stays because a widened
    // vocabulary must not crash a coordinator's screen mid-reception.
    if (!isKwentoMomentKey(key)) continue;
    placed.set(key, {
      moment: key,
      missionId: row.mission_id as string,
      libraryId: row.library_id === null ? null : Number(row.library_id),
      prompt: row.prompt as string,
      captureKind: (row.capture_kind as string | null) ?? null,
      isActive: Boolean(row.is_active),
    });
  }
  return { measured: true, placed };
}
