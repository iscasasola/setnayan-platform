/**
 * 🎂 THE CAKE MAKER'S CLIENT DOOR — `cakeAction(input)` (options · save · invite · status · open · design · send).
 *
 * Not a server action of its own: it calls the Specialized tools' existing dispatcher `supplierScan` with
 * `{ op: 'cake_tool', input }`, which runs `runCakeAction` (`./cake-actions`, server-only). The action budget is full, so the
 * Cake Maker adds zero routes. Every refused or failed call comes back as `{ ok: false, message }` — never a throw.
 */
import { supplierScan } from '@/app/_actions/supplier-scan-actions';
import type { CakeActionInput, CakeActionResult } from './cake-actions';

const CALL_FAILED = 'Couldn’t reach the Cake Maker — try again.';

export async function cakeAction(input: CakeActionInput): Promise<CakeActionResult> {
  try {
    const r = await supplierScan({ op: 'cake_tool', input });
    return r.op === 'cake_tool' ? r.result : { ok: false, message: CALL_FAILED };
  } catch {
    return { ok: false, message: CALL_FAILED };
  }
}
