import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { resolvePublicProfile } from '@/lib/public-profile';
import {
  fetchPublishedChapterByPublicId,
  resolveShoppableVendors,
  type ShoppableVendor,
} from '@/lib/creator-public';
import { CHAPTER_KIND_LABEL, EMBED_PROVIDER_LABEL } from '@/lib/creator-chapters';
import { formatAudienceCount } from '@/lib/creator-audience';
import { CreatorBadge } from '@/app/_components/creator-badge';
import { ViewBeacon } from '@/app/u/_components/view-beacon';
import { ChapterEmbedFrame } from '@/app/dashboard/(account)/creator/_components/chapter-embed-frame';
import { ShareButtons } from '@/app/realstories/_components/share-buttons';
import { ReportPageButton } from '@/app/_components/report-page-button';
import { fetchAudienceRatesForCreatorVendors } from '@/lib/inquiry-attribution';

// Creator "Adventure Chapter" — PUBLIC chapter detail (CP-3 / CP-4).
//
//   setnayan.com/u/[user-slug]/c/[chapter-public-id]
//
// A NON-colliding sibling of the /u/[userSlug] profile: the `c` segment is a
// single static char, and real slugs are ≥3 chars (^[a-z0-9-]{3,32}$), so it can
// never shadow (or be shadowed by) an event slug. The chapter is addressed by
// its human-facing public_id (S89C-…), never an enumerable integer.
//
// Renders (locked model, do NOT re-litigate):
//   • the EMBEDDED finished edit via the sandboxed, allowlisted ChapterEmbedFrame
//     — Setnayan NEVER hosts the creator's full video;
//   • the chapter title + kind + published date + the creator badge;
//   • the SHOPPABLE substrate (CP-4) — itinerary, an optional Papic-gallery note,
//     and vendor cards that link to the vendor's existing public page /v/[slug]
//     (0% commission leads; read-only surfacing, no new inquiry flow here).
//
// Gate (user-native since 2026-07-16): the owner's public profile must be
// enabled AND the chapter must be published — a published chapter on a public
// profile IS a creator surface (no is_creator flag). Reads run through the
// service-role admin client (lib/creator-public) and filter in app code — the
// same public-read pattern the /u profile uses; the chapter RLS is
// defense-in-depth. Draft/hidden preview is done from the creator dashboard, not
// this public page.

export const revalidate = 60;

type Props = { params: Promise<{ userSlug: string; chapterId: string }> };

const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com'
).replace(/\/$/, '');

