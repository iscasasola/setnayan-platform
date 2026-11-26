import 'server-only';
import type { SvDisputesStayDoor } from '@/lib/stay-doors/svDisputes';
import type { StayWords } from '@/lib/save-in-place';
import { submitDisputeContest } from '@/app/vendor-dashboard/disputes/actions';
import { kind, type Door } from './_door';

/** The response answers by returning (its own `revalidatePath` re-draws the list) and refuses by THROWING a plain
 *  sentence ("This dispute has already been reviewed …", "Keep your response under … characters.") — said under the
 *  box, the words kept (A6-68, final check 25 Nov). Its only redirect is the gate (signed out / no shop) — navigates. */
const SV_DISPUTES_WORDS: StayWords = { within: ['/vendor-dashboard/disputes'] };
const svDisputes = kind(SV_DISPUTES_WORDS, false);

export const SV_DISPUTES: Readonly<Record<SvDisputesStayDoor, Door>> = {
  'svDisputes.submitDisputeContest': svDisputes(submitDisputeContest),
};
