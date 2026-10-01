/**
 * lib/kinship-derive.ts — extended kin, DERIVED from the eight stored relations.
 *
 * ── THE CONTRACT ───────────────────────────────────────────────────────────
 * `person_connections` stores first-degree family only. Its table comment is
 * explicit: "Family first-degree only; extended kin derived." So lolo, lola,
 * tito, tita, pinsan, pamangkin, apo and the in-law terms are never rows — they
 * are computed from spouse / parent / child / sibling / godparent / godchild /
 * friend / partner. The vocabulary was FROZEN at seven (owner, OD7, 2026-07-30)
 * and the owner himself opened it once, for one word (2026-09-29):
 *
 *   > "add partner (to become a couple)"
 *
 * ── A PARTNER MAKES IN-LAWS, EXACTLY AS A SPOUSE DOES ──────────────────────
 * Your partner's parents are your biyenan, their siblings your bayaw/hipag —
 * and the other way round: to your partner's parents you are their manugang,
 * to their siblings a bayaw/hipag. So every in-law rule below walks the
 * COUPLE — spouse OR partner — never spouse alone. The couple is the shape
 * that makes in-laws; the paperwork does not.
 *
 * ── A LABEL NOBODY AGREED TO DERIVES NOTHING ───────────────────────────────
 * Owner, 2026-09-29: *"assigning a label needs a handshake"*. An ASKED label
 * lives in `person_connections.proposed_relation` and never reaches this
 * module — the readers pass `relation` from confirmed rows only, and on a
 * confirmed row `relation` changes only when the person it is about accepts.
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

/** The eight stored relations — OD7's seven, plus partner (owner 2026-09-29). */
export type StoredRelation =
  | 'spouse'
  | 'parent'
  | 'child'
  | 'sibling'
  | 'godparent'
  | 'godchild'
  | 'friend'
  | 'partner';

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
  | 'parent-in-law'
  | 'child-in-law'
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
  // Biyenan and manugang are not gendered in Tagalog, so all three agree.
  'parent-in-law': ['Biyenan', 'Biyenan', 'Biyenan'],
  'child-in-law': ['Manugang', 'Manugang', 'Manugang'],
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
  partner: 'partner',
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

/** The two relations that make a couple — and so make in-laws. */
export const COUPLE_RELATIONS: readonly StoredRelation[] = ['spouse', 'partner'];

/**
 * Everyone `id` is a couple with, each once, with the word that joins them.
 * Spouse wins over partner when a pair holds both (they married): the chain
 * then says "spouse", which is the truer word.
 */
function couplesOf(adj: Adjacency, id: string): Array<{ to: string; relation: StoredRelation }> {
  const out = new Map<string, StoredRelation>();
  for (const n of adj.get(id) ?? []) {
    if (!COUPLE_RELATIONS.includes(n.relation)) continue;
    if (out.get(n.to) === 'spouse') continue;
    out.set(n.to, n.relation);
  }
  return [...out].map(([to, relation]) => ({ to, relation }));
}

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
  // THE COUPLE — spouse or partner. Every in-law rule walks this, never
  // spouse alone (see "A PARTNER MAKES IN-LAWS" in the header).
  const couples = couplesOf(adj, egoPersonId);
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
    for (const cs of couplesOf(adj, c)) {
      const word = cs.relation;
      // Your child's spouse or partner is your manugang…
      add(cs.to, 'child-in-law', 'blood', 2, ['child', word]);
      // …and their parents are your balae.
      for (const inlaw of neighbours(adj, cs.to, 'parent')) {
        add(inlaw, 'co-parent-in-law', 'blood', 3, ['child', word, 'parent']);
      }
    }
  }
  for (const s of siblings) {
    for (const n of neighbours(adj, s, 'child')) add(n, 'nibling', 'blood', 2, ['sibling', 'child']);
    // Your sibling's spouse or partner is your bayaw/hipag — the "vice versa"
    // of the rule below, read from the other side of the same couple.
    for (const ss of couplesOf(adj, s)) {
      add(ss.to, 'sibling-in-law', 'blood', 2, ['sibling', ss.relation]);
    }
  }
  for (const sp of couples) {
    // Your spouse's or partner's parents are your biyenan…
    for (const pil of neighbours(adj, sp.to, 'parent')) {
      add(pil, 'parent-in-law', 'blood', 2, [sp.relation, 'parent']);
    }
    // …and their siblings your bayaw/hipag.
    for (const sib of neighbours(adj, sp.to, 'sibling')) {
      add(sib, 'sibling-in-law', 'blood', 2, [sp.relation, 'sibling']);
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