async function resolve(userSlug: string, chapterId: string) {
  const profile = await resolvePublicProfile(userSlug);
  if (!profile) return null;
  const { user } = profile;
  // User-native: any public profile can carry chapters. Gate on the profile
  // being public; the published-chapter check below is the "is a creator" test.
  if (user.public_profile_enabled !== true) return null;

  const chapter = await fetchPublishedChapterByPublicId(user.user_id, chapterId);
  if (!chapter) return null;
  return { user, chapter };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { userSlug, chapterId } = await params;
  const resolved = await resolve(userSlug, chapterId);
  if (!resolved) {
    return { title: 'Setnayan', robots: { index: false, follow: false } };
  }
  const name = resolved.user.display_name?.trim() || 'Setnayan';
  const title = `${resolved.chapter.title} · ${name}`;
  // A chapter is a shareable surface, but the individual event/vendor pages carry
  // the real SEO — keep it out of the index, allow follow so the embed/vendor
  // links are crawled. OG uses the account's personalized card (item #7c).
  const canonicalSlug = resolved.user.slug ?? userSlug;
  return {
    title,
    robots: { index: false, follow: true },
    openGraph: {
      type: 'article',
      title,
      siteName: 'Setnayan',
      locale: 'en_PH',
      images: [
        {
          url: `${SITE_URL}/api/og/u/${canonicalSlug}`,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: { card: 'summary_large_image' as const },
  };
}

export default async function ChapterDetailPage({ params }: Props) {
  const { userSlug, chapterId } = await params;
  const resolved = await resolve(userSlug, chapterId);
  if (!resolved) notFound();

  const { user, chapter } = resolved;
  const canonicalSlug = user.slug ?? userSlug;
  const creatorName = user.display_name?.trim() || 'A Setnayan creator';
  const date = chapter.published_at
    ? new Date(chapter.published_at).toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  const { itinerary, papic_gallery_id, vendor_ids } = chapter.substrate;
  const vendors: ShoppableVendor[] = await resolveShoppableVendors(vendor_ids);
  const hasSubstrate =
    !!itinerary || !!papic_gallery_id || vendors.length > 0;

  // Creator Economy PR-C — the viewer promo. For each shoppable vendor with an
  // ACCEPTED collab (this chapter's creator ↔ that vendor) carrying an audience
  // rate, surface "Viewer promo: {terms}" + the ratified disclosure at the Book
  // CTA. WHITELIST: only audience_rate_terms is read — creator_rate_terms never
  // renders publicly (owner paper-lock 2026-07-16).
  const audienceRates =
    vendors.length > 0
      ? await fetchAudienceRatesForCreatorVendors(
          user.user_id,
          vendors.map((v) => v.vendorProfileId),
        )
      : new Map<string, string>();

  return (
    <main className="uchap">
      <style>{UCHAP_CSS}</style>

      {/* Audience view beacon — counts one public chapter view out of band,
          keeping this page ISR-cacheable. The RPC self-gates to published +
          public, and a first-party cookie dedups refresh-spam. */}
      <ViewBeacon kind="chapter" id={chapter.public_id} />

      <article className="uchap-inner">
        <div className="uchap-top">
          <Link href={`/u/${canonicalSlug}`} className="uchap-back">
            <span aria-hidden>&lsaquo;</span> {creatorName}
          </Link>
          <CreatorBadge size="sm" />
        </div>

        <header className="uchap-head">
          <div className="uchap-kicker">
            <span className="uchap-kind">{CHAPTER_KIND_LABEL[chapter.kind]}</span>
            {chapter.embed_provider ? (
              <span className="uchap-provider">
                {EMBED_PROVIDER_LABEL[chapter.embed_provider]}
              </span>
            ) : null}
            {date ? <span className="uchap-date">{date}</span> : null}
            <span className="uchap-views">
              {formatAudienceCount(chapter.view_count)}{' '}
              {chapter.view_count === 1 ? 'view' : 'views'}
            </span>
          </div>
          <h1 className="m-serif uchap-title">{chapter.title}</h1>
        </header>

        {chapter.embed_url ? (
          <div className="uchap-embed">
            <ChapterEmbedFrame src={chapter.embed_url} title={chapter.title} />
          </div>
        ) : null}

        {hasSubstrate ? (
          <section className="uchap-sub" aria-label="Behind the chapter">
            <h2 className="m-serif uchap-sub-head">Behind the chapter</h2>

            {itinerary ? (
              <div className="uchap-block">
                <p className="uchap-block-label">Itinerary</p>
                <p className="uchap-itinerary">{itinerary}</p>
              </div>
            ) : null}

            {papic_gallery_id ? (
              <div className="uchap-block">
                <p className="uchap-block-label">Gallery</p>
                <p className="uchap-note">
                  A Papic gallery of candid photos + clips sits behind this
                  chapter.
                </p>
              </div>
            ) : null}

            {vendors.length > 0 ? (
              <div className="uchap-block">
                <p className="uchap-block-label">Vendors — shoppable</p>
                <ul className="uchap-vendors">
                  {vendors.map((v) => {
                    // Viewer promo (PR-C) — the vendor's audience rate from
                    // the ACCEPTED collab with this chapter's creator.
                    // audience_rate_terms ONLY; never the creator rate.
                    const promo = audienceRates.get(v.vendorProfileId) ?? null;
                    return (
                      <li key={v.slug} className="uchap-vendor-cell">
                        <Link href={`/v/${v.slug}`} className="uchap-vendor">
                          {v.logoUrl ? (
                            <span className="uchap-vendor-logo">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={v.logoUrl}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                className="uchap-vendor-logo-img"
                              />
                            </span>
                          ) : (
                            <span className="uchap-vendor-logo uchap-vendor-logo--empty" aria-hidden>
                              {v.name.charAt(0)}
                            </span>
                          )}
                          <span className="uchap-vendor-body">
                            <span className="uchap-vendor-name">{v.name}</span>
                            {v.city ? (
                              <span className="uchap-vendor-city">{v.city}</span>
                            ) : null}
                          </span>
                          <span aria-hidden className="uchap-vendor-chev">
                            &rsaquo;
                          </span>
                        </Link>
                        {/* Book CTA — the CTA-click attribution doorway. The
                            ref_chapter param rides to /v/[slug], threads into
                            the existing inquiry composer, and is validated
                            server-side before 'influencer' is stamped. Sibling
                            link, never nested in the card anchor. */}
                        <div className="uchap-vendor-book">
                          {promo ? (
                            <p className="uchap-vendor-promo">
                              Viewer promo: {promo}
                            </p>
                          ) : null}
                          <Link
                            href={`/v/${v.slug}?ref_chapter=${chapter.public_id}`}
                            className="uchap-vendor-book-cta"
                          >
                            Book through this chapter
                          </Link>
                          {promo ? (
                            // Ratified viewer disclosure (simplest-approach
                            // verdict §6 — exact copy; RA-10173 must-plan).
                            <p className="uchap-vendor-disclosure">
                              This storyteller partnered with {v.name}. Book
                              through this chapter and {v.name} honors the promo
                              shown — the discount is offered and settled by the
                              vendor directly.
                            </p>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </section>
        ) : null}

        {/* Share doorway + report path (Storytellers council verdict
            2026-07-16, Phase S0 safety floor). This whole page is the PUBLIC
            branch — resolve() notFound()s anything unpublished or on a
            non-public profile — so these never render on a private surface.
            Kept as quiet chrome below the substrate, out of the chapter's own
            aesthetic. */}
        <div className="uchap-actions">
          <ShareButtons
            url={`${SITE_URL}/u/${canonicalSlug}/c/${chapter.public_id}`}
            title={`${chapter.title} · ${creatorName}`}
            image={`${SITE_URL}/api/og/u/${canonicalSlug}`}
          />
          <ReportPageButton
            targetType="chapter"
            targetId={chapter.public_id}
            className="inline-flex"
          />
        </div>

        <footer className="uchap-foot">
          <a href="https://www.setnayan.com" className="uchap-foot-link">
            Made with Setnayan
          </a>
        </footer>
      </article>
    </main>
  );
}

const UCHAP_CSS = `
  .uchap {
    min-height: 100dvh;
    background: var(--m-paper, #FBFBFA);
    color: var(--m-ink, #1B1A17);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: clamp(2rem, 6vw, 4rem) 1.5rem clamp(2.5rem, 6vw, 4rem);
  }
  .uchap-inner { width: 100%; max-width: 760px; }

  .uchap-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: clamp(1.5rem, 4vw, 2.25rem);
  }
  .uchap-back {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.9rem;
    color: var(--m-slate, #4F535B);
    text-decoration: none;
    transition: color .15s;
  }
  .uchap-back:hover { color: var(--m-ink, #1B1A17); }

  .uchap-head { margin-bottom: clamp(1.5rem, 4vw, 2.25rem); }
  .uchap-kicker {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.85rem;
    margin-bottom: 0.75rem;
  }
  .uchap-kind {
    font-family: var(--font-mono-marketing), 'JetBrains Mono', ui-monospace, monospace;
    font-size: 0.64rem;
    font-weight: 600;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--m-orange-2, #8A6B39);
  }
  .uchap-provider, .uchap-date, .uchap-views {
    font-size: 0.8rem;
    color: var(--m-slate-2, #6A6E76);
  }
  .uchap-title {
    font-size: clamp(1.9rem, 6vw, 3rem);
    line-height: 1.08;
    margin: 0;
    color: var(--m-ink, #1B1A17);
  }

  .uchap-embed {
    border-radius: var(--m-r-lg, 22px);
    overflow: hidden;
    border: 1px solid var(--m-line, #E2DED4);
    box-shadow: var(--m-shadow-sm, 0 1px 2px rgba(30,26,18,.05));
  }

  .uchap-sub { margin-top: clamp(2.25rem, 5vw, 3rem); }
  .uchap-sub-head {
    font-size: clamp(1.3rem, 4vw, 1.7rem);
    margin: 0 0 1.25rem;
    color: var(--m-ink, #1B1A17);
  }
  .uchap-block + .uchap-block { margin-top: 1.5rem; }
  .uchap-block-label {
    margin: 0 0 0.5rem;
    font-family: var(--font-mono-marketing), 'JetBrains Mono', ui-monospace, monospace;
    font-size: 0.62rem;
    font-weight: 600;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--m-slate-2, #6A6E76);
  }
  .uchap-itinerary {
    margin: 0;
    white-space: pre-wrap;
    font-size: 0.95rem;
    line-height: 1.6;
    color: var(--m-slate, #4F535B);
  }
  .uchap-note {
    margin: 0;
    font-size: 0.9rem;
    color: var(--m-slate, #4F535B);
  }

  .uchap-vendors {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.7rem;
  }
  @media (min-width: 560px) {
    .uchap-vendors { grid-template-columns: 1fr 1fr; }
  }
  .uchap-vendor {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    height: 100%;
    padding: 0.9rem 1rem;
    background: #fff;
    border: 1px solid var(--m-line, #E2DED4);
    border-radius: var(--m-r-md, 14px);
    box-shadow: var(--m-shadow-sm, 0 1px 2px rgba(30,26,18,.05));
    text-decoration: none;
    color: inherit;
    transition: transform .18s cubic-bezier(.2,.7,.2,1), border-color .18s, box-shadow .18s;
  }
  .uchap-vendor:hover {
    transform: translateY(-2px);
    border-color: var(--m-orange, #A9834B);
    box-shadow: 0 10px 30px -12px rgba(30,26,18,.18);
  }
  .uchap-vendor-logo {
    flex: 0 0 auto;
    width: 42px;
    height: 42px;
    border-radius: var(--m-r-sm, 10px);
    overflow: hidden;
    background: var(--m-ivory, #EDEAE0);
  }
  .uchap-vendor-logo-img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .uchap-vendor-logo--empty {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    color: var(--m-orange-2, #8A6B39);
    text-transform: uppercase;
  }
  .uchap-vendor-body { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; flex: 1 1 auto; }
  .uchap-vendor-name {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--m-ink, #1B1A17);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .uchap-vendor-city {
    font-size: 0.78rem;
    color: var(--m-slate-2, #6A6E76);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .uchap-vendor-cell { display: flex; flex-direction: column; gap: 0.45rem; }
  .uchap-vendor-book { display: flex; flex-direction: column; gap: 0.3rem; padding: 0 0.25rem; }
  .uchap-vendor-promo {
    margin: 0;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--m-orange-2, #8A6B39);
  }
  .uchap-vendor-book-cta {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    padding: 0.45rem 0.9rem;
    border-radius: var(--m-r-full, 999px);
    background: var(--m-ink, #1B1A17);
    color: var(--m-paper, #FBFBFA);
    font-size: 0.8rem;
    font-weight: 600;
    text-decoration: none;
    transition: opacity .15s;
  }
  .uchap-vendor-book-cta:hover { opacity: .85; }
  .uchap-vendor-disclosure {
    margin: 0;
    font-size: 0.72rem;
    line-height: 1.45;
    color: var(--m-slate-2, #6A6E76);
  }
  .uchap-vendor-chev {
    flex: 0 0 auto;
    font-size: 1.3rem;
    line-height: 1;
    color: var(--m-slate-2, #6A6E76);
    opacity: .5;
    transition: transform .18s cubic-bezier(.2,.7,.2,1), color .18s, opacity .18s;
  }
  .uchap-vendor:hover .uchap-vendor-chev {
    transform: translateX(3px);
    color: var(--m-orange, #A9834B);
    opacity: 1;
  }

  .uchap-actions {
    margin-top: clamp(2rem, 5vw, 3rem);
    padding-top: 1.25rem;
    border-top: 1px solid var(--m-line, #E2DED4);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem 1.5rem;
  }

  .uchap-foot { margin-top: clamp(2.5rem, 7vw, 4rem); text-align: center; }
  .uchap-foot-link {
    font-size: 0.8rem;
    letter-spacing: 0.04em;
    color: var(--m-slate-2, #6A6E76);
    text-decoration: none;
    border-bottom: 1px solid transparent;
    transition: color .15s, border-color .15s;
  }
  .uchap-foot-link:hover { color: var(--m-ink, #1B1A17); border-color: var(--m-orange, #A9834B); }
`;
