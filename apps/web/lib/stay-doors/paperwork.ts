/** Paperwork — every save on `/dashboard/<ev>/paperwork` (`paperwork/actions.ts`) and the Nikah card's save
 *  (`nikah-actions.ts`). A refused save is said under its form; the typed note stays (final check A2-I10 / A2-I19). */
export const PAPERWORK_STAY_DOORS = [
  'paperwork.seedPaperworkForEvent',
  'paperwork.markPaperworkRequested',
  'paperwork.markPaperworkReceived',
  'paperwork.setPaperworkStatus',
  'paperwork.uploadPaperworkScan',
  'paperwork.setPaperworkNotes',
  'paperwork.updateNikahDetails',
] as const;
export type PaperworkStayDoor = (typeof PAPERWORK_STAY_DOORS)[number];
