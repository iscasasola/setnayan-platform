/** Panood › Setup — the YouTube watch link and the Facebook link (`studio/panood/setup/actions.ts`). */
export const PANOOD_SETUP_STAY_DOORS = [
  'panoodSetup.savePanoodWatchUrl',
  'panoodSetup.clearPanoodWatchUrl',
  'panoodSetup.savePanoodFacebookUrl',
  'panoodSetup.clearPanoodFacebookUrl',
] as const;
export type PanoodSetupStayDoor = (typeof PANOOD_SETUP_STAY_DOORS)[number];
