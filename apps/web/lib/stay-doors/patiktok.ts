/** Patiktok (the video booth) — Home's two template picks, the booth page, the studio page (`studio/patiktok/actions.ts`). */
export const PATIKTOK_STAY_DOORS = [
  'patiktok.savePatiktokBoothTemplates',
  'patiktok.disconnectPatiktokTiktok',
  'patiktok.submitPatiktokRender',
] as const;
export type PatiktokStayDoor = (typeof PATIKTOK_STAY_DOORS)[number];
