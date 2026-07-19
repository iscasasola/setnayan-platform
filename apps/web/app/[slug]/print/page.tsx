// ============================================================================
// GET /[slug]/print — the A3 broadsheet PRINT KEEPSAKE (Editorial slice A)
// ============================================================================
//
// A print-first render of the couple's post-event editorial: an A3-portrait
// broadsheet the couple can send to the browser's Print / Save-as-PDF dialog.
// Front is always full; a conditional back prints only when content warrants it
// (see keepsake-layout.needsBackPage). The QR colophon always closes the last
// side, linking back to the living editorial at /[slug].
//
// Spec: Editorial_Experience_Spec_2026-06-18 §8 — A3 full-page (owner-locked
// 2026-07-04). PDF-download generation is a follow-up slice; this is the route.
//
// VISIBILITY — mirrors the editorial page exactly:
//   • canViewSlugEvent() is the SAME public/unlisted/private gate the editorial
//     itself applies (extracted to lib/slug-access, shared here — not duplicated).
//   • PHASE gate: pre-editorial, HOSTS may preview (like ?phase=editorial on the
//     page), but anonymous visitors are blocked until the event is past.
// ============================================================================

import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveProfile, surfaceEnabled } from '@/lib/event-type-profile';
import { RESERVED_SLUGS } from '@/lib/reserved-slugs';
import { canViewSlugEvent, isSignedInEventHost } from '@/lib/slug-access';
import { getLifecyclePhase } from '@/lib/invitation-widgets';
import { renderUrlQrSvg } from '@/lib/qr';
import { eventCoupleWebsiteProActive } from '@/lib/couple-website-pro';
import {
  resolveEventMonogram,
  HERO_MONOGRAM_COLUMNS,
  type HeroMonogramData,
} from '@/lib/hero-monogram-data';
import {
  loadEditorialData,
  type EditorialData,
} from '../_components/editorial/data';
import { composeCopy, type ComposedCopy } from '../_components/editorial/compose';
import { KEEPSAKE_CSS } from './keepsake.css';
import { PrintSheet } from './print-sheet';
import { PrintToolbar } from './print-toolbar';

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '');

// The keepsake is a snapshot of a published editorial; a short revalidate keeps
// it fresh without a per-request DB round-trip. Matches the editorial's cadence.
export const revalidate = 300;

const fetchEvent = cache(async (slug: string) => {
  const admin = createAdminClient();
  const { data } = await admin
    .from('events')
    .select(
      `event_id, slug, display_name, event_type, event_date, landing_page_visibility, ${HERO_MONOGRAM_COLUMNS}`,
    )
    .ilike('slug', slug)
    .maybeSingle();
  return data;
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // A print keepsake is never something we want indexed — it's a utility view.
  return { title: 'Print keepsake', robots: { index: false, follow: false } };
}

export default async function EditorialPrintPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!slug || RESERVED_SLUGS.has(slug)) notFound();

  const event = await fetchEvent(slug);
  if (!event) notFound();

  // Iteration 0053: the editorial is the 'website' surface — non-website event
  // types don't have one (config-driven), matching the editorial page.
  if (!surfaceEnabled(await resolveProfile(event.event_type), 'website')) notFound();

  // (1) Visibility gate — IDENTICAL to the editorial (canViewSlugEvent): a
  // private (pre-launch) page never leaks through this URL to a stranger; a
  // cookie-guest or signed-in host passes. Bounce blocked strangers to the
  // public page rather than 404 (same UX the recap route uses).
  if (!(await canViewSlugEvent(event.event_id, event.landing_page_visibility))) {
    redirect(`/${slug}`);
  }

  // (2) Phase gate — the keepsake is a POST-event artifact. Anonymous visitors
  // only see it once the event is past (lifecycle === 'editorial'); a signed-in
  // HOST may preview it any time (mirrors the page's ?phase=editorial host
  // preview allowance). Pre-event, a non-host is bounced to the live page.
  const isEditorialPhase = getLifecyclePhase(event.event_date) === 'editorial';
  if (!isEditorialPhase) {
    const hostPreview = await isSignedInEventHost(event.event_id);
    if (!hostPreview) redirect(`/${slug}`);
  }

  // Load the SAME editorial data the on-screen editorial renders. Best-effort:
  // a null / throw degrades to the "not ready yet" stand-in.
  let data: EditorialData | null = null;
  try {
    data = await loadEditorialData(event.event_id);
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <main
        className="keepsake-root"
        style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <style dangerouslySetInnerHTML={{ __html: KEEPSAKE_CSS }} />
        <p style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', color: '#e7e2d6', fontSize: 18 }}>
          This keepsake isn&rsquo;t ready to print yet.
        </p>
      </main>
    );
  }

  // Composed copy (headline / deck / lead paragraphs / pull quote), same source
  // as the editorial, wrapped so a compose failure still prints a bare headline.
  let copy: ComposedCopy;
  try {
    copy = composeCopy(data);
  } catch {
    copy = {
      superKicker: 'A celebration',
      headline: `${data.displayName} Are Married`,
      deck: '',
      byline: 'By the Setnayan Desk',
      leadParagraphs: [],
      pullQuote: null,
    };
  }

  // The couple's mark, resolved exactly like the editorial masthead (we force it
  // STILL at render time by passing animatedMonogram=false in PrintSheet).
  let mono: HeroMonogramData | null = null;
  try {
    const admin = createAdminClient();
    const { data: monoRow } = await admin
      .from('events')
      .select(HERO_MONOGRAM_COLUMNS)
      .eq('event_id', event.event_id)
      .maybeSingle();
    mono = await resolveEventMonogram(admin, event.event_id, monoRow);
  } catch {
    mono = null;
  }

  // Free-tier watermark parity — reuse EXACTLY the flag the editorial colophon
  // uses (data.sections is content, not the watermark; the watermark is the
  // COUPLE_WEBSITE_PRO perk). data.ts doesn't carry it, so resolve it here the
  // same way editorial-content.tsx does.
  let hideWatermark = false;
  try {
    hideWatermark = await eventCoupleWebsiteProActive(createAdminClient(), event.event_id);
  } catch {
    hideWatermark = false;
  }

  // The QR encodes the canonical living-story URL. Reuse the platform QR
  // machinery (lib/qr renderUrlQrSvg — the same ink/cream, level-H, quiet-zone
  // renderer the invitation/seat QRs use). Best-effort: a QR failure just drops
  // the code, never the sheet.
  const storyUrl = `${SITE_URL}/${event.slug ?? slug}`;
  let qrSvg = '';
  try {
    qrSvg = await renderUrlQrSvg(storyUrl, 240);
  } catch {
    qrSvg = '';
  }

  return (
    <main className="keepsake-root">
      <style dangerouslySetInnerHTML={{ __html: KEEPSAKE_CSS }} />
      <PrintToolbar backHref={`/${event.slug ?? slug}`} />
      <PrintSheet data={data} copy={copy} mono={mono} qrSvg={qrSvg} hideWatermark={hideWatermark} />
    </main>
  );
}
