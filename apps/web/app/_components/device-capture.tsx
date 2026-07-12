'use client';

// Phase E slice 1 — device-fingerprint capture (fake-inquiry protection).
//
// Mirrors DeferredObservability's shape: a null-rendering client component in the
// root Providers tree that does its work AFTER hydration/idle, off the critical
// path. On a secured account's browser it sends a COARSE, first-party device id
// (a random UUID persisted in localStorage) to a server action, which hashes it
// and records it in `user_devices` — lighting up the fraud identity-cluster
// machinery that already reads that table.
//
// Privacy + safety: gated OFF by default (see device-capture-flag); fires at most
// ONCE per browser session (sessionStorage guard); never touches storage or the
// network when the flag is off; degrades silently where storage is blocked
// (private mode). The server action captures only secured (non-anonymous) users.

import { useEffect } from 'react';
import { deviceFingerprintEnabled } from '@/lib/device-capture-flag';
import { recordDeviceHash } from '@/lib/device-capture';

const DEVICE_ID_KEY = 'sn_did';
const PINGED_KEY = 'sn_did_pinged';

export function DeviceCapture() {
  useEffect(() => {
    if (!deviceFingerprintEnabled()) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      // Once per session — the device→user link doesn't change within a session.
      if (sessionStorage.getItem(PINGED_KEY)) return;

      let deviceId = localStorage.getItem(DEVICE_ID_KEY);
      if (!deviceId) {
        deviceId =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
        localStorage.setItem(DEVICE_ID_KEY, deviceId);
      }
      sessionStorage.setItem(PINGED_KEY, '1');

      // Defer past first paint/interaction — capture is never urgent.
      const id = deviceId;
      timer = setTimeout(() => {
        void recordDeviceHash(id).catch(() => {});
      }, 2500);
    } catch {
      // Storage blocked (private mode / disabled cookies) → skip silently.
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, []);

  return null;
}
