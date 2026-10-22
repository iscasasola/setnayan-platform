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
import { PERSON_ONLY_TYPES } from './create-subjects';

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

/**
 * ── A SHOP IS LINKED ON EVERY EVENT IT IS PICKED FOR (owner 2026-10-22) ───────
 *
 * The two lists above answer "may this TYPE name a subject" without asking WHO
 * the subject is — and for a person that is right: a birthday for Lola keys the
 * one-in-planning cap on Lola, a travel "for" Lola is just a trip. But a shop's
 * business alaga (`dependent_kind = 'business'`, written when the shop opens —
 * lib/business-alaga.ts) sat in the create picker's "For ▾" and was then DROPPED
 * by the server on every type outside those lists: a celebration, a tournament, a
 * trip, a hangout "for" the shop was created, and was never the shop's. Owner,
 * 22 Oct, "yes" to the controller's recommendation: link the shop on EVERY type
 * the owner creates for it.
 *
 * ⇒ For a BUSINESS alaga the answer is "every type the picker offers for it":
 * everything except `PERSON_ONLY_TYPES` (the five a business can never have —
 * wedding · debut · christening · graduation · gender_reveal — which the grid
 * already folds away for one, `hiddenTypesForSubject`). Derived from that list,
 * never re-listed, so an admin-added type reaches a shop with no edit here.
 *
 * ⚠ IT IS ONE MORE PERMISSION TO NAME, AND STILL NO CAP. None of the widened
 * types is in `LIFE_GATE_BY_TYPE`, so `blocksLifeEventCreation` returns false for
 * them: a shop may hold as many tournaments in planning as it likes.
 * ⚠ PEOPLE KEEP THEIR OWN RULES. A person / pet / item alaga on a widened type is
 * still dropped — the kind is read from the RECORD on the server
 * (`resolveHonoreeDependentId`), never from the wire.
 * ⚠ A WEDDING STAYS OUT FOR EVERYONE — it is the first person-only type.
 */
export function businessMayBeLinkedOn(eventType: string | null | undefined): boolean {
  if (!eventType) return false;
  return !(PERSON_ONLY_TYPES as readonly string[]).includes(eventType);
}

/**
 * Could an event of this type name SOME subject? The cheap pre-check before a
 * round-trip — true for every type a person may be named on, plus every type a
 * business may be. Whether THIS dependent may is decided once its kind is read
 * (`honoreeLinkAllowed`, inside the resolver).
 */
export function eventTypeMayNameASubject(eventType: string | null | undefined): boolean {
  return eventTypeAcceptsHonoreeLink(eventType) || businessMayBeLinkedOn(eventType);
}

/** May THIS kind of alaga be linked on THIS type? The rule, once the kind is known. */
export function honoreeLinkAllowed(
  eventType: string | null | undefined,
  dependentKind: string | null | undefined,
): boolean {
  if (eventTypeAcceptsHonoreeLink(eventType)) return true;
  return dependentKind === 'business' && businessMayBeLinkedOn(eventType);
}

/**
 * Does the create picker draw the "Which business is this for?" field — i.e.
 * post the subject's label + record id — for this type and this "For ▾" answer?
 * The types that name a subject for anyone, as before, and every type a
 * business may be linked on when the answer is a business.
 */
