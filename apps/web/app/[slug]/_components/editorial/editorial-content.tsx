// ============================================================================
// Editorial recap page — the post-wedding "newspaper front page" (Increment D)
// ============================================================================
//
// Server component. Mounted by the public site renderer when the site enters
// its "editorial" phase (a parallel task wires that — this module does NOT
// touch the renderer or [slug]/page.tsx). Renders standalone and NEVER throws:
// the data layer is fully best-effort and every section degrades gracefully
// when its data is absent.
//
// Spec: Wedding_Website_Lifecycle_Spec_2026-06-07 §6.3–6.8.
// Mockup: Editorial_Page_Mockup_2026-06-07.html.
//
// Visual language matches the [slug] invitation site: warm-alabaster ground,
// Cormorant Garamond serif (font-serif/font-display), DM Mono eyebrows
// (font-mono uppercase tracked), champagne-gold accent (text-terracotta-700 —
// the DEEPER gold; the default slot measures 3.48:1 on the page ground and
// cannot carry 12px type. See the eyebrow note above the first one),
// mulberry CTAs, hairline rules in ink/10..ink/80.
// ============================================================================

import { Fragment, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import { Printer } from 'lucide-react';
import {
  loadEditorialData,
  resolveSectionOrder,
  customColumnId,
  shippedSections,
  type EditorialData,
  type EditorialOrderKey,
} from './data';
// From the pure module, not the re-export in `./data` — same predicate, but this
// path carries no `server-only`, so the guard stays reachable to a unit test.
import { isSampleEditorialId } from './sample-ids';
import {
  editorialPhotoBlocks,
  editorialGalleryAnchorKey,
  type EditorialPhotoKey,
} from './gallery-anchor';
import { KwentoClip } from './living-moments';
import { composeCopy, type ComposedCopy } from './compose';
import { ShareButtons } from '@/app/realstories/_components/share-buttons';
import { SaveStoryCardButton } from '@/app/[slug]/recap/_components/save-story-card-button';
import { createAdminClient } from '@/lib/supabase/admin';
import { storyAudienceAdmits, STRANGER, type StoryViewer } from '@/lib/who-can-see-your-story';
import { redactStoryLayers } from '@/lib/the-guests-layer-is-theirs-until-you-publish';
import { eventCoupleWebsiteProActive } from '@/lib/couple-website-pro';
import { eventWordsForEvent, type EventWords } from '../../_lib/event-words';
import {
  resolveEventMonogram,
  HERO_MONOGRAM_COLUMNS,
  type HeroMonogramData,
} from '@/lib/hero-monogram-data';
import { HeroMonogram } from '@/app/_components/hero-monogram';
import { StorySpine } from '../story/story-spine';
import { BackCoverBlock } from '../story/back-cover';
import { storyTapHref } from '@/lib/a-tap-from-the-story';
import { loadBackCover } from '../../_lib/back-cover.server';
import { loadPreviousEdition, type PreviousEdition } from '../../_lib/previous-edition.server';
import type { BackCover } from '@/lib/the-back-cover';
import { loadYourOwnDay } from '../../_lib/your-own-day.server';
import { ROAD_STAGE, deriveStages, neutralStages, paintAtRest } from '@/lib/story-light';
import { loadStorySpineFacts, sampleSpineFacts, type StorySpineFacts } from '../story/spine-data';
import { loadStoryPages, type DrawnSheet } from '@/lib/story-pages';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { POST_EVENT_WAITING, galleryTabsFor, postEventReader, postEventSceneKeyForBlock } from '@/lib/post-event-scenes';
import { OpenUpScene, OpenUpTabs } from './open-up-layer';
import type { PostEventDraft } from '@/lib/post-event-draft';
import { postEventElementScope, postEventLookKey, postEventStyleHome } from '@/lib/post-event-styles';
import { resolvePostEventStyle } from '@/lib/post-event-style-resolve';
import { hubElementSceneCss } from '@/lib/element-style';
import { filmTimecode, mastheadEdition } from '@/lib/story-spine';
import { guestLayerAdmits } from '@/lib/the-guests-layer-is-theirs-until-you-publish';
import { loadEntourage } from '../../_lib/loaders';
import type { EntourageGroup } from '@/lib/entourage';
import { BeforeAfterScene, EntourageScene, RoadScene, SeatingScene, type RoadEntry } from './post-event-scene-views-3';
import {
  FrontPageScene,
  GalleryPreview,
  PeWaiting,
  PostEventSceneFrame,
  ScheduleScene,
  StatisticsScene,
  ThankYouScene,
} from './post-event-scene-views';
import { POST_EVENT_SUPPLIERS_ANCHOR, postEventSupplierStoriesDrawn, postEventSuppliersAnchorKey } from './post-event-bar-facts';
import {
  ChallengeScene,
  LiveStreamPreview,
  MessagesScene,
  PhotoNotesScene,
  SupplierStoriesScene,
  VideosScene,
} from './post-event-scene-views-2';
import { PHOTO_NOTES_LABEL } from '@/lib/post-event-styles';

const SHARE_SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(
  /\/$/,
  '',
);

/** The "Watch the Film" section's anchor. Named once so the section that OWNS it
 *  and the colophon link that AIMS at it cannot drift apart. */
const WATCH_FILM_ANCHOR_ID = 'watch-the-film';

/** 'wedding' → 'Wedding'; 'gender reveal' → 'Gender Reveal'. Two slots in this
 *  file are Title Case headings ("The Wedding Day (Live)"), so the event word
 *  has to be capitalised per word rather than lower-cased into them. */
function capitaliseWords(s: string): string {
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

export async function EditorialContent({
  eventId,
  share,
  galleryAnchorId = null,
  viewer = STRANGER,
  magicTraveller = null,
  makerMarkers = false,
  draft = null,
  hostPreview = false,
  sharedStyles = null,
}: {
  /**
   * 🎨 The style picked on a SECTION that is the same scene on another stage
   * (`POST_EVENT_STYLE_HOME`: the Schedule and Gallery rows' `canvas.style`),
   * by widget type — one value across stages. Null → every such scene wears
   * its default.
   */
  sharedStyles?: Readonly<Record<string, string | null>> | null;
  /**
   * 💾 THE HOST'S DRAFT OF POST EVENT'S SCENES (owner 2026-09-25 "POST EVENT
   * IS MANY SMALL SCENES", 2026-09-29 "EVERY STYLE OF EVERY SCENE SHIPS") —
   * which scenes show, their order, and each scene's look, as drafted in the
   * Maker (`HubDraft.editorial`). Handed in ONLY for the Maker's canvas and its
   * whole-stage preview, whose host the page already verified
   * (`loadHostPreviewDraft`); every guest and stranger gets null, and their
   * story renders from the live row exactly as before.
   */
  draft?: PostEventDraft | null;
  /**
   * 🕰 THE COUPLE'S OWN PREVIEW (the Maker's canvas and "Preview the whole
   * stage"). A scene with nothing in it yet is drawn with the line that says
   * what fills it — for the couple only. False for every guest: they never
   * meet an empty scene.
   */
  hostPreview?: boolean;
  eventId: string;
  /** Share target for the editorial's own "Share this story" element. Omit for a
   *  real editorial and it falls back to the couple's own /[slug]; the sample
   *  detail passes its /realstories/[slug] target. */
  share?: { url: string; title: string; image: string } | null;
  /**
   * The id the event site's Gallery tab scrolls to, stamped on whichever photo
   * block this edition draws FIRST (see `gallery-anchor.ts`). Passed only by the
   * event site, which owns that bar; the /realstories sample and the print view
   * have no bar and leave it null, so their markup is unchanged.
   */
  galleryAnchorId?: string | null;
  /**
   * WHO IS ASKING — decides whether this story may be shown at all.
   *
   * ⚠ OMITTING IT MEANS "A STRANGER", AND THAT IS THE POINT. Every caller that
   * does not think about the audience gets the safest answer, so a surface added
   * later cannot leak a couple's private story by forgetting a prop. The event
   * site passes the viewer it already resolved for its own lock screen; the
   * couple's own editor preview passes the host.
   */
  viewer?: StoryViewer;
  /**
   * ✈ MAGIC MOVE — 'mark' means the hero's monogram is the element that
   * travels, and this component stamps the attribute the measurer looks for.
   *
   * 🔑 STAMPED AT THE SLOT, NOT INSIDE `HeroMonogram`. The slot has two
   * implementations — the couple's designed mark and the plain circle fallback
   * — and one wrapper covers both without either knowing this feature exists.
   * Tagging inside `HeroMonogram` would be wrong in the other direction: it is
   * shared with the wall projection, the Save-the-Date page and the recap, none
   * of which HAVE a berth, so the script would find a traveller, find nowhere
   * to send it, and log a warning on three pages that never asked to take part.
   *
   * ⛔ Null renders the slot exactly as it did before this existed — no
   * wrapper element at all, not an unstamped one.
   */
  magicTraveller?: 'mark' | null;
  /**
   * 🧭 THE MAKER'S CANVAS ONLY (Event Hub Maker Phase 8). Stamps a hidden
   * `[data-maker-section="p:<scene>"]` marker in front of each Post Event scene
   * so the navigator can scroll to it (the same marker contract `site-body.tsx`
   * uses for every other stage). False — every guest, every stranger — renders
   * no marker at all, so their HTML is unchanged.
   */
  makerMarkers?: boolean;
}): Promise<ReactElement> {
  // The event's own words. This page is the STORY AFTER the event and was the
  // densest pocket of wedding language left — eleven sentences, including two
  // Title-Case headings and three screen-reader labels a sighted reader never
  // sees. Resolved from the event id because this component receives only that;
  // `resolveProfileByEvent` is request-cached, so it costs nothing.
  const w = await eventWordsForEvent(eventId);
  let data: EditorialData | null = null;
  try {
    data = await loadEditorialData(eventId);
  } catch {
    data = null;
  }

  if (!data) {
    return <GracefulFallback words={w} />;
  }

  /*
    THE ONE GATE (owner 2026-08-22). Three surfaces render this component and
    two more read the same loader; each asking its own version of "may they see
    it?" is three chances to forget, and the next surface makes four. That is
    exactly how the Live Photo Wall ended up mirrored onto every guest's phone.

    🚨 AND IT CLOSES THE DATA, NOT A BLOCK. Until this landed, the public page
    decided to draw the story from the LIFECYCLE alone and never read the
    couple's status at all — while a row is created automatically for every
    event — so after the day an UNPUBLISHED story was already readable by
    anybody who could open the page. Hiding the block would have left the same
    words one fetch away; returning before the composed copy is built is what
    actually withholds them.

    A sample fixture carries no audience and must always render — it exists to
    be read, and `storyAudienceOf` would otherwise fail it closed to 'draft'.
  */
  if (data.audience && !storyAudienceAdmits(data.audience, viewer)) {
    return <GracefulFallback words={w} />;
  }

  /*
    THE SECOND FENCE, AND IT IS INSIDE THE FIRST. The gate above answers "may
    this viewer read this story?" — one audience for the whole thing. This one
    answers "which LAYERS of it?", and it has to exist because the by-the-minute
    page grows in public: the invitation, the room and the live broadcast are the
    host's own and are readable while the day happens, so passing the first gate
    stops meaning "everything here is yours to read".

    🔴 IT REPLACES THE PAYLOAD, NOT THE MARKUP. The design review found the
    photos correctly withheld and the SHAPE of them still public — the index, the
    dial's bar heights, the minute sheet, the cover's counts, the Relive player
    and the closing words. Every one of those is a value in `data`, so the fix is
    here, before a single component is handed it, and not a stylesheet rule that
    leaves the same numbers in the served HTML.

    ⚖ IT CAN ONLY EVER REMOVE. `redactStoryLayers` has no branch that adds
    anything, so it cannot widen what the gate above already closed — and a
    viewer who may read every layer gets the identical object back.
  */
  data = redactStoryLayers(data, viewer);

  /* 💾 The host's drafted arrangement and looks, laid over the story's own keys
     — the SAME keys, in the SAME shapes, the loader read (`lib/post-event-
     draft.ts` sanitised them through the page's own readers). Only the order,
     the switches and each scene's look move; every layer above stays redacted. */
  if (draft) {
    data = {
      ...data,
      ...(draft.sections !== undefined ? { sections: draft.sections as EditorialData['sections'] } : {}),
      ...(draft.sectionOrder !== undefined ? { sectionOrder: draft.sectionOrder } : {}),
      ...(draft.sceneLooks !== undefined ? { sceneLooks: draft.sceneLooks } : {}),
    };
  }

  let copy: ComposedCopy;
  try {
    copy = composeCopy(data);
  } catch {
    // Even composition is wrapped — fall back to a bare headline.
    copy = {
      superKicker: 'A celebration',
      // Same split as `compose.ts`: a wedding announces a marriage, every other
      // event announces itself. This fallback produced "Mateo Turns Seven Are
      // Married" on a birthday.
      headline:
        !data.eventType || data.eventType === 'wedding'
          ? `${data.displayName} Are Married`
          : data.displayName,
      deck: '',
      byline: 'By the Setnayan Desk',
      leadParagraphs: [],
      pullQuote: null,
    };
  }

  // The editorial owns its share affordance (no external bar). Use the passed
  // target (sample → its /realstories/[slug]) or the couple's own /[slug].
  const effectiveShare =
    share ??
    (data.slug
      ? {
          url: `${SHARE_SITE_URL}/${data.slug}`,
          title: `${data.displayName} — a Setnayan Real Story`,
          image: `${SHARE_SITE_URL}/api/og/realstory-slug/${data.slug}`,
        }
      : null);

  // File-asset share path (share-asset completion 2026-07-17): the 9:16 story
  // card behind the "Save story card" button. IG feed / Stories / TikTok don't
  // take web-URL shares — this hands the couple a postable file through the
  // native share sheet. REAL published editorials only: the curated samples
  // (share prop passed, slug null) have no ?format=story asset, and the OG
  // route only renders the editorial card once the couple has PUBLISHED (the
  // same gate that put this page in front of the reader).
  const storyCard =
    !share && data.published && data.slug
      ? {
          url: `${SHARE_SITE_URL}/api/og/realstory-slug/${data.slug}?format=story`,
          filenameBase: `${data.slug}-story`,
        }
      : null;

  // A block shows unless the couple turned it off in the editorial editor.
  const isOn = (k: keyof NonNullable<typeof data.sections>) => data.sections?.[k] !== false;

  // Does the "Watch the Film" section actually render on this edition? Resolved
  // ONCE, because two things now depend on the same answer: the section itself,
  // and the colophon link that points at it. Deriving it twice is how a footer
  // link ends up scrolling to nothing.
  const watchFilmShown = isOn('watchFilm') && Boolean(data.watchFilmEmbedUrl);

  // The three photo blocks, resolved ONCE — for the same reason `watchFilmShown`
  // is: the bottom bar's Gallery slot and the block that carries its anchor must
  // be the same answer. See `gallery-anchor.ts` for why they cannot be typed out
  // twice. The nodes below read `photo.*` instead of re-deriving their gates.
  const photo = editorialPhotoBlocks({
    sections: data.sections,
    dayChapters: data.dayChapters.length,
    essayPhotos: data.essayPhotos.length,
    galleryPhotos: data.galleryPhotos.length,
    photoWallActive: data.photoWallActive,
    photoWallPhotos: data.photoWallPhotos.length,
  });
  // The couple's own columns take part in the ordered run. Passing their ids is
  // what ADMITS a `custom:` key at all — the resolver drops one with no column
  // behind it, so a deleted column can never leave an empty block behind.
  const customColumns = data.customColumns ?? [];
  const sectionOrder = resolveSectionOrder(
    data.sectionOrder,
    customColumns.map((c) => c.id),
  );
  const galleryAnchorOn: EditorialPhotoKey | null = galleryAnchorId
    ? // the anchor lives on a SHIPPED block; a couple's own column is not one
      editorialGalleryAnchorKey(photo, shippedSections(sectionOrder))
    : null;
  /**
   * The anchor id + its scroll margin, on the ONE block that carries it. Every
   * other block (and every caller with no bar — the /realstories sample, the
   * print view) spreads an empty object, so their markup is unchanged.
   */
  const anchorProps = (key: EditorialPhotoKey): { id?: string; className?: string } =>
    galleryAnchorOn === key && galleryAnchorId
      ? { id: galleryAnchorId, className: 'scroll-mt-6' }
      : {};

  // The couple's canonical mark for the masthead — resolved like the public hero
  // (animates iff they own the paid ANIMATED_MONOGRAM). Best-effort + wrapped so
  // this component keeps its "never throws" contract; null → the text-circle
  // fallback below. Admin client: the editorial is publicly viewable.
  /*
    🔴 A CURATED SAMPLE HAS NO EVENT ROW, SO IT MUST NOT BE LOOKED UP.
    `loadEditorialData` above already returns the fixture without touching the
    database — but this query and the perk probe below carried straight on with
    the same id, and `sample-maria-and-juan` is not a UUID. Postgres rejected
    both (`22P02`) on every render of all six sample stories from 2026-07-31.
    Nothing looked wrong, because null is exactly the right answer for a sample
    (the fixture's own monogram draws below), which is why it ran for a
    fortnight — it cost two doomed round trips and two red 400s per page in the
    log a real fault has to be spotted in. The predicate lives beside the
    fixture table so a seventh sample cannot teach only half the code.
  */
  const isSample = isSampleEditorialId(eventId);
  let mono: HeroMonogramData | null = null;
  if (!isSample) {
    try {
      const admin = createAdminClient();
      const { data: monoRow } = await admin
        .from('events')
        .select(HERO_MONOGRAM_COLUMNS)
        .eq('event_id', eventId)
        .maybeSingle();
      mono = await resolveEventMonogram(admin, eventId, monoRow);
    } catch {
      mono = null;
    }
  }

  // Paid COUPLE_WEBSITE_PRO perk (retired/unbundled) — when ACTIVE (admin-approved), the
  // editorial sheds the freemium "Powered by Setnayan" colophon watermark
  // (the masthead sign-off below), matching the wedding site + recap. The
  // "Powered by Setnayan" SERVICE-CREDITS strip (SetnayanExperience chip row)
  // is CONTENT, not a watermark, and is intentionally NOT gated. Best-effort +
  // wrapped to keep this component's "never throws" contract → false (keep the
  // watermark) on any error. eventCoupleWebsiteProActive already
  // graceful-degrades on orders-table drift; the catch guards the rest.
  //
  // 🔴 SKIPPED FOR A CURATED SAMPLE, same reason as the monogram above: this
  // probes `orders` by event id, and a sample's id is a sentinel string, not a
  // UUID. `false` (keep the watermark) is both the pre-existing behaviour for a
  // sample and the right one — a fixture has bought nothing.
  let hideWatermark = false;
  if (!isSample) {
    try {
      hideWatermark = await eventCoupleWebsiteProActive(createAdminClient(), eventId);
    } catch {
      hideWatermark = false;
    }
  }

  /*
    THE SPINE'S OWN FACTS — the road's dated entries, the broadcast sessions,
    the venue's blocks and the dial's bar heights. A supplement to the loader
    above, never a second opinion about anything it already answered.

    🔴 A CURATED SAMPLE IS RESOLVED WITHOUT TOUCHING THE DATABASE, for the same
    reason the monogram and the perk probe above are: its id is a sentinel
    string, not a UUID, and Postgres rejects every query carrying one with
    22P02 — an ABSENCE, not an error anybody sees.
  */
  /*
    THE BACK COVER (01 §3.9). Loaded here with the other optional reads and, like
    them, FAIL-QUIET: `loadBackCover` swallows its own errors and answers null,
    and null is not an error state — it is the ordinary, correct-by-default
    answer for a story whose host announced nothing. A sample has no real row and
    is skipped for the same reason the monogram above is.
  */
  const backCover: BackCover | null = isSample
    ? null
    : await loadBackCover({ eventId, eventDateISO: data.eventDate ?? null, viewer });

  /*
    "PREVIOUSLY · No. 1" — 08 step 4.3. This edition OPENS with it when the host
    started it from the last one's back cover. Same fail-quiet contract as the
    back cover above, and skipped on a sample for the same reason.
  */
  const previousEdition: PreviousEdition | null = isSample
    ? null
    : await loadPreviousEdition(eventId);

  let spineFacts: StorySpineFacts;
  try {
    spineFacts = isSample
      ? sampleSpineFacts(data.eventDate, data.eventEndDate)
      : await loadStorySpineFacts({
          eventId,
          eventDate: data.eventDate,
          eventEndDate: data.eventEndDate,
          createdAtMs: null,
          /*
            The minutes the story writes up, so the lens's heat is read for
            those instants and no others (`08` step 2.3). Taken from the payload
            the loader above already resolved — asking the database a second
            time which minutes exist would be a second opinion about the day.

            🔒 AND IT IS THE REDACTED PAYLOAD. `redactStoryLayers` has already
            run, so a reader who may not have the guests' layer has no day
            chapters here — which means no windows are read at all for them,
            and the heat is empty before the gate downstream even sees it.
          */
          writtenMinutesMs: data.dayChapters
            .map((c) => (c.atIso ? Date.parse(c.atIso) : Number.NaN))
            .filter((n) => Number.isFinite(n)),
        });
  } catch {
    // Same contract as the rest of this component: it never throws. With no
    // facts the cover and the day's minutes still render; the road, the dial
    // and the film timecodes simply are not there.
    spineFacts = sampleSpineFacts(data.eventDate, data.eventEndDate);
  }

  /*
    ═══ THE LIGHT ══════════════════════════════════════════════════════════
    `01_The_Story.md` §1 + §4 · `08` step 2.2.

    The six stages come from the reception palette the host saved, or the
    neutral six when they saved none — offered as a choice, never reported as a
    failure. Derived HERE rather than inside the spine because the element that
    wears them is this one: the light has to reach the shipped sections under
    the clock as well, and a page painted only down to the spine would show a
    seam where one ground meets another.

    🔑 THE PAGE IS ALREADY RIGHT BEFORE ANY SCRIPT RUNS. The wrapper is
    server-painted with the opening stage, so with JavaScript off, in a
    screenshot and to a crawler the story is a legible printed page that simply
    does not change as you scroll. `StoryLight` only takes over the changing.

    🔴 IT REPLACED A HARD-CODED `bg-[#e7e2d6]`. That one colour was every
    couple's story, whatever they had saved on their own mood board.
  */
  const stages = spineFacts.palette.length > 0 ? deriveStages(spineFacts.palette) : neutralStages();

  /*
    ═══ WERE YOU THERE? — ONE PERSON'S OWN DAY (`01` §3.7 · `08` step 2.5) ════

    🔒 THE IDENTITY IS A SIGNED SESSION AND NOTHING ELSE. Owner ruling
    2026-09-07: there is no name field, for anyone, ever — a box that took a
    first name let a stranger with the link learn who attended and where they
    sat. `loadYourOwnDay` reads the guest cookie, refuses a session belonging to
    another celebration, and returns the empty shape to everybody else. It never
    throws, so a broken read costs one reader their own panel and nothing more.
  */
  /*
    ═══ THE PAGES THE HOST ARRANGED BY HAND (step 5 of `10_WHAT_IS_LEFT_SESSIONS_2026-09-10.md`) ══

    Each moment laid out in "Make it yours" is drawn on the day's spine as its sheet. A story in
    Automatic — and every story nobody has arranged — gets NONE, so its page is exactly what it
    was before this existed.

    🔒 THE FENCE IS STEP 3'S, NOT THIS COMPONENT'S. This page reads with the admin client, outside
    every RLS rule; `loadStoryPages` goes through `loadStoryArrangement`, which reads the audience
    off the arrangement's own row (the guests' layer, S3) and builds every photograph through the
    consent veto (S14). Nothing here reads the arrangement any other way. A sample has no
    celebration behind it and is skipped, like every other lookup above.
  */
  const sheets: DrawnSheet[] = isSample
    ? []
    : await loadStoryPages(createAdminClient(), eventId, viewer, (key) =>
        displayUrlForStoredAsset(key),
      ).catch(() => []);

  /* 👥 The entourage — the SAME loader the invitation lists it with (public
     invitation content, owner 2026-09-15). A sample has no guest list. */
  const entourage: EntourageGroup[] = isSample ? [] : await loadEntourage(createAdminClient(), eventId).catch(() => []);

  let own = await loadYourOwnDay(eventId).catch(() => null);
  own ??= { signedIn: false, appearsIn: [], shot: [], said: [], tableLabel: null };
  /** 🪑 The reader's own table, from their signed session — null for everyone else. */
  const ownTable = own.tableLabel;

  /*
    ═══ THE GALLERY'S TABS FOLLOW THE READER (Maker Phase 8 · owner 2026-09-25) ═══
    "All that is tagged to me" (a guest: Yours / Everyone's) or "all that is
    shared in public" (a stranger); the couple sees everything. The reader is
    the viewer this page ALREADY resolved for its lock screen, and every photo
    here already passed `redactStoryLayers` for that viewer — the tabs only
    choose among what was allowed, they never widen it.
    🔒 "Yours" is the signed Papic session's own photos (`loadYourOwnDay`) —
    never a name lookup. A reader without one is told so, not shown an empty grid.
  */
  const marker = (scene: string): ReactNode =>
    makerMarkers ? <span hidden data-maker-section={`p:${scene}`} /> : null;
  const ownPhotos = Array.from(
    new Set(
      [...own.appearsIn, ...own.shot]
        .map((i) => i.url)
        .filter((u): u is string => typeof u === 'string' && u.length > 0),
    ),
  );
  const galleryPhotos = data.galleryPhotos;
  const galleryNames = data.firstNames;
  const galleryTabs = galleryTabsFor(postEventReader(viewer)).map((t) => ({
    key: t.key,
    label: t.label,
    count: t.key === 'yours' ? (own.signedIn ? ownPhotos.length : null) : galleryPhotos.length,
    node:
      t.key === 'yours' ? (
        ownPhotos.length > 0 ? (
          <PhotoGallery photos={ownPhotos} names={galleryNames} max={60} />
        ) : (
          <p className="max-w-prose text-base text-ink/70">
            {own.signedIn
              ? 'Nothing of yours from the day is in the gallery yet — the photos you are in and the ones you took will show here.'
              : 'Open the story from your own Papic link and the photos you are in, and the ones you took, show here.'}
          </p>
        )
      ) : (
        <PhotoGallery photos={galleryPhotos} names={galleryNames} max={60} />
      ),
  }));

  /*
    ═══ EACH SCENE IN ITS STYLE (owner 2026-09-29, "EVERY STYLE OF EVERY SCENE
    SHIPS") ═══ A scene's look is `sceneLooks[<scene>]` (`lib/post-event-draft.ts`):
    its style — absent = the type's recommended one — its words, and its parts'
    own font · size · colour, written as the scene's scoped `<style>` by the ONE
    function every Event Hub section uses (`hubElementSceneCss`).
  */
  const looks = data.sceneLooks ?? {};
  const lookOf = (scene: string) => looks[postEventLookKey(scene)] ?? {};
  const styleOf = (scene: string) => {
    const home = postEventStyleHome(scene);
    return resolvePostEventStyle(scene, home ? sharedStyles?.[home] : lookOf(scene).style, data?.eventType ?? null);
  };
  const cssOf = (scene: string) => hubElementSceneCss(postEventElementScope(scene), lookOf(scene).elements ?? null);
  const wordsOf = (scene: string) => lookOf(scene).words ?? {};
  /* 🕰 Has the day happened? Compared by Manila calendar date — the scenes that
     wait for the day say so to the couple only (`hostPreview`). */
  const lastDay = (data.eventEndDate ?? data.eventDate ?? '').slice(0, 10);
  const todayManila = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  const dayHappened = /^\d{4}-\d{2}-\d{2}$/.test(lastDay) ? todayManila > lastDay : false;
  const placeholderOf = (scene: string) => (hostPreview && !dayHappened ? (POST_EVENT_WAITING[scene] ?? null) : null);
  /* 🕰 A scene drawn in its style that has nothing YET — before the day, on the
     couple's own canvas only: its label and the line that says what fills it,
     in the scene's own frame, so the navigator's tile has a place to land. */
  const waitingScene = (scene: string, label: string, shown: boolean, key: string = scene): ReactElement | null => {
    const style = styleOf(scene);
    const line = placeholderOf(scene);
    if (!shown || !style || !line) return null;
    return (
      <PostEventSceneFrame key={key} scene={scene} style={style} css={cssOf(scene)}>
        <div className="py-8">
          <p className="pahina-eyebrow m-0 font-mono text-xs font-semibold uppercase tracking-[0.22em] text-terracotta-700">
            {wordsOf(scene).label ?? label}
          </p>
          <PeWaiting text={line} />
        </div>
      </PostEventSceneFrame>
    );
  };
  const dateDots = data.eventDate && /^\d{4}-\d{2}-\d{2}/.test(data.eventDate)
    ? `${data.eventDate.slice(8, 10)} · ${data.eventDate.slice(5, 7)} · ${data.eventDate.slice(0, 4)}`
    : null;
  const lastChapterLead = data.dayChapters.at(-1)?.media[0];
  const wishes = data.kwentoQuotes.length;
  const suppliers = data.vendors.length;

  /* The Front Page — the story's cover, in its style, where the spine's own
     title used to stand (`StorySpine coverScene`). Its marker travels with it,
     so the navigator's Cover tile lands on THIS scene, not the whole spine. */
  /* 🛤 THE ROAD TO THE DAY — their Love Story's moments, then the platform's
     dated steps the spine already files (the date set, the look saved, the team
     booked …), guest-layer entries only where this reader may see that layer. */
  const guestOpen = data.audience ? guestLayerAdmits(data.audience, viewer) : true;
  const roadEntries: RoadEntry[] = [
    ...(data.loveStory.milestones ?? [])
      .filter((m) => m.title && m.title.trim())
      .map((m, i) => ({ key: `m-${i}`, atMs: null, year: m.year ?? null, title: m.title!.trim(), line: m.note ?? null })),
    ...spineFacts.road
      .filter((f) => f.layer === 'host' || guestOpen)
      .map((f) => ({ key: f.key, atMs: f.atMs, year: null, title: f.title, line: f.body })),
  ];
  const dayMs = data.eventDate && Number.isFinite(Date.parse(data.eventDate)) ? Date.parse(data.eventDate) : null;
  const roadStyle = styleOf('before');
  const roadScene =
    roadStyle && (roadEntries.length > 0 || placeholderOf('before')) ? (
      <>
        {marker('before')}
        <PostEventSceneFrame scene="before" style={roadStyle} css={cssOf('before')}>
          <RoadScene style={roadStyle} entries={roadEntries} dayMs={dayMs} words={wordsOf('before')} placeholder={placeholderOf('before')} />
        </PostEventSceneFrame>
      </>
    ) : null;

  const coverStyle = styleOf('cover');
  const coverScene = coverStyle ? (
    <>
      {marker('cover')}
      <PostEventSceneFrame scene="cover" style={coverStyle} css={cssOf('cover')} className="mt-4">
        <FrontPageScene
          style={coverStyle}
          words={wordsOf('cover')}
          facts={{
            names: data.displayName,
            vows: w.twoPeople,
            solemn: w.solemn,
            eventWord: w.eventWord,
            dateLong: data.eventDateFormatted,
            dateDots,
            venueName: data.venueName,
            venueCity: data.venueCity,
            heroPhotoUrl: data.heroPhotoUrl,
            heroVideoUrl: data.heroVideoUrl,
            edition: mastheadEdition(data.eventDate, data.editionNo, data.published, data.editionVolume),
            invited: data.metrics.guests,
            saidYes: data.metrics.attending,
            photos: data.metrics.photos,
            chapters: data.metrics.chapters,
          }}
        />
      </PostEventSceneFrame>
      {roadScene}
    </>
  ) : null;

  /* 🧭 Where the bar's Suppliers slot lands — the FIRST team scene drawn, asked
     of the SAME predicate the bar asks (`post-event-bar-facts.ts`). */
  const suppliersAnchor = postEventSuppliersAnchorKey(
    {
      sections: data.sections,
      broadcast: Boolean(data.watchFilmEmbedUrl),
      films: data.films?.length ?? 0,
      teamVendors: data.vendors.length,
      vendorMedia: data.vendorMedia.length,
      vendorsWeLoved: data.vendorsWeLoved.length,
    },
    shippedSections(sectionOrder),
  );
  const suppliersId = (key: 'team' | 'fromVendors' | 'vendorsWeLoved') =>
    suppliersAnchor === key ? { id: POST_EVENT_SUPPLIERS_ANCHOR, className: 'scroll-mt-6' } : {};
  /* 🤝 Supplier Stories draws the booked team and their frames — the SAME
     predicate the bar asks (`postEventSupplierStoriesDrawn`); while it does, the
     article's own team list steps aside so the team is never listed twice. */
  const supplierStoriesDrawn =
    postEventSupplierStoriesDrawn({ sections: data.sections, vendorMedia: data.vendorMedia.length, teamVendors: data.vendors.length }) &&
    styleOf('vendors') !== null;
  /* 🎥 The replay's chapters, each at its place in the recording (`filmTimecode`
     — the spine's own arithmetic, never a second one). */
  const filmHighlights = data.dayChapters
    .map((c) => {
      const at = c.atIso ? Date.parse(c.atIso) : Number.NaN;
      const tc = Number.isFinite(at) ? filmTimecode(at, spineFacts.broadcasts) : null;
      return tc ? { title: c.title ?? c.time ?? 'A moment', timecode: tc.label } : null;
    })
    .filter((h): h is { title: string; timecode: string } => h !== null);

  return (
    <div
      data-story-light
      style={paintAtRest(stages, ROAD_STAGE) as CSSProperties}
      className="min-h-screen bg-cream text-ink"
    >
      {/*
        ═══ THE SPINE — the page IS the event's clock ═══════════════════════
        08 step 2.1 · Design_Editorial_By_The_Minute_2026-09-07.

        🔑 IT REPLACED THE MASTHEAD AND THE LEAD, IT DID NOT SIT ON TOP OF THEM.
        The cover carries the mark, the volume, the names very large, one
        sentence and the four facts — every job the centred masthead + dateline
        + lead headline used to do. Keeping both would have printed the story's
        name twice and the edition line twice, three inches apart.

        What is BELOW it is deliberately untouched: the shipped sections still
        render, in the couple's own order, under the clock. S11 (08 step 2.4)
        folds them into the eleven index tabs; until it does, nothing a couple
        switched on has stopped appearing.
      */}
      {/*
        The pointer BACK, at the very top — "No. 2 opens with Previously · No. 1".
        Absent unless the host started this celebration from the last one's back
        cover AND that story is published; a line leading to a locked page would
        disclose that a private story exists and what it is called.
      */}
      {previousEdition ? (
        <p className="mx-auto max-w-5xl px-4 pt-4 text-center">
          <a
            href={previousEdition.href}
            className="font-mono text-xs uppercase tracking-[0.32em] text-ink/60 underline-offset-4 hover:underline"
          >
            {previousEdition.label}
          </a>
        </p>
      ) : null}

      {coverScene ? null : marker('cover')}
      <StorySpine
        coverScene={coverScene}
        hideRoad={Boolean(coverScene && roadScene)}
        makerMarkers={makerMarkers}
        data={data}
        facts={spineFacts}
        words={w}
        viewer={viewer}
        isSample={isSample}
        stages={stages}
        eventId={eventId}
        own={own}
        sheets={sheets}
        storyCard={storyCard}
        monogram={
          /* ✈ ONE WRAPPER, BOTH IMPLEMENTATIONS.
             🪤 `className="contents"` WAS THE FIRST ATTEMPT AND IT CANNOT WORK.
             `display: contents` generates NO BOX, and an element with no box
             takes no `transform` — the rule in globals.css would have matched,
             every custom property would have been written, and the mark would
             have sat perfectly still with nothing anywhere reporting a fault.
             It has to be a real box, so `block`: neutral around the block-level
             mark it wraps, and it has a rect for the measurer to read.
             Without the attribute there is no wrapper element at all. */
          magicTraveller === 'mark' ? (
            <span data-magic-traveller className="block">
              {mono ? (
                <HeroMonogram
                  event={mono.design}
                  monogram={mono.monogram}
                  animatedMonogram={mono.animatedMonogram}
                  studioAnim={mono.studioAnim}
                  bespokeSvg={mono.bespokeSvg}
                />
              ) : (
                <Monogram text={data.monogramText} color={data.monogramColor} />
              )}
            </span>
          ) : mono ? (
            <HeroMonogram
              event={mono.design}
              monogram={mono.monogram}
              animatedMonogram={mono.animatedMonogram}
              studioAnim={mono.studioAnim}
              bespokeSvg={mono.bespokeSvg}
            />
          ) : (
            <Monogram text={data.monogramText} color={data.monogramColor} />
          )
        }
        actions={
          effectiveShare ? (
            <span className="inline-flex items-center gap-2">
              <ShareButtons
                compact
                url={effectiveShare.url}
                title={effectiveShare.title}
                image={effectiveShare.image}
              />
              {storyCard ? (
                <SaveStoryCardButton
                  compact
                  storyCardUrl={storyCard.url}
                  filenameBase={storyCard.filenameBase}
                />
              ) : null}
            </span>
          ) : null
        }
      />

      <article className="mx-auto mt-10 max-w-5xl border border-ink/10 bg-cream px-5 py-7 shadow-[0_30px_70px_-30px_rgba(30,34,41,0.45)] sm:px-10 sm:py-9">
        {/* Phase ribbon (cross-links) ----------------------------------------- */}
        <PhaseRibbon slug={data.slug} words={w} />

        <div className="border-t-[3px] border-double border-ink" />

        {/* Full-width hero — the cover spans the whole row. A baked boomerang
            (Living Hero) plays as a looping GIF-like banner; else the still. */}
        {!coverScene && (data.heroPhotoUrl || data.heroVideoUrl) ? (
          <div className="pt-2">
            <HeroPhoto
              words={w}
              url={data.heroPhotoUrl}
              videoUrl={data.heroVideoUrl}
              names={data.firstNames}
            />
          </div>
        ) : null}

        {/* Below the photo: the write-up takes the wide column; the Setnayan
            "By the Numbers" sits in a slim corner sidebar. On mobile both stack
            (story first, numbers as the recap right after). */}
        <div className="mt-5">
          <div className="min-w-0">
            {/* Editorial = post-event SHOWCASE: the love story now lives on the
                run-up paths (Save the Date / RSVP / Event), not here. We keep
                the thank-you pull-quote, drop the love-narrative paragraphs. */}
            {/* Couple-written lead paragraphs (full editorial control). When the
                couple wrote none, FALL BACK to their love_story prose so the
                article body is never empty (FREE, no-Papic path); the
                auto-composed love narrative otherwise stays on the run-up paths. */}
            <LeadArticle
              paragraphs={
                data.draft.leadParagraphs?.length
                  ? data.draft.leadParagraphs
                  : data.loveStoryParagraphs
              }
              pullQuote={copy.pullQuote}
            />
            {isOn('team') && data.vendors.length && !supplierStoriesDrawn ? (
              <div {...suppliersId('team')}>
                <TeamBehindTheDay vendors={data.vendors} eventSlug={data.slug} />
              </div>
            ) : null}
          </div>
        </div>

        {/* 📊 STATISTICS — its own scene, in its style (it was a slim sidebar).
            Drawn when there is a count to show; the couple alone sees it wait. */}
        {isOn('byTheNumbers') && (data.metrics.guests > 0 || (data.metrics.photos ?? 0) > 0 || placeholderOf('numbers')) ? marker('numbers') : null}
        {isOn('byTheNumbers') && (data.metrics.guests > 0 || (data.metrics.photos ?? 0) > 0 || placeholderOf('numbers')) && styleOf('numbers') ? (
          <PostEventSceneFrame scene="numbers" style={styleOf('numbers')!} css={cssOf('numbers')}>
            <StatisticsScene
              style={styleOf('numbers')!}
              words={wordsOf('numbers')}
              facts={{
                invited: data.metrics.guests,
                saidYes: data.metrics.attending,
                repliedPct: data.metrics.guests > 0 ? (data.metrics.rsvpPct ?? Math.round((data.metrics.replied / data.metrics.guests) * 100)) : null,
                photos: data.metrics.photos,
                wishes,
                chapters: data.metrics.chapters,
                suppliers,
                names: data.firstNames,
                dateLong: data.eventDateFormatted,
                venue: [data.venueName, data.venueCity].filter(Boolean).join(' · ') || null,
                eventWord: w.eventWord,
                waiting: hostPreview && !dayHappened,
              }}
            />
          </PostEventSceneFrame>
        ) : null}

        {/* ── The reorderable content run (Editorial PRO — "the Editor's Desk")
            ────────────────────────────────────────────────────────────────────
            Every reorderable section is built as a keyed node, then rendered in
            the couple's saved order (resolveSectionOrder — default order when no
            PRO order is saved, which is the case for every older editorial + all
            samples). The LOCKED CLOSE — "From the Couple" then "Their Song" — is
            NOT part of this run; it is appended AFTER it, always the last two
            content sections before the colophon (Editorial_Experience_Spec §7).
            A section whose data is absent renders null and simply drops out. --- */}
        {(() => {
          // Keyed nodes for the reorderable run. Each carries the SAME gating it
          // had inline; an absent-data section is `null` and contributes nothing.
          const nodes: Record<EditorialOrderKey, ReactNode> = {
            // "As the Day Unfolded" (living chapters) or the legacy "Moments"
            // essay fallback — one block, gated by the `gallery` toggle.
            // 🗓 SCHEDULE — one chapter per event-day block, in its style.
            chapters:
              photo.chapters === 'living' && styleOf('chapters') ? (
                <PostEventSceneFrame
                  key="chapters"
                  scene="chapters"
                  style={styleOf('chapters')!}
                  css={cssOf('chapters')}
                  id={anchorProps('chapters').id}
                >
                  <ScheduleScene style={styleOf('chapters')!} chapters={data.dayChapters} words={wordsOf('chapters')} placeholder={null} />
                </PostEventSceneFrame>
              ) : photo.chapters === null && placeholderOf('chapters') && isOn('gallery') && styleOf('chapters') ? (
                <PostEventSceneFrame key="chapters" scene="chapters" style={styleOf('chapters')!} css={cssOf('chapters')}>
                  <ScheduleScene style={styleOf('chapters')!} chapters={[]} words={wordsOf('chapters')} placeholder={placeholderOf('chapters')} />
                </PostEventSceneFrame>
              ) : photo.chapters === 'essay' ? (
                <div key="chapters" {...anchorProps('chapters')}>
                  <SectionRule title="Moments" />
                  <MomentsEssay photos={data.essayPhotos} names={data.firstNames} />
                </div>
              ) : null,
            // 📝 PHOTO NOTES ("Kwento") — a photo WITH what a guest said, in its
            // style; the whole wall still opens full screen.
            kwento:
              isOn('kwento') && data.kwentoQuotes.length && styleOf('wishes') ? (
                <PostEventSceneFrame key="kwento" scene="wishes" style={styleOf('wishes')!} css={cssOf('wishes')}>
                  <OpenUpScene
                    kind="wishes"
                    title={PHOTO_NOTES_LABEL}
                    eyebrow={`Approved · ${fmt(data.kwentoQuotes.length)}`}
                    openLabel={`Read all ${fmt(data.kwentoQuotes.length)}`}
                    preview={
                      <PhotoNotesScene
                        style={styleOf('wishes')!}
                        quotes={data.kwentoQuotes}
                        label={PHOTO_NOTES_LABEL}
                        words={wordsOf('wishes')}
                      />
                    }
                  >
                    <KwentoWall quotes={data.kwentoQuotes} names={data.firstNames} max={60} />
                  </OpenUpScene>
                </PostEventSceneFrame>
              ) : (
                waitingScene('wishes', PHOTO_NOTES_LABEL, isOn('kwento'), 'kwento')
              ),
            // 🙋 PAPIC CHALLENGE — the couple's questions and the guests' answers
            // (owner 2026-08-21: challenge answers "have their own column"). The
            // loader applies four fail-closed consent gates; by the time a row is
            // here it has been agreed to. [] hides the scene entirely.
            challengeAnswers:
              isOn('challengeAnswers') && data.challengeAnswers.length && styleOf('asked') ? (
                <PostEventSceneFrame key="challengeAnswers" scene="asked" style={styleOf('asked')!} css={cssOf('asked')}>
                  <ChallengeScene style={styleOf('asked')!} answers={data.challengeAnswers} words={wordsOf('asked')} />
                </PostEventSceneFrame>
              ) : (
                waitingScene('asked', 'What we asked', isOn('challengeAnswers'), 'challengeAnswers')
              ),
            // ✉ MESSAGES — approved Guest Columns (GUEST_COLUMNS_ENABLED;
            // data.guestColumns is absent/[] when off), approved by the organiser.
            guestColumns:
              isOn('guestColumns') && (data.guestColumns?.length ?? 0) > 0 && styleOf('letters') ? (
                <PostEventSceneFrame key="guestColumns" scene="letters" style={styleOf('letters')!} css={cssOf('letters')}>
                  <MessagesScene style={styleOf('letters')!} letters={data.guestColumns ?? []} words={wordsOf('letters')} />
                </PostEventSceneFrame>
              ) : (
                waitingScene('letters', 'Messages', isOn('guestColumns'), 'guestColumns')
              ),
            // Shared photos from the day ("From the Day").
            // 🖼 GALLERY — the preview in its style; the whole gallery opens up.
            gallery: photo.gallery && styleOf('gallery') ? (
              <PostEventSceneFrame key="gallery" scene="gallery" style={styleOf('gallery')!} css={cssOf('gallery')} id={anchorProps('gallery').id}>
                {/* 🔓 OPEN-UP (Maker Phase 8): a collage of five or six in the
                    flow (template 21); the gallery opens full screen, and its
                    tabs follow the reader — Yours / Everyone's for a guest,
                    what is shared with everyone for a stranger, everything
                    for the couple (owner 2026-09-25). */}
                <OpenUpScene
                  kind="gallery"
                  title={wordsOf('gallery').heading ?? 'From the Day'}
                  eyebrow={`${data.firstNames} · the gallery`}
                  openLabel={`Open the gallery · ${fmt(data.galleryPhotos.length)} ${data.galleryPhotos.length === 1 ? 'photo' : 'photos'}`}
                  preview={
                    <GalleryPreview
                      style={styleOf('gallery')!}
                      photos={data.galleryPhotos}
                      captures={data.galleryCaptures}
                      total={data.metrics.photos ?? data.galleryPhotos.length}
                      names={data.firstNames}
                      words={wordsOf('gallery')}
                    />
                  }
                >
                  <OpenUpTabs tabs={galleryTabs} />
                </OpenUpScene>
              </PostEventSceneFrame>
            ) : (
              waitingScene('gallery', 'From the day', isOn('gallery'))
            ),
            // 🤝 SUPPLIER STORIES — the booked team and their own frames from the
            // day, in its style; ♥ for the ones the couple would book again.
            fromVendors: supplierStoriesDrawn ? (
              <PostEventSceneFrame
                key="fromVendors"
                scene="vendors"
                style={styleOf('vendors')!}
                css={cssOf('vendors')}
                id={suppliersId('fromVendors').id}
              >
                <SupplierStoriesScene
                  style={styleOf('vendors')!}
                  team={data.vendors}
                  media={data.vendorMedia}
                  loved={data.vendorsWeLoved}
                  words={wordsOf('vendors')}
                />
              </PostEventSceneFrame>
            ) : (
              waitingScene('vendors', 'Supplier stories', isOn('fromVendors'), 'fromVendors')
            ),
            // Live Photo Wall (LIVE_WALL SKU).
            liveWall: photo.liveWall ? (
              <div key="liveWall" {...anchorProps('liveWall')}>
                <SectionRule title="Live Photo Wall" />
                <LivePhotoWall photos={data.photoWallPhotos} photoCount={data.metrics.photos} />
              </div>
            ) : null,
            // 🎥 LIVE STREAM + 🎞 VIDEOS — the broadcast replay and the couple's own
            // films, each its own scene in its style (owner 2026-09-26: Live
            // Stream and Videos are two types). ONE film open-up (the bar's Film
            // slot, `#open-film`) — the replay's when there is one, else the
            // videos'. The `id` the colophon's "Watch the Film" link aims at stays
            // on the replay. Each scene carries its own marker (the run loop
            // leaves this block's to it).
            watchFilm:
              watchFilmShown || (data.films?.length ?? 0) > 0 ? (
                <Fragment key="watchFilm">
                  {watchFilmShown && data.watchFilmEmbedUrl && styleOf('film') ? (
                    <>
                      {marker('film')}
                      <PostEventSceneFrame scene="film" style={styleOf('film')!} css={cssOf('film')}>
                        <OpenUpScene
                          kind="film"
                          id={WATCH_FILM_ANCHOR_ID}
                          title="Watch Live"
                          eyebrow="The broadcast, replayed"
                          openLabel="Watch the replay"
                          preview={
                            <LiveStreamPreview
                              style={styleOf('film')!}
                              still={data.heroPhotoUrl}
                              names={data.firstNames}
                              highlights={filmHighlights}
                              words={wordsOf('film')}
                            />
                          }
                        >
                          <WatchTheFilm embedUrl={data.watchFilmEmbedUrl} names={data.firstNames} />
                        </OpenUpScene>
                      </PostEventSceneFrame>
                    </>
                  ) : null}
                  {/* 🎞 The couple's OWN films — ungated on purpose (owner
                      2026-09-02): their own links must not depend on an unlock. */}
                  {data.films?.length && styleOf('videos') ? (
                    <>
                      {marker('videos')}
                      <PostEventSceneFrame scene="videos" style={styleOf('videos')!} css={cssOf('videos')}>
                        {watchFilmShown ? (
                          <VideosScene style={styleOf('videos')!} films={data.films} words={wordsOf('videos')} />
                        ) : (
                          <OpenUpScene
                            kind="film"
                            title="Videos"
                            eyebrow="Your films"
                            openLabel="Watch the films"
                            preview={<VideosScene style={styleOf('videos')!} films={data.films} words={wordsOf('videos')} asPreview />}
                          >
                            <VideosScene style="film-grid" films={data.films} words={wordsOf('videos')} />
                          </OpenUpScene>
                        )}
                      </PostEventSceneFrame>
                    </>
                  ) : null}
                </Fragment>
              ) : placeholderOf('film') && isOn('watchFilm') ? (
                <Fragment key="watchFilm">
                  {marker('film')}
                  {waitingScene('film', 'Watch Live', true)}
                  {marker('videos')}
                  {waitingScene('videos', 'Videos', true)}
                </Fragment>
              ) : null,
            // What they said (reviews). Renders even when empty (empty state).
            reviews: isOn('reviews') ? (
              <div key="reviews">
                <SectionRule title="What They Said" />
                {data.reviews.length ? (
                  <ReviewsWall reviews={data.reviews} />
                ) : (
                  <ReviewsEmptyState />
                )}
              </div>
            ) : null,
            // Powered by Setnayan — the in-app services the couple availed.
            poweredBy:
              isOn('poweredBy') && data.servicesAvailed.length ? (
                <div key="poweredBy">
                  <SectionRule title="Powered by Setnayan" />
                  <SetnayanExperience services={data.servicesAvailed} />
                </div>
              ) : null,
            // Vendors we loved — the couple's opt-in recommendations.
            vendorsWeLoved:
              isOn('vendorsWeLoved') && data.vendorsWeLoved.length ? (
                <div key="vendorsWeLoved" {...suppliersId('vendorsWeLoved')}>
                  <SectionRule title="Suppliers We Loved" />
                  <VendorsWeLoved vendors={data.vendorsWeLoved} />
                </div>
              ) : null,
            // 🪑 WHERE EVERYONE SAT — the seat plan; the reader's own table in gold.
            seating:
              isOn('seating') && spineFacts.room.tables.length > 0 && styleOf('seating') ? (
                <PostEventSceneFrame key="seating" scene="seating" style={styleOf('seating')!} css={cssOf('seating')}>
                  <SeatingScene style={styleOf('seating')!} room={spineFacts.room} ownTable={ownTable} words={wordsOf('seating')} />
                </PostEventSceneFrame>
              ) : (
                waitingScene('seating', 'Where everyone sat', isOn('seating'))
              ),
            // 👥 ENTOURAGE — the roles the couple gave.
            entourage:
              isOn('entourage') && entourage.length > 0 && styleOf('entourage') ? (
                <PostEventSceneFrame key="entourage" scene="entourage" style={styleOf('entourage')!} css={cssOf('entourage')}>
                  <EntourageScene style={styleOf('entourage')!} groups={entourage} names={data.firstNames} words={wordsOf('entourage')} />
                </PostEventSceneFrame>
              ) : (
                waitingScene('entourage', 'The entourage', isOn('entourage'))
              ),
            // 🎞 BEFORE & AFTER — the Save the Date's cover beside the story's own,
            // only when the couple chose a new cover (one style).
            beforeAfter:
              isOn('beforeAfter') && data.coverChosen && data.eventHeroUrl && data.heroPhotoUrl ? (
                <PostEventSceneFrame key="beforeAfter" scene="beforeAfter" style="two-up" css={cssOf('beforeAfter')}>
                  <BeforeAfterScene before={data.eventHeroUrl} after={data.heroPhotoUrl} names={data.firstNames} words={wordsOf('beforeAfter')} />
                </PostEventSceneFrame>
              ) : null,
          };
          // A key is either one of the shipped sections above, or one of the
          // couple's own. `customColumnId` is the ONLY way to tell — it
          // re-validates the id rather than trusting the prefix, so a key like
          // `custom:` or `custom:a:b` falls through to the shipped lookup and
          // renders nothing, exactly as an unknown key always has.
          const byId = new Map(customColumns.map((c) => [c.id, c] as const));
          return sectionOrder.map((k) => {
            const id = customColumnId(k);
            const col = id ? byId.get(id) : undefined;
            if (!col) {
              const node = nodes[k as EditorialOrderKey];
              // The film block stamps its two scenes' markers itself.
              const scene = k === 'watchFilm' ? null : postEventSceneKeyForBlock(k as EditorialOrderKey);
              return node && makerMarkers && scene ? (
                <Fragment key={k}>
                  {marker(scene)}
                  {node}
                </Fragment>
              ) : (
                node
              );
            }
            return (
              <div key={k}>
                <SectionRule title={col.title} />
                <CustomColumnBody body={col.body} />
              </div>
            );
          });
        })()}

        {/* LOCKED CLOSE — always the last two content sections, in this order
            (Editorial_Experience_Spec §7: every editorial closes with the
            couple's words then their song). Pinned after the reorderable run;
            excluded from sectionOrder so no reorder can move them. ------------- */}
        {/* 💌 THANK YOU — their closing words, in its style. Guests meet it only
            when there ARE words; the couple alone sees it wait for them. */}
        {isOn('fromTheCouple') && (data.specialMessage || wordsOf('couple').body || placeholderOf('couple')) && styleOf('couple') ? (
          <>
            {marker('couple')}
            <PostEventSceneFrame scene="couple" style={styleOf('couple')!} css={cssOf('couple')}>
              <ThankYouScene
                style={styleOf('couple')!}
                words={wordsOf('couple')}
                placeholder={placeholderOf('couple')}
                facts={{
                  message: data.specialMessage,
                  names: data.firstNames,
                  from: `From ${capitaliseWords(w.theOrganizer)}`,
                  photoUrl: (lastChapterLead?.type === 'clip' ? lastChapterLead.posterUrl : lastChapterLead?.url) ?? data.heroPhotoUrl,
                  saidYes: data.metrics.attending,
                  photos: data.metrics.photos,
                  wishes,
                }}
              />
            </PostEventSceneFrame>
          </>
        ) : null}
        {data.song.url || data.song.label ? (
          <>
            {marker('song')}
            <SectionRule title="Their Song" />
            <TheirSong song={data.song} names={data.firstNames} words={w} />
          </>
        ) : null}

        {/* Colophon / cross-phase links --------------------------------------- */}
        <Colophon
          words={w}
          names={data.displayName}
          city={data.venueCity}
          hideWatermark={hideWatermark}
          slug={data.slug}
          watchFilmShown={watchFilmShown}
        />

        {/*
          THE BACK COVER — after the colophon, the way a series page sits after
          The End. It is OUTSIDE the locked close, which is exactly why it does
          not break it: the edition still ends on the host's last word and then
          their song, and nothing below moves either. Absent, not empty, when the
          host announced nothing.
        */}
        {backCover ? marker('next') : null}
        <BackCoverBlock cover={backCover} />
      </article>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function GracefulFallback({ words: w }: { words: EventWords }): ReactElement {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-cream px-4 py-16 text-ink">
      <div className="mx-auto max-w-md space-y-3 rounded-2xl border border-ink/10 bg-cream/60 p-8 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-terracotta-700">
          The Story
        </p>
        <h2 className="font-display text-2xl italic tracking-tight">
          This {w.eventWord}&rsquo;s story isn&rsquo;t available yet.
        </h2>
        <p className="text-sm text-ink/65">
          The recap is composed a few days after the celebration. Please check back soon.
        </p>
      </div>
    </div>
  );
}

function Monogram({ text, color }: { text: string; color: string }): ReactElement {
  return (
    <div className="flex justify-center">
      <div
        aria-hidden
        className="flex h-16 w-16 items-center justify-center rounded-full border-2 bg-cream font-serif text-xl italic sm:h-20 sm:w-20 sm:text-2xl"
        style={{ borderColor: color, color }}
      >
        {text}
      </div>
    </div>
  );
}

/**
 * The cross-phase ribbon. Its links WERE `href="#"` — the original note said
 * "the engine task owns real phase navigation. We don't hardcode routes that
 * need params", and the param never arrived, so both anchors sat there looking
 * live and doing nothing for anyone who tapped them. The param exists now: the
 * couple's own slug is already threaded to this component's sibling (it feeds
 * the print link), and both destinations are ordinary shipped routes.
 *
 * `slug` null means a CURATED SAMPLE — there is no real event behind it, so
 * there is nowhere for these to go and they are simply not drawn. A phase
 * marker with no phases is still honest; a link that goes nowhere is not.
 */
function PhaseRibbon({ slug, words: w }: { slug: string | null; words: EventWords }): ReactElement {
  return (
    <nav
      aria-label="Site phases"
      className="flex flex-wrap items-center justify-center gap-4 pb-3 font-mono text-xs uppercase tracking-[0.14em] text-ink/60"
    >
      {slug ? (
        <>
          <a
            href={`/${slug}`}
            className="border-b border-terracotta pb-0.5 text-ink/60 no-underline"
          >
            &larr; The Invitation (RSVP)
          </a>
          <a
            href={`/${slug}/hub`}
            className="border-b border-terracotta pb-0.5 text-ink/60 no-underline"
          >
            The {capitaliseWords(w.eventWord)} Day (Live) &uarr;
          </a>
        </>
      ) : null}
      <span className="border-b border-mulberry pb-0.5 text-mulberry-600">The Story — Today</span>
    </nav>
  );
}

function HeroPhoto({
  url,
  videoUrl,
  names,
  words: w,
}: {
  url: string | null;
  videoUrl?: string | null;
  names: string;
  words: EventWords;
}): ReactElement {
  return (
    <figure className="relative aspect-[16/9] w-full overflow-hidden rounded-sm bg-ink/10">
      {/* Editorial rule: any hero VIDEO is a pre-baked forward+reverse boomerang
          (Living Hero Studio), so it loops seamlessly. It autoplays muted +
          inline + looping — the exact attribute set a browser needs to run a
          video like a continuously-playing GIF with no user tap. The still
          (url) is the poster, so there's no black flash before frame one. Raw
          <video>/<img>: presigned R2 URLs expire; next/* would cache stale.
          Full-width cinematic banner at 16:9 → zero crop. */}
      {videoUrl ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video
          autoPlay
          muted
          loop
          playsInline
          poster={url ?? undefined}
          aria-label={`${names}, a moving moment from the ${w.eventWord}`}
          className="h-full w-full object-cover"
        >
          <source src={videoUrl} />
        </video>
      ) : url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={`${names}, from the ${w.eventWord}`}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : null}
      <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/70 to-transparent px-3 pb-2 pt-5 font-mono text-xs uppercase tracking-[0.08em] text-cream">
        {names}, from the celebration — captured on the day.
      </figcaption>
    </figure>
  );
}

/**
 * The body of a column the couple wrote themselves.
 *
 * Reuses the article register the page already uses for the couple's own lead
 * paragraphs — two columns of justified serif — so their column reads as part of
 * the magazine rather than a note pasted into it. No drop cap: that is the
 * opening flourish of the article, and a page with six of them has none.
 *
 * 🔒 THE BODY IS TEXT, AND STAYS TEXT. It is rendered as React children, never
 * through `dangerouslySetInnerHTML`. A couple typing `<script>` into their own
 * column would only publish it to their own guests, but `draft_json` is a column
 * their browser can write directly, and a stored value that becomes markup on a
 * public page is how the harmless case turns into the other one.
 */
function CustomColumnBody({ body }: { body: string }): ReactElement | null {
  // A blank line starts a new paragraph; single newlines stay inside one, which
  // is how people actually type. `readCustomColumns` has already refused an
  // empty body, so this cannot render an empty block.
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!paragraphs.length) return null;
  return (
    <div className="mt-4 columns-1 gap-7 text-justify font-serif text-[15.5px] leading-relaxed sm:columns-2 [&>p]:mb-3">
      {paragraphs.map((p, i) => (
        <p key={i} className="whitespace-pre-line">
          {p}
        </p>
      ))}
    </div>
  );
}

function LeadArticle({
  paragraphs,
  pullQuote,
}: {
  paragraphs: string[];
  pullQuote: string | null;
}): ReactElement | null {
  if (!paragraphs.length && !pullQuote) return null;
  return (
    <div className="mt-4 columns-1 gap-7 text-justify font-serif text-[15.5px] leading-relaxed sm:columns-2 [&>p]:mb-3">
      {paragraphs.map((p, i) => (
        <p
          key={i}
          className={
            i === 0
              ? 'first-letter:float-left first-letter:mr-2 first-letter:pt-1 first-letter:font-display first-letter:text-6xl first-letter:font-bold first-letter:leading-[0.7] first-letter:text-mulberry'
              : undefined
          }
        >
          {p}
        </p>
      ))}
      {pullQuote ? (
        <p className="my-2 break-inside-avoid border-y border-ink/15 border-t-2 border-t-ink py-3 font-display text-lg font-medium italic leading-tight text-ink">
          &ldquo;{pullQuote}&rdquo;
        </p>
      ) : null}
    </div>
  );
}

/** A vendor is "tagged" when it carries a tag worth featuring: a Pro/Enterprise
 *  tier badge OR a #1-match label. Tagged vendors show by default; the rest
 *  (plain credits) collapse under a native "Show more" disclosure. */
function isTaggedVendor(v: EditorialData['vendors'][number]): boolean {
  // Pro-or-higher (Custom runs as Enterprise) get the featured editorial
  // treatment; Solo/Verified render as plain credits.
  return v.tier === 'pro' || v.tier === 'enterprise' || v.tier === 'custom' || v.isFirstPick;
}

function VendorRow({
  v,
  eventSlug,
}: {
  v: EditorialData['vendors'][number];
  /** The story this credit sits on — carried so a tap is attributable to it.
   *  Null on a curated sample, which has no event row. */
  eventSlug: string | null;
}): ReactElement {
  // §3 tier-aware showcase: Pro/Enterprise get their real logo + a tier badge +
  // a link to their marketplace profile; others render as a plain credit.
  // (Free vendors are already filtered out in data.ts.)
  const featured = (v.tier === 'pro' || v.tier === 'enterprise' || v.tier === 'custom') && !!v.slug;
  // One href, derived once: null when this supplier has no marketplace profile,
  // and the link is then not rendered at all rather than pointing nowhere.
  const tapHref = storyTapHref(v.slug, eventSlug);
  return (
    <li className="flex items-center gap-2 border-b border-dotted border-ink/15 py-1.5 last:border-b-0">
      {v.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={v.logoUrl}
          alt=""
          aria-hidden
          className="h-7 w-7 shrink-0 rounded-sm object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="h-7 w-7 shrink-0 rounded-sm bg-gradient-to-br from-terracotta-100 to-terracotta-300"
        />
      )}
      <span className="min-w-0 flex-1">
        {featured && tapHref ? (
          <a
            href={tapHref}
            className="block truncate font-serif text-sm font-semibold leading-tight text-ink underline-offset-2 hover:underline"
          >
            {v.name}
          </a>
        ) : (
          <span className="block truncate font-serif text-sm font-semibold leading-tight">
            {v.name}
          </span>
        )}
        {v.category ? (
          <span className="block font-mono text-xs uppercase tracking-[0.06em] text-ink/60">
            {prettyCategory(v.category)}
          </span>
        ) : null}
      </span>
      {/* #1 MATCH credit — the vendor the couple chose was Setnayan's top
          recommendation for that category (selection_match_rank = 1). A subtle
          mulberry pill keeps it editorial, distinct from the terracotta tier
          badge. Replaces the old inline "· #1 match" caption so the credit
          reads as a proper badge instead of buried metadata. */}
      {v.isFirstPick ? (
        <span className="shrink-0 rounded-full border border-mulberry/40 bg-mulberry/5 px-1.5 py-0.5 font-mono text-xs uppercase tracking-[0.12em] text-mulberry-600">
          #1 Match
        </span>
      ) : null}
      {v.tier === 'pro' || v.tier === 'enterprise' || v.tier === 'custom' ? (
        <span className="shrink-0 rounded-full border border-terracotta/40 px-1.5 py-0.5 font-mono text-xs uppercase tracking-[0.12em] text-terracotta-700">
          {v.tier}
        </span>
      ) : null}
    </li>
  );
}

