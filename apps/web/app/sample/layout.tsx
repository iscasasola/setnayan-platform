import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { sampleOpensHere } from '@/lib/sample-event/switch.server';

/**
 * `/sample` — the Maria and Jose sample, signed-out, no login (owner GO
 * 2026-11-02; corpus SAMPLE_EVENT_BUILD_BRIEF_2026-11-02.md item 8).
 *
 * 🔒 BUILT DARK. With `platform_settings.sample_event_enabled` off (the
 * default) every /sample address is a plain 404 for everyone but an internal
 * account — the same answer as an address that never existed. The native app
 * shell never gets it while Apple reviews 1.0 (middleware bounces it; this
 * says the same). Every page under here ALSO opens with
 * `loadSampleOrNotFound()`, so a page that skipped this layout's gate would
 * still be closed.
 *
 * 🕶 NEVER INDEXED. noindex here covers every page beneath; no sitemap lists
 * /sample (`the-sample-is-sealed.test.ts`).
 */
export const metadata: Metadata = {
  title: 'Maria and Jose — a sample event',
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default async function SampleLayout({ children }: { children: ReactNode }) {
  if (!(await sampleOpensHere())) notFound();
  return children;
}
