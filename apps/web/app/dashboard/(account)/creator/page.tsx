import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Clapperboard, Clock, Globe, Plus, Sparkles, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import {
  CHAPTER_KINDS,
  CHAPTER_KIND_LABEL,
  EMBED_PROVIDER_LABEL,
  type ChapterKind,
  type ChapterStatus,
  type EmbedProvider,
} from '@/lib/creator-chapters';
import { SubmitButton } from '@/app/_components/submit-button';
import { FormFlash } from '@/app/_components/forms/form-flash';
import { ChapterEmbedFrame } from './_components/chapter-embed-frame';
import {
  applyForCreator,
  createChapter,
  deleteChapter,
  publishChapter,
  unpublishChapter,
  updateChapter,
} from './actions';

export const metadata = { title: 'Creator chapters' };

type ChapterRow = {
  chapter_id: string;
  public_id: string;
  title: string;
  kind: ChapterKind;
  embed_url: string | null;
  embed_provider: EmbedProvider | null;
  substrate: Record<string, unknown> | null;
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
  applied: 'Application submitted — the Setnayan team will review it shortly.',
};

type ApplicationRow = {
  status: 'pending' | 'approved' | 'rejected';
  applied_at: string;
  reviewed_at: string | null;
  note: string | null;
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
    .select('is_creator, display_name, slug, public_profile_enabled')
    .eq('user_id', user.id)
    .maybeSingle();

  const isCreator = profile?.is_creator === true;

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
          Creator
        </p>
        <h1 className="sn-h1">Adventure Chapters</h1>
        <p className="text-base text-ink/65">
          A chapter embeds your finished edit — hosted on your own platform
          (YouTube, Instagram, or TikTok) — and wraps it with the raw substrate
          only Setnayan has: your Papic gallery, the itinerary, the vendors.
          Your profile is a timeline of chapters, not a feed. Creators are free.
        </p>
      </header>

      {search.error ? (
        <FormFlash tone="error">{decodeURIComponent(search.error)}</FormFlash>
      ) : null}
      {successKey ? <FormFlash tone="success">{FLASH[successKey]}</FormFlash> : null}

      {!isCreator ? (
        <BecomeCreator supabase={supabase} userId={user.id} />
      ) : (
        <CreatorBody
          supabase={supabase}
          userId={user.id}
          slug={profile?.slug ?? null}
          publicProfileEnabled={profile?.public_profile_enabled !== false}
        />
      )}
    </div>
  );
}

/**
 * Non-creator entry point: shows either the "Become a creator" apply form, or —
 * once they've filed — the pending / approved / rejected state of their latest
 * application. Reads through the authenticated client (RLS Pattern A), so a user
 * only ever sees their OWN application. Approval is what flips `is_creator`; this
 * branch never renders for an approved creator (the page already gates on that).
 */
async function BecomeCreator({
  supabase,
  userId,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
}) {
  const { data } = await supabase
    .from('creator_applications')
    .select('status, applied_at, reviewed_at, note')
    .eq('user_id', userId)
    .order('applied_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const application = (data ?? null) as ApplicationRow | null;

  const pending = application?.status === 'pending';
  // A prior rejection doesn't lock the door — the applicant may re-apply.
  const canApply = !application || application.status === 'rejected';

  return (
    <section className="sn-tile mt-4 space-y-4">
      <div className="space-y-2">
        <h2 className="sn-sec">Become a creator</h2>
        <p className="text-sm text-ink/70">
          The <span className="font-medium text-ink">Creator program</span> is a
          free presence + distribution layer for wedding, travel, food, and
          lifestyle creators. Your profile becomes a timeline of Adventure
          Chapters — your finished edits, wrapped in the raw substrate only
          Setnayan has. Creators are free; there&rsquo;s no subscription and
          nothing to buy.
        </p>
      </div>

      {pending ? (
        <div className="rounded-tile border border-ink/10 bg-ink/[0.03] p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-ink">
            <Clock aria-hidden className="h-4 w-4 text-ink/50" strokeWidth={1.75} />
            Application in review
          </p>
          <p className="mt-1 text-sm text-ink/65">
            You applied on {application.applied_at.slice(0, 10)}. The Setnayan
            team reviews creator applications and will enable your creator surface
            once approved.
          </p>
        </div>
      ) : null}

      {application?.status === 'rejected' ? (
        <div className="rounded-tile border border-warn-200/60 bg-warn-50/50 p-4">
          <p className="text-sm font-medium text-warn-900">
            Your last application wasn&rsquo;t approved
          </p>
          {application.note ? (
            <p className="mt-1 text-sm text-ink/70">
              <span className="text-ink/45">Note from the team:</span>{' '}
              {application.note}
            </p>
          ) : null}
          <p className="mt-1 text-sm text-ink/65">
            You&rsquo;re welcome to apply again below with more detail.
          </p>
        </div>
      ) : null}

      {canApply ? (
        <form action={applyForCreator} className="space-y-4">
          <label className="block space-y-1">
            <span className="block text-xs font-medium text-ink">
              What do you make? (your pitch)
            </span>
            <textarea
              name="pitch"
              required
              rows={4}
              maxLength={2000}
              placeholder="Tell us about the events you cover and why you'd be a great Setnayan creator."
              className="input-field"
            />
          </label>
          <label className="block space-y-1">
            <span className="block text-xs font-medium text-ink">
              Your platform links
            </span>
            <textarea
              name="links"
              rows={2}
              maxLength={2000}
              placeholder="YouTube · Instagram · TikTok · your site — one per line or comma-separated"
              className="input-field"
            />
            <span className="block text-[11px] text-ink/55">
              Where your finished work lives. Helps the team review faster.
            </span>
          </label>
          <SubmitButton
            className="button-primary inline-flex items-center justify-center gap-2"
            pendingLabel="Submitting…"
          >
            <Sparkles aria-hidden className="h-4 w-4" strokeWidth={2} />
            Apply to the creator program
          </SubmitButton>
        </form>
      ) : null}
    </section>
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
  const { data } = await supabase
    .from('creator_chapters')
    .select(
      'chapter_id, public_id, title, kind, embed_url, embed_provider, substrate, status, published_at, updated_at',
    )
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  const chapters = (data ?? []) as ChapterRow[];

  return (
    <>
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
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function ChapterCard({
  chapter: c,
  slug,
  publicProfileEnabled,
}: {
  chapter: ChapterRow;
  slug: string | null;
  publicProfileEnabled: boolean;
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
        <p className="text-xs text-ink/55">
          <Globe aria-hidden className="mr-1 inline h-3 w-3" strokeWidth={1.75} />
          Lives on your profile timeline at{' '}
          <span className="font-mono text-ink/70">/u/{slug}</span>
          {publicProfileEnabled ? '' : ' (your public profile is currently hidden)'}
          . The public timeline itself ships in a later update.
        </p>
      ) : null}

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
            placeholder="optional"
            className="input-field"
          />
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
            placeholder="optional — comma-separated (shoppable in a later update)"
            className="input-field"
          />
        </label>
      </fieldset>
    </>
  );
}
