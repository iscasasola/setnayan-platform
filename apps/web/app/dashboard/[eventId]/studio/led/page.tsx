import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Check, Sparkles, Tv, Usb } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { eventSkuActive } from '@/lib/entitlements';
import { sanitizeRolePalette, type RolePalette } from '@/lib/mood-board';
import { formatV2Sku } from '@/lib/v2/sku-catalog-v2';
import { resolveServiceSellability } from '@/lib/v2-catalog';
import { formatPhp } from '@/lib/orders';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { InlineCheckoutDrawer } from '@/app/dashboard/[eventId]/_components/inline-checkout-drawer';
import {
  LED_DEFAULT_LOOP_SECONDS,
  LED_TEMPLATES,
  findLedTemplate,
} from '@/lib/led-background';
import { LedBackgroundMaker, type LedInitialConfig } from './_components/led-background-maker';

export const metadata = { title: 'LED Background Maker · Setnayan' };

/**
 * /dashboard/[eventId]/studio/led — the 0005 LED Background Maker, gated on the
 * paid LIVE_BACKGROUND SKU.
 *
 * The 8K LED-wall loop generator is a PAID couple service. Until 2026-06-22 the
 * editor rendered for ANY logged-in couple (no entitlement gate at all — the
 * accidental "free" state). This page now mirrors the sibling studio add-ons
 * (animated-monogram / custom-qr-guest):
 *   • Owned (a paid LIVE_BACKGROUND order exists, admin-approved — direct OR via
 *     the Complete/MEDIA_PACK bundle) → render the editor exactly as before,
 *     restoring the couple's last saved draft.
 *   • Unowned → the marketing surface + InlineCheckoutDrawer buy CTA. The editor
 *     never renders and we never hard-error — the couple sees what they get and
 *     can buy in one step.
 *
 * The gate uses the bundle-aware, admin-approved eventSkuActive() reader (the
 * handshake gate — feature unlocks only AFTER payment is verified). It reads with
 * the ADMIN client because ownership is an EVENT-level fact but orders RLS is
 * purchaser-scoped, so a co-host member who didn't personally place the order
 * would otherwise be wrongly shown the buy CTA. eventSkuActive graceful-degrades
 * on a missing/legacy orders table (42P01 / 42703 → treated as not-owned), so a
 * pre-bootstrap database surfaces the buy CTA rather than crashing. The save
 * route (/api/led-background/save) enforces the same gate so an unowned couple
 * can't persist a draft via a direct POST.
 */

const SKU_CODE = 'LIVE_BACKGROUND';

type Props = { params: Promise<{ eventId: string }> };

