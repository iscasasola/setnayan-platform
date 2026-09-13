/**
 * lib/kinship-tree.ts — the RENDERER's half of the kin graph. Pure.
 *
 * `kinship-derive.ts` answers "who is who to me". It shipped on 2026-07-31 and
 * then sat with NO CONSUMER: `git grep -l kinship-derive` returned the module
 * and its own test and nothing else, so the hardest thinking in the product
 * reached no screen. This module is the missing half — it takes `DerivedKin[]`
 * and arranges it for a person to read.
 *
 * ── THE OWNER RULED THIS A RENDERING PROBLEM, IN THESE WORDS ────────────────
 * Courtesy kin are unbounded on purpose (owner, 2026-07-31: *"yes tita can be
 * most"*). The DECISION_LOG row for that day states the consequence exactly:
 *
 *   > That makes it a RENDERING problem (blood must not be crowded out), not a
 *   > rule problem.
 *
 * and `Kin_Graph_Adoption_and_Deltas_SPEC_2026-07-30.md` §5 repeats it: "a tree
 * where courtesy titas outnumber blood relations must not let them crowd the
 * blood layer out."
 *
 * So the volume rule lives HERE, and it is one-directional:
 *
 *   · blood and ritual are ALWAYS shown in full — they never collapse.
 *   · courtesy is the only layer with a preview cap, because it is the only one
 *     that grows without bound.
 *
 * Capping blood to make room for courtesy would be the precise defect the owner
 * named. `collapseAfter` is therefore null for blood and ritual by construction,
 * not by configuration.
 *
 * ⚠ NO HOP CAP AND NO CLOSENESS FILTER ARE ADDED — not here and not in
 * `kinship-derive.ts`. Everything derived is present in `people`; the cap is a
 * DISCLOSURE default on one layer, and the count of what is behind it is always
 * stated so the number is never hidden.
 *
 * ── A NAME IS NOT OURS TO SHOW ─────────────────────────────────────────────
 * `name: null` means the owner-signed-off name-visibility rule (2026-07-05) does
 * not permit this person's name to us — they share no CONFIRMED edge with the
 * viewer. The spec is explicit (§6): *"Names only where permitted — an
 * unconfirmed or unconsented node shows as a placeholder, never a name."*
 * A renderer that substitutes an id, an email, or a guess for a null name has
 * broken that rule. Null renders as the kin word alone.
 */
import { type DerivedKin, type KinBasis, type KinKind } from '@/lib/kinship-derive';

export type KinPerson = {
  personId: string;
  /** The kin word — "Tito/Tita", "Lolo/Lola". Paired unless sex is known. */
  label: string;
  kind: KinKind;
  basis: KinBasis;
  distance: number;
  /** Their name, or NULL when the name rule does not permit it. Never guess. */
  name: string | null;
  /** "your parent’s sibling" — the chain that produced the label. */
  via: string;
};

export type KinLayer = {
  basis: KinBasis;
  title: string;
  blurb: string;
  people: KinPerson[];
  /**
   * How many to show before a disclosure. NULL = show every one, always.
   * Only the courtesy layer is ever capped — see the header.
   */
  collapseAfter: number | null;
};

export type KinTree = {
  /** Always blood → ritual → courtesy. Empty layers are dropped. */
  layers: KinLayer[];
  total: number;
};

/**
 * Blood first, ALWAYS. The order is a constant rather than a sort comparator so
 * that "blood must not be crowded out" cannot be reversed by a data change.
 */
export const LAYER_ORDER: readonly KinBasis[] = ['blood', 'ritual', 'courtesy'];

/**
 * How many courtesy kin to show before the disclosure. Courtesy grows with
 * every friend's parent, so this is the only layer that needs a default —
 * and the remainder is COUNTED in the summary, never silently dropped.
 */
export const COURTESY_PREVIEW = 6;

const LAYER_COPY: Record<KinBasis, { title: string; blurb: string }> = {
  blood: {
    title: 'Family',
    blurb: 'Worked out from the closest people you’ve each confirmed.',
  },
  ritual: {
    title: 'Ninong · Ninang',
    blurb: 'Your godparents and godchildren, as confirmed by both of you.',
  },
  courtesy: {
    title: 'Tito · Tita by courtesy',
    blurb:
      'The parents of your friends, and your friends’ children. The same words as family, and not the same fact.',
  },
};

/**
 * The chain, as a phrase a person can read: ['parent','sibling'] becomes
 * "your parent’s sibling". Generic on purpose — every chain `kinship-derive.ts`
 * produces is a possessive walk outwards from you, so no per-chain table can
 * fall out of step with the module.
 */
export function viaPhrase(via: readonly string[]): string {
  if (via.length === 0) return 'you';
  return `your ${via.join('’s ')}`;
}

/**
 * Arrange derived kin into the three layers, in the locked order.
 *
 * `nameOf` returns NULL for anyone whose name the viewer may not see. It is
 * passed in rather than read here so this module stays pure and the name rule
 * stays in one place — the `visible_connection_names` RPC.
 */
export function buildKinTree(
  kin: readonly DerivedKin[],
  nameOf: (personId: string) => string | null = () => null,
): KinTree {
  const byBasis = new Map<KinBasis, KinPerson[]>();

  for (const k of kin) {
    const list = byBasis.get(k.basis) ?? [];
    list.push({
      personId: k.personId,
      label: k.label,
      kind: k.kind,
      basis: k.basis,
      distance: k.distance,
      name: nameOf(k.personId),
      via: viaPhrase(k.via),
    });
    byBasis.set(k.basis, list);
  }

  const layers: KinLayer[] = [];
  for (const basis of LAYER_ORDER) {
    const people = byBasis.get(basis);
    if (!people || people.length === 0) continue;
    // Closest first, then by the kin word, so a layer reads in a stable order
    // whatever order the derivation happened to emit.
    people.sort((a, b) => a.distance - b.distance || a.label.localeCompare(b.label));
    layers.push({
      basis,
      title: LAYER_COPY[basis].title,
      blurb: LAYER_COPY[basis].blurb,
      people,
      // The one-directional rule. Blood and ritual are never capped.
      collapseAfter: basis === 'courtesy' ? COURTESY_PREVIEW : null,
    });
  }

  return { layers, total: kin.length };
}
