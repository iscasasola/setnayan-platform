import 'server-only';
import type { SvContractsStayDoor } from '@/lib/stay-doors/svContracts';
import type { StayWords } from '@/lib/save-in-place';
import { cancelContract, publishContractToCouple } from '@/app/vendor-dashboard/contracts/actions';
import { kind, type Door } from './_door';

/** Both actions answer by returning (their own `revalidatePath` re-draws the contract page) and refuse by THROWING a
 *  short sentence ("Contract not found.", "Cancelled contracts cannot be re-published.") — the door says it on the row.
 *  Their only redirect is the gate: signed out → `/login`, no shop → bare `/vendor-dashboard` — both navigate. */
const SV_CONTRACTS_WORDS: StayWords = { within: [/^\/vendor-dashboard\/contracts\/[^/]+$/] };
const svContracts = kind(SV_CONTRACTS_WORDS, false);

export const SV_CONTRACTS: Readonly<Record<SvContractsStayDoor, Door>> = {
  'svContracts.publishContractToCouple': svContracts(publishContractToCouple),
  'svContracts.cancelContract': svContracts(cancelContract),
};
