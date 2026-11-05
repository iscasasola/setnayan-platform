'use client';

import { useEffect, useState } from 'react';

/**
 * `document.body`, once the component has mounted — null on the server and on
 * the first client render. For a sheet that must be drawn into <body> (the
 * dashboard's page wrapper traps `position: fixed`) and may also be rendered on
 * the server (a dev lab that opens it at once).
 */
export function usePortalHost(): HTMLElement | null {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);
  return host;
}
