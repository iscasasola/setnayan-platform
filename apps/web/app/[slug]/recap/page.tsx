import { cache } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Camera, Quote, Sparkles } from 'lucide-react';
import { Logo } from '@/app/_components/logo';
import { createAdminClient } from '@/lib/supabase/admin';
import { sanitizeRolePalette } from '@/lib/mood-board';
import { buildSitePaletteVars } from '@/lib/site-palette';
import { isRecapPublished, assembleRecapModel, type RecapModel } from '@/lib/auto-recap';
import { ShareButtons } from '@/app/realstories/_components/share-buttons';

/**
 * GET /[slug]/recap — the public Auto-Recap "living recap" (Living Memories
 * pillar · produce-the-keepsake row).
 *
 * The couple's love story is the FRAME, the day's PUBLIC-SAFE photos are the
 * body (their own curated gallery + face-blurred wall-safe derivatives — never
 * unblurred masters), and the wall-approved Kwentos are the voices. Renders
 * only when the couple has PUBLISHED it (event_recaps.status='published');
 * otherwise a gentle "not ready yet" stand-in (the couple's site is public, so
 * this leaks nothing — it just isn't a recap yet).
 */

// The stat line + new photos arrive over time; a short revalidate keeps the
// page fresh without a request-time DB round trip on every view.
export const revalidate = 300;

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '');

