/**
 * Person-spine · Phase 2 · connections flow helpers + feature flag.
 *
 * ⚠ PHASE 2 IS COUNSEL-GATED. `peopleConnectionsEnabled()` defaults OFF. The
 * suggest→confirm flow (proposeConnection / confirmConnection / declineConnection
 * in the People `actions.ts`) is guarded by this flag, so it is INERT in
 * production and stores NO relationship data until PH counsel signs off and the
 * owner sets `NEXT_PUBLIC_PEOPLE_CONNECTIONS=1` as a Vercel project env var.
 * See 03_Strategy/People_Graph_and_Lifelong_Identity_2026-07-04.md §11.
 */

export type ConnectionRelation =
  | 'spouse'
  | 'parent'
  | 'child'
  | 'sibling'
  | 'godparent'
  | 'godchild'
  | 'friend'
  | 'partner';

/**
 * EVERY stored relation, in one list — the database's
 * `person_connections_relation_check` holds exactly these (migration
 * 20271254271392). `partner` is the owner's 2026-09-29 addition: *"add partner
 * (to become a couple)"*. `vocabulary-is-one-list.test.ts` pins this list to the
 * CHECK, to the kinship reader and to the derivation, so a word added in one
 * place and forgotten in another goes red instead of silently deriving nothing.
 */
export const CONNECTION_RELATIONS: readonly ConnectionRelation[] = [
  'spouse',
  'parent',
  'child',
  'sibling',
  'godparent',
  'godchild',
  'friend',
  'partner',
];

/**
 * The same edge, read from the OTHER side. `relation` is what to_person IS to
 * from_person, so if Ana says Ben is her Parent, Ben is asked to confirm Ana as
 * his Child — never shown "Parent" about somebody who is his daughter.
 */
export const INVERSE_RELATION: Record<ConnectionRelation, ConnectionRelation> = {
  spouse: 'spouse',
  parent: 'child',
  child: 'parent',
  sibling: 'sibling',
  godparent: 'godchild',
  godchild: 'godparent',
  friend: 'friend',
  partner: 'partner',
};

/** What the other person is to ME, given the row and which side I am on. */
export function relationForViewer(
  relation: ConnectionRelation | null,
  viewerIsDeclarer: boolean,
): ConnectionRelation | null {
  if (!relation) return null;
  return viewerIsDeclarer ? relation : INVERSE_RELATION[relation];
}

export type ConnectionLayer = 'family' | 'ritual' | 'friend';

/** Family is first-degree blood/affinal; ritual = ninong/ninang; friend = friend. */
export function layerForRelation(relation: ConnectionRelation): ConnectionLayer {
  switch (relation) {
    case 'godparent':
    case 'godchild':
      return 'ritual';
    case 'friend':
      return 'friend';
    default:
      // spouse · parent · child · sibling · partner
      return 'family';
  }
}

/** The relations a person can declare directly (first-degree only — extended kin
 *  is derived, never declared). Ritual + friend added; godchild is created by the
 *  ceremony/other side, so it's not in the manual "add" set. */
export const DECLARABLE_RELATIONS: ConnectionRelation[] = [
  'spouse',
  'parent',
  'sibling',
  'child',
  'godparent',
  'friend',
  'partner',
];

/**
 * OFF until PH counsel clears Phase 2 and the owner flips the env flag. Kept as a
 * function (not a module const) so it's re-read per request rather than captured.
 */
export function peopleConnectionsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PEOPLE_CONNECTIONS === '1';
}
