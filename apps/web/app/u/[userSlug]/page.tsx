import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Play } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolvePublicProfile } from '@/lib/public-profile';
import { resolveRenamedPath } from '@/lib/slug-forwarding';
import { EventMonogram } from '@/app/_components/event-monogram';
import { resolveCelebrationIdentity } from '@/lib/celebration-card-identity';
import { pastShelf, splitComingUpAndPast } from '@/lib/coming-up-and-past';
import { manilaTodayISO } from '@/lib/event-board';
import { initialsFor } from '@/lib/conversation-list';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { renderableImageSrc } from '@/lib/event-card-art';
import { formatEventDate } from '@/lib/events';
import { ReportPageButton } from '@/app/_components/report-page-button';
import { ProfileShareButton } from '@/app/_components/profile-share-button';
import { CreatorBadge } from '@/app/_components/creator-badge';
import { CreatorTierChip } from '@/app/_components/creator-tier-chip';
import {
  chapterExcerpt,
  CHAPTER_KIND_LABEL,
  EMBED_PROVIDER_LABEL,
  youtubeThumbFromEmbedUrl,
} from '@/lib/creator-chapters';
import {
  fetchPublishedChaptersResult,
  loadChapterEventDays,
  type PublicChapter,
} from '@/lib/creator-public';
import { chronicleDay, groupChronicleByYear } from '@/lib/creator-chronicle';
import { ScaledTileList } from '@/app/_components/scaled-tile';
import { loadChapterPictures, type ChapterPicture } from '@/lib/chapter-picture';
import { loadWhoWasThere, type WhoWasThere } from '@/lib/who-was-there';
import {
  fetchCreatorInfluence,
  type CreatorInfluenceVendor,
} from '@/lib/creator-offers';
import { formatAudienceCount } from '@/lib/creator-audience';
import { fetchCreatorInquiriesDriven } from '@/lib/inquiry-attribution';
import { ViewBeacon } from '@/app/u/_components/view-beacon';
import { FollowButton } from '@/app/u/_components/follow-button';
import { MutualDays } from '@/app/u/_components/mutual-days';

// Public account profile · setnayan.com/u/[user-slug].
//
// Doubles as the account's public website (owner 2026-07-04): the same surface
// that lets a signed-out visitor pick among the couple's celebrations IS their
// personal web presence. The signed-in dashboard keeps its own simple picker +
// auto-jump (owner ruling 2026-07-04 "keep auto-jump, hub reachable"); this
// page is the polished public-facing counterpart.
//
// Dispatch (owner ruling 2026-07-01):
//   • exactly 1 ongoing (active + effectively-public) event → redirect straight
//     to /u/[user-slug]/[event-slug] (mirrors the signed-in dashboard's
//     single-active-event auto-jump).
//   • 2+ ongoing events → show the celebrations gallery.
//   • 0 ongoing events → show the account's published stories (past public
//     celebrations); empty-state when there are none.
//
// Creator overlay (CP-3; user-native since 2026-07-16): creator is now a
// USER-NATIVE capability — a profile that has published >=1 Adventure Chapter is
// a creator, no is_creator flag. When the account has published chapters, the
// profile ALSO renders a timeline of them (reverse-chronological cards →
// /u/[slug]/c/[id]) plus the gold creator badge, and never auto-redirects into a
// single event — the chapters are the point of the page.
//
// Only surfaces events the /[slug] target would actually render — mirrors BOTH
// gates that page enforces: (a) effectively-public visibility (so 'unlisted' /
// 'private' / pre-STD-launch events never appear), and (b) the event-type
// 'website' surface (generic / simple event types don't enable a public
// website, so listing/redirecting to them would 404). This is a public,
// indexable-adjacent surface — it aggregates only what the couple published.

export const revalidate = 60;

type Props = { params: Promise<{ userSlug: string }> };

const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com'
).replace(/\/$/, '');

// The "who is a public profile / what counts as a public chapter" resolver lives
// in lib/public-profile.ts (resolvePublicProfile, cache()-wrapped) so the page
// body, generateMetadata, the OG route, and the settings share-doorway gate all
// agree on the SAME definition — a name/hero never leaks anywhere one of them
// would have hidden it.

// Owner-preview probe. Only ever called on the DORMANT path (profile disabled),
// so the common enabled+public render never reads cookies and stays cacheable
// under `revalidate`. The signed-in holder may preview their own hidden shell;
// everyone else 404s.
async function isSignedInHolder(ownerUserId: string): Promise<boolean> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return !!user && user.id === ownerUserId;
  } catch {
    return false;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { userSlug } = await params;
  const resolved = await resolvePublicProfile(userSlug);

  // Neutral, name-free metadata unless the profile is BOTH opted-in AND has at
  // least one public chapter. This keeps the account holder's real name out of
  // the <title> for any enumerable slug (the name/existence oracle) and honors
  // the noindex-unless-published rule.
  const enabled = resolved?.user.public_profile_enabled === true;
  const hasPublic = (resolved?.publicWebsiteEvents.length ?? 0) > 0;
  if (!resolved || !enabled || !hasPublic) {
    return {
      // `absolute` bypasses the root template so this renders exactly
      // "Setnayan" and not "Setnayan · Setnayan". The neutral title is the
      // privacy control here — it must not confirm the slug belongs to anyone.
      title: { absolute: 'Setnayan' },
      robots: { index: false, follow: false },
    };
  }

  const name = resolved.user.display_name?.trim() || 'Setnayan';
  const canonicalSlug = resolved.user.slug ?? userSlug;
  // Personalized share card (name + most-recent public hero) — item #7c. The OG
  // route re-checks the SAME enabled + ≥1-public-chapter gate before rendering a
  // name-bearing card, and falls back to the brand card otherwise, so this URL is
  // only ever emitted for a genuine public showcase.
  const ogImage = `${SITE_URL}/api/og/u/${canonicalSlug}`;
  return {
    title: `${name} · Setnayan`,
    // Aggregation surface — the individual event pages carry the real SEO. Keep
    // this out of the index to avoid thin-content duplication, but allow follow
    // so the (public) chapter links are crawled.
    robots: { index: false, follow: true },
    openGraph: {
      type: 'profile',
      title: `${name} · Setnayan`,
      siteName: 'Setnayan',
      locale: 'en_PH',
      images: [{ url: ogImage, width: 1200, height: 630, alt: `${name} · Setnayan` }],
    },
    twitter: { card: 'summary_large_image' as const },
  };
}

