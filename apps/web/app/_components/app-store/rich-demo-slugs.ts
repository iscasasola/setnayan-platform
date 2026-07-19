// Server-safe list of feature slugs that have a built-in native demo scene in
// studio-card-demo.tsx (`RICH_SCENES`).
//
// WHY THIS MODULE EXISTS (the 3349409504 crash): studio-card-demo.tsx is a
// `'use client'` module — its `RICH_SCENES` holds JSX (`scene: ReactNode`), so it
// can't move to the server. But the App Store layout (app-store/layout.tsx) is a
// SERVER component and needs the *slug list* to decide whether to render the demo
// section. When a server component imports a DATA export from a `'use client'`
// module, Next.js hands it a client-reference proxy — NOT the array — so
// `RICH_DEMO_SLUGS.includes(...)` threw "includes is not a function" and crashed
// every About page whose feature has no `demo` frames (papic short-circuited past
// it via its `detail.demo`, which is why only papic's About worked). Dev masked
// it (non-fatal); the production build threw it fatally.
//
// Keeping the slug list in this plain (server-safe) module lets the server read
// the real array. `RICH_SCENES` is typed against this list in studio-card-demo.tsx
// (`Record<(typeof RICH_DEMO_SLUGS)[number], …>`), so the two can't drift — adding
// or removing a scene without updating this list is a compile error.
export const RICH_DEMO_SLUGS = [
  'papic',
  'save-the-date',
  'animated-monogram',
  'mood-board',
  'custom-qr-guest',
  'photo-delivery',
  'patiktok',
  'led',
  'indoor-blueprint',
  'setnayan-ai',
  'landing-page',
  'music-creator',
  'pakanta',
  'playlist',
] as const;

export type RichDemoSlug = (typeof RICH_DEMO_SLUGS)[number];

const RICH_DEMO_SLUG_SET: ReadonlySet<string> = new Set(RICH_DEMO_SLUGS);

/** Does this feature slug have a built-in native demo scene? Server-safe. */
export function isRichDemoSlug(slug: string | null | undefined): boolean {
  return slug != null && RICH_DEMO_SLUG_SET.has(slug);
}
