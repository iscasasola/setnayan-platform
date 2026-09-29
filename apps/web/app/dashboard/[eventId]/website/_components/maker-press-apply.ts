/**
 * "APPLY" FROM INSIDE THE PAGE — the guided flow's Ready screen ends each round
 * in Apply (DECISION_LOG 2026-09-29 "THE GUIDED FLOW IS APPROVED…": *"each round
 * ends in Apply plus the round's real action"*). There is ONE Apply: the draft
 * bar's (`hub-draft-bar.tsx`). The Ready screen only ASKS it, by this window
 * event — the same shape as More ▾ → "Reset this stage…" (`maker-open-reset.ts`)
 * — so it can never apply differently from the button in the bar: the same Pro
 * sheet, the same "nothing to apply", the same result.
 *
 * 🔑 THE BAR IS MOUNTED TWICE (the phone's top bar and the desktop's). The event
 * carries a claim: the FIRST listener to run answers and marks it handled, the
 * other returns — so one press is one Apply, never two.
 *
 * The answer comes back on the event (listeners run synchronously), so the
 * Ready screen says what happened in words — never a press that looks like it
 * did something when there was nothing to apply.
 *
 * Its own module, with no server action, so a page can import it (as the
 * toolbar imports `maker-open-reset.ts`).
 */
export const MAKER_PRESS_APPLY_EVENT = 'setnayan:maker-press-apply';

/** What the bar did: applied · opened the Pro sheet · had nothing to apply · was busy. */
export type MakerApplyOutcome = 'applying' | 'pro-sheet' | 'nothing' | 'busy';

export type MakerPressApplyDetail = { handled: boolean; outcome: MakerApplyOutcome | null };

/**
 * Press the bar's Apply. Null = no bar answered (not inside the Maker, or its
 * draft could not load) — the caller says where Apply is instead.
 */
export function pressMakerApply(): MakerApplyOutcome | null {
  const detail: MakerPressApplyDetail = { handled: false, outcome: null };
  window.dispatchEvent(new CustomEvent<MakerPressApplyDetail>(MAKER_PRESS_APPLY_EVENT, { detail }));
  return detail.handled ? detail.outcome : null;
}