export default async function AccountProfilePage({ params }: Props) {
  const { userSlug } = await params;
  const resolved = await resolvePublicProfile(userSlug);
  // Retired-handle forwarding. The handle field on Profile promises the old
  // link keeps working, and every rename writes the ledger row — but NOTHING
  // ANYWHERE READ THOSE ROWS, at any flag setting, so a person who corrected
  // their handle broke every link anyone had already shared. Only on the miss
  // path, so a live profile costs nothing.
  if (!resolved) {
    const movedTo = await resolveRenamedPath(createAdminClient(), userSlug, ['user']);
    if (movedTo) redirect(movedTo);
    notFound();
  }

  const { user, publicWebsiteEvents } = resolved;
  const canonicalSlug = (user.slug as string | null) ?? userSlug;

  // #7b — per-account public/hidden gate. DORMANT by default: while the account
  // hasn't opted in, the /u shell 404s for strangers so it's neither a public
  // page nor a name/existence oracle. Only the signed-in holder may preview
  // their own hidden shell (this is the ONLY branch that reads auth, so the
  // opted-in public render stays cacheable under `revalidate`).
  const enabled = user.public_profile_enabled === true;
  const isOwnerPreview = enabled ? false : await isSignedInHolder(user.user_id);
  if (!enabled && !isOwnerPreview) notFound();

  /*
    ── THE ACCOUNT'S FACE ─────────────────────────────────────────────────────
    ⚖ Owner 2026-09-23, asked directly whether turning the public profile on
    counts as consent to publish the photo: *"yes, turning it on is the
    consent"*. So it is gated on `enabled` and nothing else — an owner PREVIEW
    of a switched-OFF profile deliberately shows no photo, because the consent
    is the switch and the switch is off.

    THREE THINGS THE STORED VALUE IS NOT:
      • not an <img src> — it is `r2://bucket/key`, and handing that to an <img>
        renders a broken-image glyph. `displayUrlForStoredAsset` is the app's own
        resolver (it fails closed for a non-public bucket, so a private ref
        yields null and the initials show).
      • not trusted — `renderableImageSrc` re-checks the RESULT, the same guard
        the event hero goes through, because this is a public page.
      • not the common case — 16 of 17 accounts have no photo. The initials disc
        is what almost everyone sees; the photo is the enhancement.
  */
  const photoSrc = enabled
    ? renderableImageSrc(await displayUrlForStoredAsset(user.profile_photo_url))
    : null;

  // Creator "Adventure Chapter" (CP-3; user-native): a profile with published
  // chapters IS a timeline of them, not just an event picker. Creator is now
  // user-native — having >=1 published chapter is what makes the account a
  // creator (no is_creator flag). We're already past the enabled/owner-preview
  // gate, so load the timeline here; when it's non-empty we NEVER auto-redirect
  // into a single event — the chapters are the point of the page.
  const chaptersRead = await fetchPublishedChaptersResult(user.user_id);
  const chapters: PublicChapter[] = chaptersRead.items;
  const hasChapters = chapters.length > 0;
  // The chronicle is ordered by the day each celebration HAPPENED, so the
  // timeline needs those days. Only read when there is something to place, and
  // only for chapters that name a celebration.
  const [chapterEventDays, chapterPictures, whoWasThere] = hasChapters
    ? await Promise.all([
        loadChapterEventDays(chapters.map((c) => c.event_id)),
        // The photographs. One snapshot per celebration, not per chapter — see
        // lib/chapter-picture.ts for why that distinction is the whole cost.
        loadChapterPictures(chapters),
        // 🔒 The entourage — ACCEPTED roles only. See lib/who-was-there.ts:
        // being on a guest list is not agreeing to be named in public.
        loadWhoWasThere(
          chapters.map((c) => c.event_id).filter((id): id is string => !!id),
        ),
      ])
    : [
        new Map<string, string>(),
        new Map<string, ChapterPicture>(),
        [] as WhoWasThere[],
      ];

  // Creator "influence" — accepted vendor partnerships (aggregate, public). Only
  // relevant for a creator profile; never exposes the offer terms or the graph,
  // just the fact of a partnership + the vendor's public identity.
  const influenceVendors: CreatorInfluenceVendor[] = hasChapters
    ? await fetchCreatorInfluence(user.user_id)
    : [];

  // "Inquiries driven" (Creator Economy PR-C) — the ONE public influence metric
  // (owner paper-lock: raw integer, the word is "inquiries" never "bookings",
  // renders NOTHING at 0). Aggregate-only: the count of distinct events whose
  // chapter-attributed inquiry a vendor unlocked, self-owned-vendor unlocks
  // excluded. No tiers, no bands.
  const inquiriesDriven = hasChapters
    ? await fetchCreatorInquiriesDriven(user.user_id)
    : 0;

  const ongoing = publicWebsiteEvents.filter((e) => !e.archived);

  // 1 ongoing → jump straight in (skip for the owner previewing their own
  // hidden shell so they actually see the profile page they're checking, and
  // for creators whose profile is the chapter timeline).
  //
  // ⚠ AND NEVER ON A FAILED READ. `hasChapters` is false both when somebody
  // has published nothing and when the chapters query was REFUSED — a rejected
  // Supabase query resolves rather than throwing. Redirecting on the second
  // case sends a visitor who pressed this person's name in a byline onto a
  // WEDDING PAGE instead of the person's own, with nothing on screen wrong.
  // A read that failed knows nothing, so it decides nothing.
  if (ongoing.length === 1 && !isOwnerPreview && !hasChapters && chaptersRead.ok) {
    redirect(`/u/${canonicalSlug}/${ongoing[0]!.slug}`);
  }

  // ongoing≥2 → the celebrations gallery; ongoing 0 → published stories (past
  // public celebrations, incl. archived); the single-ongoing case only reaches
  // here for the owner preview, where we still list it rather than redirect.
  const listed = ongoing.length >= 2 ? ongoing : publicWebsiteEvents;
  const { comingUp, past: pastEvents } = splitComingUpAndPast(listed, manilaTodayISO());
  const pastShown = pastShelf(pastEvents);

  /*
    ONE CARD, RENDERED BY BOTH SECTIONS. Extracted when the Coming-up/Past
    split landed so the two sections cannot drift into two different cards —
    which is the defect the split exists to fix, arriving from the other side.
    Section-level difference is carried by the SECTION, never by a second copy
    of this markup.
  */
  const renderCelebration = (event: (typeof listed)[number]) => {
              const meta = [event.venue_name, formatEventDate(event.event_date)]
                .filter(Boolean)
                .join(' · ');
              /*
                  THE CARD WEARS THE CELEBRATION (owner 2026-09-23: "the event
                  cards look non events"). It used to read the hero and the
                  monogram and nothing else — and since none of his three events
                  has a hero, every card took the monogram branch, where every
                  `monogram_color` is the same default. Three celebrations, three
                  identical discs.

                  `resolveCelebrationIdentity` reads the look the couple ALREADY
                  chose: their Save-the-Date typeface and their own accent. It
                  invents nothing and reads no private column.
              */
              const identity = resolveCelebrationIdentity(event);
              return (
                <li key={event.event_id}>
                  <Link
                    href={`/u/${canonicalSlug}/${event.slug}`}
                    className="uprof-card"
                    data-identity={identity.hasOwnIdentity ? 'own' : 'none'}
                  >
                    {identity.heroUrl ? (
                      <span className="uprof-cover">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={identity.heroUrl}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="uprof-cover-img"
                        />
                      </span>
                    ) : (
                      <span className="uprof-mark">
                        <EventMonogram event={event} size="lg" />
                      </span>
                    )}
                    <span className="uprof-body">
                      {/* The event's OWN typeface, from its STD theme — the
                          class comes from the shipped STD_THEMES table, never
                          re-typed here. */}
                      <span className={`${identity.fontCls} uprof-title`}>
                        {event.display_name?.trim() || 'Celebration'}
                      </span>
                      {meta ? <span className="uprof-meta">{meta}</span> : null}
                    </span>
                    {/* THE CHEVRON IS GONE. A `›` is list-row chrome: it says
                        "next item in a settings list", which is precisely what
                        made a celebration read as a row. The whole card is the
                        link; it needs no arrow to say so. */}
                  </Link>
                </li>
              );
  };

  const mode: 'gallery' | 'stories' | 'empty' =
    ongoing.length >= 2 ? 'gallery' : listed.length > 0 ? 'stories' : 'empty';

  // Name-oracle fix: only surface the holder's real display_name when there is
  // public published content (gallery/stories/chapters) — never on the true
  // empty state, where printing it would confirm "this slug exists and belongs
  // to <name>". A creator with a published chapter timeline counts as content.
  const hasPublicContent = mode !== 'empty' || hasChapters;
  const displayName = user.display_name?.trim() || 'Celebrations';
  const heading = hasPublicContent ? displayName : 'A Setnayan profile';

  const subtitle =
    mode === 'gallery'
      ? 'A collection of celebrations.'
      : mode === 'stories'
        ? 'Stories from celebrations past.'
        : null;

  return (
    <main className="uprof">
      <style>{UPROF_CSS}</style>

      {/* Audience view beacon — counts a genuinely-public profile view out of
          band (keeps this page ISR-cacheable). No-op on the owner-preview of a
          hidden profile (the RPC self-gates to public_profile_enabled). */}
      {enabled && hasPublicContent ? (
        <ViewBeacon kind="profile" id={user.user_id} />
      ) : null}

      <div className="uprof-inner">
        {isOwnerPreview ? (
          <div className="uprof-preview" role="status">
            Preview · your public profile is <strong>hidden</strong>. Turn it on in
            Profile &amp; settings → URL &amp; handle to share it.
          </div>
        ) : null}
        <header className="uprof-head">
          <span className="uprof-avatar" aria-hidden>
            {photoSrc ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={photoSrc} alt="" className="uprof-avatar-img" decoding="async" />
            ) : (
              <span className="uprof-avatar-initials">{initialsFor(heading)}</span>
            )}
          </span>
          <h1 className="m-serif uprof-name">{heading}</h1>
          {hasChapters ? (
            <div className="uprof-badge-row">
              <CreatorBadge size="md" />
            </div>
          ) : null}
          {hasPublicContent ? (
            <div className="uprof-audience">
              {/* E6 — "N chapters", first in the row (spec order: chapters ·
                  followers · views · inquiries-driven). Presentation-only:
                  `chapters` is already loaded above for the timeline, so this
                  adds ZERO reads, and it counts EXACTLY what the timeline below
                  renders (published AND carrying an embed) — not a DB total, and
                  deliberately not the owner's own draft-inclusive count.

                  HONESTY GATE: `hasChapters` is the only gate, and a FAILED read
                  cannot reach it — fetchPublishedChapters swallows a Supabase
                  error to [], so a broken read renders no badge, no timeline and
                  no stat. There is no path where this prints "0 chapters". */}
              {hasChapters ? (
                <>
                  <span className="uprof-stat">
                    <strong>{formatAudienceCount(chapters.length)}</strong>{' '}
                    {chapters.length === 1 ? 'chapter' : 'chapters'}
                  </span>
                  <span aria-hidden className="uprof-stat-dot">
                    &middot;
                  </span>
                </>
              ) : null}
              <span className="uprof-stat">
                <strong>{formatAudienceCount(user.followers_count)}</strong>{' '}
                {user.followers_count === 1 ? 'follower' : 'followers'}
              </span>
              <span aria-hidden className="uprof-stat-dot">
                &middot;
              </span>
              <span className="uprof-stat">
                <strong>{formatAudienceCount(user.profile_view_count)}</strong>{' '}
                {user.profile_view_count === 1 ? 'view' : 'views'}
              </span>
              {/* PR-C — renders NOTHING at 0 (no fake influence). */}
              {inquiriesDriven > 0 ? (
                <>
                  <span aria-hidden className="uprof-stat-dot">
                    &middot;
                  </span>
                  <span className="uprof-stat">
                    <strong>{formatAudienceCount(inquiriesDriven)}</strong>{' '}
                    {inquiriesDriven === 1 ? 'inquiry driven' : 'inquiries driven'}
                    {/* P3 tier band — a rendering of the SAME number, not a
                        second metric; hides at 0 alongside the line itself. */}
                    <CreatorTierChip
                      inquiriesDriven={inquiriesDriven}
                      className="uprof-tier-chip"
                    />
                  </span>
                </>
              ) : null}
              {/* Follow — the client island renders only for a signed-in
                  visitor viewing someone else's profile (never self/signed-out).
                  E6: the one-way note rides INSIDE the island (past its own
                  render gate) so it can never appear without the button. */}
              <FollowButton
                followedUserId={user.user_id}
                className="uprof-follow"
                noteClassName="uprof-follow-note"
              />
            </div>
          ) : null}
          <span aria-hidden className="uprof-rule" />
          {subtitle ? <p className="uprof-sub">{subtitle}</p> : null}
        </header>

        {/*
            ── COMING UP · PAST (owner 2026-09-23: "split coming up from past") ──
            He asked "why do we see the 2 upcoming events as well?" — which was
            not a request for two headings. He had noticed that an INVITATION and
            a MEMORY were drawn identically. So the sections read as different
            things: Coming up leads the page at full size; Past is quieter and
            smaller, something to look back at. Two identical grids under two
            headings would satisfy the words and miss the point.

            "Is this over" is `isFinishedEvent` via `splitComingUpAndPast` —
            archived, multi-day and dateless already have ONE answer in this
            product. "Today" is Manila's, because a wedding is upcoming until it
            is over where it happens.

            A section renders ONLY when it has cards: a couple with nothing
            behind them must never meet an empty "Past celebrations" heading.
        */}
        {listed.length > 0 ? (
          <>
            {comingUp.length > 0 ? (
              <section className="uprof-section">
                <h2 className="uprof-section-head">Coming up</h2>
                <ul className="uprof-grid">{comingUp.map(renderCelebration)}</ul>
              </section>
            ) : null}
            {pastEvents.length > 0 ? (
              <section className="uprof-section uprof-past">
                <h2 className="uprof-section-head">Past celebrations</h2>
                <ul className="uprof-grid">{pastShown.shown.map(renderCelebration)}</ul>
                {/*
                    A PLAIN <details>, SO THE REST IS ONE TAP AND NO JAVASCRIPT.
                    This page is ISR-cached and the rest of it is server-rendered;
                    a client island to reveal six more memories would be the only
                    script on the page, and it would leave the hidden ones out of
                    the HTML a search engine or a reader-mode sees. The cards are
                    RENDERED either way — `details` only hides them.
                */}
                {pastShown.moreLabel ? (
                  <details className="uprof-more">
                    <summary className="uprof-more-btn">{pastShown.moreLabel}</summary>
                    <ul className="uprof-grid uprof-more-grid">
                      {pastEvents.slice(pastShown.shown.length).map(renderCelebration)}
                    </ul>
                  </details>
                ) : null}
              </section>
            ) : null}
          </>
        ) : hasChapters ? null : (
          <div className="uprof-empty">
            <p className="uprof-empty-title">Nothing public to show yet</p>
            <p className="uprof-empty-sub">
              When a celebration is published, it will appear here.
            </p>
          </div>
        )}

        {/* "The days you were both there" — a per-VIEWER client island, for the
            same reason FollowButton is one: this page is ISR-cached, and an
            answer that differs per visitor must never enter that cache. It
            renders nothing for a signed-out visitor, nothing on your own
            profile, and nothing while the feature is off. The holder's name is
            passed ONLY where the page already prints it publicly, so the island
            can never become a name oracle for a hidden/empty profile. */}
        {/* ⚠ NOT `displayName` — that variable falls back to the literal
            "Celebrations" when the account has no name set, which would print
            "the next time you and Celebrations are at the same celebration".
            Pass the REAL name or nothing; the island says "them" when it has
            nothing, which is always readable. */}
        <MutualDays
          profileUserId={user.user_id}
          profileName={hasPublicContent ? (user.display_name?.trim() || null) : null}
        />

        {hasChapters ? (
          <>
            <WhoWasThereBand people={whoWasThere} />
            <ChapterTimeline
              chapters={chapters}
              eventDays={chapterEventDays}
              pictures={chapterPictures}
              slug={canonicalSlug}
            />
          </>
        ) : null}

        {influenceVendors.length > 0 ? (
          <CreatorInfluence vendors={influenceVendors} />
        ) : null}

        {/* Share doorway + report path (#7c). Gated on the profile being a real
            public showcase — opted-in AND has ≥1 public chapter (hasPublicContent).
            Never rendered on the disabled owner-preview or the empty state, so we
            never offer sharing on, or attach a report target to, a non-public
            profile. */}
        {enabled && hasPublicContent ? (
          <div className="uprof-actions">
            <ProfileShareButton
              url={`${SITE_URL}/u/${canonicalSlug}`}
              title={`${displayName} · Setnayan`}
              className="uprof-action-btn"
            />
            <ReportPageButton
              targetType="user_profile"
              targetId={user.user_id}
              label="Report this page"
              className="inline-flex"
            />
          </div>
        ) : null}

        <footer className="uprof-foot">
          <a href="https://www.setnayan.com" className="uprof-foot-link">
            Made with Setnayan
          </a>
        </footer>
      </div>
    </main>
  );
}

