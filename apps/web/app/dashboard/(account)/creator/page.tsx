import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowLeft,
  Clapperboard,
  Globe,
  Handshake,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import {
  CHAPTER_KINDS,
  CHAPTER_KIND_LABEL,
  EMBED_PROVIDER_LABEL,
  type ChapterKind,
  type ChapterStatus,
  type EmbedProvider,
} from '@/lib/creator-chapters';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { fetchCreatorInbox, type CreatorInboxOffer } from '@/lib/creator-offers';
import { SubmitButton } from '@/app/_components/submit-button';
import { FormFlash } from '@/app/_components/forms/form-flash';
import { ChapterEmbedFrame } from './_components/chapter-embed-frame';
import { TeaserGenerator } from './_components/teaser-generator';
import {
  createChapter,
  deleteChapter,
  publishChapter,
  unpublishChapter,
  updateChapter,
} from './actions';
import {
  acceptCreatorOffer,
  declineCreatorOffer,
  linkCreatorOfferDeliverable,
} from './offer-actions';

export const metadata = { title: 'Your chapters' };

type ChapterRow = {
  chapter_id: string;
  public_id: string;
  title: string;
  kind: ChapterKind;
  embed_url: string | null;
  embed_provider: EmbedProvider | null;
  substrate: Record<string, unknown> | null;
  teaser_r2_key: string | null;
  status: ChapterStatus;
  published_at: string | null;
  updated_at: string;
};

const FLASH: Record<string, string> = {
  created: 'Chapter created.',
  saved: 'Chapter saved.',
  published: 'Chapter published.',
  unpublished: 'Chapter moved back to draft.',
  deleted: 'Chapter deleted.',
  accepted: 'Offer accepted — the vendor was notified.',
  declined: 'Offer declined.',
  linked: 'Chapter linked as the deliverable.',
};

type Props = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function CreatorChaptersPage({ searchParams }: Props) {
  const search = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('display_name, slug, public_profile_enabled')
    .eq('user_id', user.id)
    .maybeSingle();

  const successKey = Object.keys(FLASH).find((k) => search[k]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <Link href="/dashboard" className="sn-chip sn-press mb-4 w-fit">
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        Back to home
      </Link>

      <header className="mb-6 space-y-2">
        <p className="sn-eye">
          <Clapperboard aria-hidden strokeWidth={1.75} />
          Your story
        </p>
        <h1 className="sn-h1">Your Chapters</h1>
        <p className="text-base text-ink/65">
          A chapter embeds your finished edit — hosted on your own platform
          (YouTube, Instagram, or TikTok) — and wraps it with the raw substrate
          only Setnayan has: your Papic gallery, the itinerary, the vendors.
          Publish one and your public profile becomes a timeline of chapters, not
          a feed. Anyone can tell their story here — there&rsquo;s nothing to buy.
        </p>
      </header>

      {search.error ? (
        <FormFlash tone="error">{decodeURIComponent(search.error)}</FormFlash>
      ) : null}
      {successKey ? <FormFlash tone="success">{FLASH[successKey]}</FormFlash> : null}

      <CreatorBody
        supabase={supabase}
        userId={user.id}
        slug={profile?.slug ?? null}
        publicProfileEnabled={profile?.public_profile_enabled !== false}
      />
    </div>
  );
}

