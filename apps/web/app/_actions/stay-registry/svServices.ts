import 'server-only';
import type { SvServicesStayDoor } from '@/lib/stay-doors/svServices';
import { supplierScreen, type StayWords } from '@/lib/save-in-place';
import { proposeCategory, toggleVendorServiceActive } from '@/app/vendor-dashboard/services/actions';
import { setServiceAddons } from '@/app/vendor-dashboard/services/addon-actions';
import { createCoverage, deleteCoverage, updateCoverageServes } from '@/app/vendor-dashboard/services/coverage-actions';
import { saveServiceRefinements } from '@/app/vendor-dashboard/services/refinement-actions';
import { pickServicesThatStayOn } from '@/app/vendor-dashboard/services/stay-on-actions';
import { kind, type Door } from './_door';

/**
 * Every one of these lands on My Shop (`servicesReturnBase()` → `/vendor-dashboard/shop`) with `?saved=1` /
 * `?requested=1` / `#stay-on`, or refuses with `?error=<the sentence>`, which the services manager prints as given.
 * Pressed from Today's sheet the base is bare `/vendor-dashboard` — that navigates, exactly as before; so do no shop
 * (bare `/vendor-dashboard`), signed out (`/login`), and "Which services stay on" picking an UPGRADE (→ the Plan page,
 * where it is paid).
 */
const SV_SERVICES_WORDS: StayWords = { within: [supplierScreen('shop')], refuse: (q) => q.get('error') };
const svServices = kind(SV_SERVICES_WORDS, false);

export const SV_SERVICES: Readonly<Record<SvServicesStayDoor, Door>> = {
  'svServices.toggleVendorServiceActive': svServices(toggleVendorServiceActive),
  'svServices.proposeCategory': svServices(proposeCategory),
  'svServices.createCoverage': svServices(createCoverage),
  'svServices.updateCoverageServes': svServices(updateCoverageServes),
  'svServices.deleteCoverage': svServices(deleteCoverage),
  'svServices.saveServiceRefinements': svServices(saveServiceRefinements),
  'svServices.setServiceAddons': svServices(setServiceAddons),
  'svServices.pickServicesThatStayOn': svServices(pickServicesThatStayOn),
};
