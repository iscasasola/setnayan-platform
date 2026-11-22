'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * 💳 "Checking your payment…" — back from Maya, while we ask Maya's API for this exact reference and amount (v3
 * drawing, section 2). Nothing to press, so no pinned bar. The page re-asks every few seconds (each re-render runs the
 * server-side re-verify); a confirmed payment turns into the Paid page by itself, a mismatch into "We're checking this
 * by hand". After a minute it stops asking and says so — #8096's line — rather than spinning forever.
 *
 * Motion: the one loop allowed on this flow, a small spinner; reduced motion = a still card with the words.
 */
const EVERY_MS = 3_000;
const TRIES = 20;

export function MayaChecking() {
  const router = useRouter();
  const [tries, setTries] = useState(0);
  useEffect(() => {
    if (tries >= TRIES) return;
    const t = window.setTimeout(() => {
      // one-render: keep (retry) — a timed re-ask: each refresh re-renders the pay page, whose server render re-verifies with Maya; no server action runs here.
      router.refresh();
      setTries((n) => n + 1);
    }, EVERY_MS);
    return () => window.clearTimeout(t);
  }, [tries, router]);

  const gaveUp = tries >= TRIES;
  return (
    <section role="status" data-pay-maya-checking="" className="mt-5 rounded-card bg-[color:var(--m-paper-2)] p-6 text-center">
      {!gaveUp ? (
        <Loader2 aria-hidden className="mx-auto mb-3 h-5 w-5 text-ink/50 motion-safe:animate-spin" strokeWidth={1.75} />
      ) : null}
      <h2 className="text-lg font-semibold text-ink">Checking your payment…</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-ink/70">
        {gaveUp
          ? 'Maya is still confirming your payment. Refresh in a minute.'
          : 'We’re asking Maya to confirm it. This takes a few seconds — please keep this page open.'}
      </p>
    </section>
  );
}
