import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Check, Clapperboard, Film, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { eventOwnsSku, eventSkuActive } from '@/lib/entitlements';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { formatV2Sku } from '@/lib/v2/sku-catalog-v2';
import { formatPhp } from '@/lib/orders';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { InlineCheckoutDrawer } from '@/app/dashboard/[eventId]/_components/inline-checkout-drawer';
import { SdeFilmPreview } from './sde-film-preview';

export const metadata = { title: 'Same-Day Edit · Setnayan' };

/**
 * /dashboard/[eventId]/studio/sde — the couple-side detail for the Same-Day
 * Edit deliverable (a cinematic film the Setnayan crew cuts from the day's
 * footage and delivers the same night).
 *
 * Mirrors studio/indoor-blueprint/page.tsx — owned vs. unowned split:
 *   • Owned (a paid/bundled SDE order) → it appears on the day-of page + recap
 *     automatically; when the crew has delivered the film, an inline preview
 *     plays it; until then a calm "being cut" stand-in.
 *   • Unowned → what-it-is + the Get CTA (InlineCheckoutDrawer).
 *
 * The couple never uploads — delivery is crew/admin-driven (/admin/sde), and the
 * film auto-shows the moment it lands (no separate couple-publish step). SDE is
 * a Media Pack child, so eventOwnsSku/eventSkuActive resolve it bundle-aware.
 *
 * All sde_* reads graceful-degrade (the SdeFilmPreview is only rendered once the
 * page has resolved the keys; a missing column → no film, treated as pending).
 */

const SKU_CODE = 'SDE';

type Props = { params: Promise<{ eventId: string }> };

export default async function SdeStudioPage({ params }: Props) {
  const { eventId } = await params;

  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  const { data: event } = await supabase
    .from('events')
    .select('event_id, display_name, slug')
    .eq('event_id', eventId)
    .maybeSingle();
  if (!event) redirect(`/dashboard/${eventId}`);

  // owns = a live order (counts pending so the buy CTA doesn't double-offer);
  // active = admin-approved (paid/fulfilled) — the same gate the public surfaces
  // use, so "appears on your day-of page" is only promised once it really shows.
  const owns = await eventOwnsSku(supabase, eventId, SKU_CODE);

  return (
    <section className="space-y-6">
      <Link
        href={`/dashboard/${eventId}/studio`}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to add-ons
      </Link>

      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">Same-Day Edit</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          A cinematic cut of your day — the same night
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          Our crew edits the day&rsquo;s best moments into a short film and delivers it the same
          evening. It plays right on your wedding page — for the guests still celebrating, and for
          everyone who reads your recap after.
        </p>
      </header>

      {owns ? (
        <OwnedView eventId={eventId} supabase={supabase} slug={event.slug} />
      ) : (
        <UnownedView eventId={eventId} displayName={event.display_name} />
      )}
    </section>
  );
}

type SupabaseLike = Awaited<ReturnType<typeof createClient>>;

// ─────────────────────────────────────────────────────────────────────────
// Owned — the couple holds the SDE (à-la-carte or via the Media Pack). The
// film auto-shows on their public surfaces; here we mirror its state.
// ─────────────────────────────────────────────────────────────────────────

