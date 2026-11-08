import 'server-only';
import type { SvProposalsStayDoor } from '@/lib/stay-doors/svProposals';
import { supplierScreen, type StayWords } from '@/lib/save-in-place';
import { QUOTE_NOTICES } from '@/app/vendor-dashboard/proposals/_components/quote-notices';
import { respondToProposal, saveTemplate } from '@/app/vendor-dashboard/proposals/actions';
import { kind, type Door } from './_door';

/** "Save template" lands on the Quotes surface with `?notice=<code>`; a `warn` code is said in the banner's own words
 *  (`QUOTE_NOTICES`). The surface is also drawn on Customers — the redirect still names the Quotes screen, so it reads
 *  as saved and the page the press is on re-renders. No shop → bare `/vendor-dashboard`: navigates. */
const SV_TEMPLATES_WORDS: StayWords = {
  within: [supplierScreen('proposals')],
  refuse: (q) => {
    const n = QUOTE_NOTICES[q.get('notice') ?? ''];
    return n && n.tone === 'warn' ? n.text : null;
  },
};
const svTemplates = kind(SV_TEMPLATES_WORDS, false);

/** The couple's Accept / Decline lands back on the quote (`/proposals/<id>`), or — "Accept the update" in a chat — on
 *  that thread (`return_to`, only this app's own thread paths). `?notice=respond_failed` is said in the quote page's own
 *  banner sentence. Signed out → `/login`: navigates. */
const SV_QUOTE_ANSWER_WORDS: StayWords = {
  within: [/^\/proposals\/[^/]+$/, /^\/dashboard\/[^/]+\/messages\/[^/]+$/, /^\/vendor-dashboard\/messages\/[^/]+$/],
  refuse: (q) => (q.get('notice') === 'respond_failed' ? 'That didn’t go through — refresh and try again.' : null),
};
const svQuoteAnswer = kind(SV_QUOTE_ANSWER_WORDS, false);

export const SV_PROPOSALS: Readonly<Record<SvProposalsStayDoor, Door>> = {
  'svProposals.saveTemplate': svTemplates(saveTemplate),
  'svProposals.respondToProposal': svQuoteAnswer(respondToProposal),
};
