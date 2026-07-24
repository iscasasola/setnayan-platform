import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Lock,
  Palette,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { getHostUserId } from '@/lib/host-gate';
import { eventCoupleWebsiteProActive } from '@/lib/couple-website-pro';
import { sanitizeRolePalette } from '@/lib/mood-board';
import { buildSitePaletteVars } from '@/lib/site-palette';
import { SubmitButton } from '@/app/_components/submit-button';
import { updateSiteColors } from './actions';
import { ColorField } from './color-field';

export const metadata = { title: 'Site colours · Setnayan' };

const WEBSITE_PRO_HREF = (eventId: string) => `/dashboard/${eventId}/studio/website-pro`;

// Brand defaults (globals.css light mode) — the last-resort swatch shown while a
// field is cleared and the palette can't contribute a colour.
const DEFAULT_BG_HEX = '#ffffff'; //   --color-cream (light)
const DEFAULT_BUTTON_HEX = '#a9834b'; // --color-mulberry (Atelier gold, light)

/** "r g b" channel string (buildSitePaletteVars output) → `#rrggbb`, or the
 *  fallback when absent/malformed. Powers the "using my palette" swatch so the
 *  picker previews what the couple's current palette colour looks like. */
function channelsToHex(channels: string | undefined, fallback: string): string {
  if (!channels) return fallback;
  const parts = channels.trim().split(/\s+/).map((n) => Number(n));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) {
    return fallback;
  }
  return `#${parts.map((n) => Math.round(n).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * /dashboard/[eventId]/website/colors — the Website Pro "Site colours" editor
 * (Launch settings-first · Design_Launch_Settings_2026-07-24 §4.4 · PR-C).
 *
 * Two NET-NEW couple-facing settings — Background colour + Button colour — that
 * override the Mood-Board-derived tokens on the guest site (events.site_bg_color
 * / site_button_color · migration 20270930244819). These are Website Pro perks:
 * because they're brand-new settings there's no grandfathered content, so the
 * page gates PURELY on active Website Pro ownership — a non-Pro couple sees a
 * locked upsell to the Website Pro buy surface instead of the pickers.
 *
 * Host-gated (event_moderators OR the legacy couple row, via getHostUserId);
 * the save action re-checks host membership AND Pro ownership (defence-in-depth).
 */
export default async function SiteColorsEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { eventId } = await params;
  const search = await searchParams;

  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // Host gate — moderators OR the legacy couple member. Non-hosts bounce home.
  const hostUserId = await getHostUserId(eventId);
  if (!hostUserId) redirect(`/dashboard/${eventId}`);

  const supabase = await createClient();
  const { data: event } = await supabase
    .from('events')
    .select('event_id, display_name, slug, role_palette, site_bg_color, site_button_color')
    .eq('event_id', eventId)
    .maybeSingle();

  if (!event) redirect(`/dashboard/${eventId}`);

  // Pro gate. Admin client: orders RLS is purchaser-scoped, so a co-host who
  // didn't place the order still resolves the shared event ownership (mirrors
  // the buy pages + loadMedia on the public site).
  const proActive = await eventCoupleWebsiteProActive(createAdminClient(), eventId);

  return (
    <section className="space-y-6">
      <header className="sn-reveal space-y-3">
        <Link
          href={`/dashboard/${eventId}/website`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-terracotta hover:text-terracotta-700"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Back to website
        </Link>
        <div>
          <p className="sn-eye flex items-center gap-2">
            <Palette aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Site colours
          </p>
          <h1 className="sn-h1 mt-1">Background &amp; button colour</h1>
          <p className="mt-2 max-w-prose text-sm text-ink/65">
            Set the background and button colours for your wedding website. Leave
            either one blank to keep the colour from your Mood Board palette. Your
            guests see these across every part of your site.
          </p>
        </div>
      </header>

      {proActive ? (
        <SiteColorsForm
          eventId={eventId}
          bgInitial={typeof event.site_bg_color === 'string' ? event.site_bg_color : ''}
          buttonInitial={
            typeof event.site_button_color === 'string' ? event.site_button_color : ''
          }
          rolePalette={event.role_palette}
          saved={search.saved === '1'}
          error={search.error}
        />
      ) : (
        <LockedUpsell eventId={eventId} />
      )}
    </section>
  );
}

/** Unlocked state — the two colour pickers + save. */
function SiteColorsForm({
  eventId,
  bgInitial,
  buttonInitial,
  rolePalette,
  saved,
  error,
}: {
  eventId: string;
  bgInitial: string;
  buttonInitial: string;
  rolePalette: unknown;
  saved: boolean;
  error?: string;
}) {
  const paletteVars = buildSitePaletteVars(sanitizeRolePalette(rolePalette));
  const bgFallback = channelsToHex(paletteVars?.['--color-cream'], DEFAULT_BG_HEX);
  const buttonFallback = channelsToHex(paletteVars?.['--color-mulberry'], DEFAULT_BUTTON_HEX);
  const updateAction = updateSiteColors.bind(null, eventId);

  return (
    <>
      {saved ? (
        <div
          role="status"
          className="inline-flex items-center gap-2 rounded-md border border-success-300/60 bg-success-50 px-3 py-2 text-sm text-success-800"
        >
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Saved — your guests will see these colours on your website.
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="rounded-md border border-red-300/60 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </div>
      ) : null}

      <form action={updateAction} className="space-y-4">
        <ColorField
          name="bg_color"
          label="Background colour"
          help="The page background of your website. Blank = your Mood Board palette."
          initial={bgInitial}
          fallbackHex={bgFallback}
        />
        <ColorField
          name="button_color"
          label="Button colour"
          help="Buttons and calls-to-action across your site. Blank = your Mood Board palette."
          initial={buttonInitial}
          fallbackHex={buttonFallback}
        />
        <SubmitButton pendingLabel="Saving…" className="button-primary">
          Save colours
        </SubmitButton>
      </form>
    </>
  );
}

/** Locked state — Website Pro not owned. One umbrella upsell, no buy buttons here. */
function LockedUpsell({ eventId }: { eventId: string }) {
  return (
    <div className="rounded-xl border border-mulberry/20 bg-mulberry/5 p-5">
      <p className="mb-1 inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
        <Lock aria-hidden className="h-5 w-5 text-mulberry" strokeWidth={1.75} />
        Part of Website Pro
      </p>
      <p className="text-sm text-ink/70">
        Custom background and button colours are part of Website Pro — the
        cinematic layer that also unlocks your Save-the-Date reveal, photo
        gallery, background music, editorial editing, and removes the
        &ldquo;Powered by Setnayan&rdquo; footer.
      </p>
      <Link
        href={WEBSITE_PRO_HREF(eventId)}
        className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-mulberry px-4 py-2 text-sm font-semibold text-cream hover:bg-mulberry-600"
      >
        Unlock Website Pro
        <ArrowUpRight aria-hidden className="h-4 w-4" strokeWidth={2} />
      </Link>
    </div>
  );
}
