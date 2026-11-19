'use client';

import { GlideMount } from './glide-mount';
import { OfflineBar } from './offline-bar';

/**
 * 🎞 The two app-wide mounts of the motion standard's Phase 6 (MOTION_STANDARD_2026-11-18 § 4): the Offline bar (#28)
 * and Glide's one listener (#12). Loaded after the page from `app/providers.tsx` (never in the shared first load).
 */
export function MotionMounts() {
  return (
    <>
      <OfflineBar />
      <GlideMount />
    </>
  );
}
