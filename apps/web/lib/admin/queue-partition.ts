/**
 * Split the admin's day into what needs doing and what does not.
 *
 * 🔑 A CLEAR QUEUE MUST NOT COST THE SAME SCREEN AS A WAITING ONE. The owner's
 * complaint about the admin was *"so many buttons and menus"* — and most of that
 * mass is queues with nothing in them, each taking a full card. Collapsing the
 * clear ones behind one line is the largest honest density win on the work list:
 * nothing is hidden, it is summarised, and every queue is still one click away.
 *
 * ⚠ `count === null` MEANS "NO COUNT AVAILABLE", NOT "ZERO". Those rows are a
 * doorway, not a verdict. Filing one under "N queues are clear" would put an
 * unmeasured queue in the one place a reader has been told they need not look.
 *
 * WHY THIS IS ITS OWN MODULE, and not a helper inside the feed component: the
 * component imports the queue drawer, which imports `server-only`, so anything
 * living beside it can only be tested by rendering. A rule about what an admin
 * is SHOWN deserves a test that can fail cheaply — and a rule that cannot fail
 * is not a rule. No imports here on purpose; keep it that way.
 */

/** Structural, not imported — see the note above about staying dependency-free. */
type Partitionable = { dueState?: string | undefined; count?: number | null };

export function partitionQueues<T extends Partitionable>(
  items: readonly T[],
): { overdue: T[]; waiting: T[]; clear: T[] } {
  const overdue: T[] = [];
  const waiting: T[] = [];
  const clear: T[] = [];
  for (const i of items) {
    if (i.dueState === 'overdue') overdue.push(i);
    else if (i.count === 0) clear.push(i);
    else waiting.push(i);
  }
  return { overdue, waiting, clear };
}
