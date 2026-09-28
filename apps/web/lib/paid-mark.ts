/**
 * apps/web/lib/paid-mark.ts
 *
 * THE PAID MARK'S DECISION — which of the two marks a paid-to-unlock control
 * wears, or none at all. The component (`app/_components/paid-mark.tsx`) only
 * draws the answer; every caller asks HERE, so the rule is one function and
 * the tests (`paid-mark.test.ts`) pin it once.
 *
 * Owner, verbatim (2026-09-25): *"for all parts that are Paid to unlock, let us
 * use the padlock icon. and a diamond icon when unlocked"* — DECISION_LOG row
 * "PAID-TO-UNLOCK PARTS WEAR A PADLOCK; UNLOCKED ONES WEAR A DIAMOND".
 *
 *   • padlock  → the couple / shop does NOT own it yet (a door to buy)
 *   • diamond  → they DO own it (paid, or granted — owned is owned)
 *
 * 🔒 THE APP-STORE SHELL RULE IS UNCHANGED (`lib/store-shell.ts`): inside the
 * store-distributed shell a paid door is ABSENT — no padlock, no purchase hint —
 * so `locked` collapses to `null` there. An OWNED mark is not a purchase hint
 * (nothing is for sale behind it), so the diamond still shows in the shell.
 *
 * ⚠ `owns` MUST BE A MEASURED ENTITLEMENT, never a default. `lib/event-hub-pro.ts`
 * records why: a gate that can only ever answer one way renders identically to a
 * gate that works. Pass the caller's real `ownsPro` / `entitled` boolean.
 */

/**
 *   • try      → ◆ PRO — a Pro control the couple may USE before paying: its
 *                pick lives in the Event Hub Maker's draft and Apply asks for
 *                Pro (owner 2026-09-28, verbatim: *"they can edit it with pro
 *                features. but need to upgrade to pro when clicked on apply"*;
 *                DECISION_LOG "A FREE COUPLE MAY USE EVERY PRO FEATURE IN THE
 *                MAKER …": *"Small ◆ PRO marks stay on the controls as
 *                information, never as a lock."*). Information, never a door.
 */
export type PaidMarkState = 'locked' | 'unlocked' | 'try';

export function paidMarkState({
  owns,
  storeShell = false,
  tryable = false,
}: {
  /** The caller's MEASURED entitlement — true once the feature is paid / granted. */
  owns: boolean;
  /** Inside the app-store shell a locked door is absent — no padlock. */
  storeShell?: boolean;
  /**
   * The control works before paying (a Maker control whose pick is drafted and
   * held at Apply) — it wears ◆ PRO, not a padlock. Still absent in the store
   * shell: a Pro hint there is a purchase hint.
   */
  tryable?: boolean;
}): PaidMarkState | null {
  if (owns) return 'unlocked';
  if (storeShell) return null;
  return tryable ? 'try' : 'locked';
}

/**
 * 💎 A Pro control in the Event Hub MAKER: its mark, and whether it can be used.
 * Usable by everyone on the web (the pick is drafted; Apply is the gate —
 * `planHubDraftApply`); in the app-store shell a couple without Pro is not
 * shown it at all (the shell rule above, unchanged).
 */
export function makerProMark({ owns, storeShell }: { owns: boolean; storeShell: boolean }): PaidMarkState | null {
  return paidMarkState({ owns, storeShell, tryable: true });
}
export function makerProUsable({ owns, storeShell }: { owns: boolean; storeShell: boolean }): boolean {
  return owns || !storeShell;
}

/** The accessible name for a mark, when the caller has no better one. */
export function paidMarkLabel(state: PaidMarkState, product = 'a paid feature'): string {
  if (state === 'try') return `Part of ${product} — try it here; Apply asks for it`;
  return state === 'locked' ? `Locked — part of ${product}` : `Unlocked — ${product} is yours`;
}
