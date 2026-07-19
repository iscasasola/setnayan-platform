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
  | 'friend';

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
      // spouse · parent · child · sibling
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
];

/**
 * OFF until PH counsel clears Phase 2 and the owner flips the env flag. Kept as a
 * function (not a module const) so it's re-read per request rather than captured.
 */
export function peopleConnectionsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PEOPLE_CONNECTIONS === '1';
}
