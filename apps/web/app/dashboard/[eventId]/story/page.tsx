import { notFound } from 'next/navigation';
import Link from 'next/link';
import { storyGate } from '@/lib/story-opens-when-untold';
import { storyAudienceOf, storyHasBeenPublished } from '@/lib/who-can-see-your-story';
import { formatEventDate } from '@/lib/events';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import {
  EDITORIAL_SECTION_KEYS,
  readCustomColumns,
  loadEditorialChaptersForEditor,
  loadEditorialData,
  type EditorialSections,
  type Review,
} from '@/app/[slug]/_components/editorial/data';
import { composeCopy } from '@/app/[slug]/_components/editorial/compose';
import { isEditorialProActive } from '@/lib/couple-website-pro';
import { deskIsClear, percentDecided } from '@/lib/story-desk';
import { loadDesk } from './_lib/load-desk';
import { hostUserId } from './_lib/host-authority';
import { TheDesk } from './_components/the-desk';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { siteUrl } from '@/lib/social/urls';
import { publicEventUrl, resolveEventOwnerSlug } from '@/lib/public-event-url';
import { EditorialEditor } from './_components/editorial-editor';
import { guestColumnsActive } from '@/lib/guest-columns-gate';
import type { EditorialEditorInput } from './actions';
import { eventNoun } from '@/lib/event-noun';
import { sanitizeRolePalette } from '@/lib/mood-board';
import { sanitizeStoryTheme } from '@/lib/story-theme';
import { PageMasthead } from '@/app/_components/page-masthead';
import { sanitizeStoryCover } from '@/lib/story-cover';
import { loadCoverCandidates, type WrittenMinute } from './_lib/load-cover-candidates';
import { CoverStep } from './_components/cover-step';
import { WhatsNextStep } from './_components/whats-next-step';
import { nextCandidates, sanitizeNextAnnouncement, type NextTypeOption } from '@/lib/whats-next';
import { getCreatableEventTypes } from '@/lib/event-types-db';
import { eventWordsFor } from '@/app/[slug]/_lib/event-words';

/**
 * How the celebration's own page is published.
 *
 * ⚠ `invited_accounts` is a REAL fourth state (the privacy screen's "tagged
 * accounts only") and it is in the database's own CHECK constraint. This union
 * omitted it, so the cast below silently relabelled it — and the Stories
 * caveat downstream told the host their page was "Private" when it was not.
 */
type LandingVisibility = 'public' | 'unlisted' | 'invited_accounts' | 'private';

/**
 * Consolidated editorial editor (iteration 0046). One page where the couple
 * controls their post-event "front-page story": the words (→ draft_json), which
 * features show (→ draft_json.sections), and links out to the piece-editors for
 * the living hero, photos, and thank-you note. The compose engine already
 * prefers these draft_json fields; EditorialContent gates each optional block on
 * the section map. Event is read under the host session (RLS-scoped); the
 * composer-owned event_editorial row is read via the admin client.
 */
