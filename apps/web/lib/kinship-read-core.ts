import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { deriveKin, type DerivedKin, type StoredEdge, type StoredRelation } from '@/lib/kinship-derive';

/**
 * lib/kinship-read-core.ts — the confirmed edge neighbourhood around ONE person.
 *
 * NO `server-only` and NO client construction: every Supabase client arrives as
 * a PARAMETER. That is the repo's `-core` convention (see
 * `people-you-can-invite-core.ts`), and here it is load-bearing rather than
 * stylistic — a module that walks the graph with service-role rights must be
 * drivable by a test, and `server-only` cannot be resolved under `tsx --test`,
 * so the alternative would be asserting against the SOURCE of the most
 * privacy-sensitive read on the People surface instead of its BEHAVIOUR.
 *
 * ── WHY THIS NEEDS MORE THAN THE VIEWER'S OWN ROWS ─────────────────────────
 * `person_connections_select` (migration 20271025100000) lets a user read only
 * the edges they are an ENDPOINT of. Every extended relation is at least two
 * hops out: a tita is (my parent ↔ their sibling), an edge I am not party to.
 * So an RLS-scoped read derives NOTHING but the ritual layer, and the screen
 * would state "no family" to someone with a large one — the exact failure this
 * codebase keeps closing (see `guests-read-is-honest.test.ts`).
 *
 * The neighbourhood therefore has to be read with the service-role client, and
 * the authorization becomes THIS MODULE'S JOB rather than the database's. That
 * is the same posture `people-roster.ts` already takes, and the same one the
 * kin-pilot guardrail names: "Treat every call as trust the function."
 *
 * ── WHAT BOUNDS THE BLAST RADIUS ───────────────────────────────────────────
 *   1. EGO-SCOPED WALK. The frontier starts at the viewer's own person and only
 *      ever expands along edges already collected. A person unreachable from
 *      the viewer is never queried and never returned.
 *   2. CONFIRMED ONLY, AT THE QUERY. `.eq('status','confirmed')` is applied to
 *      every hop, so a draft or a pending claim is not merely dropped later —
 *      it never enters the walk, and so cannot even widen the frontier.
 *      `buildAdjacency` drops non-confirmed a second time; both are deliberate.
 *   3. THREE HOPS, WHICH IS THE DERIVATION'S REACH, NOT A CAP. The deepest
 *      relation `kinship-derive.ts` produces is distance 3 (pinsan =
 *      parent→sibling→child; balae = child→spouse→parent), and reaching a
 *      distance-3 person needs the edges incident to the distance-2 ring.
 *      Reading further would collect edges no relation can consume.
 *      ⚠ This is NOT the "hop cap" the task forbids: no derived relation is
 *      withheld, because none exists past this ring.
 *   4. NAMES STAY WITH THE DATABASE. This module returns person ids. Names come
 *      from `visible_connection_names` on the USER's client, whose WHERE clause
 *      is the owner-signed-off rule (2026-07-05) — name only, confirmed only,
 *      self-scoped. The service-role client NEVER resolves a name, so widening
 *      the walk cannot widen who gets named.
 *   5. NO SEX IS READ. `kinLabel` genders a label when sex is known; sex lives
 *      on `users` behind its own consent stamp (OD6), for people the viewer may
 *      not even be named to. So every label renders paired ("Tito/Tita"), which
 *      the derivation module documents as a first-class case: "a tree
 *      legitimately shows a MIX ... deliberate, not broken." Reading a
 *      consent-stamped column about a third party to prettify a word is not a
 *      trade this module makes.
 *
 * Every node is a claimed account regardless: the pilot guardrail
 * (`kin_pilot_require_mutual_accounts`) refuses to store an edge unless BOTH
 * endpoints hold accounts, so nobody in this walk is a third party who cannot
 * see, decline or delete their own row.
 *
 * ── A REFUSED READ IS NOT AN EMPTY FAMILY ──────────────────────────────────
 * `measured: false` means WE DO NOT KNOW. A caller that renders it as "no
 * relatives" has reintroduced the defect this file's precedent closed. The
 * shape is `MeasuredGuests`'s, deliberately.
 */

export type MeasuredKin = {
  kin: DerivedKin[];
  /** FALSE when a read was refused — the tree is UNKNOWN, not empty. */
  measured: boolean;
};

export const EMPTY_KIN: MeasuredKin = { kin: [], measured: true };
const UNKNOWN_KIN: MeasuredKin = { kin: [], measured: false };

/** The reach of the derivation, not a limit on it — see note 3 in the header. */
export const NEIGHBOURHOOD_HOPS = 3;

