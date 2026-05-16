'use client';

// Thin client-only wrapper for `_StickyMobileCTA`.
//
// `next/dynamic({ ssr: false })` is forbidden inside a React Server
// Component in Next 15 — but the sticky thumb-zone CTA is purely an
// after-hydration mobile widget (it doesn't need to be in the SSR HTML
// to function, and rendering it on desktop is wasted bytes since it's
// `lg:hidden`). Wrapping the lazy import inside this tiny client module
// lets the homepage Server Component still call `<DynamicStickyMobileCTA />`
// while keeping the actual widget JS off the initial client bundle.

import dynamic from 'next/dynamic';

const StickyMobileCTA = dynamic(
  () => import('./_StickyMobileCTA'),
  { ssr: false },
);

export function DynamicStickyMobileCTA() {
  return <StickyMobileCTA />;
}
