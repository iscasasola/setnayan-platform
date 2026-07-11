import { cache } from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Logo } from '@/app/_components/logo';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveProfile, surfaceEnabled } from '@/lib/event-type-profile';
import { canViewSlugEvent } from '@/lib/slug-access';
import { sanitizeRolePalette } from '@/lib/mood-board';
import { buildSitePaletteVars } from '@/lib/site-palette';
import { fetchEgiftMethods, isPabuyaPublicRouteEnabled } from '@/lib/egift';
import {
  PabuyaCardList,
  PabuyaTrustNote,
  type PabuyaMethodCard,
} from '@/app/_components/pabuya/pabuya-card-list';

/**
 * GET /[slug]/pabuya — the public "digital money dance" surface. Guests see the
 * couple's own e-gift handles + QR codes and send DIRECTLY to those accounts;
 * Setnayan never holds the money (the trust note is load-bearing).
 *
 * Reads via the SERVICE-ROLE admin client behind the published-visibility gate
 * (canViewSlugEvent), exactly like /[slug]/recap and the Live Wall — events has
 * no anon-read policy, so a public page reads service-role, not anon RLS. Only
 * ENABLED rows are fetched, so hidden destinations never leak.
 *
 * ROLLOUT: gated behind `PABUYA_PUBLIC_ROUTE_ENABLED` (isPabuyaPublicRouteEnabled)
 * — off by default → notFound(), so this net-new public surface ships dark and
 * the owner flips it on when ready. Handles are noindexed regardless.
 */

export const revalidate = 300;

// noindex — payment handles should not be search-indexed.
export const metadata = {
  title: 'A blessing',
  robots: { index: false, follow: false },
};

const fetchEvent = cache(async (slug: string) => {
  const admin = createAdminClient();
  const { data } = await admin
    .from('events')
    .select(
      'event_id, slug, display_name, event_type, role_palette, landing_page_visibility',
    )
    .ilike('slug', slug)
    .maybeSingle();
  return data as {
    event_id: string;
    slug: string | null;
    display_name: string | null;
    event_type: string | null;
    role_palette: unknown;
    landing_page_visibility: string | null;
  } | null;
});

export default async function PabuyaPublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  // Rollout flag — off by default. The route exists but stays dark until the
  // owner sets PABUYA_PUBLIC_ROUTE_ENABLED.
  if (!isPabuyaPublicRouteEnabled()) notFound();

  const { slug } = await params;
  const event = await fetchEvent(slug);
  if (!event) notFound();

  // Pabuya lives on the event website → the 'website' surface. Generic profiles
  // disable it, so non-website event types notFound (config-driven, like recap).
  if (!surfaceEnabled(await resolveProfile(event.event_type ?? 'wedding'), 'website')) {
    notFound();
  }

  // Visibility gate: strangers can't reach a private (pre-launch) page; invited
  // guests (guest-session cookie) + signed-in hosts pass. Mirrors /[slug]/recap.
  if (!(await canViewSlugEvent(event.event_id, event.landing_page_visibility))) {
    redirect(`/${slug}`);
  }

  const admin = createAdminClient();
  const methods = await fetchEgiftMethods(admin, event.event_id, {
    enabledOnly: true,
  });

  const themeVars = buildSitePaletteVars(sanitizeRolePalette(event.role_palette));
  const wrapStyle = themeVars ? (themeVars as React.CSSProperties) : undefined;

  const cards: PabuyaMethodCard[] = methods.map((m) => ({
    kind: m.method_kind,
    label: m.label,
    accountName: m.account_name,
    handle: m.handle,
    note: m.note,
    qrUrl: m.qrDisplayUrl,
  }));

  const coupleName = event.display_name ?? 'the couple';

  return (
    <main className="min-h-dvh bg-cream text-ink" style={wrapStyle}>
      <header className="border-b border-ink/10 bg-cream/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href={`/${slug}`} className="flex items-center gap-2 text-ink">
            <Logo height={26} />
          </Link>
          <span className="font-mono text-xs uppercase tracking-[0.18em] text-ink/50">
            Pabuya
          </span>
        </div>
      </header>

      <div className="mx-auto w-full max-w-xl px-4 py-10 sm:px-6">
        <div className="mb-8 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-gold">
            The pabuya · digital money dance
          </p>
          <h1 className="mt-2 font-display text-3xl font-medium italic sm:text-4xl">
            A blessing for {coupleName}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink/65">
            Pin your cash on the couple — wherever you are in the world. Scan a
            QR or copy a handle and send it straight to their own account.
          </p>
        </div>

        {cards.length > 0 ? (
          <PabuyaCardList methods={cards} />
        ) : (
          <p className="rounded-2xl border border-dashed border-ink/20 bg-white/60 px-4 py-10 text-center text-sm text-ink/60">
            {coupleName} hasn&rsquo;t set up e-gifts yet. Check back soon — or
            visit their page in the meantime.
          </p>
        )}

        <div className="mt-6">
          <PabuyaTrustNote audience="guest" />
        </div>

        <footer className="mt-12 border-t border-ink/10 pt-8 text-center">
          <p className="font-display text-xl italic text-mulberry">
            Ang laki ng pasasalamat namin.
          </p>
          <p className="mt-1 text-sm text-ink/60">— {coupleName}</p>
          <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
            Kept forever on Setnayan
          </p>
        </footer>
      </div>
    </main>
  );
}
