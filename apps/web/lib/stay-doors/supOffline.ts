/** The supplier offline engine — every queued supplier action, the one-time QR codes, expo holds and the team's pending
 *  line, through ONE door (`lib/supplier-offline/engine.server.ts`, op by op). It answers with a typed reply, never a
 *  redirect, so the phone's queue knows what to keep and what to show. */
export const SUP_OFFLINE_STAY_DOORS = ['supOffline.supplierOffline'] as const;
export type SupOfflineStayDoor = (typeof SUP_OFFLINE_STAY_DOORS)[number];
