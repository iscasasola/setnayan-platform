'use client';

import { useEffect, useState } from 'react';
import { BackButton } from '@/app/_components/back-button';
import { createClient } from '@/lib/supabase/client';

/**
 * ‹ People — the way back from a person's page (owner 2026-10-26: "I opened a user and now im stuck on her
 * account"). People opens `/u/<slug>` (`lib/person-page-link.ts`), and that page drew no way back at all; in
 * the installed app there is no browser bar, so the only exit was a swipe or closing the app.
 *
 * Drawn only for a signed-in viewer — the one who can have come from People. A stranger following a shared
 * link sees the page exactly as before. The session is read on the device (no request), after mount, so
 * the page stays cacheable. Href-only, like every back button (`back-button.tsx`).
 */
export function ProfileBack() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    let live = true;
    createClient()
      .auth.getSession()
      .then(({ data }) => {
        if (live) setSignedIn(Boolean(data.session));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  if (!signedIn) return null;
  return (
    <div className="uprof-back" data-profile-back="">
      <BackButton href="/dashboard/people" label="People" className="mb-0" />
    </div>
  );
}