export function pickerAsksHonoree(
  eventType: string | null | undefined,
  subjectKind: string | null | undefined,
): boolean {
  return eventTypeAcceptsHonoreeLink(eventType) || (subjectKind === 'business' && businessMayBeLinkedOn(eventType));
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
  /**
   * The type of the event being created. REQUIRED: whether a record may be
   * linked depends on what KIND it is (a shop may be linked on a tournament, a
   * person may not), and the kind is only known once the row is read here.
   */
  eventType: string | null | undefined;
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
  { userId, dependentId, honoreeLabel, eventType }: ResolveHonoreeLinkInput,
): Promise<string | null> {
  if (!userId || !isDependentId(dependentId)) return null;
  // No type could name anybody → no round-trip spent looking.
  if (!eventTypeMayNameASubject(eventType)) return null;
  const id = dependentId.trim();

  const { data, error } = await client
    .from('dependents')
    .select('dependent_id, name, dependent_kind')
    .eq('dependent_id', id)
    // ⚠ THE OWNERSHIP BOUNDARY. Admin client = RLS off; this predicate is it.
    .eq('owner_user_id', userId)
    // A handed-over record is no longer this account's alaga (it belongs to the
    // person themselves now), and the subject roster already drops it.
    .is('handed_over_at', null)
    .maybeSingle();

  // An unreadable table must not cost anyone their event — drop the link and
  // let the label key the cap, exactly as it did before this module existed.
  if (error) {
    console.error(
      '[supabase-error] lib/honoree-dependent-link.ts · from:dependents.select',
      error,
    );
  }
  if (error || !data) return null;

  const row = data as { dependent_id: string; name: string | null; dependent_kind?: string | null };
  if (!honoreeLabelMatchesDependent(honoreeLabel, row.name)) return null;
  // The KIND comes from the record, never from the wire: a person picked for a
  // trip is dropped here exactly as before; a shop picked for one is linked.
  // A NULL kind is the column default's legacy reading — a person.
  if (!honoreeLinkAllowed(eventType, row.dependent_kind ?? 'person')) return null;
  return row.dependent_id;
}

export type ResolvedEventHonoree = {
  /** `events.honoree_label` to write — NULL when this type names nobody. */
  honoreeLabel: string | null;
  /** `events.honoree_dependent_id` to write — server-verified, or NULL. */
  honoreeDependentId: string | null;
};

/**
 * BOTH CREATE DOORS' ONE ANSWER to "who is this event for" — the inline form
 * (`create-event/actions.ts`) and the wizard (`onboarding/_shared/commit-event.ts`)
 * both call this, so the two cannot drift.
 *
 *  • A type that names a subject for anyone (the five life types, corporate,
 *    gala night): the typed label is kept as typed, and the id is resolved —
 *    byte-identical to what each door did inline before.
 *  • A type that only a BUSINESS may be named on (celebration, tournament,
 *    travel, …): the label is kept ONLY IF the id resolved to a shop the caller
 *    owns. A person's name on a trip is dropped, label and all, exactly as it
 *    was — the widening reaches businesses and nobody else.
 *  • Anything else (a wedding): NULL / NULL.
 *
 * ⚠ STILL NEVER A NEW WAY TO FAIL. A throw while resolving (no service key)
 * resolves to NULL; the event is created either way.
 */
export async function resolveEventHonoree(
  getClient: () => SupabaseClient,
  input: {
    userId: string;
    eventType: string | null | undefined;
    honoreeLabel: string | null | undefined;
    dependentId: unknown;
  },
): Promise<ResolvedEventHonoree> {
  const label = (input.honoreeLabel ?? '').trim().replace(/\s+/g, ' ').slice(0, 80) || null;
  if (!eventTypeMayNameASubject(input.eventType)) {
    return { honoreeLabel: null, honoreeDependentId: null };
  }
  let honoreeDependentId: string | null = null;
  // `isDependentId` first: an account without a People roster posts no id, so
  // no admin client is constructed and not one round-trip is spent.
  if (isDependentId(input.dependentId)) {
    try {
      honoreeDependentId = await resolveHonoreeDependentId(getClient(), {
        userId: input.userId,
        dependentId: input.dependentId,
        honoreeLabel: label,
        eventType: input.eventType,
      });
    } catch {
      honoreeDependentId = null;
    }
  }
  if (eventTypeAcceptsHonoreeLink(input.eventType)) {
    return { honoreeLabel: label, honoreeDependentId };
  }
  // A business-only type: the name rides only with the shop it names.
  return honoreeDependentId
    ? { honoreeLabel: label, honoreeDependentId }
    : { honoreeLabel: null, honoreeDependentId: null };
}
