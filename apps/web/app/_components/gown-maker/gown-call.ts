/**
 * 👗 THE GOWN MAKER'S CLIENT DOOR — `gownAction(input)` (design).
 *
 * Not a server action of its own: it calls the Specialized tools' existing dispatcher `supplierScan` with
 * `{ op: 'gown_tool', input }`, which runs `runGownAction` (`./gown-actions`, server-only). Every refused or failed call
 * comes back as `{ ok: false, message }` — never a throw.
 */
import { supplierScan } from '@/app/_actions/supplier-scan-actions';
import type { GownActionInput, GownActionResult } from './gown-actions';

const CALL_FAILED = 'Couldn’t reach the Gown Maker — try again.';

export async function gownAction(input: GownActionInput): Promise<GownActionResult> {
  try {
    const r = await supplierScan({ op: 'gown_tool', input });
    return r.op === 'gown_tool' ? r.result : { ok: false, message: CALL_FAILED };
  } catch {
    return { ok: false, message: CALL_FAILED };
  }
}
