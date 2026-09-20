'use client';

import { useEffect, useState } from 'react';
import {
  NFC_TEST_STORAGE_KEY,
  isNfcWriteEnabled,
  resolveNfcTestOptIn,
} from '@/lib/nfc-write-flag';

/**
 * Read this phone's `?nfc-test` opt-in from the current URL and storage, and
 * persist any change. Browser-only; call after mount.
 */
function captureNfcTestOptIn(): boolean {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(NFC_TEST_STORAGE_KEY);
  } catch {
    /* storage blocked — the opt-in simply does not persist */
  }
  const r = resolveNfcTestOptIn(window.location.search, stored);
  try {
    if (r.store === '1') window.localStorage.setItem(NFC_TEST_STORAGE_KEY, '1');
    else if (r.store === 'clear') window.localStorage.removeItem(NFC_TEST_STORAGE_KEY);
  } catch {
    /* as above */
  }
  return r.on;
}

/**
 * Is NFC (write + desk read) on for THIS viewer? The launch flag, or this
 * phone's own test opt-in (lib/nfc-write-flag.ts, "Per-phone test switch").
 *
 * The opt-in is read after mount, so the server render and the first client
 * paint agree (both follow the flag alone) and nothing flickers for anyone
 * who has not opted in.
 */
export function useNfcEnabled(): boolean {
  const nfcWrite = isNfcWriteEnabled();
  const [optedIn, setOptedIn] = useState(false);
  useEffect(() => {
    setOptedIn(captureNfcTestOptIn());
  }, []);
  return nfcWrite || optedIn;
}

/**
 * Mounted once in the root layout so `?nfc-test=1` is remembered on ANY page
 * it is opened on — including one with no NFC control (a couple's /dashboard).
 * Renders nothing.
 */
export function NfcTestSwitch() {
  useEffect(() => {
    captureNfcTestOptIn();
  }, []);
  return null;
}
