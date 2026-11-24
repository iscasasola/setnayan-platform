// 📶 The phone's ONE way to the supplier offline door: a POST to the stable route (`/api/offline/supplier-sync`, a
// versioned payload — controller review #2 item 4). Used by the daemon's handler and by `supplier-queue.ts`.
// Null = no answer (no signal, a timeout): the caller keeps what it has. `update` = this phone speaks an older payload:
// it must reload, never guess. `busy` = rate-limited: keep it and try later.

import { SUPPLIER_OFFLINE_ROUTE, SUPPLIER_OFFLINE_WIRE, type SupplierOfflineOp, type SupplierOfflineReply } from '@/lib/supplier-offline/replies';

export type WireAnswer = { reply: SupplierOfflineReply } | { update: true } | { busy: true } | null;

export async function supplierWire(op: SupplierOfflineOp, fields: Record<string, string>): Promise<WireAnswer> {
  let res: Response;
  try {
    res = await fetch(SUPPLIER_OFFLINE_ROUTE, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ v: SUPPLIER_OFFLINE_WIRE, op, fields }),
    });
  } catch {
    return null;
  }
  if (res.status === 409) return { update: true };
  if (res.status === 429) return { busy: true };
  if (!res.ok) return null;
  try {
    const json = (await res.json()) as { v?: unknown; reply?: SupplierOfflineReply };
    return json.v === SUPPLIER_OFFLINE_WIRE && json.reply ? { reply: json.reply } : null;
  } catch {
    return null;
  }
}