const fetchEvent = cache(async (slug: string) => {
  const admin = createAdminClient();
  const { data } = await admin
    .from('events')
    .select('event_id, slug, display_name, event_type, role_palette')
    .ilike('slug', slug)
    .maybeSingle();
  return data;
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await fetchEvent(slug);
  if (!event || event.event_type !== 'wedding' || !(await isRecapPublished(event.event_id))) {
    return { title: 'The Recap', robots: { index: false, follow: false } };
  }
  const title = `${event.display_name} — The Recap`;
  const description = `The day, in their words. ${event.display_name}'s wedding recap on Setnayan.`;
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/${event.slug}/recap` },
    openGraph: {
      type: 'website',
      url: `${SITE_URL}/${event.slug}/recap`,
      title,
      description,
      siteName: 'Setnayan',
      locale: 'en_PH',
      images: [{ url: `${SITE_URL}/api/og/recap/${event.slug}`, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: 'summary_large_image' as const },
  };
}

export default async function RecapPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await fetchEvent(slug);
  if (!event || event.event_type !== 'wedding') notFound();

  const themeVars = buildSitePaletteVars(sanitizeRolePalette(event.role_palette));
  const wrapStyle = themeVars ? (themeVars as React.CSSProperties) : undefined;

  if (!(await isRecapPublished(event.event_id))) {
    return (
      <main className="min-h-dvh bg-cream text-ink" style={wrapStyle}>
        <RecapHeader />
        <div className="mx-auto flex max-w-2xl flex-col items-center px-6 py-24 text-center">
          <Sparkles aria-hidden className="h-7 w-7 text-terracotta" strokeWidth={1.5} />
          <h1 className="mt-4 font-display text-3xl italic">The recap isn&rsquo;t ready yet</h1>
          <p className="mt-3 max-w-prose text-ink/65">
            {event.display_name} hasn&rsquo;t published their wedding recap. Check back soon — or
            visit their page in the meantime.
          </p>
          <Link
            href={`/${event.slug}`}
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-ink/15 bg-cream px-5 py-2.5 text-sm font-medium text-ink/75 shadow-sm hover:border-terracotta hover:text-terracotta"
          >
            Open their page
          </Link>
        </div>
        <RecapFooter />
      </main>
    );
  }

  const model = await assembleRecapModel(event.event_id);
  if (!model) notFound();

  const shareUrl = `${SITE_URL}/${event.slug}/recap`;
  const shareImage = `${SITE_URL}/api/og/recap/${event.slug}`;

  return (
    <main className="min-h-dvh bg-cream text-ink" style={wrapStyle}>
      <RecapHeader />
      <article className="mx-auto w-full max-w-3xl px-4 pb-16 pt-8 sm:px-6">
        <RecapHero model={model} />
        <RecapStats model={model} />
        <RecapPrologue model={model} />
        {model.dayChapters.map((ch, i) => (
          <ChapterBlock key={`ch-${i}`} chapter={ch} />
        ))}
        {model.curatedPhotoUrls.length > 0 ? (
          <CuratedGallery urls={model.curatedPhotoUrls} />
        ) : null}
        {model.voices.length > 0 ? <Voices voices={model.voices} /> : null}
        <RecapClosing model={model} shareUrl={shareUrl} shareImage={shareImage} />
      </article>
      <RecapFooter />
    </main>
  );
}

// ── chrome ────────────────────────────────────────────────────────────────

function RecapHeader() {
  return (
    <header className="border-b border-ink/10 bg-cream/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
        <span className="flex items-center gap-2 text-ink">
          <Logo height={28} />
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/60">Setnayan</span>
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/50">The Recap</span>
      </div>
    </header>
  );
}

function RecapFooter() {
  return (
    <footer className="border-t border-ink/10 px-4 py-8 text-center">
      <p className="font-serif text-lg italic text-terracotta">A living memory.</p>
      <p className="mt-3 text-xs text-ink/50">Powered by Setnayan · setnayan.com</p>
    </footer>
  );
}

// ── sections ────────────────────────────────────────────────────────────────

function RecapHero({ model }: { model: RecapModel }) {
  const meta = [model.eventDateFormatted, model.venueLabel].filter(Boolean).join(' · ');
  if (model.heroUrl) {
    return (
      <div className="relative -mx-4 mb-8 overflow-hidden rounded-2xl text-center sm:mx-0">
        {/* presigned URL → raw img (next/image would cache an expired URL) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={model.heroUrl} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-ink/30 via-ink/45 to-ink/80" />
        <div className="relative space-y-3 px-6 py-16 sm:py-24">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-cream/85">The Recap</p>
          <h1 className="font-display text-5xl font-medium italic tracking-tight text-cream sm:text-6xl">
            {model.coupleNames}
          </h1>
          {meta ? <p className="text-base text-cream/80">{meta}</p> : null}
        </div>
      </div>
    );
  }
  return (
    <div className="mb-8 space-y-3 text-center">
      <span
        className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-gold font-display text-2xl text-mulberry"
        style={{ color: model.monogramColor }}
      >
        {model.monogramText}
      </span>
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-terracotta">The Recap</p>
      <h1 className="font-display text-5xl font-medium italic tracking-tight sm:text-6xl">
        {model.coupleNames}
      </h1>
      {meta ? <p className="text-base text-ink/60">{meta}</p> : null}
    </div>
  );
}

function RecapStats({ model }: { model: RecapModel }) {
  const items = [
    { n: model.totals.photos, label: model.totals.photos === 1 ? 'photo' : 'photos' },
    { n: model.totals.voices, label: model.totals.voices === 1 ? 'voice' : 'voices' },
    ...(model.totals.guests ? [{ n: model.totals.guests, label: 'guests' }] : []),
  ].filter((it) => it.n > 0);
  if (items.length === 0) return null;
  return (
    <div className="mb-10 flex items-center justify-center gap-8 border-y border-ink/10 py-5">
      {items.map((it) => (
        <div key={it.label} className="text-center">
          <p className="font-display text-3xl text-mulberry">{it.n}</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">{it.label}</p>
        </div>
      ))}
    </div>
  );
}

function RecapPrologue({ model }: { model: RecapModel }) {
  if (model.lede.length === 0 && model.milestones.length === 0 && !model.pullQuote) return null;
  return (
    <section className="mx-auto mb-12 max-w-prose">
      <h2 className="font-display text-2xl text-mulberry">Ang Kwento</h2>
      <div className="mt-1 h-px w-16 bg-gold" />
      <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-ink/80">
        {model.lede.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      {model.pullQuote ? (
        <blockquote className="mt-6 border-l-2 border-gold pl-4 font-serif text-lg italic text-mulberry">
          {model.pullQuote}
        </blockquote>
      ) : null}
      {model.milestones.length > 0 ? (
        <ul className="mt-6 space-y-1.5">
          {model.milestones.slice(0, 9).map((m, i) => (
            <li key={i} className="text-sm text-ink/60">
              <span className="font-medium text-ink/80">{m.label}</span>
              {m.detail ? ` — ${m.detail}` : ''}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function PhotoGrid({ urls }: { urls: string[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {urls.map((url, i) => (
        <div key={i} className="aspect-square overflow-hidden rounded-lg bg-ink/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
        </div>
      ))}
    </div>
  );
}

function ChapterBlock({ chapter }: { chapter: RecapModel['dayChapters'][number] }) {
  return (
    <section className="mb-12">
      <div className="mb-4">
        <h2 className="font-display text-2xl text-mulberry">{chapter.title}</h2>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/50">
          {[chapter.subtitle, chapter.whenLabel].filter(Boolean).join(' · ')}
        </p>
      </div>
      <PhotoGrid urls={chapter.photoUrls} />
    </section>
  );
}

function CuratedGallery({ urls }: { urls: string[] }) {
  return (
    <section className="mb-12">
      <div className="mb-4">
        <h2 className="flex items-center gap-2 font-display text-2xl text-mulberry">
          <Camera aria-hidden className="h-5 w-5 text-gold" strokeWidth={1.75} />
          Their photos
        </h2>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/50">
          The moments they chose to share
        </p>
      </div>
      <PhotoGrid urls={urls} />
    </section>
  );
}

function Voices({ voices }: { voices: RecapModel['voices'] }) {
  return (
    <section className="mb-12">
      <div className="mb-4">
        <h2 className="flex items-center gap-2 font-display text-2xl text-mulberry">
          <Quote aria-hidden className="h-5 w-5 text-gold" strokeWidth={1.75} />
          Mga Boses
        </h2>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/50">
          The voices of their guests
        </p>
      </div>
      <ul className="space-y-5">
        {voices.map((v, i) => (
          <li key={i} className="rounded-2xl border border-ink/10 bg-surface p-5">
            <p className="font-serif text-lg italic leading-snug text-ink">&ldquo;{v.body}&rdquo;</p>
            <p className="mt-2 font-mono text-xs uppercase tracking-[0.15em] text-mulberry">— {v.author}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RecapClosing({
  model,
  shareUrl,
  shareImage,
}: {
  model: RecapModel;
  shareUrl: string;
  shareImage: string;
}) {
  return (
    <section className="mt-16 flex flex-col items-center gap-5 border-t border-ink/10 pt-10 text-center">
      <p className="font-display text-3xl text-mulberry">Salamat</p>
      <p className="max-w-prose text-sm text-ink/65">
        Ang mga litratong ito ang nagkuwento — the photos told the story, and the guests narrated it.
      </p>
      <ShareButtons
        url={shareUrl}
        title={`${model.coupleNames} — the day, in their words. A Setnayan recap.`}
        image={shareImage}
      />
    </section>
  );
}
