import type { ReactNode } from 'react';

/**
 * The Papic area with its `@rise` slot (final check A4-55 / A4-81, approved drawing §§ 05–06): from My photos
 * (`/papic/me/[token]`), "Decorate a photo" and "Browse everyone's photos", reached by a soft tap, rise full screen OVER
 * that page (`@rise/(.)decorate` · `@rise/(.)pool`), which never unmounts — ✕ / Back land on My photos at the same
 * scroll. The slot sits HERE, on the layout both addresses share, because an intercept placed under `me/[token]` never
 * fires for a sibling outside it (measured in a dev lab). A hard load of either address draws the full page, as it
 * always did; every other Papic page renders exactly as before. Null when nothing is risen.
 */
export default function PapicLayout({ children, rise }: { children: ReactNode; rise: ReactNode }) {
  return (
    <>
      {children}
      {rise}
    </>
  );
}
