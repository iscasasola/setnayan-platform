/** Monogram — the vector studio's Save / Remove and the uploaded mark's Remove (`monogram/*-actions.ts`). */
export const MONOGRAM_STAY_DOORS = ['monogram.saveStudioAction', 'monogram.clearStudioAction', 'monogram.clearUploadedMarkAction'] as const;
export type MonogramStayDoor = (typeof MONOGRAM_STAY_DOORS)[number];
