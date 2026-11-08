import 'server-only';
import type { SvRepertoireStayDoor } from '@/lib/stay-doors/svRepertoire';
import { supplierScreen, type StayWords } from '@/lib/save-in-place';
import { addRepertoireSong, setPerformanceLink } from '@/app/vendor-dashboard/repertoire/actions';
import { kind, type Door } from './_door';

/** A refusal is `?error=<the sentence>` (with the search `?q=` kept), which `repertoire/page.tsx` prints as given.
 *  `?saved=1` re-draws the set list in place. No shop → bare `/vendor-dashboard`: navigates. */
const SV_REPERTOIRE_WORDS: StayWords = { within: [supplierScreen('repertoire')], refuse: (q) => q.get('error') };
const svRepertoire = kind(SV_REPERTOIRE_WORDS, null);

export const SV_REPERTOIRE: Readonly<Record<SvRepertoireStayDoor, Door>> = {
  'svRepertoire.addRepertoireSong': svRepertoire(addRepertoireSong),
  'svRepertoire.setPerformanceLink': svRepertoire(setPerformanceLink),
};
