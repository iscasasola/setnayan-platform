'use client';

import dynamic from 'next/dynamic';

/**
 * ⚡ The Maker's instant scrapbook (`love-story-live.tsx`), loaded with Details'
 * pieces (`maker-details` chunk) — never in the Maker's first load, and never on
 * the standalone Love Story page (which draws `LoveStoryBook` itself). Its own
 * tiny module so that page does not pull in every Details stand-in
 * (`details-lazy.tsx`) to reach this one.
 */
export const LiveLoveStoryBook = dynamic(
  () => import(/* webpackChunkName: "maker-details" */ './love-story-live').then((m) => m.LiveLoveStoryBook),
);
