import Link from 'next/link';
import { logQueryError } from '@/lib/supabase/error-detect';
import { redirect } from 'next/navigation';
import { Check, Clapperboard, Globe, Handshake, Plus, Sparkles, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { loadLinkableEvents, type LinkableEvent } from '@/lib/chapter-event-participation';
import {
  canShareWithEvent,
  CHAPTER_AUDIENCE_LABEL,
  CHAPTER_AUDIENCE_NOTE,
  CHAPTER_AUDIENCES,
  chapterIsShared,
  CHAPTER_BODY_MAX,
  CHAPTER_KINDS,
  CHAPTER_KIND_LABEL,
  EMBED_PROVIDER_LABEL,
  type ChapterKind,
  type ChapterStatus,
  type EmbedProvider,
} from '@/lib/creator-chapters';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { fetchCreatorInbox, type CreatorInboxOffer } from '@/lib/creator-offers';
import { chronicleDay, groupChronicleByYear } from '@/lib/creator-chronicle';
import { SubmitButton } from '@/app/_components/submit-button';
import { FormFlash } from '@/app/_components/forms/form-flash';
import { ChapterEmbedFrame } from './_components/chapter-embed-frame';
import { TeaserGenerator } from './_components/teaser-generator';
import { PageMasthead } from '@/app/_components/page-masthead';
import { InfoTip } from '@/app/_components/info-tip';
import { Badge, type BadgeTone } from '@/app/_components/badge';
import { PostedPick } from '@/app/dashboard/[eventId]/_components/posted-pick';
import {
  createChapter,
  deleteChapter,
  setChapterAudience,
  updateChapter,
} from './actions';
import {
  acceptCreatorOffer,
  declineCreatorOffer,
  linkCreatorOfferDeliverable,
} from './offer-actions';
import { StayForm } from '@/app/_components/stay-form';

export const metadata = { title: 'Your chapters' };

type ChapterRow = {
  chapter_id: string;
  public_id: string;
  title: string;
  kind: ChapterKind;
  /** The story itself — required to publish (a video is not). */
  body: string | null;
  embed_url: string | null;
  embed_provider: EmbedProvider | null;
  substrate: Record<string, unknown> | null;
  /** The celebration this chapter is about — the column that had no writer. */
  event_id: string | null;
  /** The day the author says this happened. Beats the celebration and the
   *  publish date when deciding which year it files under. */
  happened_on: string | null;
  teaser_r2_key: string | null;
  status: ChapterStatus;
  published_at: string | null;
  updated_at: string;
};

const FLASH: Record<string, string> = {
  created: 'Chapter created.',
  saved: 'Chapter saved.',
  deleted: 'Chapter deleted.',
  accepted: 'Offer accepted — the supplier was notified.',
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

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('display_name, slug, public_profile_enabled')
    .eq('user_id', user.id)
    .maybeSingle();
  // ⚠ the creator account record. Absence DENIES rather than renders.
  if (profileError) {
    logQueryError('CreatorPage.profile', profileError, {}, 'graceful_degrade');
  }

  const successKey = Object.keys(FLASH).find((k) => search[k]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageMasthead
        title="Your Chapters"
      />

      {search.error ? (
        <FormFlash tone="error">{decodeURIComponent(search.error)}</FormFlash>
      ) : null}
      {successKey ? <FormFlash tone="success">{FLASH[successKey]}</FormFlash> : null}

      {/* 🛑 THE "ACCEPT VENDOR OFFERS" TOGGLE WAS REMOVED HERE (owner 2026-08-20:
          *"accept vendor offers will forever be on. so no need to toggle since
          all users can be deemed content creators"*).

          `users.creator_accepts_offers` is DELIBERATELY NOT DROPPED. It defaults
          TRUE, no prod row has ever been FALSE, and the vendor-browse filter
          plus the `CREATOR_OFFERS_OFF` hold in the database still honour it — so
          the mechanism survives intact for the day an opt-out is required again
          (a solicitation opt-out is the kind of thing a privacy review asks
          for). What is gone is the only writer, so the value can now only ever
          be TRUE.
          🔑 The reason removing it is safe is the DEFAULT, and that is the thing
          to check before removing any switch: had this column defaulted FALSE,
          deleting the toggle would have blocked every vendor offer in the
          product, permanently and silently. Read the default before you take
          away the handle. */}
      {/* `=== true`, not `!== false`. The column is NOT NULL DEFAULT false, so
          the only honest reading of a missing/failed profile read is "not
          public" — `!== false` turned an undefined into a claim that the page
          was live, which is the reassuring direction to be wrong in. */}
      <CreatorBody
        supabase={supabase}
        userId={user.id}
        slug={profile?.slug ?? null}
        publicProfileEnabled={profile?.public_profile_enabled === true}
        prefillEventId={typeof search.event === 'string' ? search.event : null}
      />
    </div>
  );
}

async function CreatorBody({
  supabase,
  userId,
  slug,
  publicProfileEnabled,
  prefillEventId,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  slug: string | null;
  publicProfileEnabled: boolean;
  /** `?event=` — the celebration the events board sent them here to write. */
  prefillEventId: string | null;
}) {
  const [{ data, error: chaptersError }, inbox] = await Promise.all([
    supabase
      .from('creator_chapters')
      .select(
        'chapter_id, public_id, title, kind, body, embed_url, embed_provider, substrate, event_id, happened_on, teaser_r2_key, status, published_at, updated_at',
      )
      .eq('user_id', userId)
      .order('updated_at', { ascending: false }),
    fetchCreatorInbox(supabase, userId),
  ]);
  // `?? []` cannot tell "you have written none" from "we could not read
  // them" — and one of those is a statement about somebody's own work.
  const chaptersMeasured = !chaptersError;
  const chapters = (data ?? []) as ChapterRow[];
  const publishedChapters = chapters.filter((c) => c.status === 'published');

  // The picker offers CONCLUDED celebrations only (owner 2026-08-20) — plus any
  // day a chapter is already attached to, so editing a chapter can never
  // silently detach it from a celebration whose date has since moved. That is
  // why this read waits for the chapters: it needs their days.
  const myEvents = await loadLinkableEvents(userId, {
    keepEventIds: chapters.map((c) => c.event_id),
  });
  const dayByEventId = new Map(myEvents.map((e) => [e.event_id, e.day] as const));

  // THE CHRONICLE — every chapter numbered by the day it is ABOUT, grouped by
  // year. Nobody types a number; see lib/creator-chronicle.ts for why the year
  // is a heading and not a "Volume".
  const chronicle = groupChronicleByYear(chapters, (c) =>
    chronicleDay({
      happenedOn: c.happened_on,
      eventDate: c.event_id ? dayByEventId.get(c.event_id) ?? null : null,
      publishedAt: c.published_at,
    }),
  );

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

      <section className="mb-8 space-y-4">
        <h2 className="sn-sec">New chapter</h2>
        <StayForm door="accCreator.createChapter" action={createChapter} className="space-y-4">
          <ChapterFields myEvents={myEvents} prefillEventId={prefillEventId} />
          <SubmitButton
            className="ab ab-brand ab-main inline-flex min-h-11 items-center justify-center gap-2"
            pendingLabel="Creating…"
          >
            <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
            Create chapter
          </SubmitButton>
        </StayForm>
      </section>

      <section className="space-y-4">
        {/* A count over somebody's published work. `?? []` cannot tell "you
            have written none" from "we could not read them", so the heading
            drops the number rather than reporting zero chapters to an author
            who has some. */}
        <h2 className="sn-sec">
          {chaptersMeasured ? `Your chapters (${chapters.length})` : 'Your chapters'}
        </h2>
        {chapters.length === 0 ? (
          <p className="flex items-center gap-2 py-3 text-sm text-ink/70">
            <Clapperboard aria-hidden className="h-4 w-4 flex-none" strokeWidth={1.75} />
            No chapters yet. Create one above, write your story, then publish.
          </p>
        ) : (
          <div className="space-y-8">
            {chronicle.map((block) => (
              <div key={block.year ?? 'unplaced'} className="space-y-4">
                {/* THE YEAR IS A HEADING. It is not a Volume, it is not stored,
                    and it is not typed — see lib/creator-chronicle.ts. */}
                <div className="flex items-baseline gap-3">
                  <h3 className="m-serif text-lg text-ink">
                    {block.year ?? 'Not placed yet'}
                  </h3>
                  <span className="h-px flex-1 bg-ink/10" aria-hidden />
                  {block.year ? null : (
                    <span className="text-xs text-ink/70">
                      These land in a year once you post them.
                    </span>
                  )}
                </div>
                <ul className="divide-y divide-ink/10 border-y border-ink/10">
                  {block.entries.map(({ item: c, number }) => (
                    <li key={c.chapter_id}>
                      <ChapterCard
                        chapter={c}
                        number={number}
                        slug={slug}
                        publicProfileEnabled={publicProfileEnabled}
                        teaserUrl={teaserUrls.get(c.chapter_id) ?? null}
                        myEvents={myEvents}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
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
const OFFER_STATUS_TONE: Record<CreatorInboxOffer['status'], BadgeTone> = {
  pending: 'wait',
  accepted: 'ok',
  declined: 'quiet',
  expired: 'quiet',
};
const OFFER_STATUS_WORD: Record<CreatorInboxOffer['status'], string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  declined: 'Declined',
  expired: 'Expired',
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
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-ink/70">
          <Handshake aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Partnerships
        </p>
        <InfoTip label={`Discount offers (${pending.length} to review)`} labelAs="h2" labelClassName="sn-sec" align="start">
          A supplier is offering you a discount for a credited feature in one of your chapters. Setnayan never touches the
          money — any discount settles directly between you and the supplier.
        </InfoTip>
      </div>

      <ul className="divide-y divide-ink/10 border-y border-ink/10">
        {pending.map((o) => (
          <li key={o.offerId} className="space-y-3 py-3">
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
                  <p className="text-[13px] text-ink/75">
                    <span className="font-medium text-ink">Your viewers:</span>{' '}
                    {o.audienceRateTerms}
                  </p>
                ) : null}
              </div>
              <Badge tone={OFFER_STATUS_TONE[o.status]}>Pending</Badge>
            </div>

            <div className="flex flex-wrap items-end gap-2 border-t border-ink/10 pt-3">
              <StayForm door="accCreator.acceptCreatorOffer" action={acceptCreatorOffer} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="offer_id" value={o.offerId} />
                {publishedChapters.length > 0 ? (
                  <span className="block space-y-1">
                    <span className="block text-xs font-medium text-ink">Credit in chapter (optional)</span>
                    <PostedPick
                      name="deliverable_chapter_id"
                      label="Link later"
                      initial=""
                      className="block max-w-[15rem]"
                      options={[
                        { key: '', label: 'Link later' },
                        ...publishedChapters.map((c) => ({ key: c.chapter_id, label: c.title })),
                      ]}
                    />
                  </span>
                ) : null}
                <SubmitButton
                  className="ab ab-brand ab-main inline-flex min-h-11 items-center gap-1"
                  pendingLabel="Accepting…"
                >
                  <Sparkles aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                  Accept
                </SubmitButton>
              </StayForm>
              <StayForm door="accCreator.declineCreatorOffer" action={declineCreatorOffer}>
                <input type="hidden" name="offer_id" value={o.offerId} />
                <SubmitButton
                  className="ab ab-neutral inline-flex min-h-11 items-center gap-1"
                  pendingLabel="Declining…"
                >
                  Decline
                </SubmitButton>
              </StayForm>
            </div>
          </li>
        ))}
      </ul>

      {resolved.length > 0 ? (
        <details className="group">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-ink/75 hover:text-ink">
            Past offers ({resolved.length})
          </summary>
          <ul className="mt-3 divide-y divide-ink/10 border-y border-ink/10">
            {resolved.map((o) => {
              const canLink =
                o.status === 'accepted' &&
                !o.deliverableChapterId &&
                publishedChapters.length > 0;
              return (
                <li key={o.offerId} className="min-h-14 space-y-2 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[13px] font-medium text-ink">
                      {o.vendorName}
                    </span>
                    <Badge tone={OFFER_STATUS_TONE[o.status]}>{OFFER_STATUS_WORD[o.status]}</Badge>
                  </div>
                  {canLink ? (
                    <StayForm
                      door="accCreator.linkCreatorOfferDeliverable"
                      action={linkCreatorOfferDeliverable}
                      className="flex flex-wrap items-end gap-2"
                    >
                      <input type="hidden" name="offer_id" value={o.offerId} />
                      <PostedPick
                        name="deliverable_chapter_id"
                        label="Credit this supplier in…"
                        initial=""
                        className="block w-full max-w-[15rem]"
                        options={publishedChapters.map((c) => ({ key: c.chapter_id, label: c.title }))}
                      />
                      <SubmitButton
                        className="ab ab-neutral inline-flex min-h-11 items-center gap-1"
                        pendingLabel="Linking…"
                      >
                        Link chapter
                      </SubmitButton>
                    </StayForm>
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
  number,
  slug,
  publicProfileEnabled,
  teaserUrl,
  myEvents,
}: {
  chapter: ChapterRow;
  /** Its place in the life — derived, never typed. Null until it has a day. */
  number: number | null;
  slug: string | null;
  publicProfileEnabled: boolean;
  teaserUrl: string | null;
  myEvents: LinkableEvent[];
}) {
  const substrate = (c.substrate ?? {}) as {
    papic_gallery_id?: string;
    vendor_ids?: string[];
  };
  const published = c.status === 'published';
  const shared = chapterIsShared(c.status);

  return (
    <div className="space-y-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          {/* The number is the chronicle's, not the author's: it comes from the
              day the celebration happened. A chapter with no day yet says so
              rather than borrowing a position it has not earned. */}
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-ink/70">
            {number === null ? 'Chapter — not placed yet' : `Chapter ${number}`}
          </p>
          <p className="text-base font-semibold text-ink">{c.title}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="quiet">{CHAPTER_KIND_LABEL[c.kind]}</Badge>
            {c.embed_provider ? (
              <Badge tone="quiet">{EMBED_PROVIDER_LABEL[c.embed_provider]}</Badge>
            ) : null}
            {/* The badge says WHO, not whether a switch is on. "Draft" told
                somebody sharing with one celebration that their finished piece
                was unfinished. */}
            <Badge tone={shared ? 'ok' : 'quiet'}>{CHAPTER_AUDIENCE_LABEL[c.status]}</Badge>
          </div>
        </div>
        <span className="text-xs tabular-nums text-ink/70">{c.public_id}</span>
      </div>

      {c.embed_url ? (
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-ink/70">Preview</p>
          <ChapterEmbedFrame src={c.embed_url} title={c.title} />
        </div>
      ) : (
        /* ⚠ THIS USED TO READ "No embed yet — paste your finished edit below,
           then publish", inside a dashed box, on EVERY chapter without a video
           INCLUDING published ones. It described the retired rule as a required
           step, so a finished written story permanently read as unfinished and
           blocked — the publish wall rebuilt in copy after it was removed from
           the code. A video is optional; its absence needs no warning. */
        <p className="text-xs text-ink/70">
          No video on this chapter — that’s fine, your story stands on its own. Add a link below any time.
        </p>
      )}

      {published && slug ? (
        /* Truthful build state (readiness verdict 2026-07-16 · B5): the public
           chapter timeline renders on /u TODAY — the old "ships in a later
           update" line was a reverse fake door telling creators publishing was
           inert. Link the live page. */
        <p className="text-xs text-ink/70">
          <Globe aria-hidden className="mr-1 inline h-3 w-3" strokeWidth={1.75} />
          Live on your public page —{' '}
          <Link
            href={`/u/${slug}`}
            className="text-ink underline decoration-ink/25 underline-offset-2"
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
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-ink/75 hover:text-ink">
          Edit chapter
        </summary>
        <StayForm door="accCreator.updateChapter" action={updateChapter} className="mt-3 space-y-4">
          <input type="hidden" name="chapter_id" value={c.chapter_id} />
          <ChapterFields chapter={c} substrate={substrate} myEvents={myEvents} />
          <SubmitButton
            className="ab ab-brand ab-main inline-flex min-h-11 items-center justify-center gap-2"
            pendingLabel="Saving…"
          >
            Save changes
          </SubmitButton>
        </StayForm>
      </details>

      {/* WHO READS THIS — the whole decision in one row of three (owner
          2026-08-20). It replaced a Publish button and a "Move to draft"
          button: two doors onto one question, with no way at all to say the
          third answer. The current choice is the pressed one; pressing another
          moves it. */}
      <div className="space-y-2 border-t border-ink/10 pt-3">
        <p className="text-xs font-medium text-ink">Who can read this?</p>
        <div className="flex flex-wrap items-center gap-2">
          {CHAPTER_AUDIENCES.map((choice) => {
            const current = c.status === choice;
            // The middle answer needs a celebration to share WITH. Offering it
            // on a chapter about no celebration would be a button whose only
            // outcome is a refusal.
            if (choice === 'event' && !canShareWithEvent(c.event_id)) return null;
            return (
              <StayForm door="accCreator.setChapterAudience" action={setChapterAudience} key={choice}>
                <input type="hidden" name="chapter_id" value={c.chapter_id} />
                <input type="hidden" name="audience" value={choice} />
                <SubmitButton
                  className={
                    current
                      ? 'ab ab-brand ab-main inline-flex min-h-11 items-center gap-1'
                      : 'ab ab-neutral inline-flex min-h-11 items-center gap-1'
                  }
                  pendingLabel="Saving…"
                >
                  {current ? <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> : null}
                  {CHAPTER_AUDIENCE_LABEL[choice]}
                </SubmitButton>
              </StayForm>
            );
          })}
        </div>
        <p className="text-xs leading-snug text-ink/70">
          {CHAPTER_AUDIENCE_NOTE[c.status]}
        </p>
        {/* Everything the "Everyone" answer depends on, said BEFORE it is
            pressed — a privacy-relevant change is never discovered afterwards.
            (2026-07-16 · B5, extended 2026-08-12: choosing Everyone also
            switches the public page on when it is off. That default-FALSE
            switch had never been turned on by anyone in production, so a
            published chapter used to land somewhere nobody could reach.) */}
        {c.status !== 'published' ? (
          <p className="text-xs leading-snug text-ink/70">
            {!slug ? (
              <>
                To choose Everyone, pick your web address first in{' '}
                <Link
                  href="/dashboard/profile#url-slug"
                  className="underline decoration-ink/25 underline-offset-2 hover:text-ink"
                >
                  Profile
                </Link>{' '}
                — that address is where people will read your story.
              </>
            ) : publicProfileEnabled ? (
              <>Setnayan may feature standout chapters on Stories.</>
            ) : (
              <>
                Choosing Everyone also switches on your public page at /u/{slug} so
                people can read this. Your private event details stay private.
              </>
            )}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StayForm door="accCreator.deleteChapter" action={deleteChapter} className="ml-auto">
          <input type="hidden" name="chapter_id" value={c.chapter_id} />
          <SubmitButton
            className="ab ab-danger inline-flex min-h-11 items-center gap-1"
            pendingLabel="Deleting…"
          >
            <Trash2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Delete
          </SubmitButton>
        </StayForm>
      </div>
    </div>
  );
}

/**
 * Today in Manila, as a plain `YYYY-MM-DD`.
 *
 * The date input's ceiling. Never `new Date().toISOString()` — that is today in
 * UTC, which is YESTERDAY for eight hours of every Philippine evening, so
 * somebody writing up tonight's party would find their own day greyed out.
 */
function manilaToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
}

/** A celebration this account hosts, offered in the picker. */

function ChapterFields({
  chapter,
  substrate,
  myEvents = [],
  prefillEventId = null,
}: {
  chapter?: ChapterRow;
  substrate?: { papic_gallery_id?: string; vendor_ids?: string[] };
  myEvents?: LinkableEvent[];
  /** Preselect the celebration the events board sent them here to write. */
  prefillEventId?: string | null;
}) {
  // The prefill is only honoured when it is REALLY in the list — a `?event=`
  // anybody can type must never preselect a celebration this account cannot
  // attach. (The action re-proves the tie server-side either way.)
  const prefillIsOffered =
    !!prefillEventId && myEvents.some((e) => e.event_id === prefillEventId);
  const pickedEventId =
    chapter?.event_id ??
    substrate?.papic_gallery_id ??
    (prefillIsOffered ? (prefillEventId as string) : '');
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

      <span className="block space-y-1">
        <span className="block text-xs font-medium text-ink">Type</span>
        <PostedPick
          name="kind"
          label="Type"
          initial={chapter?.kind ?? 'wedding'}
          className="block"
          options={CHAPTER_KINDS.map((k) => ({ key: k, label: CHAPTER_KIND_LABEL[k] }))}
        />
      </span>

      {/* THE STORY — the main event, and therefore the biggest field on the
          form. It used to be a 3-row box called "Itinerary" inside a fieldset
          headed "Substrate (the moat)", below the embed. A couple typing their
          wedding story was filling in travel paperwork. */}
      <label className="block space-y-1">
        <span className="block text-xs font-medium text-ink">Your story</span>
        <textarea
          name="body"
          maxLength={CHAPTER_BODY_MAX}
          rows={14}
          defaultValue={chapter?.body ?? ''}
          placeholder={
            'Tell it the way you’d tell a friend.\n\nHow the day started. What you didn’t expect. Who made it work. The bit you’ll still be telling in ten years.\n\nLeave a blank line between paragraphs.'
          }
          className="input-field"
        />
        <span className="block text-xs text-ink/70">
          This is your chapter. Needed to publish — a video is optional. Blank
          lines become paragraphs.
        </span>
      </label>

      <label className="block space-y-1">
        <span className="block text-xs font-medium text-ink">
          Video link — optional (YouTube · Instagram · TikTok)
        </span>
        <input
          name="embed_url"
          maxLength={2000}
          defaultValue={chapter?.embed_url ?? ''}
          placeholder="https://youtu.be/…  ·  instagram.com/reel/…  ·  tiktok.com/@you/video/…"
          className="input-field"
        />
        <span className="block text-xs text-ink/70">
          Leave this empty if you don’t have one — your story stands on its own.
          If you paste a link we store a privacy-enhanced embed only; Setnayan
          never hosts your video, it stays on your platform.
        </span>
      </label>

      {/* WHEN — the one question that puts a chapter in the right year.
          Rendered beside the story, not buried in the optional fieldset: a
          chronicle is ordered by when things happened, and for a chapter about
          no celebration this is the only day there is. */}
      <label className="block space-y-1">
        <span className="block text-xs font-medium text-ink">When did this happen?</span>
        <input
          type="date"
          name="happened_on"
          max={manilaToday()}
          defaultValue={chapter?.happened_on?.slice(0, 10) ?? ''}
          className="input-field"
        />
        <span className="block text-xs text-ink/70">
          This decides which year your chapter files under. Leave it blank if you
          pick an event below — we’ll use that day.
        </span>
      </label>

      <fieldset className="space-y-3 border-t border-ink/10 pt-3">
        <legend className="text-xs font-medium text-ink">
          Behind the chapter — all optional
        </legend>
        {/* 🔴 THIS REPLACED A BOX THAT ASKED FOR A RAW EVENT ID — and a second
            one beside it asking for comma-separated vendor ids. Nobody ever
            filled either: production's one published chapter carries neither,
            so "the real day underneath" was a door that opened for nobody.
            🔑 The day is asked ONCE, here. The gallery value the teaser reads
            is derived from this answer in the action — never a second box. */}
        <label className="block space-y-1">
          <span className="block text-xs font-medium text-ink">
            Which event is this about?
          </span>
          {myEvents.length > 0 ? (
            <>
              <select name="event_id" defaultValue={pickedEventId} className="input-field">
                <option value="">Not about one of my events</option>
                {myEvents.map((e) => (
                  <option key={e.event_id} value={e.event_id}>
                    {e.label}
                  </option>
                ))}
              </select>
              <span className="block text-xs text-ink/70">
                Only events that are over show up here — this is the story
                of a day that happened. Attach it and your chapter stands on it:
                its photos, and the suppliers who were really there. Setnayan’s
                own write-up of the same day will link to your chapter, and yours
                to it. You can detach it at any time; your film and your words
                stay.
              </span>
            </>
          ) : (
            <>
              <input type="hidden" name="event_id" value="" />
              <span className="block text-xs text-ink/70">
                Nothing to attach yet — an event appears here once its day
                has passed. Your chapter stands on its own until then. If you
                were a guest at someone else’s day, asking them to link it is
                coming.
              </span>
            </>
          )}
        </label>
        {/* 🔴 THE LAST MACHINE-ID BOX IS GONE. It asked for comma-separated
            supplier ids; production's one published chapter carries none, which
            is the whole story of whether anyone would ever fill it.
            🔑 The day already knows who worked it — the product recorded exactly
            that in the booking, and used it ONLY to check a list the author had
            to type. It is now the SOURCE, so attaching a celebration is the one
            action that makes the suppliers appear. Narrowing which of them show
            is a later refinement; nobody can narrow a list they never had. */}
        <InfoTip
          label="The suppliers who worked your event appear on your published chapter on their own."
          labelAs="p"
          labelClassName="text-xs text-ink/70"
          align="start"
        >
          Once you attach the day above — there&rsquo;s nothing to type. Anyone your story merely mentions in writing
          stays plain text, never a bookable card.
        </InfoTip>
      </fieldset>
    </>
  );
}
