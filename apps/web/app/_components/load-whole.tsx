'use client';

import { useEffect } from 'react';

/**
 * ⤴ NOT A RISEN PAGE AFTER ALL: an intercepted address that is not what the slot rises (a services page beside the
 * card maker — `@rise/(.)services/[serviceId]` matches any name) loads as its own page, exactly as a typed address does.
 * Draws nothing; the address bar already holds the place. Final check B8.
 */
export function LoadWhole() {
  useEffect(() => {
    window.location.replace(window.location.href);
  }, []);
  return null;
}