function TeamBehindTheDay({
  vendors,
  eventSlug,
}: {
  vendors: EditorialData['vendors'];
  eventSlug: string | null;
}): ReactElement {
  const tagged = vendors.filter(isTaggedVendor);
  const rest = vendors.filter((v) => !isTaggedVendor(v));
  // If nothing is tagged (no badges/#1-matches), fall back to showing the
  // first few so the section is never empty.
  const shown = (tagged.length ? tagged : vendors.slice(0, 4)).slice(0, 10);
  const collapsed = (tagged.length ? rest : vendors.slice(4)).slice(0, 20);

  return (
    <div className="mt-5 border-t border-ink/15 pt-3">
      <p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-ink/60">
        The Team Behind the Day
      </p>
      <ul className="m-0 list-none p-0">
        {shown.map((v, i) => (
          <VendorRow key={`t-${i}`} v={v} eventSlug={eventSlug} />
        ))}
      </ul>
      {collapsed.length ? (
        <details className="mt-2">
          <summary className="cursor-pointer list-none font-mono text-xs uppercase tracking-[0.16em] text-terracotta-700 hover:text-ink">
            + {collapsed.length} more {collapsed.length === 1 ? 'supplier' : 'suppliers'}
          </summary>
          <ul className="m-0 mt-1 list-none p-0">
            {collapsed.map((v, i) => (
              <VendorRow key={`c-${i}`} v={v} eventSlug={eventSlug} />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

/** "Vendors We Loved" (§6.3 referral loop) — the vendors the couple explicitly
 *  recommended, led by their own endorsement. Distinct from the auto-generated
 *  Team credits: here the couple's WORDS are the headline, and a named vendor
 *  links to their marketplace profile so a reading guest can find them. */
function VendorsWeLoved({ vendors }: { vendors: EditorialData['vendorsWeLoved'] }): ReactElement {
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
      {vendors.map((v, i) => (
        <figure
          key={v.vendorProfileId || i}
          className="m-0 break-inside-avoid border-l-2 border-terracotta/40 pl-4"
        >
          {v.endorsement ? (
            <blockquote className="m-0 font-serif text-base italic leading-snug text-ink/85">
              &ldquo;{v.endorsement}&rdquo;
            </blockquote>
          ) : null}
          <figcaption className="mt-2 flex items-center gap-2">
            {v.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={v.logoUrl}
                alt=""
                aria-hidden
                className="h-6 w-6 shrink-0 rounded-sm object-cover"
              />
            ) : (
              <span
                aria-hidden
                className="h-6 w-6 shrink-0 rounded-sm bg-gradient-to-br from-terracotta-100 to-terracotta-300"
              />
            )}
            {v.href ? (
              <a
                href={v.href}
                className="font-mono text-xs uppercase tracking-[0.12em] text-ink underline-offset-2 hover:underline"
              >
                {v.businessName}
              </a>
            ) : (
              <span className="font-mono text-xs uppercase tracking-[0.12em] text-ink/70">
                {v.businessName}
              </span>
            )}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}




function SectionRule({ title }: { title: string }): ReactElement {
  return (
    <div className="my-7 flex items-center gap-3">
      <span aria-hidden className="h-px flex-1 bg-ink" />
      <h3 className="m-0 whitespace-nowrap font-display text-2xl font-bold">{title}</h3>
      <span aria-hidden className="h-px flex-1 bg-ink" />
    </div>
  );
}


function ReviewsEmptyState(): ReactElement {
  return (
    <p className="mx-auto max-w-xl text-center font-serif text-sm italic text-ink/60">
      Reviews from guests and vendors will appear here.
    </p>
  );
}

/**
 * "From the Day" — shared photo gallery (events.our_photos). A newspaper photo
 * spread: a larger lead frame + a tight grid. Raw <img> (presigned/relative
 * URLs). Lazy-loaded.
 */
function PhotoGallery({
  photos,
  names,
  max = 9,
}: {
  photos: string[];
  names: string;
  /** How many to draw — the flow drew nine; the open-up layer draws more. */
  max?: number;
}): ReactElement {
  const [lead, ...rest] = photos;
  return (
    <div className="mt-4 space-y-2">
      {lead ? (
        <figure className="relative aspect-[16/10] w-full overflow-hidden rounded-sm bg-ink/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lead}
            alt={`${names} — a moment from the day`}
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </figure>
      ) : null}
      {rest.length ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {rest.slice(0, Math.max(0, max - 1)).map((url, i) => (
            <figure
              key={`${i}-${url.slice(0, 24)}`}
              className="relative aspect-square overflow-hidden rounded-sm bg-ink/10"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                aria-hidden
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            </figure>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * "Their Song" — the couple's wedding song. When the DELIVERED Pakanta song is
 * present (`song.url`), it renders a slim audio player so the recap actually
 * plays the couple's own song. When there's only a typed title (`song.label`
 * with no url — the love_story.anchors.song fallback), it credits the title in
 * an editorial line, no player. One of url/label is guaranteed by the caller.
 */
function TheirSong({
  song,
  names,
  words: w,
}: {
  song: EditorialData['song'];
  names: string;
  words: EventWords;
}): ReactElement {
  return (
    <figure className="mx-auto mt-4 max-w-xl text-center">
      {song.label ? (
        <figcaption className="font-serif text-xl italic leading-snug text-ink/80 sm:text-2xl">
          &ldquo;{song.label}&rdquo;
        </figcaption>
      ) : null}
      <p className="mt-1 font-mono text-xs uppercase tracking-[0.16em] text-ink/60">
        {names}
        {song.url ? ` · their ${w.eventWord} song` : ' · the song that follows them'}
      </p>
      {song.url ? (
        // The delivered Pakanta song. Muted-by-default (no autoplay) — the recap
        // is a quiet, scroll-paced read; the couple's guests press play.
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio
          controls
          preload="none"
          src={song.url}
          aria-label={`${names} — their ${w.eventWord} song`}
          className="mx-auto mt-3 w-full max-w-md"
        />
      ) : null}
    </figure>
  );
}

/**
 * "Moments" — a paced photo-essay spread of the day. A larger, alternating
 * layout (distinct from the dense gallery grid). Auto-filled from the day's
 * Papic captures when the couple didn't curate `essay_photo_ids`.
 */
function MomentsEssay({ photos, names }: { photos: string[]; names: string }): ReactElement {
  return (
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {photos.slice(0, 9).map((url, i) => (
        <figure
          key={`${i}-${url.slice(0, 24)}`}
          className={`relative overflow-hidden rounded-sm bg-ink/10 ${
            // Let the first photo of each block of three breathe taller — a
            // simple paced rhythm without a per-moment mapping.
            i % 3 === 0 ? 'aspect-[3/4] row-span-2' : 'aspect-square'
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={`${names} — a moment from the day`}
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </figure>
      ))}
    </div>
  );
}


/**
 * "Live Photo Wall" — the LIVE_WALL add-on, surfaced on the recap as a dense
 * column-masonry of the day's candid photos (events.photo_wall_photos). A
 * caption strip credits the Setnayan service + the live capture count. Raw
 * <img> (presigned/relative URLs), lazy-loaded. Mixed aspect ratios fall into
 * a Pinterest-style wall via CSS columns.
 */
function LivePhotoWall({
  photos,
  photoCount,
}: {
  photos: string[];
  photoCount: number | null;
}): ReactElement {
  return (
    <div className="mt-4">
      <p className="mb-3 text-center font-mono text-xs uppercase tracking-[0.16em] text-ink/60">
        Powered by Setnayan
        {typeof photoCount === 'number' && photoCount > 0
          ? ` · ${photoCount.toLocaleString('en-PH')} photos captured live`
          : ' · captured live during the celebration'}
      </p>
      <div className="gap-2 [column-fill:_balance] columns-2 sm:columns-3 lg:columns-4">
        {photos.slice(0, 24).map((url, i) => (
          <figure
            key={`${i}-${url.slice(0, 24)}`}
            className="mb-2 overflow-hidden rounded-sm bg-ink/10 break-inside-avoid"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt=""
              aria-hidden
              className="w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          </figure>
        ))}
      </div>
    </div>
  );
}

/**
 * "What They Whispered" — approved Kwento guest wishes (photo_messages). Owner
 * (2026-07-04): "kwento are messages with videos or photos" — every wish shows its
 * anchor media beside the words. A 2-column masonry (single column on mobile):
 * each wish is a serif-italic quote opened by a large gold quotation glyph,
 * attributed in mono, and — when its anchor resolved (fail-closed upstream) — sat
 * above its media: a photo as a small ~4/3 figure, a clip as a small living frame
 * (muted loop · tap-for-sound · poster · reduced-motion still) reusing the
 * page-wide living-moments playback machinery (≤3 concurrent · one audible). The
 * clip frame's thin Daily-Prophet double border lives in <KwentoClip>. Text-only
 * wishes keep the pure-quote treatment. Fails closed upstream (approved + clean +
 * not author-hidden; anchor gated per source table), so this only paints safe
 * wishes and safe media.
 */


function KwentoWall({
  quotes,
  names,
  max = 8,
}: {
  quotes: EditorialData['kwentoQuotes'];
  names: string;
  max?: number;
}): ReactElement {
  return (
    <div className="mt-4 gap-4 [column-fill:_balance] sm:columns-2">
      {quotes.slice(0, max).map((q, i) => (
        <figure key={i} className="mb-4 break-inside-avoid border-l-2 border-terracotta/40 pl-4">
          {q.media?.type === 'clip' ? (
            <KwentoClip url={q.media.url} posterUrl={q.media.posterUrl} names={names} />
          ) : q.media?.type === 'photo' ? (
            <div className="relative mb-3 aspect-[4/3] overflow-hidden rounded-sm bg-ink/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={q.media.url}
                alt=""
                aria-hidden
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            </div>
          ) : null}
          <blockquote className="m-0 font-serif text-base italic leading-snug text-ink/85">
            <span aria-hidden className="mr-1 font-display text-3xl leading-none text-terracotta">
              &ldquo;
            </span>
            {q.body}
          </blockquote>
          {q.author ? (
            <figcaption className="mt-2 font-mono text-xs uppercase tracking-[0.12em] text-ink/60">
              {q.author}
              {q.role ? ` · ${q.role}` : ''}
            </figcaption>
          ) : null}
        </figure>
      ))}
    </div>
  );
}

/* ── OPEN-UP PREVIEWS (Maker Phase 8) ──────────────────────────────────────
   What an open-up scene shows IN THE FLOW — the template the prototype names —
   before a tap opens the shipped part full screen. They sit inside the preview's
   button, so nothing in them may be interactive (no links, no players). */




/**
 * "Watch the Film" — the Live Studio (Panood) broadcast replay. The couple's
 * ceremony as it was broadcast, embedded in a Daily-Prophet double-border frame
 * (matching the living-moments clip frame) with a paper shadow. The URL is already
 * a youtube-nocookie embed (normalize-or-rejected in lib/panood-watch), so the
 * iframe never carries a raw pasted URL. Lazy-loaded, titled.
 */
function WatchTheFilm({ embedUrl, names }: { embedUrl: string; names: string }): ReactElement {
  return (
    <div className="mt-4">
      <p className="mb-3 text-center font-mono text-xs uppercase tracking-[0.16em] text-ink/60">
        the ceremony, as it was broadcast
      </p>
      <div className="mx-auto max-w-3xl border-double border-[3px] border-ink/80 p-1.5 shadow-[0_10px_30px_-12px_rgba(20,16,12,0.35)]">
        <div className="relative aspect-video w-full overflow-hidden bg-ink">
          <iframe
            src={embedUrl}
            title={`${names} — the ceremony broadcast replay`}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        </div>
      </div>
    </div>
  );
}

/**
 * "What They Said" — guest / vendor / couple reviews. Reads
 * EditorialData.reviews (seeded today via event_editorial.draft_json.reviews;
 * the full event-bound review system §3 is a later increment). Newspaper
 * pull-quote treatment in a 2-col masonry-ish grid.
 */
function ReviewsWall({ reviews }: { reviews: EditorialData['reviews'] }): ReactElement {
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
      {reviews.slice(0, 8).map((r, i) => (
        <figure key={i} className="break-inside-avoid border-l-2 border-terracotta/40 pl-4">
          <blockquote className="font-serif text-base italic leading-snug text-ink/85">
            &ldquo;{r.quote}&rdquo;
          </blockquote>
          <figcaption className="mt-2 font-mono text-xs uppercase tracking-[0.12em] text-ink/60">
            {r.stars ? (
              <span aria-hidden className="mr-1 text-terracotta">
                {'★'.repeat(Math.max(1, Math.min(5, r.stars)))}
              </span>
            ) : null}
            {r.author}
            {r.role ? ` · ${r.role}` : ''}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

/**
 * "Powered by Setnayan" — the in-app services the couple availed (resolved
 * from paid `orders` in data.ts). A simple chip row; shows the breadth of the
 * Setnayan experience used for this wedding.
 */
function SetnayanExperience({ services }: { services: string[] }): ReactElement {
  return (
    <div className="mt-4 flex flex-wrap justify-center gap-2">
      {services.map((s, i) => (
        <span
          key={i}
          className="rounded-full border border-ink/15 bg-cream px-3 py-1 font-mono text-xs uppercase tracking-[0.1em] text-ink/70"
        >
          {s}
        </span>
      ))}
    </div>
  );
}

function Colophon({
  names,
  city,
  hideWatermark = false,
  slug = null,
  watchFilmShown = false,
  words: w,
}: {
  words: EventWords;
  names: string;
  city: string | null;
  /** Paid COUPLE_WEBSITE_PRO perk — drop the masthead "Powered by Setnayan"
   *  watermark when the event owns the active upgrade. The cross-phase links +
   *  couple names stay; only the freemium credit line goes. */
  hideWatermark?: boolean;
  /**
   * The couple's real slug. Drives BOTH the cross-phase links below and the
   * quiet "Print the keepsake" link into the A3 broadsheet route
   * (/[slug]/print). Null for the curated samples (no real event row), which
   * have neither; everything slug-dependent is then omitted.
   */
  slug?: string | null;
  /** Did the "Watch the Film" section render on this edition? Only then is
   *  there anything for its link to scroll to. */
  watchFilmShown?: boolean;
}): ReactElement {
  return (
    <footer className="mt-7 border-t-[3px] border-double border-ink pt-3 text-center">
      {/* ── THE THREE LINKS AT THE FOOT OF THE EDITORIAL THAT WENT NOWHERE. ──
          All three were `href="#"`, and all three name something that exists:
            · the couple's own site, which carries the RSVP           → /[slug]
            · the event-day hub                                       → /[slug]/hub
            · "Watch the Film" — the broadcast replay, which is a SECTION OF
              THIS VERY PAGE. Its destination was never missing; the section
              simply had no id to aim at. It has one now.
          Each is drawn only when its destination is really there: no slug means
          a curated sample with no event behind it, and an edition where the
          couple never broadcast has no film section to scroll to. A footer that
          quietly gets shorter is honest; a link that does nothing is not. */}
      {slug || watchFilmShown ? (
        <div className="flex flex-wrap justify-center gap-5 font-mono text-xs uppercase tracking-[0.1em]">
          {slug ? (
            <a
              href={`/${slug}`}
              className="border-b border-terracotta pb-0.5 text-ink no-underline"
            >
              The Invitation (RSVP)
            </a>
          ) : null}
          {slug ? (
            <a
              href={`/${slug}/hub`}
              className="border-b border-terracotta pb-0.5 text-ink no-underline"
            >
              The {capitaliseWords(w.eventWord)} Day (Live)
            </a>
          ) : null}
          {watchFilmShown ? (
            <a
              href={`#${WATCH_FILM_ANCHOR_ID}`}
              className="border-b border-terracotta pb-0.5 text-ink no-underline"
            >
              Watch the Film
            </a>
          ) : null}
        </div>
      ) : null}
      {/* Print the keepsake — a quiet on-screen-only web affordance into the A3
          broadsheet route. `print:hidden` keeps it off the browser's own print
          of the editorial page. Omitted for samples (no real slug). */}
      {slug ? (
        <a
          href={`/${slug}/print`}
          className="mt-3 inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.14em] text-ink/60 no-underline hover:text-terracotta-700 print:hidden"
        >
          <Printer aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Print the keepsake
        </a>
      ) : null}
      <p className="mt-3 font-serif text-sm italic text-ink/60">
        {hideWatermark ? (
          names
        ) : (
          <>
            Powered by Setnayan{city ? ` · ${city}` : ''} · {names}
          </>
        )}
      </p>
    </footer>
  );
}

// ── tiny presentational helpers ───────────────────────────────────────────────

function fmt(n: number): string {
  try {
    return n.toLocaleString('en-PH');
  } catch {
    return String(n);
  }
}

function prettyCategory(category: string): string {
  return category.replace(/_/g, ' ');
}