async function CreatorBody({
  supabase,
  userId,
  slug,
  publicProfileEnabled,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  slug: string | null;
  publicProfileEnabled: boolean;
}) {
  const [{ data }, inbox] = await Promise.all([
    supabase
      .from('creator_chapters')
      .select(
        'chapter_id, public_id, title, kind, embed_url, embed_provider, substrate, teaser_r2_key, status, published_at, updated_at',
      )
      .eq('user_id', userId)
      .order('updated_at', { ascending: false }),
    fetchCreatorInbox(supabase, userId),
  ]);
  const chapters = (data ?? []) as ChapterRow[];
  const publishedChapters = chapters.filter((c) => c.status === 'published');

  // Presign any already-rendered teaser so the card can preview/download it.
  const teaserUrls = new Map<string, string | null>();
  await Promise.all(
    chapters
      .filter((c) => c.teaser_r2_key)
      .map(async (c) => {
        try {
          teaserUrls.set(c.chapter_id, await displayUrlForStoredAsset(c.teaser_r2_key as string));
        } catch {
          teaserUrls.set(c.chapter_id, null);
        }
      }),
  );

  return (
    <>
      <OfferInbox offers={inbox} publishedChapters={publishedChapters} />

      <section className="sn-tile mb-8 space-y-4">
        <h2 className="sn-sec">New chapter</h2>
        <form action={createChapter} className="space-y-4">
          <ChapterFields />
          <SubmitButton
            className="button-primary inline-flex items-center justify-center gap-2"
            pendingLabel="Creating…"
          >
            <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
            Create chapter
          </SubmitButton>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="sn-sec">Your chapters ({chapters.length})</h2>
        {chapters.length === 0 ? (
          <div className="sn-tile border-dashed p-8 text-center">
            <Clapperboard
              aria-hidden
              className="mx-auto mb-2 h-6 w-6 text-ink/30"
              strokeWidth={1.5}
            />
            <p className="text-sm text-ink/55">
              No chapters yet. Create one above, paste your finished edit, then
              publish.
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {chapters.map((c) => (
              <li key={c.chapter_id}>
                <ChapterCard
                  chapter={c}
                  slug={slug}
                  publicProfileEnabled={publicProfileEnabled}
                  teaserUrl={teaserUrls.get(c.chapter_id) ?? null}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------
// Discount-offer inbox — vendors offering a discount for a credited feature.
// Accept/decline consume the vendor's held reach token; on accept the creator
// may credit the vendor in a published chapter (the deliverable). Setnayan only
// records the collab — the discount settles off-platform.
// ---------------------------------------------------------------------------
const OFFER_STATUS_STYLE: Record<CreatorInboxOffer['status'], string> = {
  pending: 'bg-amber-100 text-amber-900',
  accepted: 'bg-success-100 text-success-800',
  declined: 'bg-ink/[0.06] text-ink/60',
  expired: 'bg-ink/[0.06] text-ink/50',
};

function OfferInbox({
  offers,
  publishedChapters,
}: {
  offers: CreatorInboxOffer[];
  publishedChapters: ChapterRow[];
}) {
  if (offers.length === 0) return null;
  const pending = offers.filter((o) => o.status === 'pending');
  const resolved = offers.filter((o) => o.status !== 'pending');

  return (
    <section id="offers" className="mb-8 space-y-4">
      <div className="space-y-1">
        <p className="sn-eye">
          <Handshake aria-hidden strokeWidth={1.75} />
          Partnerships
        </p>
        <h2 className="sn-sec">Discount offers ({pending.length} to review)</h2>
        <p className="text-sm text-ink/60">
          A vendor is offering you a discount for a credited feature in one of
          your chapters. Setnayan never touches the money — any discount settles
          directly between you and the vendor.
        </p>
      </div>

      <ul className="space-y-3">
        {pending.map((o) => (
          <li key={o.offerId} className="sn-tile space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-semibold text-ink">
                  {o.vendorSlug ? (
                    <Link href={`/v/${o.vendorSlug}`} className="hover:underline">
                      {o.vendorName}
                    </Link>
                  ) : (
                    o.vendorName
                  )}
                </p>
                <p className="text-[13px] text-ink/75">
                  <span className="font-medium text-ink">Your rate:</span>{' '}
                  {o.creatorRateTerms}
                </p>
                {o.audienceRateTerms ? (
                  <p className="text-[13px] text-ink/60">
                    <span className="font-medium text-ink/80">Your viewers:</span>{' '}
                    {o.audienceRateTerms}
                  </p>
                ) : null}
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.1em] ${OFFER_STATUS_STYLE[o.status]}`}
              >
                Pending
              </span>
            </div>

            <div className="flex flex-wrap items-end gap-2 border-t border-ink/10 pt-3">
              <form action={acceptCreatorOffer} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="offer_id" value={o.offerId} />
                {publishedChapters.length > 0 ? (
                  <label className="space-y-1">
                    <span className="block text-[11px] font-medium text-ink/80">
                      Credit in chapter (optional)
                    </span>
                    <select
                      name="deliverable_chapter_id"
                      defaultValue=""
                      className="input-field max-w-[15rem]"
                    >
                      <option value="">Link later</option>
                      {publishedChapters.map((c) => (
                        <option key={c.chapter_id} value={c.chapter_id}>
                          {c.title}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <SubmitButton
                  className="button-primary inline-flex items-center gap-1"
                  pendingLabel="Accepting…"
                >
                  <Sparkles aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Accept
                </SubmitButton>
              </form>
              <form action={declineCreatorOffer}>
                <input type="hidden" name="offer_id" value={o.offerId} />
                <SubmitButton
                  className="inline-flex items-center gap-1 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10"
                  pendingLabel="Declining…"
                >
                  Decline
                </SubmitButton>
              </form>
            </div>
          </li>
        ))}
      </ul>

      {resolved.length > 0 ? (
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-ink/70 hover:text-ink">
            Past offers ({resolved.length})
          </summary>
          <ul className="mt-3 space-y-2">
            {resolved.map((o) => {
              const canLink =
                o.status === 'accepted' &&
                !o.deliverableChapterId &&
                publishedChapters.length > 0;
              return (
                <li key={o.offerId} className="sn-row space-y-2 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[13px] font-medium text-ink">
                      {o.vendorName}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] ${OFFER_STATUS_STYLE[o.status]}`}
                    >
                      {o.status}
                    </span>
                  </div>
                  {canLink ? (
                    <form
                      action={linkCreatorOfferDeliverable}
                      className="flex flex-wrap items-end gap-2"
                    >
                      <input type="hidden" name="offer_id" value={o.offerId} />
                      <select
                        name="deliverable_chapter_id"
                        defaultValue=""
                        required
                        className="input-field max-w-[15rem]"
                      >
                        <option value="" disabled>
                          Credit this vendor in…
                        </option>
                        {publishedChapters.map((c) => (
                          <option key={c.chapter_id} value={c.chapter_id}>
                            {c.title}
                          </option>
                        ))}
                      </select>
                      <SubmitButton
                        className="button-secondary inline-flex items-center gap-1 text-xs"
                        pendingLabel="Linking…"
                      >
                        Link chapter
                      </SubmitButton>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function ChapterCard({
  chapter: c,
  slug,
  publicProfileEnabled,
  teaserUrl,
}: {
  chapter: ChapterRow;
  slug: string | null;
  publicProfileEnabled: boolean;
  teaserUrl: string | null;
}) {
  const substrate = (c.substrate ?? {}) as {
    papic_gallery_id?: string;
    itinerary?: string;
    vendor_ids?: string[];
  };
  const published = c.status === 'published';

  return (
    <div className="sn-tile space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-base font-semibold text-ink">{c.title}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-ink/[0.06] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink/65">
              {CHAPTER_KIND_LABEL[c.kind]}
            </span>
            {c.embed_provider ? (
              <span className="rounded-full bg-ink/[0.06] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink/65">
                {EMBED_PROVIDER_LABEL[c.embed_provider]}
              </span>
            ) : null}
            <span
              className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${
                published
                  ? 'bg-success-100 text-success-800'
                  : 'bg-ink/[0.06] text-ink/60'
              }`}
            >
              {published ? 'Published' : 'Draft'}
            </span>
          </div>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/40">
          {c.public_id}
        </span>
      </div>

      {c.embed_url ? (
        <div className="space-y-1">
          <p className="sn-eye text-ink/50">Preview</p>
          <ChapterEmbedFrame src={c.embed_url} title={c.title} />
        </div>
      ) : (
        <p className="rounded-tile border border-dashed border-ink/15 p-3 text-xs text-ink/55">
          No embed yet — paste your finished edit below, then publish.
        </p>
      )}

      {published && slug ? (
        /* Truthful build state (readiness verdict 2026-07-16 · B5): the public
           chapter timeline renders on /u TODAY — the old "ships in a later
           update" line was a reverse fake door telling creators publishing was
           inert. Link the live page. */
        <p className="text-xs text-ink/55">
          <Globe aria-hidden className="mr-1 inline h-3 w-3" strokeWidth={1.75} />
          Live on your public page —{' '}
          <Link
            href={`/u/${slug}`}
            className="font-mono text-ink/70 underline decoration-ink/25 underline-offset-2 hover:text-ink"
          >
            /u/{slug}
          </Link>
          {publicProfileEnabled
            ? ''
            : ' (your public profile is currently hidden, so only you can see it)'}
          .
        </p>
      ) : null}

      <TeaserGenerator chapterId={c.chapter_id} existingTeaserUrl={teaserUrl} />

      {/* Edit */}
      <details className="group">
        <summary className="cursor-pointer text-sm font-medium text-ink/70 hover:text-ink">
          Edit chapter
        </summary>
        <form action={updateChapter} className="mt-3 space-y-4">
          <input type="hidden" name="chapter_id" value={c.chapter_id} />
          <ChapterFields chapter={c} substrate={substrate} />
          <SubmitButton
            className="button-primary inline-flex items-center justify-center gap-2"
            pendingLabel="Saving…"
          >
            Save changes
          </SubmitButton>
        </form>
      </details>

      <div className="flex flex-wrap items-center gap-2 border-t border-ink/10 pt-3">
        {published ? (
          <form action={unpublishChapter}>
            <input type="hidden" name="chapter_id" value={c.chapter_id} />
            <SubmitButton
              className="inline-flex items-center gap-1 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10"
              pendingLabel="Unpublishing…"
            >
              Move to draft
            </SubmitButton>
          </form>
        ) : (
          <>
            <form action={publishChapter}>
              <input type="hidden" name="chapter_id" value={c.chapter_id} />
              <SubmitButton
                className="button-primary inline-flex items-center gap-1"
                pendingLabel="Publishing…"
              >
                <Sparkles aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                Publish
              </SubmitButton>
            </form>
            {/* Publish-time expectation (readiness verdict 2026-07-16 · B5):
                say what publish DOES — live public page + possible Real
                Stories featuring — so nobody is surprised either way. */}
            <span className="min-w-0 max-w-xs text-[11px] leading-snug text-ink/50">
              Published chapters are visible on your public page right away;
              Setnayan may feature standout chapters on Real Stories.
            </span>
          </>
        )}
        <form action={deleteChapter} className="ml-auto">
          <input type="hidden" name="chapter_id" value={c.chapter_id} />
          <SubmitButton
            className="inline-flex items-center gap-1 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-danger-100 hover:text-danger-700"
            pendingLabel="Deleting…"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            Delete
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}

function ChapterFields({
  chapter,
  substrate,
}: {
  chapter?: ChapterRow;
  substrate?: { papic_gallery_id?: string; itinerary?: string; vendor_ids?: string[] };
}) {
  return (
    <>
      <label className="block space-y-1">
        <span className="block text-xs font-medium text-ink">Title</span>
        <input
          name="title"
          required
          maxLength={160}
          defaultValue={chapter?.title ?? ''}
          placeholder="e.g. Ana &amp; Marco — Batanes elopement"
          className="input-field"
        />
      </label>

      <label className="block space-y-1">
        <span className="block text-xs font-medium text-ink">Type</span>
        <select name="kind" defaultValue={chapter?.kind ?? 'wedding'} className="input-field">
          {CHAPTER_KINDS.map((k) => (
            <option key={k} value={k}>
              {CHAPTER_KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="block text-xs font-medium text-ink">
          Embed link (YouTube · Instagram · TikTok)
        </span>
        <input
          name="embed_url"
          maxLength={2000}
          defaultValue={chapter?.embed_url ?? ''}
          placeholder="https://youtu.be/…  ·  instagram.com/reel/…  ·  tiktok.com/@you/video/…"
          className="input-field"
        />
        <span className="block text-[11px] text-ink/55">
          We store a privacy-enhanced embed link only (youtube-nocookie, etc.).
          Setnayan never hosts your full edit — it stays on your platform.
        </span>
      </label>

      <fieldset className="space-y-3 rounded-tile border border-ink/10 p-3">
        <legend className="px-1 text-xs font-medium text-ink">Substrate (the moat)</legend>
        <label className="block space-y-1">
          <span className="block text-xs font-medium text-ink/80">Papic gallery id</span>
          <input
            name="papic_gallery_id"
            maxLength={200}
            defaultValue={substrate?.papic_gallery_id ?? ''}
            placeholder="optional — the event id whose Papic gallery seeds the teaser"
            className="input-field"
          />
          <span className="block text-[11px] text-ink/55">
            Set this to power the owned-music teaser — it’s built from this
            gallery’s photos. Only galleries you have access to can be used.
          </span>
        </label>
        <label className="block space-y-1">
          <span className="block text-xs font-medium text-ink/80">Itinerary</span>
          <textarea
            name="itinerary"
            maxLength={4000}
            rows={3}
            defaultValue={substrate?.itinerary ?? ''}
            placeholder="optional — the day-by-day / run-of-show behind the edit"
            className="input-field"
          />
        </label>
        <label className="block space-y-1">
          <span className="block text-xs font-medium text-ink/80">Vendor ids</span>
          <input
            name="vendor_ids"
            defaultValue={(substrate?.vendor_ids ?? []).join(', ')}
            placeholder="optional — comma-separated; shown as vendor cards on your published chapter"
            className="input-field"
          />
        </label>
      </fieldset>
    </>
  );
}
