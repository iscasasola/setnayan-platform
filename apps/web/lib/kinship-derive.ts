/**
 * lib/kinship-derive.ts — extended kin, DERIVED from the seven stored relations.
 *
 * ── THE CONTRACT ───────────────────────────────────────────────────────────
 * `person_connections` stores first-degree family only. Its table comment is
 * explicit: "Family first-degree only; extended kin derived." So lolo, lola,
 * tito, tita, pinsan, pamangkin, apo and the in-law terms are never rows — they
 * are computed from spouse / parent / child / sibling / godparent / godchild /
 * friend, and the stored vocabulary is FROZEN at those seven (owner, OD7).
 *
 * ── EDGE DIRECTION, WHICH IS EASY TO GET BACKWARDS ─────────────────────────
 * From the migration: `relation` = **what to_person IS to from_person**.
 * So (me, X, 'parent') means X is MY parent, not that I am X's.
 *
 * ── TWO CLASSES OF KIN, AND WHY IT MATTERS ─────────────────────────────────
 * Owner, 2026-07-30, on how someone becomes a tita:
 *
 *   > "they will only become an aunt if they are the brothers/sisters of their
 *   >  parents… and if they are parents of their friends. these are aunts as well"
 *
 * So a tito/tita arises TWO ways:
 *   · BLOOD    — sibling of a parent
 *   · COURTESY — parent of a friend
 *
 * This is the Philippine courtesy-kinship model, and no generic family-tree
 * design accounts for it. Two consequences shape this module:
 *
 *   1. The FRIEND layer feeds the FAMILY labels. Drop friends and half the
 *      kinship disappears. (This reversed an earlier spec line saying friends
 *      did not belong on the tree.)
 *   2. Every derived relation carries a `basis`. "My mother's sister" and "my
 *      mother's best friend" are both tita and are NOT the same fact; the UI
 *      must be able to tell them apart even though the word is identical.
 *
 * Unbounded is correct (owner, 2026-07-31: "yes tita can be most"). No closeness
 * filter, no hop cap. Volume is true to life; managing it is the renderer's job,
 * not this module's.
 *
 * ── ONLY CONFIRMED EDGES DERIVE ────────────────────────────────────────────
 * A `draft` is private to its author and a `pending` claim is unanswered. Neither
 * is an established fact, so neither may produce kinship. Deriving from pending
 * would let one person unilaterally populate another's tree — the same class of
 * problem the forgery fix closed at the database level.
 *
 * PURE: no I/O, no database, no clock. Provably inert on zero edges, which is
 * what makes it safe to ship while the counsel gate is still closed.
 */

/** The seven stored relations. Frozen — see OD7. */
export type StoredRelation =
  | 'spouse'
  | 'parent'
  | 'child'
  | 'sibling'
  | 'godparent'
  | 'godchild'
  | 'friend';

export type ConnectionStatus = 'draft' | 'pending' | 'confirmed' | 'declined';

export interface StoredEdge {
  fromPersonId: string;
  toPersonId: string;
  /** What `toPersonId` IS to `fromPersonId`. */
  relation: StoredRelation;
  status: ConnectionStatus;
}

/** Known sex, where we hold it. Absent for unclaimed people — see OD6. */
export type Sex = 'M' | 'F' | null | undefined;

/**
 * How a derived relation came about.
 *
 * `blood` — through parent/child/sibling/spouse edges.
 * `ritual` — through godparent/godchild (the ninong/ninang layer).
 * `courtesy` — through a friend edge, e.g. a friend's parent.
 */
export type KinBasis = 'blood' | 'ritual' | 'courtesy';

export interface DerivedKin {
  personId: string;
  /** Gendered where sex is known, paired otherwise ("Lolo/Lola"). */
  label: string;
  /** Stable, ungendered key for grouping and translation. */
  kind: KinKind;
  basis: KinBasis;
  /** Degrees of separation. Not a cap — only a sort key. */
  distance: number;
  /** The chain that produced it, for "why is this person here?". */
  via: string[];
}

