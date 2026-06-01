import {
  ArrowUpRight,
  CheckCircle2,
  Globe,
  Newspaper,
  Sparkles,
  Wand2,
} from 'lucide-react';
import type { BuildStatus } from '@/lib/v2-catalog';
import { InlineCheckoutDrawer } from '@/app/dashboard/[eventId]/_components/inline-checkout-drawer';
import { PRO_WEBSITE_SERVICE_KEY } from '@/lib/pro-website';

/**
 * Pro Website panel — Website tab.
 *
 * Surfaces the paid PRO_WEBSITE upgrade (₱5,499 · "Your wedding, on its own
 * website") on top of the always-free wedding website. CLAUDE.md 2026-05-30
 * "V2.1 Amendment #3" + Onboarding Blueprint §3.3 ("A premium invitation,
 * event page, and editorial archive at a custom slug").
 *
 * Three states:
 *   • owned          → "Active on this event" · lists what's unlocked.
 *   • not owned · live → upgrade card with the inline checkout drawer
 *                        (voucher + BDO/GCash QR + screenshot + submit) for
 *                        service_key PRO_WEBSITE at full retail.
 *   • not owned · not-live → honest "coming soon" teaser (still an entry
 *                        point so there's no orphan surface, but no buy
 *                        button). Flips to buyable automatically when the
 *                        V2 catalog build_status moves PRO_WEBSITE → 'live'.
 *
 * `priceCentavos` + `buildStatus` both come from the V2 catalog
 * (fetchV2CustomerCatalog → PRO_WEBSITE row) so price and gate-status stay a
 * single source of truth · no hardcoded values.
 *
 * Polite brand voice throughout · no dev-text · no all-caps urgency.
 */

type Props = {
  eventId: string;
  owned: boolean;
  /** Sticker price in centavos as a plain integer string (drawer contract). */
  priceCentavos: string;
  /** Live build status from the V2 catalog · only 'live' enables the buy path. */
  buildStatus: BuildStatus;
  /** Pre-fetched platform settings · drawer just renders them. */
  settings: {
    bdo_account_name: string | null;
    bdo_account_number: string | null;
    bdo_qr_url: string | null;
    gcash_account_name: string | null;
    gcash_number: string | null;
    gcash_qr_url: string | null;
  };
};

const UNLOCKS: { icon: typeof Globe; text: string }[] = [
  { icon: Globe, text: 'A premium event page at your own custom slug' },
  { icon: Wand2, text: 'Animated monogram and the upgraded invitation blocks' },
  { icon: Newspaper, text: 'An editorial archive of your day, woven into your page' },
  { icon: Sparkles, text: 'Music, gallery, and the polished premium styling' },
];

export function ProWebsitePanel({
  eventId,
  owned,
  priceCentavos,
  buildStatus,
  settings,
}: Props) {
  const priceLabel = `₱${(Number(priceCentavos) / 100).toLocaleString('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
  const isLive = buildStatus === 'live';

  return (
    <section aria-labelledby="pro-website-heading" className="space-y-3">
      <h2
        id="pro-website-heading"
        className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55"
      >
        Pro Website
      </h2>

      <article
        className={`flex flex-col gap-5 rounded-xl border p-5 sm:p-6 ${
          owned
            ? 'border-emerald-300/60 bg-emerald-50/60'
            : 'border-terracotta/20 bg-white/70'
        }`}
      >
        <header className="space-y-1">
          <p className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-terracotta">
            <Sparkles aria-hidden className="h-3 w-3" strokeWidth={1.75} />
            {owned ? 'Your upgrade' : 'Pro upgrade'}
          </p>
          <h3 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Globe aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
            Your wedding, on its own website
          </h3>
          <p className="text-sm text-ink/65">
            Goes beyond the free page — a premium event site with editorial
            styling, all at a slug you choose.
          </p>
        </header>

        <ul className="space-y-2 text-sm text-ink/80">
          {UNLOCKS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-2">
              <Icon
                aria-hidden
                className={`mt-0.5 h-4 w-4 shrink-0 ${
                  owned ? 'text-emerald-700' : 'text-terracotta'
                }`}
                strokeWidth={1.75}
              />
              <span>{text}</span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-3 border-t border-ink/5 pt-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold tracking-tight text-ink">
              {priceLabel}
            </span>
            <span className="text-xs text-ink/55">one-time, for this event</span>
          </div>

          {owned ? (
            <p className="inline-flex items-center justify-center gap-2 rounded-md border border-emerald-300/70 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800">
              <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              <span>Active on this event</span>
            </p>
          ) : isLive ? (
            <InlineCheckoutDrawer
              eventId={eventId}
              serviceKey={PRO_WEBSITE_SERVICE_KEY}
              displayName="Pro Website"
              originalPriceCentavos={priceCentavos}
              settings={settings}
              triggerLabel="Upgrade to Pro Website"
              triggerClassName="inline-flex h-11 min-h-[44pt] items-center justify-center gap-2 rounded-md bg-mulberry px-4 text-sm font-medium text-cream transition-colors hover:bg-mulberry-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mulberry"
            />
          ) : (
            <span className="inline-flex items-center justify-center gap-2 rounded-md border border-ink/15 bg-cream px-4 py-2 text-sm font-medium text-ink/55">
              <ArrowUpRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              <span>Coming soon</span>
            </span>
          )}
        </div>
      </article>
    </section>
  );
}
