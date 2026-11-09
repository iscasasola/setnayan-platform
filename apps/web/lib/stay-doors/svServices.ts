/** My Shop's services — the on/off switch, the Tools tab's "request a service", Coverage, the add form's refinements
 *  and add-ons, and "Which services stay on", on `/vendor-dashboard/shop` (`services/*-actions.ts`). */
export const SV_SERVICES_STAY_DOORS = [
  'svServices.toggleVendorServiceActive',
  'svServices.proposeCategory',
  'svServices.createCoverage',
  'svServices.updateCoverageServes',
  'svServices.deleteCoverage',
  'svServices.saveServiceRefinements',
  'svServices.setServiceAddons',
  'svServices.pickServicesThatStayOn',
] as const;
export type SvServicesStayDoor = (typeof SV_SERVICES_STAY_DOORS)[number];
