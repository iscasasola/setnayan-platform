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
//
// 🔑 SIGNED OUT, IT DOES NOTHING — NOT EVEN THE CALL (live check 2026-10-23).
// The server action returns early for a visitor with no account (the DPO
// review's safeguard 4: "Secured accounts only"), so every signed-out visit
// spent one server-function call that recorded nothing — and minted an `sn_did`
// in the stranger's localStorage for no purpose. The client now asks first: no
// Supabase session cookie → no id, no call, and no "pinged" mark, so the ping
// still happens the moment the person signs in. It re-checks on every
// navigation (the sign-in popup lands without a full reload), and still fires
// at most once per browser session after that. The server-side gates are
// unchanged and remain the authority. Held by
// `app/_components/device-capture-waits-for-sign-in.test.ts`.

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { deviceFingerprintEnabled } from '@/lib/device-capture-flag';
import { recordDeviceHash } from '@/lib/device-capture';
import { shouldCaptureDevice } from '@/lib/device-capture-gate';

const DEVICE_ID_KEY = 'sn_did';
const PINGED_KEY = 'sn_did_pinged';

export function DeviceCapture() {
  const pathname = usePathname();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      // Flag off or signed out → no storage, no network. Then once per session — the
      // device→user link doesn't change within a session.
      const go = shouldCaptureDevice(deviceFingerprintEnabled(), document.cookie, () =>
        Boolean(sessionStorage.getItem(PINGED_KEY)),
      );
      if (!go) return;

      let deviceId = localStorage.getItem(DEVICE_ID_KEY);
      if (!deviceId) {
        deviceId =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
        localStorage.setItem(DEVICE_ID_KEY, deviceId);
      }

      // Defer past first paint/interaction — capture is never urgent. The "sent" mark is set
      // when it is actually sent: a navigation inside the 2.5 s clears this timer, and the
      // next page must be free to try again.
      const id = deviceId;
      timer = setTimeout(() => {
        try {
          sessionStorage.setItem(PINGED_KEY, '1');
        } catch {
          // Storage blocked mid-session → still send once from this page.
        }
        void recordDeviceHash(id).catch(() => {});
      }, 2500);
    } catch {
      // Storage blocked (private mode / disabled cookies) → skip silently.
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
    // Re-checked on each navigation: a sign-in that lands without a full reload is caught on the next page.
  }, [pathname]);

  return null;
}
