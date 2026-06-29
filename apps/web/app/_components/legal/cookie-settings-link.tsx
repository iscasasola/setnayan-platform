'use client';

import { openConsentManager } from '@/lib/cookie-consent';

// A button that re-opens the cookie-consent manager from anywhere (legal
// footers, the /cookies page). Rendered as a link-styled button so it sits
// inline with the other footer links. Client component so server-rendered
// pages can still wire the click.
export function CookieSettingsLink({
  className,
  children = 'Cookie settings',
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <button type="button" onClick={() => openConsentManager()} className={className}>
      {children}
    </button>
  );
}
