/**
 * THE CHALLENGE PICKER'S QUERY — six hundred rows, one screen.
 *
 * Owner, 2026-08-21: "here they can filter it so they can pick which challenge
 * they like. also search. but we will show the top 20 most picked challenges."
 *
 * ── WHY THIS IS SERVER-SIDE AND NOT A CLIENT FILTER ─────────────────────────
 * The obvious build ships all 631 rows to the browser and filters in React.
 * That is ~90 KB of prompts on a screen most couples open once, on a phone, in
 * the Philippines. Everything here runs as a URL query instead: the chips are
 * links, the search box is a GET form, and the page works with no JavaScript at
 * all — the same shape as every other form on this screen.
 *
 * ── 🔒 THE SEARCH BOX IS A POSTGREST FILTER, WHICH IS AN INJECTION SURFACE ──
 * `.or()` takes a filter EXPRESSION as a string, so a comma or a bracket typed
 * into the search box does not get escaped — it becomes syntax. `sanitizeQuery`
 * therefore ALLOW-LISTS characters rather than escaping bad ones: a denylist is
 * a bill you have to keep paying, and this one would be paid in somebody else's
 * data. Anything outside letters, digits, spaces, apostrophes and hyphens is
 * dropped, not rejected — a couple searching for "cake?" gets cake, not an
 * error message about punctuation.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  isChallengeCategory,
  type ChallengeCategory,
} from './papic-challenge-categories';

export const PICKER_PAGE_SIZE = 20;

/** One row as the picker renders it. */
export type PickerRow = {
  library_id: number;
  category: ChallengeCategory;
  title: string;
  prompt: string;
  capture_kind: 'photo' | 'clip' | 'pabati';
  /** How many other events carry this one. 0 until couples start picking. */
  picks: number;
};

export type PickerFilters = {
  /** Free text. Already sanitized. Empty string = no text filter. */
  q: string;
  /** A category key, or null for "everything". */
  category: ChallengeCategory | null;
  /** 'photo' | 'clip' | null. Video covers `clip` and `pabati`. */
  kind: 'photo' | 'clip' | null;
};

export type PickerResult = {
  rows: PickerRow[];
  /** Total matches before the page cut, so the screen can say "20 of 148". */
  total: number;
  /**
   * TRUE when the order is real popularity; FALSE when it is the curated
   * fallback because nobody has picked anything yet.
   * 🔑 THE SCREEN MUST SAY WHICH. Presenting our own recommendations as "what
   * other couples chose" is a claim about other people that is not true, and it
   * is exactly the claim a launch-day empty rail invites.
   */
  rankedByPicks: boolean;
  /** FALSE when a read failed. The caller must SUPPRESS, never render empty. */
  readable: boolean;
};

/**
 * ⚠ ALLOW-LIST, NOT ESCAPE. See the header. Also caps the length: a very long
 * `ilike` pattern is a slow sequential scan on every keystroke-sized request.
 */
