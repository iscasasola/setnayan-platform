/**
 * 📶 What the supplier offline door answers, per op (`lib/supplier-offline/engine.server.ts`, reached through the ONE
 * dispatcher `app/_actions/save-in-place.ts` as the stay door `supOffline.supplierOffline`). Pure — the phone and the
 * screens read these shapes.
 */
import type { Clash, SyncReply } from './kinds';

export const SUPPLIER_OFFLINE_OPS = [
  /** send one queued action */
  'sync',
  /** top this device's one-time codes back up to the stock */
  'codes.refill',
  /** cancel a member's unused codes (any teammate — a lost phone) */
  'codes.cancel',
  /** expo mode: hold dates while online */
  'holds.claim',
  /** expo mode: let a hold go (the holder, or someone who manages the team) */
  'holds.release',
  /** expo mode: the queue is empty again — this member's holds end */
  'holds.synced',
  /** "N waiting to sync" as this phone last knew it */
  'presence.report',
  /** what online teammates see: holds, pending changes, unused codes */
  'team.read',
] as const;
export type SupplierOfflineOp = (typeof SUPPLIER_OFFLINE_OPS)[number];

export function isSupplierOfflineOp(v: unknown): v is SupplierOfflineOp {
  return typeof v === 'string' && (SUPPLIER_OFFLINE_OPS as readonly string[]).includes(v);
}

/** A refusal of the op itself (not of a queued action): `retry` = keep it and ask again later. */
export type OpRefusal = { ok: false; why: string; retry: boolean };

export type IssuedCode = { codeId: string; secret: string; issuedAt: string };

export type TeamHold = { holdId: string; memberUserId: string; name: string | null; poolId: string | null; start: string; end: string; since: string };
export type TeamPending = { memberUserId: string; name: string | null; waiting: number; lastOnlineAt: string };
export type TeamCodes = { memberUserId: string; name: string | null; unused: number };

export type SupplierOfflineReply =
  | { op: 'sync'; ok: true; reply: SyncReply }
  | ({ op: 'sync' } & OpRefusal)
  | { op: 'codes.refill'; ok: true; memberTag: string; codes: IssuedCode[]; stock: number }
  | ({ op: 'codes.refill' } & OpRefusal)
  | { op: 'codes.cancel'; ok: true; cancelled: number }
  | ({ op: 'codes.cancel' } & OpRefusal)
  | { op: 'holds.claim'; ok: true; holdId: string }
  | { op: 'holds.claim'; ok: false; why: string; retry: boolean; clash?: Clash }
  | { op: 'holds.release' | 'holds.synced'; ok: true; released: number }
  | ({ op: 'holds.release' | 'holds.synced' } & OpRefusal)
  | { op: 'presence.report'; ok: true }
  | ({ op: 'presence.report' } & OpRefusal)
  | { op: 'team.read'; ok: true; holds: TeamHold[]; pending: TeamPending[]; codes: TeamCodes[]; readAt: string }
  | ({ op: 'team.read' } & OpRefusal);

/** The key the door's reply rides on through `saveInPlace` (`stayReplyOf`, `lib/save-in-place.ts`). */
export type StayReply<T> = { stayReply: T };
