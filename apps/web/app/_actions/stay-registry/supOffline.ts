import 'server-only';
import type { SupOfflineStayDoor } from '@/lib/stay-doors/supOffline';
import { supplierScreen, type StayWords } from '@/lib/save-in-place';
import { supplierOffline } from '@/lib/supplier-offline/engine.server';
import { kind, type Door } from './_door';

/**
 * 📶 The supplier offline door (owner 24 Nov 2026, DECISION_LOG "The supplier dashboard works offline…"). It never
 * redirects: its answer rides back as `{ ok: true, reply }` (`stayReplyOf`). The words below only ever read a redirect
 * a replayed action let escape — none does; the engine reads each one itself. No event gate: a supplier's work.
 */
const SUP_OFFLINE_WORDS: StayWords = { within: [supplierScreen('customers'), supplierScreen('calendar'), supplierScreen('')] };
const supOffline = kind(SUP_OFFLINE_WORDS, false);

export const SUP_OFFLINE: Readonly<Record<SupOfflineStayDoor, Door>> = {
  'supOffline.supplierOffline': supOffline(supplierOffline),
};
