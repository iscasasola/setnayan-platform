'use client';

/**
 * desktop-updater-listener.tsx — the (non-modal) frontend half of S12's
 * auto-updater (`build-sessions/encoder/S12.md`, `src-tauri/src/updater.rs`).
 *
 * The actual update decision — whether one exists, whether it's signed,
 * whether the encoder is mid-broadcast — is made entirely in Rust (the task's
 * own requirement: "Check from RUST at launch… not from the web page"). This
 * component does nothing but render whatever Rust already decided to tell the
 * user: it listens for the `setnayan://update-ready` event
 * (`updater.rs`'s `check_and_maybe_install`, emitted ONLY when Rust deferred
 * an install because a broadcast was live) and surfaces it through the app's
 * existing `useToast().info(...)` primitive — the same "small notice, auto-
 * dismisses, never modal" primitive `<ToastFromParams>` uses next to this
 * mount point in providers.tsx. There is no dialog, no blocking overlay, and
 * no way for this component to trigger an install; it is read-only.
 *
 * Gated on `isTauri()` (the same `window.__TAURI__` check every other
 * desktop-only module in this codebase uses — see lib/desktop-oauth.ts's own
 * doc comment): web and mobile never see this event because the plugin that
 * emits it is never registered outside the desktop shell.
 */

import { useEffect } from 'react';
import { isTauri, tauri } from '@/lib/desktop-oauth';
import { useToast } from './toast/toast-provider';

const UPDATE_READY_EVENT = 'setnayan://update-ready';

type UpdateReadyPayload = {
  version?: unknown;
  message?: unknown;
};

export function DesktopUpdaterListener() {
  const toast = useToast();

  useEffect(() => {
    if (!isTauri()) return;
    const t = tauri();
    if (!t) return;

    let unlisten: (() => void) | undefined;
    let cancelled = false;

    void t.event
      .listen(UPDATE_READY_EVENT, (e) => {
        const payload = (e.payload ?? {}) as UpdateReadyPayload;
        // The Rust side's copy IS the task's exact required string
        // ("Update ready — installs when you're not streaming") — trust it
        // over inventing a second copy of the message here, but fall back
        // if a future payload shape ever omits it.
        const message =
          typeof payload.message === 'string' && payload.message.length > 0
            ? payload.message
            : "Update ready — installs when you're not streaming";
        toast.info(message);
      })
      .then((fn) => {
        if (cancelled) {
          fn();
        } else {
          unlisten = fn;
        }
      })
      .catch(() => {
        // No updater event will ever arrive (unsupported build, plugin not
        // registered, etc.) — nothing to surface to the user for this.
      });

    return () => {
      cancelled = true;
      try {
        unlisten?.();
      } catch {
        /* noop */
      }
    };
  }, [toast]);

  return null;
}
