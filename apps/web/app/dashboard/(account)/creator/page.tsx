import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Clapperboard, Globe, Plus, Sparkles, Trash2 } from 'lucide-react';
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
  const { data } = await supabase
    .from('creator_chapters')
    .select(
      'chapter_id, public_id, title, kind, embed_url, embed_provider, substrate, teaser_r2_key, status, published_at, updated_at',
    )
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  const chapters = (data ?? []) as ChapterRow[];

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
        <p className="text-xs text-ink/55">
          <Globe aria-hidden className="mr-1 inline h-3 w-3" strokeWidth={1.75} />
          Lives on your profile timeline at{' '}
          <span className="font-mono text-ink/70">/u/{slug}</span>
          {publicProfileEnabled ? '' : ' (your public profile is currently hidden)'}
          . The public timeline itself ships in a later update.
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
            placeholder="optional — comma-separated (shoppable in a later update)"
            className="input-field"
          />
        </label>
      </fieldset>
    </>
  );
}
