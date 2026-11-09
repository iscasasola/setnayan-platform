/** Service attributes — each service's per-category fields on `/vendor-dashboard/attributes` (`attributes/actions.ts`). */
export const SUP_ATTRIBUTES_STAY_DOORS = ['supAttributes.saveVendorServiceAttribute', 'supAttributes.removeVendorServiceAttribute'] as const;
export type SupAttributesStayDoor = (typeof SUP_ATTRIBUTES_STAY_DOORS)[number];
