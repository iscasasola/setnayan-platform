import 'server-only';
import type { SvMessagesStayDoor } from '@/lib/stay-doors/svMessages';
import type { StayWords } from '@/lib/save-in-place';
import { OUTCOME_NOTICE, OUTCOME_REFUSALS } from '@/app/vendor-dashboard/messages/[threadId]/_lib/outcome-notice';
import { recordInquiryOutcome } from '@/app/vendor-dashboard/messages/[threadId]/outcome-actions';
import { kind, type Door } from './_door';

/** The outcome lands on the thread with `?notice=outcome_*`; a refusal is said in the thread banner's own words
 *  (`OUTCOME_NOTICE`). Not this supplier's thread → the bare messages list (outside `within`): navigates. */
const SV_MESSAGES_WORDS: StayWords = {
  within: [/^\/vendor-dashboard\/messages\/[^/]+$/],
  refuse: (q) => {
    const n = q.get('notice') ?? '';
    return OUTCOME_REFUSALS.includes(n) ? (OUTCOME_NOTICE[n] ?? null) : null;
  },
};
const svMessages = kind(SV_MESSAGES_WORDS, null);

export const SV_MESSAGES: Readonly<Record<SvMessagesStayDoor, Door>> = {
  'svMessages.recordInquiryOutcome': svMessages(recordInquiryOutcome),
};
