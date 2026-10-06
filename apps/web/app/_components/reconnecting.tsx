'use client';

import { startTransition, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { nextReconnect, type ReconnectRun } from '@/lib/read-retry';

/**
 * "Reconnecting…" — what the error boundary shows for a database schema-cache
 * BLIP (a `SchemaBlipError` that outlasted the server's few-second retry).
 * It waits, refreshes the route, and does that a few times
 * (`RECONNECT_DELAYS_MS`); once spent it hands back to the boundary's honest
 * error state through `onGiveUp`. Never a not-found, never a redirect.
 *
 * The run is kept in sessionStorage because every failed refresh mounts the
 * boundary afresh. Storage that throws (private window, blocked site data)
 * falls back to a module variable, so the count still ends.
 * 🛡 lib/read-retry.test.ts.
 */
const KEY = 'setnayan.reconnect';
let memoryRun: ReconnectRun | null = null;

function readRun(): ReconnectRun | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as ReconnectRun;
    return null;
  } catch {
    return memoryRun;
  }
}

function writeRun(run: ReconnectRun) {
  memoryRun = run;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(run));
  } catch {
    /* memoryRun already holds it */
  }
}

export function Reconnecting({ reset, onGiveUp }: { reset: () => void; onGiveUp: () => void }) {
  const router = useRouter();
  // Read through refs so a parent re-render can never re-run the step and spend
  // a second attempt; `step` is decided once per mount.
  const latest = useRef({ router, reset, onGiveUp });
  latest.current = { router, reset, onGiveUp };
  const step = useRef<ReturnType<typeof nextReconnect> | undefined>(undefined);

  useEffect(() => {
    if (step.current === undefined) {
      step.current = nextReconnect(readRun(), Date.now());
      if (step.current) writeRun(step.current.run);
    }
    const s = step.current;
    if (!s) {
      latest.current.onGiveUp();
      return;
    }
    const timer = window.setTimeout(() => {
      startTransition(() => {
        latest.current.router.refresh();
        latest.current.reset();
      });
    }, s.delayMs);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="min-h-screen bg-cream text-ink flex items-center justify-center px-6 py-16">
      <p role="status" aria-live="polite" className="font-sans text-base text-ink/70">
        Reconnecting…
      </p>
    </main>
  );
}
