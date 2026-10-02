/**
 * lib/plan-myself.ts — the words and the one reading of "Plan it myself"
 * (owner 2026-10-02, tracker d4). Pure, so the switch's tests run without a
 * server. The switch itself is `launch/_components/plan-myself.tsx`.
 *
 * On = `events.planning_mode === 'manual'` — the value `isSetnayanAiActive`
 * reads as "the automatic help is off". One store, shared with the Setnayan
 * AI page.
 */
import { PLANNING_MODE_MANUAL } from './setnayan-ai';

export const PLAN_MYSELF_LABEL = 'Plan it myself';

export function planMyselfOn(planningMode: string | null | undefined): boolean {
  return planningMode === PLANNING_MODE_MANUAL;
}

export function planMyselfSub(on: boolean | null): string {
  if (on === null) return 'Could not load';
  return on ? 'On · no automatic help' : 'Off · Setnayan helps';
}
