'use client';

import { useState, useTransition } from 'react';
import { setRecapSocialFeatureAllowed } from '../actions';

// Social follow-through #2 — the couple's opt-out of Setnayan featuring their
// PUBLISHED recap on Setnayan's OWN Facebook / Instagram. Checked = allowed
// (the default, recap_social_optout_at IS NULL). Unchecking stamps the opt-out;
// re-checking clears it. Optimistic switch state so the toggle feels instant;
// reverts on a server error.
export function RecapSocialFeatureToggle({
  eventId,
  allowed: initialAllowed,
}: {
  eventId: string;
  allowed: boolean;
}) {
  const [allowed, setAllowed] = useState(initialAllowed);
  const [pending, startTransition] = useTransition();

  return (
    <label className="flex cursor-pointer items-start gap-3 select-none">
      <button
        type="button"
        role="switch"
        aria-checked={allowed}
        aria-label="Let Setnayan feature this recap on Facebook and Instagram"
        disabled={pending}
        onClick={() => {
          const next = !allowed;
          setAllowed(next); // optimistic
          startTransition(async () => {
            const res = await setRecapSocialFeatureAllowed(eventId, next);
            if (!res.ok) setAllowed(!next); // revert on failure
          });
        }}
        className={[
          'relative mt-0.5 inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2',
          allowed ? 'bg-terracotta' : 'bg-ink/20',
          pending ? 'opacity-50 cursor-not-allowed' : '',
        ].join(' ')}
      >
        <span
          className={[
            'pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
            allowed ? 'translate-x-4' : 'translate-x-0',
          ].join(' ')}
        />
      </button>
      <span className="text-sm text-ink/75">
        <span className="font-medium text-ink">
          Let Setnayan feature this recap on our Facebook &amp; Instagram
        </span>
        <span className="mt-1 block text-ink/55">
          Only ever posted after your event, and only while your recap page is public. You can turn
          this off anytime — if a post already went out, our team takes it down within 24 hours.
        </span>
      </span>
    </label>
  );
}