export function sanitizeQuery(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/[^\p{L}\p{N} '’-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

/** An event type out of the database, made safe to put in a filter string. */
function sanitizeEventType(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/[^a-z_]/g, '');
  return cleaned.length > 0 ? cleaned : null;
}

export function readFilters(search: {
  cq?: string;
  ccat?: string;
  ckind?: string;
}): PickerFilters {
  return {
    q: sanitizeQuery(search.cq),
    category: isChallengeCategory(search.ccat) ? search.ccat : null,
    kind: search.ckind === 'photo' || search.ckind === 'clip' ? search.ckind : null,
  };
}

/** Is the couple looking at the default view — no search, no chip? */
export function isDefaultView(f: PickerFilters): boolean {
  return f.q === '' && f.category === null && f.kind === null;
}

/**
 * The picker's rows.
 *
 * @param supabase   the couple's own RLS-scoped client (the library is
 *                   SELECT-granted to `authenticated`; no admin client is used
 *                   and none is needed).
 * @param eventType  this event's type, so a birthday is never offered a garter
 *                   toss. Null (an unreadable event) narrows to the unscoped
 *                   rows — plain wording, never a wedding word at something
 *                   that is not one.
 * @param taken      library ids already on this event's board. ⚠ A HIDDEN one
 *                   COUNTS AS TAKEN: re-offering a question the couple hid
 *                   would say "add this" while their own list below says
 *                   "Hidden from guests".
 */
export async function fetchPickerRows(
  supabase: SupabaseClient,
  eventType: string | null,
  taken: ReadonlySet<number>,
  filters: PickerFilters,
): Promise<PickerResult> {
  const type = sanitizeEventType(eventType);

  let query = supabase
    .from('papic_challenge_library')
    .select('library_id,category,title,prompt,capture_kind,priority_rank', { count: 'exact' })
    .eq('is_active', true)
    // `face_verified` challenges are never boarded by the resolver, so offering
    // one would be a button that does nothing visible.
    .neq('mission_type', 'face_verified');

  // Scope. `cs` is "contains" on a text[]; `is.null` is the row that fits any
  // celebration. A null type leaves ONLY the unscoped rows, which fails closed.
  query = type
    ? query.or(`event_types.is.null,event_types.cs.{${type}}`)
    : query.is('event_types', null);

  if (filters.category) query = query.eq('category', filters.category);
  if (filters.kind === 'photo') query = query.eq('capture_kind', 'photo');
  // "Video" is both moving-picture kinds. A Pabati greeting is a video to a
  // person, whatever the SKU calls it.
  if (filters.kind === 'clip') query = query.in('capture_kind', ['clip', 'pabati']);
  if (filters.q) query = query.or(`title.ilike.%${filters.q}%,prompt.ilike.%${filters.q}%`);

  // Over-fetch, because `taken` is subtracted in memory: asking for exactly 20
  // and then removing the taken ones returns a short page that reads as "that
  // is all there is".
  const { data, error, count } = await query
    .order('priority_rank', { ascending: true, nullsFirst: false })
    .order('library_id', { ascending: true })
    .limit(PICKER_PAGE_SIZE + taken.size + 40);

  // 🔑 A REJECTED READ RESOLVES WITH `{ error }` AND NULL DATA — IT DOES NOT
  // THROW. `?? []` renders an empty picker indistinguishable from "you have
  // added them all", which is the most reassuring possible way to show a broken
  // screen. Say so instead.
  if (error) return { rows: [], total: 0, rankedByPicks: false, readable: false };

  const picks = await fetchPickCounts(supabase);

  const available = (data ?? [])
    .filter((r) => !taken.has(Number(r.library_id)))
    .map((r) => ({
      library_id: Number(r.library_id),
      category: r.category as ChallengeCategory,
      title: r.title as string,
      prompt: r.prompt as string,
      capture_kind: r.capture_kind as PickerRow['capture_kind'],
      priority_rank: r.priority_rank === null ? null : Number(r.priority_rank),
      picks: picks.get(Number(r.library_id)) ?? 0,
    }));

  // The default view is the owner's "top 20 most picked". A filtered or searched
  // view keeps the curated order, because somebody who typed "cake" wants the
  // cake ones, not the popular ones that happen to mention cake.
  const rankedByPicks = isDefaultView(filters) && available.some((r) => r.picks > 0);
  const ordered = rankedByPicks
    ? [...available].sort(
        (a, b) =>
          b.picks - a.picks ||
          (a.priority_rank ?? 999) - (b.priority_rank ?? 999) ||
          a.library_id - b.library_id,
      )
    : available;

  return {
    rows: ordered.slice(0, PICKER_PAGE_SIZE).map(({ priority_rank: _rank, ...row }) => row),
    // The database's own count, minus the ones this event already has. `count`
    // is null when PostgREST could not compute it — fall back to what we hold
    // rather than printing a confident zero.
    total: Math.max(0, (count ?? available.length) - taken.size),
    rankedByPicks,
    readable: true,
  };
}

/**
 * How many other events carry each challenge.
 *
 * ⚠ FAILS TO AN EMPTY MAP, NOT TO AN ERROR. Popularity is a nicety; a couple
 * who cannot see it still gets the whole library in a sensible order. Blocking
 * the picker on this read would trade the feature for the decoration.
 */
async function fetchPickCounts(supabase: SupabaseClient): Promise<Map<number, number>> {
  const { data, error } = await supabase.rpc('papic_challenge_pick_counts');
  if (error || !Array.isArray(data)) return new Map();
  return new Map(
    data.map((r: { library_id: number; picks: number }) => [Number(r.library_id), Number(r.picks)]),
  );
}
