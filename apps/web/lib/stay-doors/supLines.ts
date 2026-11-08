/** Lines — the emcee's own words on `/vendor-dashboard/lines` (`lines/actions.ts`). */
export const SUP_LINES_STAY_DOORS = ['supLines.updateLine', 'supLines.deleteLine', 'supLines.attachLineToActivity'] as const;
export type SupLinesStayDoor = (typeof SUP_LINES_STAY_DOORS)[number];
