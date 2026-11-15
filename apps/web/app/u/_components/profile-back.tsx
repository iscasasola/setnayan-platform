'use client';

import { useEffect, useState } from 'react';
import { BackButton } from '@/app/_components/back-button';
import { createClient } from '@/lib/supabase/client';

/**
 * ‹ The way back from a person's page (owner 2026-10-26: "I opened a user and now im stuck on her account"). People
 * opens `/u/<slug>` (`lib/person-page-link.ts`), and that page drew no way back at all; in the installed app there is
 * no browser bar, so the only exit was a swipe or closing the app.
 *
 * 2026-11-12 (DECISION_LOG "DISCOVER WITH SUPPLIERS — PROTOTYPE APPROVED"; owner: "when we enter a shop, event or
 * anything, we should be able to go back to home"). It was drawn only signed in and ALWAYS went to Home › People —
 * even for someone who opened the person from Discover. Now it is drawn for EVERYONE and returns IN PLACE (`inPlace`:
 * the browser's back when this tab came here from a page of ours, so Discover or People comes back where it was
 * scrolled). Only a cold arrival uses the address: People signed in, Discover signed out (the drawing's "Cold: People
 * signed in, Discover signed out"). The session is read on the device (no request), after mount, so the page stays
 * cacheable; nothing is drawn until it is known, so the label never flips. Href-only, like every back button.
 */
export function ProfileBack() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    createClient()
      .auth.getSession()
      .then(({ data }) => {
        if (live) setSignedIn(Boolean(data.session));
      })
      .catch(() => {
        if (live) setSignedIn(false);
      });
    return () => {
      live = false;
    };
  }, []);
  if (signedIn === null) return null;
  return (
    <div className="uprof-back" data-profile-back="">
      {signedIn ? (
        <BackButton href="/dashboard?seg=people" label="People" className="mb-0" inPlace />
      ) : (
        <BackButton href="/" label="Discover" className="mb-0" inPlace />
      )}
    </div>
  );
}