export type KinKind =
  | 'grandparent'
  | 'grandchild'
  | 'parent-sibling'
  | 'nibling'
  | 'cousin'
  | 'godparent'
  | 'godchild'
  | 'sibling-in-law'
  | 'co-parent-in-law';

/** [male, female, neutral-pair] */
const LABELS: Record<KinKind, [string, string, string]> = {
  grandparent: ['Lolo', 'Lola', 'Lolo/Lola'],
  grandchild: ['Apo', 'Apo', 'Apo'],
  'parent-sibling': ['Tito', 'Tita', 'Tito/Tita'],
  nibling: ['Pamangkin', 'Pamangkin', 'Pamangkin'],
  cousin: ['Pinsan', 'Pinsan', 'Pinsan'],
  godparent: ['Ninong', 'Ninang', 'Ninong/Ninang'],
  godchild: ['Inaanak', 'Inaanak', 'Inaanak'],
  'sibling-in-law': ['Bayaw', 'Hipag', 'Bayaw/Hipag'],
  'co-parent-in-law': ['Balae', 'Balae', 'Balae'],
};

/**
 * The label for a kind, gendered when we know the person's sex.
 *
 * OD6: sex lives on `users` (with its own consent stamp) and on `dependents`,
 * NOT on `people` — and `people` can hold someone with no account. So a tree
 * legitimately shows a MIX of gendered and paired labels. That should read as
 * deliberate, not broken.
 */
export function kinLabel(kind: KinKind, sex: Sex): string {
  const [m, f, neutral] = LABELS[kind];
  if (sex === 'M') return m;
  if (sex === 'F') return f;
  return neutral;
}

/** Inverse of each stored relation — the same edge read from the other end. */
const INVERSE: Record<StoredRelation, StoredRelation> = {
  parent: 'child',
  child: 'parent',
  sibling: 'sibling',
  spouse: 'spouse',
  godparent: 'godchild',
  godchild: 'godparent',
  friend: 'friend',
};

type Adjacency = Map<string, Array<{ to: string; relation: StoredRelation }>>;

/**
 * Bidirectional adjacency from confirmed edges only.
 *
 * Each stored edge is walkable both ways with its relation inverted, because
 * "X is my parent" and "I am X's child" are one fact recorded once.
 */
export function buildAdjacency(edges: readonly StoredEdge[]): Adjacency {
  const adj: Adjacency = new Map();
  const push = (from: string, to: string, relation: StoredRelation) => {
    const list = adj.get(from) ?? [];
    list.push({ to, relation });
    adj.set(from, list);
  };
  for (const e of edges) {
    if (e.status !== 'confirmed') continue; // drafts and pending are not facts
    if (e.fromPersonId === e.toPersonId) continue;
    push(e.fromPersonId, e.toPersonId, e.relation);
    push(e.toPersonId, e.fromPersonId, INVERSE[e.relation]);
  }
  return adj;
}

const neighbours = (adj: Adjacency, id: string, relation: StoredRelation): string[] =>
  (adj.get(id) ?? []).filter((n) => n.relation === relation).map((n) => n.to);

/**
 * Every extended relation derivable for one person.
 *
 * Ego-centric by design: this answers "who is who to ME", never "map the
 * platform". Results are deduplicated per (person, kind), keeping the shortest
 * chain and preferring `blood` over `courtesy` when both reach the same person —
 * your friend's mother who is also your aunt is your aunt.
 */
