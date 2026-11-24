'use client';

// 🔳 The member device's one-time QR code stock (the supplier offline engine, owner 2026-11-24) — the store is created by
// the shipped daemon's database (`./db.ts` · `SUPPLIER_CODES_STORE`, version 3); these helpers live apart from it so
// they load only with the supplier screens, never in every page's first load. Also the sign-out wipe of the supplier's
// queue and codes (the worker does the same on `/auth/sign-out`, `public/sw.js` · `forgetSupplierOffline`).

import { SUPPLIER_CODES_STORE, openOfflineDB, storeNameForService } from './db';

export type StockedSupplierCode = {
  code_id: string;
  shop: string;
  member: string;
  secret: string;
  issued_at: string;
};

function awaitRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IDB request failed'));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IDB tx failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IDB tx aborted'));
  });
}

/**
 * 🔳 Replace THIS member's stocked codes for a shop with the server's list (the refill answer is the whole stock of
 * this device, so a code the server cancelled — a teammate's "cancel unused codes" — leaves the phone too).
 */
export async function replaceSupplierCodes(shop: string, member: string, codes: readonly StockedSupplierCode[]): Promise<void> {
  const db = await openOfflineDB();
  const tx = db.transaction(SUPPLIER_CODES_STORE, 'readwrite');
  const store = tx.objectStore(SUPPLIER_CODES_STORE);
  const held = await awaitRequest(store.index('shop').getAll(IDBKeyRange.only(shop)) as IDBRequest<StockedSupplierCode[]>);
  for (const c of held) if (c.member === member) store.delete(c.code_id);
  for (const c of codes) store.put(c);
  await txDone(tx);
  db.close();
}

/** How many unused codes this phone holds for a member in a shop. */
export async function countSupplierCodes(shop: string, member: string): Promise<number> {
  const db = await openOfflineDB();
  const tx = db.transaction(SUPPLIER_CODES_STORE, 'readonly');
  const held = await awaitRequest(tx.objectStore(SUPPLIER_CODES_STORE).index('shop').getAll(IDBKeyRange.only(shop)) as IDBRequest<StockedSupplierCode[]>);
  await txDone(tx);
  db.close();
  return held.filter((c) => c.member === member).length;
}

/** Take ONE code out of the stock (oldest first) — it is gone from the phone before a QR is drawn from it. */
export async function takeSupplierCode(shop: string, member: string): Promise<StockedSupplierCode | null> {
  const db = await openOfflineDB();
  const tx = db.transaction(SUPPLIER_CODES_STORE, 'readwrite');
  const store = tx.objectStore(SUPPLIER_CODES_STORE);
  const held = (await awaitRequest(store.index('shop').getAll(IDBKeyRange.only(shop)) as IDBRequest<StockedSupplierCode[]>))
    .filter((c) => c.member === member)
    .sort((a, b) => a.issued_at.localeCompare(b.issued_at));
  const code = held[0] ?? null;
  if (code) store.delete(code.code_id);
  await txDone(tx);
  db.close();
  return code;
}

/** 🧹 Sign-out: every queued supplier action and every stocked code leave this phone. */
export async function wipeSupplierOffline(): Promise<void> {
  const db = await openOfflineDB();
  const names = [storeNameForService('supplier'), SUPPLIER_CODES_STORE].filter((n) => db.objectStoreNames.contains(n));
  if (names.length > 0) {
    const tx = db.transaction(names, 'readwrite');
    for (const n of names) tx.objectStore(n).clear();
    await txDone(tx);
  }
  db.close();
}
