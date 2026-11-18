'use client';
/**
 * 🎬 STORY VIDEO — the door. The recorder and its canvas scene (`story-video-impl.tsx` + `story-rig.ts`) are fetched
 * only when someone taps "Share to story", so they cost no page bundle (202.3 KB shared budget, never raised).
 * A bare `React.lazy`, as `notices/inline-notice-lazy.tsx` does; one named chunk shared with the seal's entrance.
 *
 * Mount it to make the story; `onClose` unmounts it.
 */
import { lazy, Suspense } from 'react';
import type { StoryVideoProps } from './story-video-impl';

export type { StoryVideoProps } from './story-video-impl';
export type { StoryInput } from './story-rig';

const Impl = lazy(() => import(/* webpackChunkName: "award-story" */ './story-video-impl').then((m) => ({ default: m.StoryVideoImpl })));

export function StoryVideo(props: StoryVideoProps) {
  return (
    <Suspense fallback={null}>
      <Impl {...props} />
    </Suspense>
  );
}
