import Link from 'next/link';
import { Globe, ArrowRight } from 'lucide-react';

// Section 12 — Available everywhere you plan (iteration 0015 § Section 12)
// Hide-until-live tiles (per 2026-05-15 revision).
// V1 launch state: only the Web tile renders; native tiles hidden until
// the platform_availability.store_url is published.
//
// Position per spec: between Section 11 conversion block and Section 11
// footer chrome. _DualCTAFooter wraps both pieces, so this section renders
// in the page composition order as Section 11.5 — placed in page.tsx as
// `<AvailableEverywhere />` between `<DualCTAFooter />` would need to split
// them. To keep the layout faithful, page.tsx renders:
//   <ConversionModule /> (via DualCTAFooter conversion half)
//   <AvailableEverywhere />
//   <SiteFooter /> (via DualCTAFooter footer half)
//
// Easier composition without refactoring DualCTAFooter: section 12 is
// rendered immediately AFTER section 11's conversion module but immediately
// BEFORE the footer chrome — handled in page.tsx by splitting the imports.
//
// TODO(post-Agent-D-merge): query platform_availability table; show
//   tiles only where `is_visible AND store_url IS NOT NULL`. Web tile
//   always renders. Auto-trim sub-line as platforms ship.

type PlatformTile = {
  id: string;
  label: string;
  storeName: string;
  isVisible: boolean;
};

// Static placeholder data per skeleton phase. The five native tiles all
// have isVisible=false until store URLs are published.
const TILES: PlatformTile[] = [
  { id: 'web', label: 'Web', storeName: 'Open in browser', isVisible: true },
  { id: 'windows', label: 'Windows', storeName: 'Microsoft Store', isVisible: false },
  { id: 'macos', label: 'macOS', storeName: 'Mac App Store', isVisible: false },
  { id: 'ios', label: 'iOS', storeName: 'App Store', isVisible: false },
  { id: 'ipados', label: 'iPadOS', storeName: 'App Store', isVisible: false },
  { id: 'android', label: 'Android', storeName: 'Google Play', isVisible: false },
];

export function AvailableEverywhere() {
  const visible = TILES.filter((t) => t.isVisible);
  const hiddenLabels = TILES.filter((t) => !t.isVisible).map((t) => t.label);

  // Auto-trimming sub-line: enumerate remaining unpublished platforms.
  // After 5 platforms ship, the sub-line disappears (handled by the
  // hiddenLabels.length check below).
  const subline =
    hiddenLabels.length === 0
      ? null
      : `Native apps for ${hiddenLabels.join(', ').replace(/,([^,]*)$/, ', and$1')} are on the way. We'll add each one as it ships.`;

  return (
    <section
      aria-labelledby="platforms-heading"
      className="border-t border-ink/10 bg-cream"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="max-w-3xl space-y-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            On every device
          </p>
          <h2
            id="platforms-heading"
            className="text-balance font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl"
          >
            Available everywhere you plan.
          </h2>
          <p className="text-base text-ink/65 sm:text-lg">
            Web · Windows · macOS · iOS · iPadOS · Android. Open Setnayan on
            whatever device your event-planning lands on.
          </p>
        </div>

        <ul className="mt-10 flex flex-wrap gap-3">
          {visible.map((tile) => (
            <li key={tile.id}>
              <Link
                href="/login"
                className="inline-flex min-h-[48px] items-center gap-3 rounded-xl border border-ink/15 bg-cream px-5 py-3 text-sm font-medium text-ink transition-colors hover:border-terracotta/40 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
                  <Globe aria-hidden className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <span className="flex flex-col items-start text-left">
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
                    {tile.label}
                  </span>
                  <span className="text-sm font-semibold">{tile.storeName}</span>
                </span>
                <ArrowRight
                  aria-hidden
                  className="ml-1 h-4 w-4 text-ink/50"
                  strokeWidth={1.75}
                />
              </Link>
            </li>
          ))}
        </ul>

        {subline ? (
          <p className="mt-5 max-w-2xl text-sm text-ink/55">{subline}</p>
        ) : null}

        <p className="mt-3 text-xs text-ink/45">
          Plan from anywhere — your data syncs across every device you sign
          in on.
        </p>
      </div>
    </section>
  );
}
