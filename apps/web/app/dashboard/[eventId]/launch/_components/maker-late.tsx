'use client';

import { use, useEffect } from 'react';
import type { MakerLate } from '@/lib/maker-late';

/**
 * ⚡ Takes up the panels that arrive behind the Maker (`lib/maker-late.ts`). It sits in its own
 * `<Suspense fallback={null}>` inside the shell, so waiting for them suspends NOTHING the couple sees —
 * never the canvas, never the toolbar — and hands them to the shell's state once they are in.
 */
export function MakerLateBridge({ late, onLate }: { late: Promise<MakerLate>; onLate: (value: MakerLate) => void }) {
  const value = use(late);
  useEffect(() => {
    onLate(value);
  }, [value, onLate]);
  return null;
}
