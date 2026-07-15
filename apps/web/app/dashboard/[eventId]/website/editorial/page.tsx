import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  EDITORIAL_SECTION_KEYS,
  loadEditorialChaptersForEditor,
  loadEditorialData,
  type EditorialSections,
  type Review,
} from '@/app/[slug]/_components/editorial/data';
import { composeCopy } from '@/app/[slug]/_components/editorial/compose';
import { isEditorialProActive } from '@/lib/couple-website-pro';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { siteUrl } from '@/lib/social/urls';
import { publicEventUrl, resolveEventOwnerSlug } from '@/lib/public-event-url';
import { EditorialEditor } from './_components/editorial-editor';
import type { EditorialEditorInput } from './actions';
import { eventNoun } from '@/lib/event-noun';

type LandingVisibility = 'public' | 'unlisted' | 'private';

/**
 * Consolidated editorial editor (iteration 0046). One page where the couple
 * controls their post-event "front-page story": the words (→ draft_json), which
 * features show (→ draft_json.sections), and links out to the piece-editors for
 * the living hero, photos, and thank-you note. The compose engine already
 * prefers these draft_json fields; EditorialContent gates each optional block on
 * the section map. Event is read under the host session (RLS-scoped); the
 * composer-owned event_editorial row is read via the admin client.
 */
export const metadata = { title: 'Editorial' };

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