export function deriveKin(
  egoPersonId: string,
  edges: readonly StoredEdge[],
  sexOf: (personId: string) => Sex = () => null,
): DerivedKin[] {
  const adj = buildAdjacency(edges);
  const out = new Map<string, DerivedKin>();

  const add = (
    personId: string,
    kind: KinKind,
    basis: KinBasis,
    distance: number,
    via: string[],
  ) => {
    if (personId === egoPersonId) return;
    const key = `${personId}|${kind}`;
    const existing = out.get(key);
    if (existing) {
      const better =
        (existing.basis === 'courtesy' && basis !== 'courtesy') ||
        (existing.basis === basis && distance < existing.distance);
      if (!better) return;
    }
    out.set(key, { personId, kind, basis, distance, via, label: kinLabel(kind, sexOf(personId)) });
  };

  const parents = neighbours(adj, egoPersonId, 'parent');
  const children = neighbours(adj, egoPersonId, 'child');
  const siblings = neighbours(adj, egoPersonId, 'sibling');
  const spouses = neighbours(adj, egoPersonId, 'spouse');
  const friends = neighbours(adj, egoPersonId, 'friend');

  // ── ritual: stored, surfaced rather than derived ─────────────────────────
  for (const g of neighbours(adj, egoPersonId, 'godparent')) {
    add(g, 'godparent', 'ritual', 1, ['godparent']);
  }
  for (const g of neighbours(adj, egoPersonId, 'godchild')) {
    add(g, 'godchild', 'ritual', 1, ['godchild']);
  }

  // ── blood ────────────────────────────────────────────────────────────────
  for (const p of parents) {
    for (const gp of neighbours(adj, p, 'parent')) add(gp, 'grandparent', 'blood', 2, ['parent', 'parent']);
    // A parent's sibling is a tito/tita — rule 1.
    for (const ps of neighbours(adj, p, 'sibling')) {
      add(ps, 'parent-sibling', 'blood', 2, ['parent', 'sibling']);
      for (const cousin of neighbours(adj, ps, 'child')) {
        add(cousin, 'cousin', 'blood', 3, ['parent', 'sibling', 'child']);
      }
    }
  }
  for (const c of children) {
    for (const gc of neighbours(adj, c, 'child')) add(gc, 'grandchild', 'blood', 2, ['child', 'child']);
    // Your child's spouse's parents are your balae.
    for (const cs of neighbours(adj, c, 'spouse')) {
      for (const inlaw of neighbours(adj, cs, 'parent')) {
        add(inlaw, 'co-parent-in-law', 'blood', 3, ['child', 'spouse', 'parent']);
      }
    }
  }
  for (const s of siblings) {
    for (const n of neighbours(adj, s, 'child')) add(n, 'nibling', 'blood', 2, ['sibling', 'child']);
  }
  for (const sp of spouses) {
    for (const sib of neighbours(adj, sp, 'sibling')) {
      add(sib, 'sibling-in-law', 'blood', 2, ['spouse', 'sibling']);
    }
  }

  // ── courtesy: the rule generic family trees miss ─────────────────────────
  // A friend's parent is a tito/tita too — rule 2. Deliberately unbounded:
  // "yes tita can be most" (owner). Volume here is correct, not a defect.
  for (const f of friends) {
    for (const fp of neighbours(adj, f, 'parent')) {
      add(fp, 'parent-sibling', 'courtesy', 2, ['friend', 'parent']);
    }
    // The symmetric case: your friends' children call you tito/tita, so their
    // children are your pamangkin by the same courtesy.
    for (const fc of neighbours(adj, f, 'child')) {
      add(fc, 'nibling', 'courtesy', 2, ['friend', 'child']);
    }
  }

  return [...out.values()].sort(
    (a, b) => a.distance - b.distance || a.label.localeCompare(b.label),
  );
}

/** Just the tito/tita set, the relation the owner specified in detail. */
export function derivedTitoTita(
  egoPersonId: string,
  edges: readonly StoredEdge[],
  sexOf: (personId: string) => Sex = () => null,
): DerivedKin[] {
  return deriveKin(egoPersonId, edges, sexOf).filter((k) => k.kind === 'parent-sibling');
}