/**
 * The chapter's day, long form.
 *
 * 🪤 `new Date('2026-12-18')` IS MIDNIGHT UTC — the 17th anywhere west of
 * Greenwich — and this function used to do exactly that. It only ever received
 * a publish TIMESTAMP, where the hour absorbed the shift; it now also receives
 * the celebration's DATE, which is a bare calendar day and would have drifted
 * on the phone of every relative reading from abroad. `formatEventDate` builds
 * the date from its parts for precisely this reason (2026-08-04 sweep, 41 call
 * sites), so this delegates rather than repeating the mistake a third time.
 */
function formatChapterDate(iso: string | null): string | null {
  if (!iso) return null;
  return formatEventDate(iso.slice(0, 10), 'en-PH') || null;
}

// CP-3 — the published-chapter TIMELINE (reverse-chronological, a spine of
// dated cards; deliberately NOT a feed). Each card links to the chapter detail
// view at /u/[slug]/c/[public_id]. The embed itself is NOT mounted here — the
// timeline is lightweight cards; the sandboxed ChapterEmbedFrame lives on the
// detail page.
/**
 * WHO WAS THERE — the band the whole field is missing.
 *
 * 🔒 It renders ONLY people who ACCEPTED a named role (lib/who-was-there.ts).
 * An empty list renders nothing at all: a heading over no names would announce
 * an entourage that either does not exist or did not consent, and both are
 * worse than silence.
 *
 * ⚠ NO GUEST COUNT HERE, deliberately. "+ 42 guests" was in the drawing, and a
 * count is harmless — but it can only be measured from `guests`, and a failed
 * read of that table is indistinguishable from a wedding of nine people. A
 * number nobody can trust does not belong next to names that are true.
 */
