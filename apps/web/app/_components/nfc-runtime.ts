'use client';

import type { RawNdefRecord } from '@/lib/nfc-tag';

/**
 * nfc-runtime.ts — what the device can do with NFC, and the typed handles to
 * do it. Shared by the WRITE button (nfc-write-button.tsx) and the READ side
 * (the check-in desk), so "is there NFC here?" has one answer app-wide.
 *
 * Two runtimes exist:
 *   • the Setnayan iOS / Android app — the native `CapacitorNfc` plugin
 *     (@capgo/capacitor-nfc). Only when the running app build actually has it:
 *     an app from before the plugin shipped reports it unavailable.
 *   • Chrome on Android — Web NFC (`NDEFReader`).
 * Everything else (iPhone Safari, desktop) has neither.
 */

// ── Web NFC (not in TypeScript's lib.dom) ─────────────────────────────────
export type NdefRecordLike = { recordType: string; data?: DataView | null };
export type NdefReaderLike = {
  write(message: { records: { recordType: 'url'; data: string }[] }, opts: { signal: AbortSignal; overwrite: boolean }): Promise<void>;
  scan(opts: { signal: AbortSignal }): Promise<void>;
  addEventListener(type: 'reading', cb: (ev: { message: { records: NdefRecordLike[] } }) => void): void;
};
export type NdefReaderCtor = new () => NdefReaderLike;

// ── The app's native plugin (@capgo/capacitor-nfc, jsName "CapacitorNfc") ──
export type ListenerHandle = { remove: () => Promise<void> | void };
export type NativeNfcEvent = { tag?: { ndefMessage?: RawNdefRecord[] | null } };
export type NativeNfc = {
  startScanning(opts: { invalidateAfterFirstRead?: boolean; alertMessage?: string }): Promise<void>;
  stopScanning(): Promise<void>;
  write(opts: { records: RawNdefRecord[]; allowFormat?: boolean }): Promise<void>;
  getStatus(): Promise<{ status: string }>;
  addListener(event: 'nfcEvent', cb: (e: NativeNfcEvent) => void): Promise<ListenerHandle> | ListenerHandle;
  addListener(event: 'nfcSessionEnd', cb: (e: { reason?: string }) => void): Promise<ListenerHandle> | ListenerHandle;
};
type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  isPluginAvailable?: (name: string) => boolean;
  Plugins?: { CapacitorNfc?: NativeNfc };
};

export function nativeNfc(): NativeNfc | null {
  if (typeof window === 'undefined') return null;
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  if (cap.isPluginAvailable && !cap.isPluginAvailable('CapacitorNfc')) return null;
  return cap.Plugins?.CapacitorNfc ?? null;
}


/** 'ios' | 'android' inside the app; null on the web. */
export function nativePlatform(): string | null {
  if (typeof window === 'undefined') return null;
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  return cap.getPlatform?.() ?? null;
}

/** The Web NFC constructor, when this browser has one. */
export function webNdefReader(): NdefReaderCtor | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { NDEFReader?: NdefReaderCtor }).NDEFReader ?? null;
}