type EdgeRow = {
  from_person_id: string;
  to_person_id: string;
  relation: string | null;
  status: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Ids are interpolated into a PostgREST `in.(…)` list, which is a string filter
 * — so they are shape-checked first. They come from the database today; this
 * costs nothing and stops a future caller from making it an injection point.
 */
export function isPersonId(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

const STORED_RELATIONS: ReadonlySet<string> = new Set([
  'spouse',
  'parent',
  'child',
  'sibling',
  'godparent',
  'godchild',
  'friend',
]);

/**
 * Rows → edges, dropping anything the derivation cannot use.
 *
 * Confirmed-only is asserted HERE as well as in the query and again in
 * `buildAdjacency`. Three checks for one rule is deliberate: a draft reaching
 * the tree would publish a claim its own author has not sent, and a pending one
 * would let a stranger populate someone else's family by asserting it.
 */
export function toStoredEdges(rows: readonly EdgeRow[]): StoredEdge[] {
  const seen = new Set<string>();
  const edges: StoredEdge[] = [];
  for (const r of rows) {
    if (r.status !== 'confirmed') continue;
    if (!r.relation || !STORED_RELATIONS.has(r.relation)) continue;
    if (!isPersonId(r.from_person_id) || !isPersonId(r.to_person_id)) continue;
    const key = `${r.from_person_id}|${r.to_person_id}|${r.relation}`;
    if (seen.has(key)) continue; // the same edge arrives once per ring it touches
    seen.add(key);
    edges.push({
      fromPersonId: r.from_person_id,
      toPersonId: r.to_person_id,
      relation: r.relation as StoredRelation,
      status: 'confirmed',
    });
  }
  return edges;
}

async function edgesIncidentTo(
  admin: SupabaseClient,
  ids: readonly string[],
): Promise<{ rows: EdgeRow[]; ok: boolean }> {
  const list = ids.filter(isPersonId);
  if (list.length === 0) return { rows: [], ok: true };
  const csv = list.join(',');
  const { data, error } = await admin
    .from('person_connections')
    .select('from_person_id, to_person_id, relation, status')
    // Confirmed-only at the QUERY, so an unconfirmed edge cannot widen the walk.
    .eq('status', 'confirmed')
    .is('deleted_at', null)
    .or(`from_person_id.in.(${csv}),to_person_id.in.(${csv})`);
  if (error) {
    logQueryError('kinshipNeighbourhood.edges', error, {}, 'graceful_degrade');
    return { rows: [], ok: false };
  }
  return { rows: (data ?? []) as EdgeRow[], ok: true };
}

/**
 * Every relation derivable for the person behind `userId`.
 *
 * `adminFactory` is injected so the walk is testable against a stub — the
 * privacy-critical assertions in `kinship-tree-is-honest.test.ts` drive this
 * function itself, not a copy of its logic.
 */
export async function getKinFor(
  supabase: SupabaseClient,
  adminFactory: () => SupabaseClient,
  userId: string,
): Promise<MeasuredKin> {
  // ── who am I, on the person spine ────────────────────────────────────────
  const { data: me, error: meError } = await supabase
    .from('people')
    .select('person_id')
    .eq('claimed_by_user_id', userId)
    .is('deleted_at', null)
    .maybeSingle();
  if (meError) {
    // Refused, not absent. Saying "no family" here would be a guess.
    logQueryError('kinshipNeighbourhood.me', meError, {}, 'graceful_degrade');
    return UNKNOWN_KIN;
  }
  const myPerson = (me as { person_id: string } | null)?.person_id ?? null;
  // No person row is a REAL answer: nothing has been connected yet.
  if (!isPersonId(myPerson)) return EMPTY_KIN;

  let admin: SupabaseClient;
  try {
    admin = adminFactory();
  } catch {
    // An admin client that cannot be built means the tree is unknown. It must
    // NOT render as an empty family — see the header.
    return UNKNOWN_KIN;
  }

  // ── the ego-scoped walk ─────────────────────────────────────────────────
  const seen = new Set<string>([myPerson]);
  let frontier: string[] = [myPerson];
  const rows: EdgeRow[] = [];

  for (let hop = 0; hop < NEIGHBOURHOOD_HOPS; hop++) {
    const res = await edgesIncidentTo(admin, frontier);
    // A partial walk would silently amputate the far side of the tree, so a
    // failed hop makes the whole answer unknown rather than short.
    if (!res.ok) return UNKNOWN_KIN;
    const next: string[] = [];
    for (const r of res.rows) {
      rows.push(r);
      for (const id of [r.from_person_id, r.to_person_id]) {
        if (isPersonId(id) && !seen.has(id)) {
          seen.add(id);
          next.push(id);
        }
      }
    }
    if (next.length === 0) break;
    frontier = next;
  }

  return { kin: deriveKin(myPerson, toStoredEdges(rows)), measured: true };
}

/**
 * Names for derived kin, through the ONE function allowed to resolve them.
 *
 * Returns a partial map: a person absent from it has no name the viewer may
 * see, and the renderer shows the kin word alone. A failed RPC yields an empty
 * map, which renders the same way — a placeholder asserts nothing false either
 * way, which is why this does not make the tree unmeasured.
 */
export async function namesForKin(
  supabase: SupabaseClient,
  personIds: readonly string[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const ids = [...new Set(personIds.filter(isPersonId))];
  if (ids.length === 0) return names;
  const { data, error } = await supabase.rpc('visible_connection_names', {
    p_person_ids: ids,
  });
  if (error) {
    logQueryError('kinshipNeighbourhood.names', error, {}, 'graceful_degrade');
    return names;
  }
  for (const r of (data ?? []) as Array<{ person_id: string; display_name: string | null }>) {
    const label = (r.display_name ?? '').trim();
    if (label) names.set(r.person_id, label);
  }
  return names;
}
