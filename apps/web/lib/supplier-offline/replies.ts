/**
 * 📶 What the supplier offline door answers, per op (`lib/supplier-offline/engine.server.ts`, reached through the ONE
 * dispatcher `app/_actions/save-in-place.ts` as the stay door `supOffline.supplierOffline`). Pure — the phone and the
 * screens read these shapes.
 */
import type { Clash, SyncReply } from './kinds';

export const SUPPLIER_OFFLINE_OPS = [
  /** send one queued action */
  'sync',
  /** the phone's QR key, made once online: register its PUBLIC half */
  'device.register',
  /** "Stop QR codes from this phone" (a Shop Manager, or the Branch Manager for that branch; the member for their own) */
  'device.stop',
  /** this phone is online now — the teammates' "last seen" */
  'device.seen',
  /** expo mode: hold dates while online */
  'holds.claim',
  /** expo mode: let a hold go (the holder, or someone who manages the team) */
  'holds.release',
  /** expo mode: the queue is empty again — this member's holds end */
  'holds.synced',
  /** what online teammates see (Settings › Offline): holds, last seen, the team's phones */
  'team.read',
] as const;
export type SupplierOfflineOp = (typeof SUPPLIER_OFFLINE_OPS)[number];

export function isSupplierOfflineOp(v: unknown): v is SupplierOfflineOp {
  return typeof v === 'string' && (SUPPLIER_OFFLINE_OPS as readonly string[]).includes(v);
}

/** A refusal of the op itself (not of a queued action): `retry` = keep it and ask again later. */
export type OpRefusal = { ok: false; why: string; retry: boolean };

export type TeamHold = { holdId: string; memberUserId: string; name: string | null; poolId: string | null; start: string; end: string; since: string };
/** R5 (corrected): when a teammate was last seen online — never a count of what is on their phone. */
export type TeamSeen = { memberUserId: string; name: string | null; lastSeenAt: string };
/** Settings › Offline: the team's phones that can sign QR codes. */
export type TeamDevice = { deviceId: string; memberUserId: string; name: string | null; status: 'active' | 'stopped'; createdAt: string; lastSeenAt: string; mayStop: boolean };

export type SupplierOfflineReply =
  | { op: 'sync'; ok: true; reply: SyncReply }
  | ({ op: 'sync' } & OpRefusal)
  | { op: 'device.register'; ok: true; deviceId: string; memberTag: string }
  | ({ op: 'device.register' } & OpRefusal)
  | { op: 'device.stop'; ok: true; stopped: boolean }
  | ({ op: 'device.stop' } & OpRefusal)
  | { op: 'device.seen'; ok: true }
  | ({ op: 'device.seen' } & OpRefusal)
  | { op: 'holds.claim'; ok: true; holdId: string }
  | { op: 'holds.claim'; ok: false; why: string; retry: boolean; clash?: Clash }
  | { op: 'holds.release' | 'holds.synced'; ok: true; released: number }
  | ({ op: 'holds.release' | 'holds.synced' } & OpRefusal)
  | { op: 'team.read'; ok: true; holds: TeamHold[]; seen: TeamSeen[]; devices: TeamDevice[]; readAt: string }
  | ({ op: 'team.read' } & OpRefusal);

/** The key the door's reply rides on through `saveInPlace` (`stayReplyOf`, `lib/save-in-place.ts`). */
export type StayReply<T> = { stayReply: T };
