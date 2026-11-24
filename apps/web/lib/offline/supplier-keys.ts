'use client';

// 🔳 The phone's QR signing key (the supplier offline engine, owner 2026-11-24, DECISION_LOG 7d618cb3 "each phone signs
// its own codes, no stock"). The store is created by the shipped daemon's database (`./db.ts` · `SUPPLIER_KEYS_STORE`,
// version 3); these helpers live apart from it so they load only with the supplier screens, never in every page's first
// load. Also the sign-out wipe of the supplier's queue and key (the worker does the same on `/auth/sign-out`,
// `public/sw.js` · `forgetSupplierOffline`).

import { SUPPLIER_KEYS_STORE, openOfflineDB, storeNameForService } from './db';
import type { PublicKeyJwk } from '@/lib/supplier-offline/qr';

/** One (shop, member) key on this phone. `privateKey` is a non-extractable CryptoKey: it signs, it is never read. */
export type PhoneKey = {
  id: string;
  shop: string;
  member: string;
  deviceId: string;
  privateKey: CryptoKey;
  publicJwk: PublicKeyJwk;
  createdAt: string;
  /** the server took the public half (`device.register`) */
  registered: boolean;
};

export const phoneKeyId = (shop: string, member: string) => `${shop}:${member}`;

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

export async function readPhoneKey(shop: string, member: string): Promise<PhoneKey | null> {
  const db = await openOfflineDB();
  const tx = db.transaction(SUPPLIER_KEYS_STORE, 'readonly');
  const key = (await awaitRequest(tx.objectStore(SUPPLIER_KEYS_STORE).get(phoneKeyId(shop, member)))) as PhoneKey | undefined;
  await txDone(tx);
  db.close();
  return key ?? null;
}

export async function writePhoneKey(key: PhoneKey): Promise<void> {
  const db = await openOfflineDB();
  const tx = db.transaction(SUPPLIER_KEYS_STORE, 'readwrite');
  tx.objectStore(SUPPLIER_KEYS_STORE).put(key);
  await txDone(tx);
  db.close();
}

/** Every device id this phone holds a key for — the sign-out route stops them (`sn_offline_devices`). */
export async function phoneDeviceIds(): Promise<string[]> {
  const db = await openOfflineDB();
  const tx = db.transaction(SUPPLIER_KEYS_STORE, 'readonly');
  const all = (await awaitRequest(tx.objectStore(SUPPLIER_KEYS_STORE).getAll())) as PhoneKey[];
  await txDone(tx);
  db.close();
  return all.map((k) => k.deviceId);
}

/** 🧹 Sign-out: every queued supplier action and every signing key leave this phone. */
export async function wipeSupplierOffline(): Promise<void> {
  const db = await openOfflineDB();
  const names = [storeNameForService('supplier'), SUPPLIER_KEYS_STORE].filter((n) => db.objectStoreNames.contains(n));
  if (names.length > 0) {
    const tx = db.transaction(names, 'readwrite');
    for (const n of names) tx.objectStore(n).clear();
    await txDone(tx);
  }
  db.close();
}
