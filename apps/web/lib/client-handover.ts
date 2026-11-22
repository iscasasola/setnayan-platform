/**
 * WHO MAY MOVE A CLIENT (supplier roles d–h, #8013 (f) + controller row 6, 21 Nov):
 *   · "Keep with …" / "Give to …" on a Hand over mark — the person who has the client, or a Shop / Branch Manager.
 *     The receiver doesn't have to accept.
 *   · "Handled by ▾" (move any client) — a Shop Manager, or the Branch Manager of the card's branch.
 * No reads here; the server resolves the caller and the client, then asks.
 */
export type HandoverCaller = {
  /** NULL for the shop's founder with no seat row (always a Shop Manager). */
  memberId: string | null;
  duty: string;
  branchId: string | null;
};

const runsBranch = (c: HandoverCaller, branch: string | null) =>
  c.duty === 'shop_manager' || (c.duty === 'branch_manager' && (c.branchId ?? null) === (branch ?? null));

export function mayMoveClient(caller: HandoverCaller, cardBranchId: string | null): boolean {
  return runsBranch(caller, cardBranchId);
}

export function mayAnswerHandOver(caller: HandoverCaller, holderId: string | null, cardBranchId: string | null): boolean {
  return (caller.memberId !== null && caller.memberId === holderId) || runsBranch(caller, cardBranchId);
}

export type HandoverOp = 'keep' | 'give' | 'move';

/** What one op writes: the new handler (unchanged = null) and whether the client is told (one Setnayan line). */
export function handoverWrite(
  op: HandoverOp,
  state: { handledBy: string | null; handOver: string | null },
  moveTo: string | null,
): { handledBy: string | null; tellClient: boolean } | null {
  if (op === 'keep') return state.handOver ? { handledBy: state.handledBy, tellClient: false } : null;
  if (op === 'give') return state.handOver ? { handledBy: state.handOver, tellClient: true } : null;
  if (!moveTo || moveTo === state.handledBy) return null;
  return { handledBy: moveTo, tellClient: true };
}
