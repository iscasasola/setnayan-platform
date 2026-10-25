'use client';

import type { RawNdefRecord } from '@/lib/nfc-tag';
import { isAppleTouchDevice } from '@/lib/apple-device';

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
  /** Is there an NFC radio at all (on or off)? Absent from builds before plugin 8.x. */
  isSupported?(): Promise<{ supported: boolean }>;
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

/**
 * 🍎 THE PLUGIN IS NOT THE RADIO (iPad + Duo audit W6, 2026-10-19). The iPad
 * app ships the same binary as the iPhone app, so `CapacitorNfc` is present on
 * an iPad — measured on the iPad Pro 11-inch simulator: `isPluginAvailable`
 * true, `isSupported` → `{ supported: false }`, `getStatus` → `NO_NFC`. No iPad
 * has an NFC radio, so offering "Write to NFC" there could only fail (App Store
 * 2.1). This asks the plugin whether the HARDWARE is here, and answers the
 * plugin only when it is: a capability check, never a device name.
 *
 * `isSupported` first; a build whose plugin predates it falls back to
 * `getStatus` (`NO_NFC` = no radio; `NFC_DISABLED` is a radio switched off,
 * which the write itself names). A plugin that cannot answer either is
 * trusted, as before — an unknown is not a "no".
 */
export async function nativeNfcWithHardware(): Promise<NativeNfc | null> {
  const nfc = nativeNfc();
  if (!nfc) return null;
  try {
    if (typeof nfc.isSupported === 'function') {
      const { supported } = await nfc.isSupported();
      return supported ? nfc : null;
    }
    const { status } = await nfc.getStatus();
    return status === 'NO_NFC' ? null : nfc;
  } catch {
    return nfc;
  }
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

/** Read this browser's device signals for `nfcDeviceKind`. Browser-only. */
export function readDeviceEnv(): {
  coarsePointer: boolean;
  maxTouchPoints: number;
  userAgent: string;
  screenWidth: number;
} {
  return {
    coarsePointer: typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    userAgent: navigator.userAgent ?? '',
    screenWidth: window.screen?.width ?? window.innerWidth ?? 0,
  };
}

/** True when this is an iPhone/iPad (including the app's WebView) — `isAppleTouchDevice`, lib/apple-device.ts. */
export function isIosBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return isAppleTouchDevice(navigator.userAgent, navigator.maxTouchPoints);
}
