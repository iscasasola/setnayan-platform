import 'server-only';
import type { SvRecommendationsStayDoor } from '@/lib/stay-doors/svRecommendations';
import { supplierScreen, type StayWords } from '@/lib/save-in-place';
import { flagFeedback, setOptIn } from '@/app/vendor-dashboard/recommendations/actions';
import { kind, type Door } from './_door';

/** A refusal is `?error=<the sentence>`, which the Recommend panel prints as given. `?saved|flagged=1` re-draws the
 *  card ("On", "Flagged — pending review"). No shop → bare `/vendor-dashboard`: navigates. */
const SV_RECOMMENDATIONS_WORDS: StayWords = { within: [supplierScreen('recommendations')], refuse: (q) => q.get('error') };
const svRecommendations = kind(SV_RECOMMENDATIONS_WORDS, false);

export const SV_RECOMMENDATIONS: Readonly<Record<SvRecommendationsStayDoor, Door>> = {
  'svRecommendations.setOptIn': svRecommendations(setOptIn),
  'svRecommendations.flagFeedback': svRecommendations(flagFeedback),
};
