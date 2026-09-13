/**
 * honoree-dependent-link.ts — originating `events.honoree_dependent_id`.
 *
 * THE DEFECT THIS MODULE CLOSES (found on origin/main 2026-08-01): the column
 * existed, the gate read it, and NOTHING ever wrote it. The only assignment in
 * the app was lib/event-recurrence.ts, which COPIES the value forward when an
 * event recurs — it propagates a link but never originates one. So the column
 * was NULL on every row, and `blocksLifeEventCreation`'s strongest branch
 *
 *     if (candidate.honoreeDependentId && existing.honoree_dependent_id) …
 *
 * could never fire. The one-in-planning life-event cap therefore always keyed
 * on the normalized honoree_label STRING, which means:
 *   - two alaga who share a first name shared ONE slot, and
 *   - RENAMING an alaga silently changed which events it capped against.
 * A cap should key on a RECORD, not on a spelling.
 *
 * ⚠ THE ID IS CLIENT-SUPPLIED. Both create paths carry it from a hidden field /
 * sessionStorage, so it can be forged. Writing an id the caller does not own
 * would leak a relationship (this account plans events for that dependent) AND
 * corrupt the OTHER account's cap. So nothing here trusts the wire: the id is
 * re-read from `dependents` under an explicit `owner_user_id = <caller>`
 * predicate, and anything that does not come back is DROPPED.
 *
 * ⚠ DROPPED, NEVER REFUSED. Every failure — forged id, unreadable table, a
 * label the user edited away from the alaga's name — resolves to NULL, which is
 * byte-identical to today's behaviour: the event is still created and the cap
 * falls back to `honoree_label`. A cardinality REFINEMENT must never become a
 * new way to fail at creating an event.
 *
 * ⚠ NO BIRTHDATE IS READ OR WRITTEN HERE. This resolver selects `name` only —
 * the counsel gate that keeps a person's birthdate off an event
 * (lib/onboarding/event-insert.ts) is untouched.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeHonoree, isGatedLifeType } from './life-event-gate';

/**
 * ── WHICH EVENT TYPES MAY NAME A SUBJECT ───────────────────────────────────
 *
 * Until 2026-08-31 the answer was "the five gated life types", because
 * `isGatedLifeType()` was doing double duty: it is the CAP's vocabulary (one
 * in-planning debut per celebrant) and it was also, by accident, the gate on
 * whether an event could say WHO it is for at all. So `corporate` and
 * `gala_night` — both live, both routinely thrown BY a business — had no way to
 * name the business they belong to. The id was posted, and the server dropped it
 * one line before it would have been verified.
 *
 * These two lists are deliberately separate concepts:
 *   • `LIFE_GATE_BY_TYPE` — types that CONTEND for a singleton in-planning slot.
 *   • `BUSINESS_HONOREE_TYPES` — types that may name a subject and contend for
 *     NOTHING. `blocksLifeEventCreation` returns false for any type outside the
 *     gate's own map, so widening here cannot cap anybody: a company may hold
 *     twelve gala nights in planning, exactly as it can today.
 *
 * ⚠ WEDDING IS STILL ABSENT, AND THAT IS THE POINT. A wedding has its own guard
 * (`wedding-guard.ts`) and its own honoree model (the couple), and it has never
 * written this column. Adding it here would put a wedding under a cap it was
 * deliberately kept out of. `eventTypeAcceptsHonoreeLink('wedding')` is FALSE
 * and must stay false.
 */
export const BUSINESS_HONOREE_TYPES = ['corporate', 'gala_night'] as const;

const BUSINESS_HONOREE_SET: ReadonlySet<string> = new Set(BUSINESS_HONOREE_TYPES);

/**
 * May an event of this type carry `honoree_label` + `honoree_dependent_id`?
 *
 * ⚠ THIS IS A PERMISSION TO NAME, NOT A CARDINALITY RULE. Nothing about the
 * one-in-planning cap moves: that is still `isGatedLifeType` inside
 * `blocksLifeEventCreation`, untouched.
 *
 * ⚠ AND IT ADDS NO NEW WAY TO FAIL. A type outside this list drops the link and
 * creates the event, byte-identically to today; a type inside it still has the
 * id re-read under `owner_user_id = you` below and still drops anything that
 * does not come back. There is no branch here that refuses an event.
 */
