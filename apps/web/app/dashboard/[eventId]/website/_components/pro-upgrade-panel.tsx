import Link from 'next/link';
import {
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { findSku, formatCentavosPhp } from '@/lib/sku-catalog';

/**
 * Free vs Pro panel — Website tab.
 *
 * RETIRED 2026-05-28 V2 cutover.
 * V1 surfaced a "Free during launch" badge on SKUs in the launch promo
 * set (2027-01-30 window). V2 retires the promo entirely — every paid
 * upgrade reads at full retail. The `isFreeNow` / `LAUNCH_PROMO_UNTIL`
 * imports are removed.
 *
 * Per CLAUDE.md 2026-05-22 owner directive + CLAUDE.md 2026-05-16 row
 * "0004 widget pricing reset", the Pro tier of the wedding website is
 * the existing two paid widget upgrades from iteration 0004:
 *
 *   • Monogram Hero  — ₱1,999 · per-event · no-refund · animated
 *                      SVG-stroke trace + custom video/photo hero
 *                      background.
 *   • Live Schedule  — ₱999 · per-event · refundable · "happening now"
 *                      highlight + auto-scroll on the Schedule widget.
 *
 * Each card surfaces its own CTA → /dashboard/[eventId]/orders/new?service=<sku>.
 * If the host has ALREADY purchased one of these upgrades (non-cancelled/
 * refunded/lapsed order on this event), the card flips to a "✓ Active"
 * badge instead of the Upgrade CTA.
 *
 * Polite brand voice throughout per [[feedback_setnayan_no_dev_text_post_launch]].
 */

const MONOGRAM_HERO_SKU = 'monogram_hero_upgrade';
const LIVE_SCHEDULE_SKU = 'pro_widget_schedule';

type OrderRow = {
  service_key: string | null;
  status: string;
};

type Props = {
  eventId: string;
  ownedOrders: OrderRow[];
};

export function ProUpgradePanel({ eventId, ownedOrders }: Props) {
  const ownsMonogramHero = ownedOrders.some(
    (o) => o.service_key === MONOGRAM_HERO_SKU,
  );
  const ownsLiveSchedule = ownedOrders.some(
    (o) => o.service_key === LIVE_SCHEDULE_SKU,
  );

  const monogramHeroSku = findSku(MONOGRAM_HERO_SKU);
  const liveScheduleSku = findSku(LIVE_SCHEDULE_SKU);

  /* Retired 2026-05-28 V2 cutover · launch-promo "Free during launch"
     branding dropped. Both SKUs read at full retail. */

  return (
    <section aria-labelledby="free-vs-pro-heading" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2
          id="free-vs-pro-heading"
          className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55"
        >
          Free vs Pro
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* FREE — your wedding website ships with this everywhere. */}
        <article className="rounded-xl border border-ink/10 bg-cream p-5">
          <header className="space-y-1">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55">
              Always free
            </p>
            <h3 className="text-xl font-semibold tracking-tight">
              Your wedding website
            </h3>
            <p className="text-sm text-ink/65">
              Everything below ships the moment your event is created — no
              upgrade needed.
            </p>
          </header>
          <ul className="mt-4 space-y-2 text-sm text-ink/80">
            <FreeBullet>Public URL with your branded QR code</FreeBullet>
            <FreeBullet>Hero photo + countdown to your wedding date</FreeBullet>
            <FreeBullet>RSVP form, guest list, and personal invitations</FreeBullet>
            <FreeBullet>Day-of schedule for your guests</FreeBullet>
            <FreeBullet>Photo moments, dress code, and venue map widgets</FreeBullet>
            <FreeBullet>Public, unlisted, or private — your call</FreeBullet>
            <FreeBullet>Your website stays live forever — no time limit</FreeBullet>
          </ul>
        </article>

        {/* PRO #1 — Monogram Hero ₱1,999. */}
        <ProUpgradeCard
          icon={Wand2}
          eyebrow="Pro upgrade"
          title="Monogram Hero"
          tagline="Animated monogram trace + your own video or photo background."
          features={[
            'Your monogram draws itself in on page load',
            'Custom video or photo background behind the monogram',
            'PNG monogram converts to SVG so it can animate',
            'Preview the result before you pay',
          ]}
          priceLabel={
            monogramHeroSku
              ? formatCentavosPhp(monogramHeroSku.priceCentavos)
              : '₱1,999'
          }
          priceSubLine="one-time, for this event"
          owned={ownsMonogramHero}
          upgradeHref={`/dashboard/${eventId}/orders/new?service=${MONOGRAM_HERO_SKU}`}
        />

        {/* PRO #2 — Live Schedule ₱999. */}
        <ProUpgradeCard
          icon={CalendarClock}
          eyebrow="Pro upgrade"
          title="Live Schedule"
          tagline="Light up the 'happening now' moment on your schedule."
          features={[
            '"Happening now" highlight on the day-of schedule widget',
            'Auto-scrolls to the current moment for guests',
            'Glows on the venue screen when each block kicks in',
            'Works on phones, tablets, and the big screen',
          ]}
          priceLabel={
            liveScheduleSku
              ? formatCentavosPhp(liveScheduleSku.priceCentavos)
              : '₱999'
          }
          priceSubLine="one-time, for this event"
          owned={ownsLiveSchedule}
          upgradeHref={`/dashboard/${eventId}/orders/new?service=${LIVE_SCHEDULE_SKU}`}
        />
      </div>
    </section>
  );
}

function FreeBullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <CheckCircle2
        aria-hidden
        className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700"
        strokeWidth={1.75}
      />
      <span>{children}</span>
    </li>
  );
}

function ProUpgradeCard({
  icon: Icon,
  eyebrow,
  title,
  tagline,
  features,
  priceLabel,
  priceSubLine,
  owned,
  upgradeHref,
}: {
  icon: typeof Wand2;
  eyebrow: string;
  title: string;
  tagline: string;
  features: string[];
  priceLabel: string;
  priceSubLine: string;
  owned: boolean;
  upgradeHref: string;
}) {
  return (
    <article
      className={`flex flex-col rounded-xl border p-5 ${
        owned
          ? 'border-emerald-300/60 bg-emerald-50/60'
          : 'border-terracotta/20 bg-white/70'
      }`}
    >
      <header className="space-y-1">
        <p className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-terracotta">
          <Sparkles aria-hidden className="h-3 w-3" strokeWidth={1.75} />
          {eyebrow}
        </p>
        <h3 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Icon aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
          {title}
        </h3>
        <p className="text-sm text-ink/65">{tagline}</p>
      </header>

      <ul className="mt-4 space-y-2 text-sm text-ink/80">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <CheckCircle2
              aria-hidden
              className="mt-0.5 h-4 w-4 shrink-0 text-terracotta"
              strokeWidth={1.75}
            />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex flex-1 flex-col justify-end gap-3 pt-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-2xl font-semibold tracking-tight text-ink">
            {priceLabel}
          </span>
          <span className="text-xs text-ink/55">{priceSubLine}</span>
        </div>

        {owned ? (
          <p className="inline-flex items-center justify-center gap-2 rounded-md border border-emerald-300/70 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800">
            <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            <span>Active on this event</span>
          </p>
        ) : (
          <Link
            href={upgradeHref}
            className="inline-flex h-11 min-h-[44pt] items-center justify-center gap-2 rounded-md bg-mulberry px-4 text-sm font-medium text-cream transition-colors hover:bg-mulberry-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mulberry"
          >
            <span>Upgrade</span>
            <ArrowUpRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          </Link>
        )}
      </div>
    </article>
  );
}