export default async function EditorialEditorPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const supabase = await createClient();

  const { data: event, error } = await supabase
    .from('events')
    .select('event_id, display_name, slug, landing_page_visibility, event_type')
    .eq('event_id', eventId)
    .maybeSingle();
  if (error || !event) notFound();

  // Showcase props — so the couple can publish AND opt into Real Stories from
  // here (the consent flag is per-user; the visibility gates hub eligibility).
  const landingVisibility = ((event.landing_page_visibility as string) ??
    'public') as LandingVisibility;
  let showcaseOptedIn = false;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const admin = createAdminClient();
      const { data: me } = await admin
        .from('users')
        .select('public_summary_consent_at')
        .eq('user_id', user.id)
        .maybeSingle();
      showcaseOptedIn = Boolean(me?.public_summary_consent_at);
    }
  } catch {
    showcaseOptedIn = false;
  }

  let draft: Record<string, unknown> = {};
  let status = 'draft';
  try {
    const admin = createAdminClient();
    const { data: ed } = await admin
      .from('event_editorial')
      .select('draft_json, status')
      .eq('event_id', eventId)
      .maybeSingle();
    if (ed?.draft_json && typeof ed.draft_json === 'object') {
      draft = ed.draft_json as Record<string, unknown>;
    }
    if (typeof ed?.status === 'string') status = ed.status;
  } catch {
    // best-effort — fall back to empty defaults (engine auto-writes everything).
  }

  const sectionsRaw =
    draft.sections && typeof draft.sections === 'object'
      ? (draft.sections as Record<string, unknown>)
      : {};
  const sections = EDITORIAL_SECTION_KEYS.reduce((acc, k) => {
    acc[k] = sectionsRaw[k] !== false; // default on
    return acc;
  }, {} as EditorialSections);

  const leadArr = Array.isArray(draft.lead_paragraphs)
    ? (draft.lead_paragraphs as unknown[]).map(str).filter(Boolean)
    : [];

  // FREE couple-uploaded imagery (draft_json.heroUpload + draft_json.galleryUploads).
  // Read the stored `r2://…` refs and resolve presigned display URLs so the editor's
  // FileUpload widgets can show existing uploads as thumbnails on mount.
  const heroUploadRef = str(draft.heroUpload);
  const galleryUploadRefs = Array.isArray(draft.galleryUploads)
    ? (draft.galleryUploads as unknown[]).map(str).filter(Boolean).slice(0, 30)
    : [];
  const uploadDisplayUrls: Record<string, string> = {};
  await Promise.all(
    [heroUploadRef, ...galleryUploadRefs]
      .filter((r) => r.length > 0)
      .map(async (ref) => {
        try {
          const url = await displayUrlForStoredAsset(ref);
          if (url) uploadDisplayUrls[ref] = url;
        } catch {
          /* best-effort — a missing thumbnail still lists the file + remove btn */
        }
      }),
  );

  // PRO section order (draft_json.sectionOrder → string[] | null). The editor
  // resolves the full order from this + the canonical default; a bad value is a
  // harmless [] here (sanitized again server-side).
  const savedSectionOrder = Array.isArray(draft.sectionOrder)
    ? (draft.sectionOrder as unknown[]).filter((v): v is string => typeof v === 'string')
    : null;

  // PRO guest-wishes (draft_json.reviews). Read the saved rows so the editor can
  // list them for editing; each row is coerced to the Review shape (blank-safe).
  const savedReviews: Review[] = Array.isArray(draft.reviews)
    ? (draft.reviews as unknown[]).map((r): Review => {
        const o = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
        const starsNum = Number(o.stars);
        return {
          author: typeof o.author === 'string' ? o.author : '',
          role: typeof o.role === 'string' && o.role.trim() ? o.role : null,
          quote: typeof o.quote === 'string' ? o.quote : '',
          stars: Number.isFinite(starsNum) && starsNum >= 1 ? Math.min(5, Math.round(starsNum)) : null,
        };
      })
    : [];

  // Editorial PRO — the "Editor's Desk" authorship gate (à-la-carte EDITORIAL_PRO
  // OR the Couple Website PRO umbrella; dual-unlock in lib/couple-website-pro).
  // Server-side; the editor renders authorship inputs read-only for free couples
  // and saveEditorial re-checks this, so the client flag is presentation only.
  let isPro = false;
  try {
    isPro = await isEditorialProActive(createAdminClient(), eventId);
  } catch {
    isPro = false;
  }

  // Compose the couple's CURRENT editorial copy — their own draft_json overrides
  // ON TOP of the onboarding-derived defaults (names → headline, archetype →
  // eyebrow, years-together + date + venue + tone → sub-headline, guest message →
  // pull-quote). So the editor opens PRE-FILLED with their own content, ready to
  // edit; clearing a field on save reverts it to the auto-written default.
  // Best-effort: if it can't be composed, fall back to the raw draft values.
  let composed: ReturnType<typeof composeCopy> | null = null;
  try {
    const edData = await loadEditorialData(eventId);
    if (edData) composed = composeCopy(edData);
  } catch {
    composed = null;
  }

  // "As the Day Unfolded" chapter cards (auto-built, unfiltered, timeline order)
  // + the couple's current per-chapter overrides. Best-effort: a non-Papic event
  // returns no cards and the editor hides the panel.
  let chapterCards: Awaited<ReturnType<typeof loadEditorialChaptersForEditor>> = {
    cards: [],
    overrides: [],
  };
  try {
    chapterCards = await loadEditorialChaptersForEditor(eventId);
  } catch {
    chapterCards = { cards: [], overrides: [] };
  }

  const initial: EditorialEditorInput = {
    headline: composed?.headline || str(draft.headline),
    deck: composed?.deck || str(draft.deck),
    superKicker: composed?.superKicker || str(draft.super) || str(draft.kicker),
    byline: composed?.byline || str(draft.byline),
    // "Your story" stays the couple's own — the editorial body intentionally
    // drops the auto love-narrative (it lives on the run-up paths), so we never
    // pre-fill it with the composed lede.
    leadParagraphs: leadArr.join('\n\n'),
    pullQuote: composed?.pullQuote || str(draft.pull_quote) || str(draft.pullQuote),
    // FREE couple uploads — the saved refs (empty when none). The editor mirrors
    // these into FileUpload widgets and sends the current set back on save.
    heroUpload: heroUploadRef,
    galleryUploads: galleryUploadRefs,
    sections,
    // The editor derives its own working rows from the cards + overrides below;
    // `chapterOverrides` in `initial` is only the save-shape default.
    chapterOverrides: [],
    // The editor computes the working section order + wishes from the props
    // below; these `initial` values are only the save-shape defaults.
    sectionOrder: savedSectionOrder,
    reviews: savedReviews,
    publish: status === 'published',
  };

  // Canonical share URL (posted to Facebook + cached by OG crawlers) — nested
  // /u/ under the cutover flag, bare root otherwise (resolve self-noops OFF).
  const ownerSlug = await resolveEventOwnerSlug(createAdminClient(), eventId);
  const shareUrl = event.slug
    ? publicEventUrl(siteUrl().replace(/\/$/, ''), event.slug, ownerSlug)
    : null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href={`/dashboard/${eventId}/website`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink/65 transition-colors hover:text-burgundy focus-visible:text-burgundy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        <span>Back to website</span>
      </Link>

      <header className="mb-8 space-y-2">
        <h1 className="font-display text-3xl italic text-ink sm:text-4xl">Editorial</h1>
        <p className="max-w-prose text-sm text-ink/65 sm:text-base">
          Your {eventNoun(event.event_type)}&rsquo;s front-page story — published after the day. It starts written from your
          {' '}{eventNoun(event.event_type)} details; edit the words, choose your photos and hero, and pick which features show.
          Clear any field and we&rsquo;ll rewrite it for you, so it always reads beautifully.
        </p>
      </header>

      <EditorialEditor
        eventId={eventId}
        slug={event.slug ?? null}
        initial={initial}
        uploadDisplayUrls={uploadDisplayUrls}
        isPro={isPro}
        chapterCards={chapterCards.cards}
        chapterOverrides={chapterCards.overrides}
        savedSectionOrder={savedSectionOrder}
        savedReviews={savedReviews}
        shareUrl={shareUrl}
        showcaseOptedIn={showcaseOptedIn}
        landingVisibility={landingVisibility}
        isWedding={(event.event_type ?? 'wedding') === 'wedding'}
      />
    </main>
  );
}