export function eventTypeAcceptsHonoreeLink(eventType: string | null | undefined): boolean {
  if (!eventType) return false;
  return isGatedLifeType(eventType) || BUSINESS_HONOREE_SET.has(eventType);
}

/** A dependent_id is a uuid — reject anything else before spending a round-trip. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isDependentId(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value.trim());
}

/**
 * Does the submitted honoree label still describe the linked dependent?
 *
 * Both create surfaces PRE-FILL the label from the chosen alaga's name and then
 * leave it editable. If the user overtypes it ("actually this one is for Jose")
 * without going back to the who step, the id still on the wire points at the
 * PREVIOUS person — and writing it would file the event under the wrong record
 * and cap it against the wrong sibling, silently.
 *
 * So the two halves must agree, compared with the gate's own normalizer (case +
 * whitespace folded). Disagreement drops the link and keeps the typed label,
 * i.e. it degrades to exactly the behaviour that shipped before this module.
 * A blank label counts as disagreement — clearing the field is how a user says
 * "not that person".
 */
export function honoreeLabelMatchesDependent(
  honoreeLabel: string | null | undefined,
  dependentName: string | null | undefined,
): boolean {
  const label = normalizeHonoree(honoreeLabel);
  const name = normalizeHonoree(dependentName);
  if (!label || !name) return false;
  return label === name;
}

export type ResolveHonoreeLinkInput = {
  /** The authenticated caller. Nothing resolves without one. */
  userId: string;
  /** The client-supplied dependent_id (hidden field / sessionStorage carry). */
  dependentId: unknown;
  /** The honoree label being written alongside it. */
  honoreeLabel: string | null | undefined;
};

/**
 * The verified `events.honoree_dependent_id` to write, or NULL.
 *
 * `client` is INJECTED (never constructed here) so this stays testable and so
 * the caller decides which client to spend. Both callers pass the ADMIN client
 * on purpose: this is an ownership check, and the samahan-organizer check three
 * screens away in the same server action already established why (a user-scoped
 * JWT can be stale or resolve to anon at the edge, which would silently drop
 * every link). Using the admin client means the `.eq('owner_user_id', …)`
 * predicate below IS the entire security boundary — do not remove it, and do
 * not widen this to a `.select()` without it.
 *
 * SCOPE — deliberately OWNER-ONLY. `dependents` also grants a spouse READ on a
 * `shared_with_spouse` row, so a spouse picking a shared alaga gets NULL here
 * and keeps label-based capping (today's behaviour). That is a narrowing we
 * accept rather than re-implement the married-household rule in app code, where
 * it could drift from the policy and start writing links across accounts.
 */
export async function resolveHonoreeDependentId(
  client: SupabaseClient,
  { userId, dependentId, honoreeLabel }: ResolveHonoreeLinkInput,
): Promise<string | null> {
  if (!userId || !isDependentId(dependentId)) return null;
  const id = dependentId.trim();

  const { data, error } = await client
    .from('dependents')
    .select('dependent_id, name')
    .eq('dependent_id', id)
    // ⚠ THE OWNERSHIP BOUNDARY. Admin client = RLS off; this predicate is it.
    .eq('owner_user_id', userId)
    // A handed-over record is no longer this account's alaga (it belongs to the
    // person themselves now), and the subject roster already drops it.
    .is('handed_over_at', null)
    .maybeSingle();

  // An unreadable table must not cost anyone their event — drop the link and
  // let the label key the cap, exactly as it did before this module existed.
  if (error || !data) return null;

  const row = data as { dependent_id: string; name: string | null };
  if (!honoreeLabelMatchesDependent(honoreeLabel, row.name)) return null;
  return row.dependent_id;
}
