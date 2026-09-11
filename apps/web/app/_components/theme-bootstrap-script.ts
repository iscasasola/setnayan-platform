/*
  NOT A 'use client' MODULE, ON PURPOSE. A server component that imports a plain value from a
  'use client' file gets a CLIENT REFERENCE, not the value: React sends a pointer that the browser
  resolves only after downloading that file. In <head> that made React pause, replay the head and
  read the page against the head's tags — hydration error #418 on ~1 in 6 loads (Story step 8,
  2026-09-11). Values a server file needs live in plain modules like this one; the guard is
  lib/a-server-file-never-takes-a-value-from-a-client-module.test.ts.
*/

/**
 * FOUC-safe inline script for `<head>` injection in app/layout.tsx.
 *
 * The app is light-locked (owner 2026-06-04), so this simply guarantees the
 * `.dark` class is absent before first paint — defending against a stale cached
 * shell that shipped with `.dark` already on <html>. Kept as a string export so
 * layout.tsx's reference stays valid. Runs synchronously, wrapped in try/catch
 * so a missing API never blanks the page.
 */
export const themeBootstrapScript = `
(function() {
  try {
    document.documentElement.classList.remove('dark');
  } catch (_e) {}
})();
`;
