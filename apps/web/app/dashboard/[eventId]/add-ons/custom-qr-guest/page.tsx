import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Check, Download, Palette, QrCode, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { fetchGuestsByEvent, guestDisplayName, ROLE_LABELS } from '@/lib/guests';
import {
  buildInvitationUrl,
  renderBrandedInvitationQrSvg,
  renderInvitationQrSvg,
  resolveBrandedQrColors,
} from '@/lib/qr';
import { resolveMonogram } from '@/lib/monogram';
import { getPrimaryColor, sanitizeRolePalette } from '@/lib/mood-board';
import { formatV2Sku } from '@/lib/v2/sku-catalog-v2';
import { formatPhp } from '@/lib/orders';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { eventOwnsSku } from '@/lib/entitlements';
import { InlineCheckoutDrawer } from '@/app/dashboard/[eventId]/_components/inline-checkout-drawer';

export const metadata = { title: 'Custom QR per guest · Setnayan' };

/**
 * /dashboard/[eventId]/add-ons/custom-qr-guest — closes the partial
 * CUSTOM_QR_GUEST SKU (₱1,499 · "One scan, and your guest finds everything").
 *
 * Every guest already has a default per-guest QR (guests.qr_token, iterations
 * 0001/0002) — ink-on-cream with the couple's monogram in the center, surfaced
 * on /dashboard/[eventId]/invitation. The PAID "Custom QR per Guest" SKU is a
 * BRANDED version of that QR: the QR modules tint with the couple's Mood Board
 * palette color and ship inside a premium card layout for print + share.
 *
 * Gating (reuses the website ProUpgradePanel pattern · CLAUDE.md 2026-05-22):
 *   • Owned (a paid CUSTOM_QR_GUEST order exists, not cancelled/refunded/lapsed)
 *     → render the branded QR cards for every guest + print sheet + downloads.
 *   • Unowned → marketing surface with a side-by-side default-vs-branded
 *     preview + the InlineCheckoutDrawer buy CTA. The default plain QR keeps
 *     working on the Invitation tab regardless.
 *
 * The default per-guest QR is NEVER gated — only this branded variant is.
 * The orchestrator flips lib/v2-catalog.ts CUSTOM_QR_GUEST → 'live' after
 * verifying; until then the SKU shows "Coming soon" on /pricing and this page
 * still works (the buy CTA is the InlineCheckoutDrawer, independent of the
 * /pricing build-status badge).
 */

const SKU_CODE = 'CUSTOM_QR_GUEST';
// Price comes ONLY from the admin V2 catalog (owner rule 2026-06-14 — no
// hardcoded price). The old ₱1,499 fallback diverged from the live catalog
// (₱999) and would over-charge on a catalog-read miss; removed. When the row is
// unreadable (e.g. no service-role key in CI / pre-seed) the buy block degrades
// gracefully below instead of inventing a number.

type Props = { params: Promise<{ eventId: string }> };

