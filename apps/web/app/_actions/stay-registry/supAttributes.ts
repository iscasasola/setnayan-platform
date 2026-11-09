import 'server-only';
import type { SupAttributesStayDoor } from '@/lib/stay-doors/supAttributes';
import { supplierScreen, type StayWords } from '@/lib/save-in-place';
import { removeVendorServiceAttribute, saveVendorServiceAttribute } from '@/app/vendor-dashboard/attributes/actions';
import { kind, type Door } from './_door';

/** A refusal is `?error=<the reason>`, which `attributes/page.tsx` prints after "Couldn’t save: " — said the same way
 *  here. No shop → `/vendor-dashboard?error=no_profile` (bare `/vendor-dashboard`) and signed out → `/login`: both
 *  navigate. `?saved=<service>&missing=…` lands on the same screen: saved (the card's own badge re-draws). */
const SUP_ATTRIBUTES_WORDS: StayWords = {
  within: [supplierScreen('attributes')],
  refuse: (q) => {
    const e = q.get('error');
    return e ? `Couldn’t save: ${e}` : null;
  },
};
const supAttributes = kind(SUP_ATTRIBUTES_WORDS, false);

export const SUP_ATTRIBUTES: Readonly<Record<SupAttributesStayDoor, Door>> = {
  'supAttributes.saveVendorServiceAttribute': supAttributes(saveVendorServiceAttribute),
  'supAttributes.removeVendorServiceAttribute': supAttributes(removeVendorServiceAttribute),
};
