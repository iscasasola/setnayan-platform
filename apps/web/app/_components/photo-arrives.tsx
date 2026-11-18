'use client';

import { useEffect } from 'react';
import { watchPhotosArrive } from '@/lib/photo-arrives';

/**
 * Photo arrives (motion standard 18 Nov 2026, § 4 #20) — mounted ONCE in the root layout, beside the top loading
 * line. One capture listener; every photo that carries `PHOTO_ARRIVES` (`lib/photo-arrives.ts`) fades and settles
 * in as it lands. Renders nothing; never hides a photo; makes no request.
 */
export function PhotoArrives() {
  useEffect(() => watchPhotosArrive(document, window), []);
  return null;
}