// "Editorial" is retired from CUSTOMER language (design decision 2026-09-07):
// the surface is the story, the tool is the Story Maker. The word survives only
// as internal vocabulary already baked into table and function names
// (`event_editorial`, `EditorialSections`) — renaming those is not this change.
export const metadata = { title: 'Story Maker' };

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
    .select(
      'event_id, display_name, slug, landing_page_visibility, event_type, event_date, event_end_date, archived, role_palette, moodboard_theme_name, special_message, story_cover_kind, story_cover_ref, landing_page_hero_image_url, monogram_text, monogram_color, venue_name',
    )
    .eq('event_id', eventId)
    .maybeSingle();
  if (error || !event) notFound();

  /*
    ── THE STORY OPENS WHEN THE CELEBRATION IS UNTOLD ────────────────────────
    Owner 2026-08-21: "editorial will unlock only after the event." A story is
    written about a day that happened — before it, there are no photos, no
    moments and nobody to hear from, so the editor would be a set of empty boxes
    asking a couple to invent their own wedding.

    🔑 THE GATE IS THE SHELF. `storyGate` delegates to `isFinishedEvent`, the
    same test that moves a card from "Coming up" to Untold on My Events, so the
    board and the story can never disagree. A second date comparison here would
    be a second answer to one question.

    This is a WAIT, not a refusal, so it does not use the refusal register: no
    danger colour, no "you can't". It says when it opens and what will be here.
  */
  const gate = storyGate({
    event_date: (event.event_date as string | null) ?? null,
    event_end_date: (event.event_end_date as string | null) ?? null,
    archived: (event.archived as boolean | null) ?? false,
  });
  if (!gate.open) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-ink/12 bg-white/60 p-6 sm:p-8">
          {/*
            NO EYEBROW. A "Not yet" kicker above this headline only repeats the
            headline, and page eyebrows are owner-retired (2026-08-xx: a page
            header is ONE LINE — 24px of layout for 10.5px of type that says what
            the sentence under it already says). `lint-page-masthead` enforces it.
          */}
          <h1 className="text-2xl font-extrabold tracking-[-0.02em] text-ink">
            Your story opens the day after {event.display_name as string}
          </h1>
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink/70">
            There is nothing to tell until the day has happened — no photos, no
            moments, nobody to hear from.{' '}
            {gate.opensAfter ? (
              <>
                Yours is{' '}
                <strong className="font-semibold text-ink">
                  {formatEventDate(gate.opensAfter)}
                </strong>
                .{' '}
              </>
            ) : null}
            The morning after, we write the first draft from your own schedule and
            the day&rsquo;s photos, and email you. Everything in it will be yours to
            change.
          </p>
          <Link
            href={`/dashboard/${eventId}/website`}
            className="sn-press mt-5 inline-flex items-center gap-2 rounded-full border border-ink/15 px-4 py-2 text-sm font-bold text-ink transition-colors hover:border-terracotta"
          >
            Back to your page
          </Link>
        </div>
      </div>
    );
  }

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
      const { data: me, error: meError } = await admin
        .from('users')
        .select('public_summary_consent_at')
        .eq('user_id', user.id)
        .maybeSingle();
      if (meError) {
        // Fails closed: an unread consent is not a consent.
        logQueryError(
          'EditorialPage.showcaseConsent',
          meError,
          { event_id: eventId },
          'graceful_degrade',
        );
      }
      showcaseOptedIn = Boolean(me?.public_summary_consent_at);
    }
  } catch {
    showcaseOptedIn = false;
  }

  // 🚨 THIS IS THE COUPLE'S WHOLE WRITTEN STORY — headline, deck, byline, pull
  // 🚨 quote, section order, their uploads. Supabase RESOLVES with { error }
  // 🚨 rather than throwing, so the try/catch below never saw a refusal: the
  // 🚨 draft fell back to `{}`, the editor opened BLANK, and saving from there
  // 🚨 writes the blank over what they wrote. An unread draft is not an empty
  // 🚨 draft, and they must be told before they start typing.
  let draft: Record<string, unknown> = {};
  let status = 'draft';
  let publishConsentAt: string | null = null;
  /*
    S14 · `07` Q6 — HAS THIS STORY EVER BEEN PUBLIC? The "Taken back" rung is
    offered only to a story that has, because offering it to one that never left
    the host's desk is a control with nothing behind it. Asked of `edition_no`
    rather than of `status`: the number is stamped on the FIRST publish and the
    database refuses to move it afterwards, so it is the one fact on the row that
    cannot lie about the past. `published_at` would say yes for a story that only
    ever reached guests-only.
  */
  let hasBeenPublished = false;
  let draftMeasured = true;
  try {
    const admin = createAdminClient();
    const { data: ed, error: edError } = await admin
      .from('event_editorial')
      .select('draft_json, status, publish_consent_at, edition_no')
      .eq('event_id', eventId)
      .maybeSingle();
    if (edError) {
      logQueryError(
        'EditorialPage.draft',
        edError,
        { event_id: eventId },
        'graceful_degrade',
      );
    }
    draftMeasured = !edError;
    if (ed?.draft_json && typeof ed.draft_json === 'object') {
      draft = ed.draft_json as Record<string, unknown>;
    }
    if (typeof ed?.status === 'string') status = ed.status;
    // The RA 10173 record of the consent tick. Read back so a host who agreed
    // on an earlier visit is not asked to agree again — the box comes back
    // ticked, which is what "you can go back to guests-only whenever" needs to
    // be true rather than an offer with a toll on the way back.
    if (typeof ed?.publish_consent_at === 'string' && ed.publish_consent_at.trim()) {
      publishConsentAt = ed.publish_consent_at;
    }
    hasBeenPublished = storyHasBeenPublished(
      typeof ed?.edition_no === 'number' ? ed.edition_no : null,
    );
  } catch {
    // A genuine throw — a network failure, not a refusal. Same conclusion.
    draftMeasured = false;
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

  // The couple's own columns. Read through the SAME validator the public page
  // renders through, so the editor can never show a column the page would drop —
  // a couple editing something invisible is worse than not offering it.
  const savedCustomColumns = readCustomColumns(draft);

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

  /*
    THE DESK (08 step 1.2). `loadDesk` reads with the ADMIN client — the four
    sources disagree about who their RLS admits, so a co-host reading through
    their own session would get a desk silently missing two of them. That makes
    proving authority HERE the whole fence for this read, so it is proved
    explicitly and through the caller's OWN session (`hostUserId`) rather than
    inferred from the RLS-scoped `events` read above: that read admits any event
    member, and a guest who scanned the QR is one.

    Failing to a NULL desk rather than throwing: a desk that cannot load must
    not take the shipped editor down with it.
  */
  let desk: Awaited<ReturnType<typeof loadDesk>> | null = null;
  if (await hostUserId(eventId)) {
    try {
      desk = await loadDesk(eventId);
    } catch {
      desk = null;
    }
  }

  /*
    ⚠ THE EVENT HUB PRO WALL IS RETIRED (owner 2026-08-21):
    "make this feature part of free and not part of the event hub pro."

    A non-PRO couple with no saved editorial used to meet a WebsiteProLock here
    reading "Author your front-page story … It's part of Event Hub PRO" — so the
    story Setnayan had already written ABOUT THEM was visible to them only as a
    price.

    🔑 THE OWNER'S REASON, WORTH KEEPING: we auto-craft this story for them. An
    auto-written story its own subject cannot correct reads worse than no story
    at all, and the first name a generator gets wrong is the couple's own.
    Charging to fix our sentence about their wedding is the wrong side of the
    line. PRO still sells the premium touches below (chapter curation, section
    order, manual guest wishes) — `isPro` above is unchanged and still gates
    those.

    ⛔ Do NOT reinstate this wall as a "cheap upsell". It was ruled on directly.
  */

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

  /*
    THE HOST'S SAVED BOARD. Read through `sanitizeRolePalette` — the SAME
    validator the mood board, the 3D room and the vendor mirror read through, so
    the Theme step can never show the story a colour those surfaces would drop.
    A booked-vendor mirror that skipped it is exactly the defect
    `the-vendor-sees-the-palette-the-couple-saved.test.ts` exists for.
  */
  const boardColors = sanitizeRolePalette(event.role_palette).reception ?? [];

  /*
    ═══ THE COVER (08 step 1.5) ══════════════════════════════════════════════

    🔑 THE CAPTURES ARE NOT RE-QUERIED. `chapterCards` above already carries
    every capture that passed the screen, the hidden check and the consent veto
    — `loadEditorialChaptersForEditor` runs all three. A second read here would
    be a second opinion about who consented, and the two would drift.

    "Any accepted capture from a WRITTEN minute" (`02` §6): a minute is written
    when the host gave it a title or a write-up, which is exactly what a chapter
    OVERRIDE records. A hidden one is not offered — the host already said no to
    it once, and a cover is the loudest place to ignore that.
  */
  const overrideByLead = new Map(chapterCards.overrides.map((o) => [o.leadId, o] as const));
  const writtenMinutes: WrittenMinute[] = chapterCards.cards.flatMap((c) => {
    const override = overrideByLead.get(c.leadId);
    if (!override || override.hidden) return [];
    const title = (override.title ?? '').trim() || (override.writeUp ?? '').trim();
    if (!title) return [];
    return [{
      leadId: c.leadId,
      time: c.time || 'From the day',
      thumbUrl: c.thumbUrl,
      title: override.title?.trim() || c.suggestedTitle || 'A written minute',
    }];
  });

  /*
    ⚠ BEHIND THE PROVED HOST, NOT JUST BEHIND THE RENDER. The page's own
    RLS-scoped `events` read admits ANY event member — and a guest who scanned
    the Papic QR is one (the desk above says so in its own comment). This read
    uses the admin client and returns the suppliers' unpublished frames, so
    gating it on `desk` (which is non-null only for a proved host) is the fence,
    not the `{desk ? … : null}` in the JSX. A load that runs for a guest is a
    leak waiting for someone to render it unconditionally.
  */
  /*
    ⚠ AND IT FAILS TO AN EMPTY LIST RATHER THAN THROWING — the SAME rule the desk
    load above keeps, for the same reason, twenty lines further down the page:
    *a desk that cannot load must not take the shipped editor down with it.*

    🔴 THIS WAS UNGUARDED IN THE FIRST CUT. A Server Component that throws takes
    the WHOLE route with it, so one unreadable supplier frame would have cost the
    host their entire Story Maker — the desk, the editor, the publish ladder, all
    of it — and the page would simply have failed. A cover step that cannot load
    must cost the cover step.
  */
  let coverCandidates: Awaited<ReturnType<typeof loadCoverCandidates>> = {
    items: [],
    unreadable: [],
  };
  if (desk) {
    try {
      coverCandidates = await loadCoverCandidates({
        eventId,
        heroImageRef: (event.landing_page_hero_image_url as string | null) ?? null,
        monogramText: (event.monogram_text as string | null) ?? null,
        writtenMinutes,
      });
    } catch {
      // The step renders with the living hero and the monogram only, which is
      // honest: it offers what it could prove, and never invents a candidate.
      coverCandidates = { items: [], unreadable: ['your pictures'] };
    }
  }
  const savedCover = sanitizeStoryCover(event.story_cover_kind, event.story_cover_ref);

  /*
    ═══ WHAT'S NEXT (08 step 1.7) ════════════════════════════════════════════

    DERIVED, NEVER CREATED. The roster is the admin's own (`event_type_vocab`),
    so a type HQ retires stops being offered here with no deploy; `solemn` is
    resolved per type from its profile rather than by naming `wake` in a list
    this screen would then have to maintain.
  */
  /*
    ⚠ GUARDED FOR THE SAME REASON, and this one resolves a profile PER TYPE — so
    a single unresolvable event type would otherwise reject the whole
    `Promise.all` and take the route down. An empty roster offers no next
    celebration at all, which is the resting state the owner ruled is a complete
    answer; a thrown page is not.
  */
  let roster: NextTypeOption[] = [];
  if (desk) {
    try {
      roster = await Promise.all(
        (await getCreatableEventTypes()).map(async (t) => ({
          key: t.key,
          label: t.label,
          solemn: (await eventWordsFor(t.key)).solemn,
        })),
      );
    } catch {
      roster = [];
    }
  }
  const nextOffered = nextCandidates({
    eventDateISO: (event.event_date as string | null) ?? null,
    todayISO: new Date().toISOString().slice(0, 10),
    roster,
    formatDate: formatEventDate,
  });
  const announced = sanitizeNextAnnouncement(draft.whatsNext, nextOffered);

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
    // WHO MAY READ IT. Was a boolean `publish`; a boolean cannot express the
    // middle answer, and its `false` meant BOTH "only me" and "I have simply
    // pressed Save", so a couple had no way to say "my guests, and nobody else".
    audience: storyAudienceOf(status),
    // The story's colours. `sanitizeStoryTheme` fails to "follow my mood board"
    // for anything it does not recognise, which is the resting state — a host
    // who has never opened this step tracks the board they already made.
    theme: sanitizeStoryTheme(draft.storyTheme),
    // The consent tick is a RECORD, not a form field: the editor sends `true`
    // only on the press that ticks it. What the host already agreed to is read
    // back through `publishConsentAt` below.
    publishConsent: false,
    // The host's last word — `events.special_message`, the same column the
    // thank-you-note editor writes. Two doors, one room.
    lastWord: (event.special_message as string | null) ?? '',
  };

  // Canonical share URL (posted to Facebook + cached by OG crawlers) — nested
  // /u/ under the cutover flag, bare root otherwise (resolve self-noops OFF).
  const ownerSlug = await resolveEventOwnerSlug(createAdminClient(), eventId);
  const shareUrl = event.slug
    ? publicEventUrl(siteUrl().replace(/\/$/, ''), event.slug, ownerSlug)
    : null;

  return (
    <div className="mx-auto max-w-[1010px] px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href={`/dashboard/${eventId}/website`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink/65 transition-colors hover:text-burgundy focus-visible:text-burgundy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        <span>Back to Event Hub</span>
      </Link>

      <PageMasthead
        title="Story Maker"
      />

      {/*
        THE DESK (08 step 1.2) — one queue over four sources, and STEP ONE of six. It is handed
        to the editor as a SLOT rather than rendered above it: the six steps are a tab switcher,
        and a panel living outside the switcher is a section that can never be switched away
        from. Same slot pattern as `cover` and `whatsNext`, for the same reason — it renders
        ONLY for a proved host, because `loadDesk` reads with the admin client and its authority
        cannot be left to the page's own RLS-scoped event read.
      */}

      {!draftMeasured ? (
        <p
          role="alert"
          className="mb-6 rounded-2xl border-t-[3px] border-mulberry/70 bg-mulberry/5 p-4 text-sm text-ink/70"
        >
          <strong className="text-ink">
            We couldn&rsquo;t load the story you saved.
          </strong>{' '}
          What you see below is blank because of that, not because your words are
          gone. Reload before writing again &mdash; saving now would replace them.
        </p>
      ) : null}

      <EditorialEditor
        eventId={eventId}
        slug={event.slug ?? null}
        initial={initial}
        uploadDisplayUrls={uploadDisplayUrls}
        isPro={isPro}
        chapterCards={chapterCards.cards}
        chapterOverrides={chapterCards.overrides}
        savedSectionOrder={savedSectionOrder}
        savedCustomColumns={savedCustomColumns}
        savedReviews={savedReviews}
        guestColumnsOn={await guestColumnsActive()}
        shareUrl={shareUrl}
        showcaseOptedIn={showcaseOptedIn}
        landingVisibility={landingVisibility}
        eventType={(event.event_type as string | null) ?? 'wedding'}
        boardColors={boardColors}
        boardThemeName={(event.moodboard_theme_name as string | null) ?? null}
        /*
          THE PUBLISH GATE (08 step 1.6). The desk is loaded once, above, and its
          verdict is handed down rather than re-derived — a second count here
          would be a second opinion about whether a host may publish.

          ⚠ `deskLoaded` IS FALSE WHEN THE DESK COULD NOT BE READ AT ALL (not a
          proved host, or the read was refused) AND when any single source came
          back unreadable. An unreadable source and an empty one look identical,
          so an incomplete desk has not proved it is clear.
        */
        deskLoaded={desk !== null && desk.unreadable.length === 0}
        deskClear={desk !== null && deskIsClear(desk.items)}
        deskOpenCount={desk ? desk.counts.open : 0}
        deskPercentDecided={desk ? percentDecided(desk.items) : 0}
        publishConsentAt={publishConsentAt}
        hasBeenPublished={hasBeenPublished}
        /*
          THE FOURTH AND FIFTH STEPS, rendered here and handed down as slots:
          each needs a server read the editor must not make. They render ONLY
          for a proved host — the same fence the desk above uses, because the
          cover's own write is a service-role write authorised by it.
        */
        desk={
          desk ? (
            <TheDesk
              eventId={eventId}
              items={desk.items}
              unreadable={desk.unreadable}
              lettersDark={desk.lettersDark}
            />
          ) : null
        }
        cover={
          desk ? (
            <CoverStep
              eventId={eventId}
              candidates={coverCandidates.items}
              unreadable={coverCandidates.unreadable}
              initial={savedCover}
              displayName={(event.display_name as string) ?? ''}
              monogramText={(event.monogram_text as string | null) ?? null}
              monogramColor={(event.monogram_color as string | null) ?? null}
              metaLine={[
                event.event_date ? formatEventDate(event.event_date as string) : null,
                (event.venue_name as string | null) ?? null,
              ]
                .filter(Boolean)
                .join(' · ')}
              uploadDisplayUrls={uploadDisplayUrls}
            />
          ) : null
        }
        whatsNext={
          desk ? (
            <WhatsNextStep
              eventId={eventId}
              candidates={nextOffered}
              initialKind={announced?.kind ?? null}
            />
          ) : null
        }
      />
    </div>
  );
}
