/**
 * 👗 THE ATTIRE MAKER'S CLIENT DOOR — `gownAction(input)` (options · save · status · open · invite · send · design · fit).
 *
 * Not a server action of its own: it calls the Specialized tools' existing dispatcher `supplierScan` with
 * `{ op: 'gown_tool', input }`, which runs `runGownAction` (`./gown-actions`, server-only). Zero new actions. Every
 * refused or failed call comes back as `{ ok: false, message }` — never a throw.
 */
import { supplierScan } from '@/app/_actions/supplier-scan-actions';
import type { GownActionInput, GownActionResult } from './gown-actions';

const CALL_FAILED = 'Couldn’t reach the Attire Maker. Try again.';

export async function gownAction(input: GownActionInput): Promise<GownActionResult> {
  try {
    const r = await supplierScan({ op: 'gown_tool', input });
    return r.op === 'gown_tool' ? r.result : { ok: false, message: CALL_FAILED };
  } catch {
    return { ok: false, message: CALL_FAILED };
  }
}