function WhoWasThereBand({ people }: { people: WhoWasThere[] }) {
  if (people.length === 0) return null;
  return (
    <section className="uprof-who" aria-label="Who was there">
      <p className="uprof-who-h">Who was there</p>
      <ul className="uprof-who-l">
        {people.map((p) => (
          <li key={`${p.role}-${p.name}`} className="uprof-who-i">
            <span className="uprof-who-n">{p.name}</span>
            <span className="uprof-who-r">{p.role}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ChapterTimeline({
  chapters,
  eventDays,
  pictures,
  slug,
}: {
  chapters: PublicChapter[];
  /** event_id → the day it happened, for the chapters that name a celebration. */
  eventDays: Map<string, string>;
  /** chapter_id → its public-safe photograph. Absent = no picture, which is a
   *  smaller chapter rather than a broken one. */
  pictures: Map<string, ChapterPicture>;
  slug: string;
}) {
  // THE CHRONICLE — the year is the season, the chapter is the episode, and the
  // number restarts inside each year (owner 2026-08-20). The day comes from the
  // author's own answer, then the celebration it is attached to, then — last
  // resort — the publish date.
  //
  // Derived from PARSED DAYS, never from array position: the query orders
  // published_at DESC and Postgres DESC is NULLS FIRST, so `chapters[0]` can be
  // an undated row. Undated rows get no number and can never be "latest".
  const days = chapters.map((c) =>
    chronicleDay({
      happenedOn: c.happened_on,
      eventDate: c.event_id ? eventDays.get(c.event_id) ?? null : null,
      publishedAt: c.published_at,
    }),
  );
  const blocks = groupChronicleByYear(chapters, (_c, i) => days[i] ?? null);
  // The poster + "Latest" belong to the newest DATED chapter in the whole
  // timeline, which is the first entry of the first block that has a year.
  const newestIndex = blocks.find((b) => b.year !== null)?.entries[0]?.index ?? -1;
  const datedCount = days.filter((d) => d !== null).length;
  const showLatest = datedCount > 1;

  return (
    <section className="uprof-tl" aria-label="Chapters">
      {blocks.map((block) => {
        // 🔑 THE SIZE IS DERIVED, NEVER CHOSEN — and it now lives in the shared
        // tile (app/_components/scaled-tile.tsx) so every other surface can use
        // the same rule. This page was where it was born and was the only place
        // that could reach it.
        return (
          <div key={block.year ?? 'unplaced'} className="uprof-yr">
            {/* THE YEAR IS THE SEASON, and it is written as its own name.
                ⛔ NEVER as the words "Your year" — that is a DIFFERENT page one
                click away in the same menu, which looks FORWARD at what is
                coming; this looks back at what happened. Same words on two
                things is the failure the Event Hub vocabulary lock exists to
                prevent. */}
            {block.year ? (
              <p className="uprof-yr-mark">
                <span className="uprof-yr-n">{block.year}</span>
                <span aria-hidden className="uprof-yr-rule" />
                <span className="uprof-yr-c">
                  {block.entries.length === 1 ? '1 chapter' : `${block.entries.length} chapters`}
                </span>
              </p>
            ) : null}
            <ScaledTileList
              className="uprof-list"
              items={block.entries.map(({ item: c, index: i, number: n }) => {
                // The day the chapter is ABOUT — the celebration's when it has one.
                const date = formatChapterDate(days[i] ?? c.published_at);
                const pic = pictures.get(c.chapter_id) ?? null;
                return {
                  id: c.chapter_id,
                  href: `/u/${slug}/c/${c.public_id}`,
                  title: c.title,
                  kicker: [
                    n !== null ? `Chapter ${n}` : null,
                    CHAPTER_KIND_LABEL[c.kind],
                    date,
                    i === newestIndex && showLatest ? 'Latest' : null,
                  ]
                    .filter(Boolean)
                    .join(' · '),
                  // ONE SENTENCE, never an essay — the slot is built for
                  // somebody with two sentences and four hundred photographs.
                  excerpt: chapterExcerpt(c.body, 190),
                  imageUrl: pic?.url ?? null,
                  imageNote: pic && pic.count > 1 ? `${pic.count} photos` : null,
                  hasVideo: !!c.embed_url,
                  meta: date,
                  cue: c.embed_url ? 'Watch the chapter' : 'Read the chapter',
                };
              })}
            />
          </div>
        );
      })}
    </section>
  );
}

// Creator "influence" — partnered vendors (accepted discount collabs), an
// aggregate social-proof strip. Public + terms-free: it shows WHO the creator
// has partnered with (name/logo → the vendor's 0%-commission public page), never
// the discount terms or the offer graph. Bookings-driven ROI is P2/P3.
function CreatorInfluence({ vendors }: { vendors: CreatorInfluenceVendor[] }) {
  return (
    <section className="uprof-inf" aria-label="Partnered vendors">
      <h2 className="m-serif uprof-inf-head">Partnered with</h2>
      <ul className="uprof-inf-list">
        {vendors.map((v) => (
          <li key={v.slug}>
            <Link href={`/v/${v.slug}`} className="uprof-inf-card">
              {v.logoUrl ? (
                <span className="uprof-inf-logo">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={v.logoUrl} alt="" loading="lazy" decoding="async" />
                </span>
              ) : (
                <span className="uprof-inf-logo uprof-inf-logo--blank" aria-hidden>
                  {v.name.charAt(0)}
                </span>
              )}
              <span className="uprof-inf-name">{v.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

const UPROF_CSS = `
  /* "Days you were both there" — rendered by the MutualDays client island.
     The island is a separate file, so these classes are its only styling; keep
     them here with the rest of the page's CSS rather than shipping a second
     <style> block. */
  .uprof-md { margin-top: clamp(2.5rem, 6vw, 3.75rem); }
  .uprof-md-head {
    font-size: clamp(1.2rem, 3.5vw, 1.6rem);
    text-align: center;
    margin: 0 0 clamp(1.25rem, 3vw, 1.75rem);
    color: var(--m-ink, #1B1A17);
  }
  .uprof-md-invite {
    max-width: 34rem;
    margin: 0 auto;
    text-align: center;
    font-size: 0.95rem;
    line-height: 1.65;
    color: color-mix(in srgb, var(--m-ink, #1B1A17) 62%, transparent);
  }
  .uprof-md-list { list-style: none; margin: 0; padding: 0; }
  .uprof-md-item + .uprof-md-item { margin-top: 0.9rem; }
  .uprof-md-card {
    display: flex;
    align-items: center;
    gap: 0.9rem;
    padding: 0.95rem 1.1rem;
    border: 1px solid color-mix(in srgb, var(--m-ink, #1B1A17) 12%, transparent);
    /* The same token as .uprof-card — a shared day is a card
       in the same stack, so it must not round differently from its neighbours. */
    border-radius: var(--m-r-lg, 22px);
    background: color-mix(in srgb, #FFFFFF 60%, transparent);
    text-decoration: none;
    transition: background-color 200ms, border-color 200ms;
  }
  .uprof-md-card:hover {
    background: #FFFFFF;
    border-color: color-mix(in srgb, var(--m-ink, #1B1A17) 22%, transparent);
  }
  .uprof-md-body { display: flex; flex-direction: column; gap: 0.2rem; min-width: 0; flex: 1; }
  .uprof-md-title { font-size: 1.02rem; color: var(--m-ink, #1B1A17); }
  .uprof-md-meta {
    font-size: 0.82rem;
    color: color-mix(in srgb, var(--m-ink, #1B1A17) 55%, transparent);
  }
  .uprof-md-chev {
    font-size: 1.35rem;
    line-height: 1;
    color: color-mix(in srgb, var(--m-ink, #1B1A17) 35%, transparent);
  }

  .uprof-inf { margin-top: clamp(2.5rem, 6vw, 3.75rem); }
  .uprof-inf-head {
    font-size: clamp(1.2rem, 3.5vw, 1.6rem);
    text-align: center;
    margin: 0 0 clamp(1.25rem, 3vw, 1.75rem);
    color: var(--m-ink, #1B1A17);
  }
  .uprof-inf-list {
    list-style: none;
    margin: 0 auto;
    padding: 0;
    max-width: 620px;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.7rem;
  }
  .uprof-inf-card {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.5rem 0.95rem 0.5rem 0.6rem;
    background: #fff;
    border: 1px solid var(--m-line, #E2DED4);
    border-radius: var(--m-r-full, 999px);
    box-shadow: var(--m-shadow-sm, 0 1px 2px rgba(30,26,18,.05));
    text-decoration: none;
    color: inherit;
    transition: transform .15s cubic-bezier(.2,.7,.2,1), border-color .15s;
  }
  .uprof-inf-card:hover {
    transform: translateY(-1px);
    border-color: var(--m-orange, #A9834B);
  }
  .uprof-inf-logo {
    flex: 0 0 auto;
    width: 26px;
    height: 26px;
    border-radius: var(--m-r-full, 999px);
    overflow: hidden;
    background: var(--m-ivory, #EDEAE0);
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .uprof-inf-logo img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .uprof-inf-logo--blank {
    font-family: var(--font-mono-marketing), ui-monospace, monospace;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--m-orange-2, #8A6B39);
    text-transform: uppercase;
  }
  .uprof-inf-name {
    font-size: 0.86rem;
    font-weight: 500;
    color: var(--m-ink, #1B1A17);
  }

  .uprof {
    min-height: 100dvh;
    background: var(--m-paper, #FBFBFA);
    color: var(--m-ink, #1B1A17);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: clamp(3rem, 9vw, 6rem) 1.5rem clamp(2.5rem, 6vw, 4rem);
  }
  .uprof-inner { width: 100%; max-width: 760px; }

  .uprof-preview {
    margin: 0 0 1.5rem;
    padding: 0.7rem 1rem;
    border: 1px solid var(--m-line, #E2DED4);
    border-radius: var(--m-r-md, 14px);
    background: var(--m-ivory, #EDEAE0);
    color: var(--m-slate, #4F535B);
    font-size: 0.85rem;
    text-align: center;
  }

  .uprof-avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 88px;
    height: 88px;
    margin: 0 auto 0.9rem;
    border-radius: var(--m-r-full, 999px);
    overflow: hidden;
    background: var(--m-paper-2, #F4F2EC);
    border: 1px solid var(--m-line, #E1DCD1);
  }
  .uprof-avatar-img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .uprof-avatar-initials {
    font-family: var(--font-display), Georgia, serif;
    font-size: 2rem;
    letter-spacing: .04em;
    color: var(--m-orange, #A9834B);
  }
  .uprof-head { text-align: center; margin-bottom: clamp(2.25rem, 5vw, 3.25rem); }
  .uprof-name {
    font-size: clamp(2.4rem, 7vw, 4rem);
    line-height: 1.04;
    margin: 0;
    color: var(--m-ink, #1B1A17);
  }
  .uprof-badge-row {
    display: flex;
    justify-content: center;
    margin-top: 1rem;
  }
  .uprof-audience {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.5rem 0.7rem;
    margin-top: 1rem;
  }
  .uprof-stat {
    font-size: 0.9rem;
    color: var(--m-slate, #4F535B);
  }
  .uprof-stat strong {
    color: var(--m-ink, #1B1A17);
    font-weight: 600;
  }
  .uprof-stat-dot {
    color: var(--m-slate-2, #6A6E76);
    opacity: 0.6;
  }
  .uprof-tier-chip {
    margin-left: 0.4rem;
  }
  .uprof-follow {
    margin-left: 0.3rem;
    display: inline-flex;
    align-items: center;
    padding: 0.34rem 0.95rem;
    border: 1px solid var(--m-orange, #A9834B);
    border-radius: var(--m-r-full, 999px);
    background: var(--m-orange, #A9834B);
    color: #fff;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition: transform .15s cubic-bezier(.2,.7,.2,1), opacity .15s, background .15s, color .15s;
  }
  .uprof-follow:hover { transform: translateY(-1px); }
  .uprof-follow:disabled { opacity: 0.6; cursor: default; transform: none; }
  .uprof-follow[data-following='1'] {
    background: #fff;
    color: var(--m-ink, #1B1A17);
    border-color: var(--m-line, #E2DED4);
  }
  /* E6 — the one-way promise. flex-basis:100% breaks it onto its own centered
     line inside the wrapping .uprof-audience row, so it never reads as a fourth
     stat chip.
     CONTRAST, measured not assumed: --m-slate-2 (#6E6A62) on --m-paper
     (#FFFFFF, white since 2026-08-20) = 5.39:1, clears AA. The spec's own 11.5px
     #A09A8E is 2.79:1 and
     was NOT used; --m-slate-3 (#8A857B) is 3.55:1 and also fails. Note that
     lint-label-on-fill-contrast.mjs CANNOT catch a miss here — it reads Tailwind
     class pairs and inline style objects, never this template literal. */
  .uprof-follow-note {
    flex-basis: 100%;
    width: 100%;
    margin: 0.35rem 0 0;
    text-align: center;
    font-size: 0.78rem;
    line-height: 1.35;
    color: var(--m-slate-2, #6E6A62);
  }

  .uprof-rule {
    display: block;
    width: 44px;
    height: 1px;
    margin: 1.25rem auto 0;
    background: var(--m-orange, #A9834B);
  }
  .uprof-sub {
    margin: 1rem 0 0;
    font-size: 0.98rem;
    color: var(--m-slate, #4F535B);
  }

  /* ── COMING UP vs PAST ──────────────────────────────────────────────────
     His complaint was that an invitation and a memory were drawn identically,
     so the DIFFERENCE lives here, at section level, rather than in a second
     copy of the card. Coming up keeps full weight and leads. Past is smaller,
     quieter and set back — still legible, never greyed into unreadability:
     the title keeps its ink colour and only the surrounding weight changes,
     because a memory should be calm, not hard to read. */
  .uprof-more { margin-top: 0.9rem; }
  .uprof-more-btn {
    display: inline-flex;
    align-items: center;
    cursor: pointer;
    list-style: none;
    font-size: 0.82rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--m-slate-2, #6A6E76);
    padding: 0.55rem 1rem;
    border: 1px solid var(--m-line, #E1DCD1);
    border-radius: var(--m-r-full, 999px);
  }
  .uprof-more-btn::-webkit-details-marker { display: none; }
  .uprof-more-btn:hover { color: var(--m-ink, #2C2A29); border-color: var(--m-orange, #A9834B); }
  .uprof-more[open] .uprof-more-btn { margin-bottom: 1.1rem; }
  .uprof-more-grid { margin-top: 0; }

  .uprof-section { margin-bottom: clamp(1.75rem, 4vw, 2.75rem); }
  .uprof-section-head {
    font-family: var(--font-display), Georgia, serif;
    font-size: 0.82rem;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--m-slate-2, #6A6E76);
    margin: 0 0 0.85rem;
  }
  .uprof-past .uprof-section-head { color: var(--m-slate-3, #8A857B); }
  .uprof-past .uprof-card { padding: 0.85rem 1rem; }
  .uprof-past .uprof-title { font-size: 1.05rem; }
  .uprof-past .uprof-mark { transform: scale(0.82); transform-origin: left center; }
  .uprof-past .uprof-cover { width: 56px; height: 56px; }

  .uprof-grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.9rem;
  }
  @media (min-width: 640px) {
    .uprof-grid { grid-template-columns: 1fr 1fr; gap: 1.1rem; }
  }

  .uprof-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    height: 100%;
    padding: 1.1rem 1.2rem;
    background: #fff;
    border: 1px solid var(--m-line, #E2DED4);
    border-radius: var(--m-r-lg, 22px);
    box-shadow: var(--m-shadow-sm, 0 1px 2px rgba(30,26,18,.05));
    text-decoration: none;
    color: inherit;
    transition: transform .18s cubic-bezier(.2,.7,.2,1), border-color .18s, box-shadow .18s;
  }
  .uprof-card:hover {
    transform: translateY(-2px);
    border-color: var(--m-orange, #A9834B);
    box-shadow: 0 10px 30px -12px rgba(30,26,18,.18);
  }

  .uprof-cover {
    flex: 0 0 auto;
    width: 68px;
    height: 68px;
    border-radius: var(--m-r-md, 14px);
    overflow: hidden;
    background: var(--m-ivory, #EDEAE0);
  }
  .uprof-cover-img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .uprof-mark { flex: 0 0 auto; display: inline-flex; }

  .uprof-body { display: flex; flex-direction: column; gap: 0.2rem; min-width: 0; flex: 1 1 auto; }
  .uprof-title {
    font-size: 1.3rem;
    line-height: 1.15;
    color: var(--m-ink, #1B1A17);
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .uprof-meta {
    font-size: 0.85rem;
    color: var(--m-slate-2, #6A6E76);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .uprof-empty {
    text-align: center;
    border: 1px dashed var(--m-line, #E2DED4);
    border-radius: var(--m-r-lg, 22px);
    padding: 2.75rem 1.5rem;
    background: #fff;
  }
  .uprof-empty-title { margin: 0; font-size: 1.05rem; font-weight: 600; color: var(--m-ink, #1B1A17); }
  .uprof-empty-sub { margin: 0.5rem 0 0; font-size: 0.9rem; color: var(--m-slate-2, #6A6E76); }

  /* ── WHO WAS THERE ────────────────────────────────────────────────────
     The warm band, and the one thing measured nowhere else in the category:
     every competitor's couple page names exactly two people. Clay ground so the
     page is not one long stretch of cream — the research bride read the
     all-cream draft as a memorial page. */
  .uprof-who {
    background: #A8421C; color: #FCEFE3;
    margin: clamp(1.6rem, 5vw, 2.4rem) 0 0;
    padding: 1.05rem clamp(1rem, 4vw, 1.6rem) 1.15rem;
    border-radius: var(--m-r-md);
  }
  .uprof-who-h {
    margin: 0 0 0.75rem; font-size: 0.66rem; font-weight: 600;
    letter-spacing: 0.2em; text-transform: uppercase; opacity: 0.92;
  }
  .uprof-who-l {
    list-style: none; margin: 0; padding: 0;
    display: flex; flex-wrap: wrap; gap: 0.5rem 1.6rem;
  }
  .uprof-who-i { min-width: 0; }
  .uprof-who-n {
    display: block; font-family: var(--font-editorial-display), Georgia, serif;
    font-size: 1.02rem; line-height: 1.2;
  }
  .uprof-who-r {
    display: block; font-size: 0.62rem; letter-spacing: 0.14em;
    text-transform: uppercase; opacity: 0.7; margin-top: 0.1rem;
  }

  /* ── THE CHRONICLE, AT THREE SIZES ────────────────────────────────────
     Scale carries meaning: the chapter with a photograph AND writing takes the
     width, the one with either takes a strip, the one with neither takes a
     line. Derived in lib/chapter-weight.ts, never art-directed — the two
     publications measured with the least per-item authoring both abandoned
     variation entirely rather than decide it by hand.
     Measured against the field: Zola ships 1,618 designs and two layouts;
     Appy Couple's "Stories" is six identical polaroids. Nobody varies. */
  .uprof-yr { max-width: 660px; margin: 0 auto; }
  .uprof-yr-mark {
    display: flex; align-items: center; gap: 12px;
    margin: clamp(1.9rem, 5vw, 2.6rem) 0 1.05rem;
  }
  .uprof-yr-n {
    font-family: var(--font-sans, system-ui), sans-serif;
    font-size: 0.82rem; font-weight: 700; letter-spacing: 0.17em;
    text-transform: uppercase; color: #C24E25;
  }
  .uprof-yr-rule { height: 2px; border-radius: var(--m-r-xs); flex: 1; background: var(--m-line, #E2DED4); }
  .uprof-yr-c {
    font-size: 0.68rem; letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--m-slate-2, #6A6E76);
  }
  .uprof-list { list-style: none; margin: 0; padding: 0; }


  /* THE LEAD */

  /* MEDIUM */

  /* A LINE */

  /* ⛔ THE OLD SPINE IS RETIRED. It gave every chapter the same dot, the same
     card and the same width — the listing shape the owner rejected. Its rules
     are deleted rather than left to rot, so nothing can quietly fall back to
     them. */

  /* CP-3 chapter timeline — a spine of dated cards (not a feed). */
  .uprof-tl { margin-top: clamp(2.5rem, 6vw, 3.75rem); }
  /* THE YEAR — the season heading. It sits ON the spine, so a reader scrolling
     back through a life passes a year the way they pass a chapter break in a
     book. Deliberately quiet: it is furniture, not a title. */
  /* E5 — padding + gap moved to the card body so the latest chapter's
     poster can run full-bleed to the card's rounded edge. EVERY card now wraps
     its text in the body span (poster or not), so the two must never be edited
     apart. overflow:hidden is what clips the poster to the radius. */
  /* Scrim pill. Cream on rgba(44,42,41,.75) composited over the WORST case (a
     pure-white thumbnail) measures 6.20:1 — clears AA with room. */

  .uprof-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 1rem 1.4rem;
    margin-top: clamp(2rem, 5vw, 3rem);
  }
  .uprof-action-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: 1px solid var(--m-line, #E2DED4);
    border-radius: var(--m-r-full, 999px);
    background: #fff;
    color: var(--m-ink, #1B1A17);
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    box-shadow: var(--m-shadow-sm, 0 1px 2px rgba(30,26,18,.05));
    transition: border-color .15s, transform .15s cubic-bezier(.2,.7,.2,1);
  }
  .uprof-action-btn:hover {
    border-color: var(--m-orange, #A9834B);
    transform: translateY(-1px);
  }

  .uprof-foot { margin-top: clamp(2.5rem, 7vw, 4rem); text-align: center; }
  .uprof-foot-link {
    font-size: 0.8rem;
    letter-spacing: 0.04em;
    color: var(--m-slate-2, #6A6E76);
    text-decoration: none;
    border-bottom: 1px solid transparent;
    transition: color .15s, border-color .15s;
  }
  .uprof-foot-link:hover { color: var(--m-ink, #1B1A17); border-color: var(--m-orange, #A9834B); }
`;
