/**
 * WHO HANDLES A NEW CLIENT — the decision, with no reads (supplier roles d–h, #8013 drawing (e)/(f)).
 *
 * Decided (do not re-ask): the drawing's "Decided 19 Nov" boxes + controller answers 21 Nov (rows 2, 3):
 *   ① the card's Account Managers on the card's branch, split fair by last name (lib/inquiry-split.ts);
 *   ② that one is away (a paused seat) → the next Account Manager in the branch, then the Branch Manager;
 *   ③ a card no Account Manager covers → the branch's Branch Manager; with no Branch Manager → the Shop Manager;
 *   ④ nothing matches at all → the Shop Manager.
 * A client already handled by someone keeps them; a second card that person does not cover marks "Hand over" to that
 * card's pick (drawing (f): "Joy had Santiago first and keeps them until someone hands the account over").
 */
import { fairSplit, pickAccountManager, MAX_ACCOUNT_MANAGERS_PER_CARD, type SplitMember } from './inquiry-split';

export type RoutingMember = {
  memberId: string;
  duty: string;
  /** NULL = the main shop. */
  branchId: string | null;
  paused: boolean;
  /** ISO — the order "next" and "first" follow (oldest seat first). */
  createdAt: string;
};

export type AdjustedCut = { memberId: string; from: string; to: string | null };

export type RoutingInput = {
  /** The branch the card is filed under (NULL = main). */
  cardBranchId: string | null;
  /** Account Managers who cover this card (vendor_service_agents), any branch — narrowed here. */
  cardCoverIds: ReadonlyArray<string>;
  team: ReadonlyArray<RoutingMember>;
  /** The cuts a manager adjusted for this card + branch + event type (or "every other event"), if any. */
  adjusted: ReadonlyArray<AdjustedCut>;
  /** The counts the fair split is cut from (own or all-Setnayan — the caller chose). */
  counts: ReadonlyMap<string, number>;
  lastName: string | null;
  /** Who handles this client now, if anyone (a resumed or second inquiry). */
  currentHandlerId: string | null;
};

export type RoutingDecision =
  | { kind: 'assign'; memberId: string; why: string }
  | { kind: 'keep'; memberId: string }
  | { kind: 'hand-over'; keepId: string; offerId: string }
  | { kind: 'nobody' };

const byAge = (a: RoutingMember, b: RoutingMember) => a.createdAt.localeCompare(b.createdAt);
const sameBranch = (m: RoutingMember, branch: string | null) => (m.branchId ?? null) === (branch ?? null);

/** The Shop Manager who takes what nothing else matches — the oldest active one. */
function shopManagerOf(team: ReadonlyArray<RoutingMember>): string | null {
  return [...team].filter((m) => m.duty === 'shop_manager' && !m.paused).sort(byAge)[0]?.memberId ?? null;
}

/** Pick for a brand-new client on this card (no current handler considered). */
export function pickForCard(input: Omit<RoutingInput, 'currentHandlerId'>): { memberId: string; why: string } | null {
  const branch = input.cardBranchId ?? null;
  const cover = new Set(input.cardCoverIds);
  const ams = input.team.filter((m) => m.duty === 'account_manager' && sameBranch(m, branch)).sort(byAge);
  const onCard = ams.filter((m) => cover.has(m.memberId)).slice(0, MAX_ACCOUNT_MANAGERS_PER_CARD);
  const branchManager = input.team.filter((m) => m.duty === 'branch_manager' && sameBranch(m, branch) && !m.paused).sort(byAge)[0] ?? null;
  const away = new Set(input.team.filter((m) => m.paused).map((m) => m.memberId));

  if (onCard.length > 0) {
    // The adjusted cuts win when they cover exactly today's people on the card; otherwise the fair split.
    const adjustedFits =
      input.adjusted.length === onCard.length && input.adjusted.every((c) => onCard.some((m) => m.memberId === c.memberId));
    const split: SplitMember[] = adjustedFits
      ? [...input.adjusted].sort((a, b) => a.from.localeCompare(b.from)).map((c) => ({ memberId: c.memberId, block: { from: c.from, to: c.to } }))
      : fairSplit(input.counts, onCard.length).map((b, i) => ({ memberId: onCard[i]!.memberId, block: b }));
    const pick = pickAccountManager({
      lastName: input.lastName,
      split,
      branchAccountManagers: ams.map((m) => m.memberId),
      branchManagerId: branchManager?.memberId ?? null,
      away,
    });
    if (pick.memberId) return { memberId: pick.memberId, why: pick.why };
  }
  // ③ nobody on the card (or everyone on it and in the branch away): the Branch Manager, then the Shop Manager.
  if (branchManager) return { memberId: branchManager.memberId, why: 'card-uncovered-branch-manager' };
  const sm = shopManagerOf(input.team);
  return sm ? { memberId: sm, why: 'shop-manager' } : null;
}

/** The whole decision for an inquiry: keep the client's person, mark a hand-over, or give a new client one. */
export function decideHandler(input: RoutingInput): RoutingDecision {
  const current = input.currentHandlerId ? input.team.find((m) => m.memberId === input.currentHandlerId) ?? null : null;
  if (current) {
    const coversThisCard = input.cardCoverIds.includes(current.memberId);
    const runsIt = current.duty === 'shop_manager' || (current.duty === 'branch_manager' && sameBranch(current, input.cardBranchId));
    if (coversThisCard || runsIt || current.duty !== 'account_manager') return { kind: 'keep', memberId: current.memberId };
    const other = pickForCard(input);
    if (other && other.memberId !== current.memberId && input.team.find((m) => m.memberId === other.memberId)?.duty === 'account_manager') {
      return { kind: 'hand-over', keepId: current.memberId, offerId: other.memberId };
    }
    return { kind: 'keep', memberId: current.memberId };
  }
  const pick = pickForCard(input);
  return pick ? { kind: 'assign', memberId: pick.memberId, why: pick.why } : { kind: 'nobody' };
}
