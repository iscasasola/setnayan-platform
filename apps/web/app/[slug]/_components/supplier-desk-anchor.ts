/*
  NOT A 'use client' MODULE, ON PURPOSE. A server component that imports a plain value from a
  'use client' file gets a CLIENT REFERENCE, not the value: React sends a pointer that the browser
  resolves only after downloading that file. In <head> that made React pause, replay the head and
  read the page against the head's tags — hydration error #418 on ~1 in 6 loads (Story step 8,
  2026-09-11). Values a server file needs live in plain modules like this one; the guard is
  lib/a-server-file-never-takes-a-value-from-a-client-module.test.ts.
*/

/** The desk's own anchor, so the ribbon can put a supplier in front of it. */
export const SUPPLIER_DESK_ANCHOR = 'your-desk';