export default async function CustomQrGuestPage({ params }: Props) {
  const { eventId } = await params;

  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  const { data: event } = await supabase
    .from('events')
    .select(
      'event_id, display_name, event_date, slug, monogram_text, monogram_color, monogram_style, monogram_font_key, monogram_frame_key, role_palette',
    )
    .eq('event_id', eventId)
    .maybeSingle();
  if (!event) redirect(`/dashboard/${eventId}`);

  // Owned-state via the shared bundle-aware eventOwnsSku() reader
  // (lib/entitlements.ts) — so a couple who got CUSTOM_QR_GUEST inside the
  // Essentials (GUIDED_PACK) or Complete (MEDIA_PACK) bundle (a single
  // bundle-keyed order, no child CUSTOM_QR_GUEST order) still owns it.
  // Refund-aware: a still-in-reconciliation order locks the page into its
  // post-purchase "owned" state so the couple isn't double-charged; cancelled /
  // refunded / lapsed releases it. Graceful-degrade on a missing/legacy orders
  // table (42P01 / 42703) — pre-bootstrap databases surface the buy CTA rather
  // than crashing, matching the PR #380/#390 hotfix pattern.
  const owns = await eventOwnsSku(supabase, eventId, SKU_CODE);

  const monogram = resolveMonogram(event);
  const palette = sanitizeRolePalette(event.role_palette ?? {});
  // Brand color: prefer the reception dominant (overall event vibe), fall
  // back to the couple's bride palette, then ceremony. resolveBrandedQrColors
  // keeps the QR scannable (only honors dark-enough palette colors).
  const brandColor =
    getPrimaryColor(palette, 'reception') ??
    getPrimaryColor(palette, 'bride') ??
    getPrimaryColor(palette, 'ceremony') ??
    event.monogram_color ??
    null;
  const qrColors = resolveBrandedQrColors(brandColor);

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';
  const slug = event.slug ?? eventId;

  // Pricing from the live V2 catalog (single source of truth) with a fallback
  // so the page never crashes if the catalog row is missing pre-seed.
  const skuRecord = await formatV2Sku(SKU_CODE).catch(() => null);
  const pricePhp = skuRecord?.price_php ?? null;

  return (
    <section className="space-y-6">
      <Link
        href={`/dashboard/${eventId}/add-ons`}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to add-ons
      </Link>

      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
          Custom QR per guest
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          One scan, and your guest finds everything
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          Every guest already has a personal QR that opens their own invitation.
          This upgrade dresses each one in your monogram and your colors — a
          branded card you can print, send, or set on every table.
        </p>
      </header>

      {owns ? (
        <OwnedView
          eventId={eventId}
          slug={slug}
          appUrl={appUrl}
          monogram={monogram}
          qrColors={qrColors}
          supabase={supabase}
          displayName={event.display_name}
        />
      ) : (
        <UnownedView
          eventId={eventId}
          slug={slug}
          appUrl={appUrl}
          monogram={monogram}
          qrColors={qrColors}
          pricePhp={pricePhp}
          brandColor={qrColors.dark}
          supabase={supabase}
          event={event}
        />
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Owned — the couple has paid. Render the branded QR card for every guest,
// plus a print sheet link + a per-guest PNG download.
// ─────────────────────────────────────────────────────────────────────────

type SupabaseLike = Awaited<ReturnType<typeof createClient>>;

async function OwnedView({
  eventId,
  slug,
  appUrl,
  monogram,
  qrColors,
  supabase,
  displayName,
}: {
  eventId: string;
  slug: string;
  appUrl: string;
  monogram: ReturnType<typeof resolveMonogram>;
  qrColors: ReturnType<typeof resolveBrandedQrColors>;
  supabase: SupabaseLike;
  displayName: string | null;
}) {
  const guests = await fetchGuestsByEvent(supabase, eventId);

  const cards = await Promise.all(
    guests.map(async (g) => ({
      guestId: g.guest_id,
      name: guestDisplayName(g),
      role: ROLE_LABELS[g.role],
      url: buildInvitationUrl({ appUrl, slug, qrToken: g.qr_token }),
      svg: await renderBrandedInvitationQrSvg({
        appUrl,
        slug,
        qrToken: g.qr_token,
        monogram,
        colors: qrColors,
      }),
    })),
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-300/60 bg-emerald-50 px-4 py-3">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-emerald-800">
          <Check aria-hidden className="h-4 w-4" strokeWidth={2} />
          Your branded QR cards are ready — one for every guest below.
        </p>
        <Link
          href={`/dashboard/${eventId}/add-ons/custom-qr-guest/print`}
          target="_blank"
          className="button-secondary"
        >
          Print all (A4)
        </Link>
      </div>

      {cards.length === 0 ? (
        <p className="rounded-xl border border-ink/10 bg-cream p-6 text-sm text-ink/60">
          Add guests to your{' '}
          <Link
            href={`/dashboard/${eventId}/guests`}
            className="font-medium text-terracotta underline-offset-4 hover:underline"
          >
            guest list
          </Link>{' '}
          and their branded QR cards appear here.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <li key={card.guestId}>
              <article className="flex h-full flex-col items-center gap-3 rounded-2xl border border-ink/10 bg-cream p-5 text-center">
                <div
                  aria-label={`Branded QR for ${card.name}`}
                  className="h-40 w-40 overflow-hidden rounded-xl border border-ink/10 bg-white p-2 [&_svg]:h-full [&_svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: card.svg }}
                />
                <div className="min-w-0">
                  <p className="font-serif text-lg italic tracking-tight text-ink">
                    {card.name}
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/50">
                    {card.role}
                  </p>
                  {displayName ? (
                    <p className="mt-0.5 text-xs text-ink/45">{displayName}</p>
                  ) : null}
                </div>
                <a
                  href={`/api/website/qr/guest/${card.guestId}`}
                  download={`qr-${card.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`}
                  className="mt-auto inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
                >
                  <Download aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                  Download PNG
                </a>
              </article>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Unowned — the marketing surface. Side-by-side default-vs-branded preview
// using the first guest's token (or no guests yet), then the buy CTA.
// ─────────────────────────────────────────────────────────────────────────

async function UnownedView({
  eventId,
  slug,
  appUrl,
  monogram,
  qrColors,
  pricePhp,
  brandColor,
  supabase,
  event,
}: {
  eventId: string;
  slug: string;
  appUrl: string;
  monogram: ReturnType<typeof resolveMonogram>;
  qrColors: ReturnType<typeof resolveBrandedQrColors>;
  pricePhp: number | null;
  brandColor: string;
  supabase: SupabaseLike;
  event: { display_name: string | null };
}) {
  const guests = await fetchGuestsByEvent(supabase, eventId);
  const previewGuest = guests[0];
  // Preview against a real guest token when one exists; otherwise a stable
  // sample token so the comparison still renders before any guests are added.
  const previewToken = previewGuest?.qr_token ?? 'preview-sample-token';

  const [plainSvg, brandedSvg, settings] = await Promise.all([
    renderInvitationQrSvg({ appUrl, slug, qrToken: previewToken, monogram }),
    renderBrandedInvitationQrSvg({
      appUrl,
      slug,
      qrToken: previewToken,
      monogram,
      colors: qrColors,
    }),
    fetchPlatformSettings(supabase),
  ]);

  return (
    <>
      {/* Side-by-side preview */}
      <section className="rounded-2xl border border-ink/10 bg-cream p-5">
        <header className="space-y-1">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">
            Your QR, two ways
          </p>
          <h2 className="text-xl font-semibold tracking-tight">
            See the difference
          </h2>
          <p className="max-w-prose text-sm text-ink/60">
            Both QRs open the same personal invitation. The branded one carries
            your colors and your monogram — straight from your Mood Board.
          </p>
        </header>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col items-center gap-2 rounded-xl border border-ink/10 bg-white/60 p-5 text-center">
            <div
              aria-label="Default guest QR preview"
              className="h-36 w-36 overflow-hidden rounded-lg border border-ink/10 bg-white p-2 [&_svg]:h-full [&_svg]:w-full"
              dangerouslySetInnerHTML={{ __html: plainSvg }}
            />
            <p className="text-sm font-medium text-ink">Default — included free</p>
            <p className="text-xs text-ink/55">
              Your monogram in the center, on every guest&rsquo;s QR.
            </p>
          </div>

          <div className="relative flex flex-col items-center gap-2 rounded-xl border border-terracotta/30 bg-white/60 p-5 text-center">
            <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-terracotta/15 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-terracotta">
              <Sparkles aria-hidden className="h-3 w-3" strokeWidth={2} />
              Upgrade
            </span>
            <div
              aria-label="Branded guest QR preview"
              className="h-36 w-36 overflow-hidden rounded-lg border border-ink/10 bg-white p-2 [&_svg]:h-full [&_svg]:w-full"
              dangerouslySetInnerHTML={{ __html: brandedSvg }}
            />
            <p className="text-sm font-medium text-ink">Branded — your colors</p>
            <p className="inline-flex items-center gap-1.5 text-xs text-ink/55">
              <Palette aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              Tinted{' '}
              <span
                aria-hidden
                className="inline-block h-3 w-3 rounded-full border border-ink/15"
                style={{ backgroundColor: brandColor }}
              />
              from your Mood Board palette.
            </p>
          </div>
        </div>

        {guests.length === 0 ? (
          <p className="mt-4 text-xs text-ink/50">
            This is a preview. Once you have guests, every one gets their own
            branded QR card.
          </p>
        ) : null}
      </section>

      {/* What you get + buy */}
      <section className="rounded-2xl border border-ink/10 bg-cream p-5">
        <header className="space-y-1">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">
            What you get
          </p>
          <h2 className="text-xl font-semibold tracking-tight">
            A branded QR card for every guest
          </h2>
        </header>

        <ul className="mt-4 space-y-2 text-sm text-ink/70">
          <li className="flex items-start gap-2">
            <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" strokeWidth={2} />
            Your palette color woven through every guest&rsquo;s QR.
          </li>
          <li className="flex items-start gap-2">
            <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" strokeWidth={2} />
            Your monogram in the center, named to each guest.
          </li>
          <li className="flex items-start gap-2">
            <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" strokeWidth={2} />
            Print-ready A4 sheet + a download for each card.
          </li>
          <li className="flex items-start gap-2">
            <QrCode aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" strokeWidth={1.75} />
            Still opens each guest&rsquo;s own invitation — RSVP, schedule, the lot.
          </li>
        </ul>

        {pricePhp != null ? (
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink/65">
              One price for your whole guest list ·{' '}
              <span className="font-mono text-base text-ink">{formatPhp(pricePhp)}</span>
            </p>
            <div className="sm:w-auto">
              <InlineCheckoutDrawer
                eventId={eventId}
                serviceKey={SKU_CODE}
                displayName={`Custom QR per guest${event.display_name ? ` · ${event.display_name}` : ''}`}
                originalPriceCentavos={String(Math.round(pricePhp * 100))}
                settings={settings}
                triggerLabel="Brand my guests' QRs"
                triggerClassName="inline-flex w-full items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream hover:bg-mulberry-600 disabled:opacity-70 sm:w-auto"
              />
            </div>
          </div>
        ) : (
          <p className="mt-5 text-sm text-ink/65">
            Pricing loads from your catalog &mdash; please refresh in a moment.
          </p>
        )}
        <p className="mt-3 text-xs text-ink/50">
          Want to fine-tune your monogram + colors first? Set them on your{' '}
          <Link
            href={`/dashboard/${eventId}/invitation`}
            className="font-medium text-terracotta underline-offset-4 hover:underline"
          >
            Invitation page
          </Link>{' '}
          — your branded QRs follow.
        </p>
      </section>
    </>
  );
}
