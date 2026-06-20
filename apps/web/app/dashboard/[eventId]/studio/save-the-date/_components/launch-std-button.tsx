'use client';

import { useState, useTransition } from 'react';
import { Rocket, Check, ExternalLink, Lock } from 'lucide-react';
import { launchSaveTheDate } from '../actions';

/**
 * LaunchStdButton — the couple's deliberate "go live" control.
 *
 * Owner ruling 2026-06-20: the wedding's /[slug] page is PRIVATE until the
 * couple launches their Save-the-Date. This is that switch. Until they launch,
 * strangers see a private holding page (the couple + invited guests can already
 * view it); launching flips it public. Inline confirm because it publishes
 * outward-facing content. Reversible anytime via Website → Privacy.
 */
export function LaunchStdButton({
  eventId,
  slug,
  initialLaunched,
}: {
  eventId: string;
  slug: string | null;
  initialLaunched: boolean;
}) {
  const [launched, setLaunched] = useState(initialLaunched);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function doLaunch() {
    setError(null);
    start(async () => {
      const res = await launchSaveTheDate(eventId);
      if (res.ok) {
        setLaunched(true);
        setConfirming(false);
      } else {
        setError('Could not launch right now — please try again.');
      }
    });
  }

  return (
    <div className="rounded-2xl border border-mulberry/25 bg-mulberry/[0.04] p-5">
      {launched ? (
        <div className="space-y-1.5">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Check aria-hidden className="h-4 w-4 text-mulberry" strokeWidth={2.25} />
            Your Save-the-Date is launched — your page is live.
          </p>
          <p className="text-sm text-ink/65">
            Anyone with your link can now see it.{' '}
            {slug ? (
              <a
                href={`/${slug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium text-terracotta underline-offset-2 hover:underline"
              >
                View your page
                <ExternalLink aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              </a>
            ) : null}
          </p>
          <p className="text-xs text-ink/50">
            You can make it private again anytime in Website → Privacy.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Lock aria-hidden className="h-4 w-4 text-ink/55" strokeWidth={1.9} />
            Your page is private
          </p>
          <p className="text-sm text-ink/65">
            Only you and guests you&rsquo;ve invited can see it. Launch your Save-the-Date
            to make your wedding page public.
          </p>
          {confirming ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-sm text-ink/70">Make your page public now?</span>
              <button
                type="button"
                onClick={doLaunch}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-full bg-mulberry px-4 py-2 text-sm font-semibold text-cream hover:bg-mulberry-600 disabled:opacity-70"
              >
                <Rocket aria-hidden className="h-4 w-4" strokeWidth={1.9} />
                {pending ? 'Launching…' : 'Yes, launch'}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={pending}
                className="rounded-full px-3 py-2 text-sm font-medium text-ink/60 hover:bg-ink/5"
              >
                Not yet
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="mt-1 inline-flex items-center gap-2 rounded-full bg-mulberry px-5 py-2.5 text-sm font-semibold text-cream shadow-sm transition hover:bg-mulberry-600"
            >
              <Rocket aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Launch my Save-the-Date
            </button>
          )}
          {error ? <p className="text-sm text-danger-700">{error}</p> : null}
        </div>
      )}
    </div>
  );
}