async function OwnedView({
  eventId,
  supabase,
  slug,
}: {
  eventId: string;
  supabase: SupabaseLike;
  slug: string | null;
}) {
  // The film keys live on events; read graceful-degrade (a pre-migration column
  // is just "not delivered yet"). admin client — the couple's RLS can read their
  // own event, but we presign with the service-role helper anyway.
  const admin = createAdminClient();
  let filmUrl: string | null = null;
  let delivered = false;
  try {
    const { data, error } = await admin
      .from('events')
      .select('sde_video_r2_key, sde_published_at')
      .eq('event_id', eventId)
      .maybeSingle();
    if (!error && data) {
      const row = data as { sde_video_r2_key?: string | null; sde_published_at?: string | null };
      delivered = Boolean(row.sde_published_at && row.sde_video_r2_key);
      if (delivered) {
        // Only surface the film once the SKU is genuinely active (admin-approved)
        // — matches the public day-of / recap gate.
        const active = await eventSkuActive(supabase, eventId, SKU_CODE);
        if (active) {
          filmUrl = await displayUrlForStoredAsset(row.sde_video_r2_key ?? null).catch(() => null);
        }
      }
    }
  } catch {
    filmUrl = null;
    delivered = false;
  }

  return (
    <>
      <div className="rounded-xl border border-success-300/60 bg-success-50 px-4 py-3 text-sm font-medium text-success-800">
        <p className="inline-flex items-center gap-2">
          <Check aria-hidden className="h-4 w-4" strokeWidth={2} />
          You&rsquo;ve got the Same-Day Edit — it appears on your day-of page and your recap
          automatically.
        </p>
      </div>

      {filmUrl ? (
        <section className="rounded-2xl border border-ink/10 bg-cream p-5">
          <header className="space-y-1">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">Your film</p>
            <h2 className="text-xl font-semibold tracking-tight">It&rsquo;s ready</h2>
          </header>
          <div className="mt-4">
            <SdeFilmPreview src={filmUrl} />
          </div>
          {slug ? (
            <p className="mt-3 text-xs text-ink/55">
              Live on{' '}
              <Link
                href={`/${slug}`}
                className="font-medium text-terracotta underline-offset-4 hover:underline"
              >
                your wedding page
              </Link>{' '}
              and{' '}
              <Link
                href={`/${slug}/recap`}
                className="font-medium text-terracotta underline-offset-4 hover:underline"
              >
                your recap
              </Link>
              .
            </p>
          ) : null}
        </section>
      ) : (
        <section className="rounded-2xl border border-ink/10 bg-cream p-6 text-center">
          <Clapperboard aria-hidden className="mx-auto h-7 w-7 text-terracotta" strokeWidth={1.5} />
          <h2 className="mt-3 text-lg font-semibold tracking-tight">Your Same-Day Edit is being cut</h2>
          <p className="mx-auto mt-2 max-w-prose text-sm text-ink/60">
            Our crew is editing your film. The moment it&rsquo;s ready, it&rsquo;ll appear here — and on
            your day-of page and recap — no action needed from you.
          </p>
        </section>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Unowned — the marketing surface + the Get CTA.
// ─────────────────────────────────────────────────────────────────────────

async function UnownedView({
  eventId,
  displayName,
}: {
  eventId: string;
  displayName: string | null;
}) {
  const supabase = await createClient();
  const [skuRecord, settings] = await Promise.all([
    formatV2Sku(SKU_CODE).catch(() => null),
    fetchPlatformSettings(supabase),
  ]);
  const pricePhp = skuRecord?.price_php ?? null;

  return (
    <>
      <section className="rounded-2xl border border-ink/10 bg-cream p-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">What you get</p>
            <h2 className="text-xl font-semibold tracking-tight">A film, ready the same night</h2>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-terracotta/15 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-terracotta">
            <Sparkles aria-hidden className="h-3 w-3" strokeWidth={2} />
            Add-on
          </span>
        </header>

        <ul className="mt-4 space-y-2 text-sm text-ink/70">
          <li className="flex items-start gap-2">
            <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" strokeWidth={2} />
            A cinematic cut of your day, edited by the Setnayan crew.
          </li>
          <li className="flex items-start gap-2">
            <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" strokeWidth={2} />
            Delivered the same evening — while your celebration is still going.
          </li>
          <li className="flex items-start gap-2">
            <Film aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" strokeWidth={1.75} />
            Plays right on your wedding page and your recap — nothing for you to publish.
          </li>
        </ul>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {pricePhp != null ? (
            <>
              <p className="text-sm text-ink/65">
                <span className="font-mono text-base text-ink">{formatPhp(pricePhp)}</span>
              </p>
              <div className="sm:w-auto">
                <InlineCheckoutDrawer
                  eventId={eventId}
                  serviceKey={SKU_CODE}
                  displayName={`Same-Day Edit${displayName ? ` · ${displayName}` : ''}`}
                  originalPriceCentavos={String(Math.round(pricePhp * 100))}
                  settings={settings}
                  triggerLabel="Get the Same-Day Edit"
                  triggerClassName="inline-flex w-full items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream hover:bg-mulberry-600 disabled:opacity-70 sm:w-auto"
                />
              </div>
            </>
          ) : (
            <p className="text-sm text-ink/55">
              Ask our team to add the Same-Day Edit to your wedding.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