export default async function LedBackgroundPage({ params }: Props) {
  const { eventId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: event } = await supabase
    .from('events')
    .select('display_name, role_palette')
    .eq('event_id', eventId)
    .maybeSingle();

  // The couple's Mood Board palette (0010) — the LED gradient recolours FROM it
  // so the stage wall reads as THEIR wedding, in lockstep with the Save-the-Date
  // reveal + branded QR which pull from the same `events.role_palette` producer.
  // sanitizeRolePalette is the shared helper those siblings use (drops invalid
  // hexes, clamps, upper-cases). Empty {} when the couple hasn't built a board →
  // the maker keeps each template's hardcoded palette.
  const moodPalette = sanitizeRolePalette(event?.role_palette);

  // THE GATE — admin-approved, bundle-aware ownership (eventSkuActive). Read with
  // the admin client: ownership is an event-level fact, but orders RLS is
  // purchaser-scoped, so the user client would deny a co-host member who didn't
  // place the order and wrongly route them to the buy CTA. Graceful-degrades to
  // not-owned on a missing orders table.
  const admin = createAdminClient();
  const owns = await eventSkuActive(admin, eventId, SKU_CODE);

  return (
    <section className="space-y-6">
      <Link
        href={`/dashboard/${eventId}/studio`}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to add-ons
      </Link>

      {/*
        Marketing hero (the "why buy this" pitch) renders for NON-OWNERS only.
        An owner who opens this surface is here to USE the tool, not be re-sold
        it — so they see just the back link + editor below. The sell lives on
        the /studio/about learn-more page (reached by non-owners). 2026-06-25.
      */}
      {!owns && (
        <header className="sn-reveal space-y-3">
          <p className="sn-eye">LED Wall</p>
          <h1 className="sn-h1">
            8K loop generators for your venue&rsquo;s LED wall
          </h1>
          <p className="max-w-2xl text-base text-ink/65">
            Pick a motion-graphics template, set your master loop length, and we
            render a seamless 8K MP4 that the venue&rsquo;s tech drops onto a USB
            stick for offline playback &mdash; no venue Wi-Fi required.
          </p>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <li className="sn-row flex items-start gap-2 p-3 text-sm text-ink/75">
              <Sparkles
                aria-hidden
                className="mt-0.5 h-4 w-4 shrink-0 text-terracotta"
                strokeWidth={1.75}
              />
              <span>
                <span className="font-medium text-ink">10 templates</span>
                <span className="block text-xs text-ink/55">
                  Filipino heritage, glamour, cinematic, minimal &mdash; each with
                  layered motion graphics.
                </span>
              </span>
            </li>
            <li className="sn-row flex items-start gap-2 p-3 text-sm text-ink/75">
              <Tv
                aria-hidden
                className="mt-0.5 h-4 w-4 shrink-0 text-terracotta"
                strokeWidth={1.75}
              />
              <span>
                <span className="font-medium text-ink">8K master loop</span>
                <span className="block text-xs text-ink/55">
                  7680&times;4320 H.264. Loops seamlessly to fill your 5-hour
                  reception.
                </span>
              </span>
            </li>
            <li className="sn-row flex items-start gap-2 p-3 text-sm text-ink/75">
              <Usb
                aria-hidden
                className="mt-0.5 h-4 w-4 shrink-0 text-terracotta"
                strokeWidth={1.75}
              />
              <span>
                <span className="font-medium text-ink">USB delivery</span>
                <span className="block text-xs text-ink/55">
                  We mail a venue-ready USB master so the LED tech plays it
                  offline &mdash; no internet at the venue needed.
                </span>
              </span>
            </li>
          </ul>
        </header>
      )}

      {owns ? (
        <OwnedEditor
          eventId={eventId}
          coupleName={event?.display_name ?? ''}
          moodPalette={moodPalette}
        />
      ) : (
        <UnownedView
          eventId={eventId}
          displayName={event?.display_name ?? null}
          supabase={supabase}
        />
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Owned — the couple has a paid (admin-approved) LIVE_BACKGROUND order. Render
// the editor as before, restoring their last saved draft.
// ─────────────────────────────────────────────────────────────────────────

async function OwnedEditor({
  eventId,
  coupleName,
  moodPalette,
}: {
  eventId: string;
  coupleName: string;
  moodPalette: RolePalette;
}) {
  // Load the couple's existing default config (if any) so reopening the
  // editor restores their last draft. Service role since led_background_configs
  // has no couple-readable RLS policy yet (PR 1 shipped RLS-on / no-policies).
  const admin = createAdminClient();
  const { data: existingConfig } = await admin
    .from('led_background_configs')
    .select('config_id, template_id, config_json')
    .eq('event_id', eventId)
    .eq('is_default', true)
    .maybeSingle();
  const draftTemplate =
    findLedTemplate((existingConfig?.template_id as string) ?? '') ?? null;
  const draftConfigJson = (existingConfig?.config_json ?? {}) as Record<string, unknown>;
  const initialConfig: LedInitialConfig | null = existingConfig
    ? {
        configId: existingConfig.config_id as string,
        templateSlug: draftTemplate?.slug ?? LED_TEMPLATES[0]!.slug,
        loopSeconds: Number(draftConfigJson.loop_duration_s ?? LED_DEFAULT_LOOP_SECONDS),
        photoPoolEnabled: Boolean(draftConfigJson.photo_pool_enabled),
      }
    : null;

  return (
    <LedBackgroundMaker
      eventId={eventId}
      coupleName={coupleName}
      templates={LED_TEMPLATES}
      initialConfig={initialConfig}
      moodPalette={moodPalette}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Unowned — the marketing surface. What you get + the InlineCheckoutDrawer buy
// CTA (the same buy surface every other studio add-on uses). No editor.
// ─────────────────────────────────────────────────────────────────────────

type SupabaseLike = Awaited<ReturnType<typeof createClient>>;

async function UnownedView({
  eventId,
  displayName,
  supabase,
}: {
  eventId: string;
  displayName: string | null;
  supabase: SupabaseLike;
}) {
  // Price comes ONLY from the admin V2 catalog (owner rule 2026-06-14 — no
  // hardcoded price). null when the catalog row is unreadable (e.g. no
  // service-role key in CI / pre-seed) → the buy block degrades gracefully
  // below rather than inventing a number. In prod the row is always seeded.
  const [skuRecord, settings, sellability, monogramSku] = await Promise.all([
    formatV2Sku(SKU_CODE).catch(() => null),
    fetchPlatformSettings(supabase),
    // Live Background is bundle-only (2026-07-22): once its catalog row is
    // is_active=false, resolveServiceSellability returns 'retired' and the
    // standalone drawer would dead-end at checkout — so we gate on it and upsell
    // Monogram PRO instead. Reads DB is_active, so it self-heals through the
    // migration-push window (standalone stays while the SKU is still sellable).
    resolveServiceSellability(SKU_CODE),
    formatV2Sku('ANIMATED_MONOGRAM').catch(() => null),
  ]);
  const pricePhp = skuRecord?.price_php ?? null;
  const standaloneSellable = sellability === 'sellable';
  const monogramPricePhp = monogramSku?.price_php ?? null;

  return (
    <section className="sn-tile p-5">
      <header className="space-y-1">
        <p className="sn-eye">
          What you get
        </p>
        <h2 className="text-xl font-semibold tracking-tight">
          Your monogram, twenty feet tall on the stage screen
        </h2>
        <p className="max-w-prose text-sm text-ink/60">
          Unlock the LED Background Maker to design a seamless 8K loop for your
          venue&rsquo;s wall &mdash; pick a motif, set your loop length, and we
          deliver a venue-ready USB master.
        </p>
      </header>

      <ul className="mt-4 space-y-2 text-sm text-ink/70">
        <li className="flex items-start gap-2">
          <Sparkles aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" strokeWidth={1.75} />
          10 motion-graphics templates &mdash; Filipino heritage, glamour,
          cinematic, minimal.
        </li>
        <li className="flex items-start gap-2">
          <Tv aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" strokeWidth={1.75} />
          A seamless 7680&times;4320 H.264 master loop that fills your full
          5-hour reception.
        </li>
        <li className="flex items-start gap-2">
          <Usb aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" strokeWidth={1.75} />
          Venue-ready USB delivery &mdash; your LED tech plays it offline, no
          venue Wi-Fi needed.
        </li>
        <li className="flex items-start gap-2">
          <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" strokeWidth={2} />
          Optional Photo Pool blend of your engagement photos behind the
          monogram.
        </li>
      </ul>

      {standaloneSellable && pricePhp != null ? (
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink/65">
            One price for your wedding ·{' '}
            <span className="font-mono text-base text-ink">{formatPhp(pricePhp)}</span>
          </p>
          <div className="sm:w-auto">
            <InlineCheckoutDrawer
              eventId={eventId}
              serviceKey={SKU_CODE}
              displayName={`LED Background${displayName ? ` · ${displayName}` : ''}`}
              originalPriceCentavos={String(Math.round(pricePhp * 100))}
              settings={settings}
              triggerLabel="Unlock the LED Background Maker"
              triggerClassName="inline-flex w-full items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream hover:bg-mulberry-600 disabled:opacity-70 sm:w-auto"
            />
          </div>
        </div>
      ) : (
        // Bundle-only: the LED Background comes with Monogram PRO. Send the couple
        // to the Monogram surface (the ₱1,000 buy) instead of a standalone
        // checkout that would be rejected — they own it the moment that's approved.
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink/65">
            Included with{' '}
            <span className="font-medium text-ink">Monogram PRO</span>
            {monogramPricePhp != null ? (
              <>
                {' '}
                ·{' '}
                <span className="font-mono text-base text-ink">{formatPhp(monogramPricePhp)}</span>
              </>
            ) : null}
          </p>
          <Link
            href={`/dashboard/${eventId}/monogram`}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream hover:bg-mulberry-600 sm:w-auto"
          >
            Get Monogram PRO
          </Link>
        </div>
      )}
    </section>
  );
}
