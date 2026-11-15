'use client';

import { lazy, Suspense, type ComponentProps } from 'react';
import type { InlineNotice as InlineNoticeImpl } from './inline-notice';

/**
 * The door to `InlineNotice` for the ROOT layout's notices ("Setnayan was updated", demo mode). Everything the root
 * layout's client tree touches lands in the SHARED chunk every visitor downloads (202.3 KB budget,
 * `scripts/check-bundle-size.mjs`), so those mounts fetch the notice's code only once they have something to say.
 * A bare `React.lazy` (the `date-sheet-lazy.tsx` reasoning); the module is the same one every static import uses.
 */
const Impl = lazy(() => import('./inline-notice').then((m) => ({ default: m.InlineNotice })));

export function LazyInlineNotice(props: ComponentProps<typeof InlineNoticeImpl>) {
  return (
    <Suspense fallback={null}>
      <Impl {...props} />
    </Suspense>
  );
}
