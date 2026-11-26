'use client';

import { useState, useTransition } from 'react';
import { setRecapSocialFeatureAllowed } from '../actions';
import { SWITCH_BUTTON, SwitchTrack } from '@/app/_components/switch-track';

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
  const [failed, setFailed] = useState(false);

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
          setFailed(false);
          startTransition(async () => {
            // P-05: the switch used to flip back with no word. It now says why it moved.
            const res = await setRecapSocialFeatureAllowed(eventId, next).catch(() => ({ ok: false }));
            if (!res.ok) {
              setAllowed(!next); // revert on failure
              setFailed(true);
            }
          });
        }}
        className={SWITCH_BUTTON}
      >
        <SwitchTrack on={allowed} />
      </button>
      <span className="text-sm text-ink/75">
        <span className="font-medium text-ink">
          Let Setnayan feature this recap on our Facebook &amp; Instagram
        </span>
        <span className="mt-1 block text-ink/70">
          Only ever posted after your event, and only while your recap page is public. You can turn
          this off anytime — if a post already went out, our team takes it down within 24 hours.
        </span>
        {failed ? (
          <span role="alert" className="mt-1 block text-danger-600">
            Couldn&rsquo;t save that change. Try again.
          </span>
        ) : null}
      </span>
    </label>
  );
}
