import type { Metadata, Viewport } from 'next';
// ⚠ LOCAL, NOT `next/font/google` — the build used to fetch every one of these
// from fonts.gstatic.com and DIED when that fetch failed (twice on
// 2026-08-13, on unrelated PRs, each time looking like a failure of the
// change under test). Same faces, same weights, same latin subset — the
// files now live in ./_fonts and are refreshed by
// `node scripts/fetch-brand-fonts.mjs`, which is the ONLY thing that should
// ever talk to Google about fonts again.
import localFont from 'next/font/local';
import Script from 'next/script';
import './globals.css';
import { ClientTypeDetector } from './_components/client-type-detector';
import { NativeBridge } from './_components/native-bridge';
import { CookieConsentBanner } from './_components/cookie-consent-banner';
import { DemoModeBanner } from './_components/demo-mode-banner';
import { OfflineDaemonMount } from './_components/offline-daemon-mount';
import { NavProgress } from './_components/nav-progress';
import { NavSlideController } from './_components/nav/nav-slide-controller';
import { AppInitSplash } from './_components/app-init-splash';
import { SignInHereProvider } from './_components/auth/sign-in-here';
import { SiteChrome } from './_components/marketing/site-chrome';
import { SiteFooterChrome } from './_components/marketing/site-footer-chrome';
import { getNavSlotMap } from '@/lib/nav-registry';
import { ZoomGuard } from './_components/zoom-guard';
import { Providers } from './providers';
import { themeBootstrapScript } from './_components/theme-provider';
import {
  DEFAULT_APPLE_TOUCH,
  DEFAULT_ICON_SVG_192,
  DEFAULT_ICON_SVG_512,
  getBrandSettings,
  resolveBrandMarkUrl,
  withBrandVersion,
} from '@/lib/brand-settings';
import { getLoaderSettings } from '@/lib/loader-settings';
import { orgSameAs } from '@/lib/seo/org-same-as';
import { envFlagEnabled } from '@/lib/env-flag';

/**
 * App cold-start ("initialization") splash gate — owner 2026-06-07.
 * Runs synchronously before first paint. Sets `data-sn-boot` on <html> on the
 * FIRST app-route (or native shell) load of a session, which globals.css uses
 * to show the animated brand splash (#sn-init-splash). Marketing/legal/public
 * pages are intentionally excluded (keeps SSR content + Lighthouse/LCP intact);
 * the native Capacitor shell always boots through it. Once per session via
 * sessionStorage so in-app navigation never re-splashes. AppInitSplash (client)
 * fades it after hydration; a CSS failsafe (~4s) guarantees it never sticks.
 */
const bootSplashScript = `(function(){try{
  var p=location.pathname;
  var isApp=/^\\/(dashboard|vendor-dashboard|admin)(\\/|$)/.test(p);
  var c=window.Capacitor;
  var isNative=!!(c&&c.isNativePlatform&&c.isNativePlatform());
  if(!(isApp||isNative))return;
  if(sessionStorage.getItem('sn_booted'))return;
  sessionStorage.setItem('sn_booted','1');
  document.documentElement.setAttribute('data-sn-boot','1');
}catch(e){}})();`;

// Brand typography — iteration 0015 § Brand. Self-hosted from ./_fonts via
// next/font/local (was next/font/google, which fetched at build time)
// so the fonts ship in the same render lifecycle as the page (no FOUT, no
// extra DNS roundtrip to fonts.gstatic.com on cold cache). The CSS variables
// are wired into `tailwind.config.ts` so `font-display` / `font-sans` /
// `font-mono` Tailwind utilities resolve to the right family at build time.
//
//   - Cormorant Garamond → display (h1/h2 hero + section titles). Editorial
//     serif with the elegant wedding-invitation register the spec calls for.
//   - Manrope            → body sans (paragraphs, buttons, nav, form fields).
//     Modern geometric humanist; reads well on small screens (PH is 80%+
//     mobile per DataReportal Digital 2024 Philippines).
//   - DM Mono            → accent mono (eyebrows, label chips, /sɛt na jan/).
//     Brand mono distinct from the dev-tools SF Mono fallback.
//
// `display: 'swap'` means the system fallback paints immediately while the
// webfont streams, so LCP measurements stay anchored to first paint instead
// of font load. The weight subsets are minimal — only the weights we actually
// reference — so payload stays under ~80KB total for all three families.
const cormorant = localFont({
  src: [
    { path: './_fonts/cormorant-garamond/cormorant-garamond-400.woff2', weight: '400', style: 'normal' },
    { path: './_fonts/cormorant-garamond/cormorant-garamond-500.woff2', weight: '500', style: 'normal' },
    { path: './_fonts/cormorant-garamond/cormorant-garamond-600.woff2', weight: '600', style: 'normal' },
    { path: './_fonts/cormorant-garamond/cormorant-garamond-700.woff2', weight: '700', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-editorial-display',
  // Metric-matched fallback while the face loads. next/font/google
  // derived this per family; with local files it must be stated.
  adjustFontFallback: 'Times New Roman',
});

// Pahina display face (guest-site design 2026-07-25 §3) — loaded under its OWN
// variable so this PR is inert; the .sn-editorial restyle PRs consume it.
// Wave-A PR-5 CHECKED THIS AND CORMORANT STAYS — it has real consumers, so do
// not "clean it up" on a future bundle pass without redoing the check:
//   · `.sn-editorial` (globals.css) maps --font-display → --font-editorial-display,
//     so every font-display / font-serif in the guest tree still resolves here.
//     Only the Pahina-specific `font-pahina` classes use Fraunces.
//   · app/global-error.tsx names 'Cormorant Garamond' directly.
// Retiring it means first repointing --font-editorial-display at Fraunces, which
// restyles the whole guest tree — a visual change, not a bundle cleanup.
const fraunces = localFont({
  src: [
    { path: './_fonts/fraunces/fraunces-300-italic.woff2', weight: '300', style: 'italic' },
    { path: './_fonts/fraunces/fraunces-400-italic.woff2', weight: '400', style: 'italic' },
    { path: './_fonts/fraunces/fraunces-500-italic.woff2', weight: '500', style: 'italic' },
    { path: './_fonts/fraunces/fraunces-600-italic.woff2', weight: '600', style: 'italic' },
    { path: './_fonts/fraunces/fraunces-300.woff2', weight: '300', style: 'normal' },
    { path: './_fonts/fraunces/fraunces-400.woff2', weight: '400', style: 'normal' },
    { path: './_fonts/fraunces/fraunces-500.woff2', weight: '500', style: 'normal' },
    { path: './_fonts/fraunces/fraunces-600.woff2', weight: '600', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-pahina-display',
  // Metric-matched fallback while the face loads. next/font/google
  // derived this per family; with local files it must be stated.
  adjustFontFallback: 'Times New Roman',
});

const manrope = localFont({
  src: [
    { path: './_fonts/manrope/manrope-400.woff2', weight: '400', style: 'normal' },
    { path: './_fonts/manrope/manrope-500.woff2', weight: '500', style: 'normal' },
    { path: './_fonts/manrope/manrope-600.woff2', weight: '600', style: 'normal' },
    { path: './_fonts/manrope/manrope-700.woff2', weight: '700', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-editorial-sans',
  // Metric-matched fallback while the face loads. next/font/google
  // derived this per family; with local files it must be stated.
  adjustFontFallback: 'Arial',
});

const dmMono = localFont({
  src: [
    { path: './_fonts/dm-mono/dm-mono-400.woff2', weight: '400', style: 'normal' },
    { path: './_fonts/dm-mono/dm-mono-500.woff2', weight: '500', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-editorial-mono',
  // Metric-matched fallback while the face loads. next/font/google
  // derived this per family; with local files it must be stated.
  adjustFontFallback: 'Arial',
});

// Atelier + macOS glass typography — owner-locked 2026-07-12 (design
// finalization; supersedes the 2026-06-10 Source Sans dashboard lock and the
// 0015 Cormorant/Manrope chrome roles). Hanken Grotesk is THE UI family for
// all chrome (marketing site + couple/vendor/admin dashboards); Space Mono
// carries data/prices/dates. The swap cascades through globals.css variable
// aliases (--font-app / --font-*-marketing / .app-surface remaps) so the
// shipped components don't churn. Cormorant/Manrope/DM Mono above stay LOADED
// but are now guest-content faces only: the /[slug] invitation surfaces are
// owner-excluded from the reskin and keep inheriting the root vars.
const hanken = localFont({
  src: [
    { path: './_fonts/hanken-grotesk/hanken-grotesk-400.woff2', weight: '400', style: 'normal' },
    { path: './_fonts/hanken-grotesk/hanken-grotesk-500.woff2', weight: '500', style: 'normal' },
    { path: './_fonts/hanken-grotesk/hanken-grotesk-600.woff2', weight: '600', style: 'normal' },
    { path: './_fonts/hanken-grotesk/hanken-grotesk-700.woff2', weight: '700', style: 'normal' },
    { path: './_fonts/hanken-grotesk/hanken-grotesk-800.woff2', weight: '800', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-hanken',
  // Metric-matched fallback while the face loads. next/font/google
  // derived this per family; with local files it must be stated.
  adjustFontFallback: 'Arial',
});

const spaceMono = localFont({
  src: [
    { path: './_fonts/space-mono/space-mono-400.woff2', weight: '400', style: 'normal' },
    { path: './_fonts/space-mono/space-mono-700.woff2', weight: '700', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-space-mono',
  // Metric-matched fallback while the face loads. next/font/google
  // derived this per family; with local files it must be stated.
  adjustFontFallback: 'Arial',
});

// Monogram display faces — the couple's onboarding monogram renders in its
// EXACT chosen face in the dashboard chrome (event switcher + profile avatar),
// matching the onboarding medallion. Owner-locked 2026-06-03 ("yes exact font").
// preload: false on all seven monogram/script faces below — they render ONLY in
// the Monogram Maker + monogram chrome, never on the marketing homepage or any
// public page, yet next/font was emitting a <link rel=preload as=font> for each
// into EVERY page's <head>. `preload:false` keeps them fully functional (loaded
// on demand when a monogram surface mounts, display:swap covers the swap) while
// removing ~7 wasted font preloads from the first-paint path site-wide.
// (Perf sweep 2026-07-02, findings #5/#11/#12/#14.)
const cinzel = localFont({
  src: [
    { path: './_fonts/cinzel/cinzel-400.woff2', weight: '400', style: 'normal' },
    { path: './_fonts/cinzel/cinzel-600.woff2', weight: '600', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-cinzel',
  // Metric-matched fallback while the face loads. next/font/google
  // derived this per family; with local files it must be stated.
  adjustFontFallback: 'Times New Roman',
});

const playfairDisplay = localFont({
  src: [
    { path: './_fonts/playfair-display/playfair-display-400-italic.woff2', weight: '400', style: 'italic' },
    { path: './_fonts/playfair-display/playfair-display-600-italic.woff2', weight: '600', style: 'italic' },
    { path: './_fonts/playfair-display/playfair-display-400.woff2', weight: '400', style: 'normal' },
    { path: './_fonts/playfair-display/playfair-display-600.woff2', weight: '600', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-playfair',
  // Metric-matched fallback while the face loads. next/font/google
  // derived this per family; with local files it must be stated.
  adjustFontFallback: 'Times New Roman',
});

const greatVibes = localFont({
  src: [
    { path: './_fonts/great-vibes/great-vibes-400.woff2', weight: '400', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-script',
  // Metric-matched fallback while the face loads. next/font/google
  // derived this per family; with local files it must be stated.
  adjustFontFallback: 'Times New Roman',
});

// Monogram typeface expansion — owner picks 2026-06-11 (font specimen session):
// Libre Caslon Display · Tangerine · Luxurious Script · Vidaloka join the four
// faces above in the Monogram Maker's typeface picker. Weight-minimal: the
// monogram renders a 1–5 character mark, nothing else uses these families.
const libreCaslon = localFont({
  src: [
    { path: './_fonts/libre-caslon-display/libre-caslon-display-400.woff2', weight: '400', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-libre-caslon',
  // Metric-matched fallback while the face loads. next/font/google
  // derived this per family; with local files it must be stated.
  adjustFontFallback: 'Times New Roman',
});

const tangerine = localFont({
  src: [
    { path: './_fonts/tangerine/tangerine-400.woff2', weight: '400', style: 'normal' },
    { path: './_fonts/tangerine/tangerine-700.woff2', weight: '700', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-tangerine',
  // Metric-matched fallback while the face loads. next/font/google
  // derived this per family; with local files it must be stated.
  adjustFontFallback: 'Times New Roman',
});

const luxuriousScript = localFont({
  src: [
    { path: './_fonts/luxurious-script/luxurious-script-400.woff2', weight: '400', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-luxurious',
  // Metric-matched fallback while the face loads. next/font/google
  // derived this per family; with local files it must be stated.
  adjustFontFallback: 'Times New Roman',
});

const vidaloka = localFont({
  src: [
    { path: './_fonts/vidaloka/vidaloka-400.woff2', weight: '400', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-vidaloka',
  // Metric-matched fallback while the face loads. next/font/google
  // derived this per family; with local files it must be stated.
  adjustFontFallback: 'Times New Roman',
});

// (RETIRED 2026-07-12 · Atelier finalization) The v2.1 marketing quartet —
// Saira Condensed / Geist / Instrument Serif / JetBrains Mono — is no longer
// loaded. Their CSS variables (--font-condensed / --font-sans-marketing /
// --font-serif-marketing / --font-mono-marketing) are still consumed by a
// handful of shipped chrome files, so globals.css now aliases those vars to
// Hanken Grotesk / Space Mono. Removing four families also drops their font
// preloads from the first-paint path site-wide.

// Static metadata baseline. `icons` is intentionally NOT here — it's resolved
// per-request in generateMetadata() below so the admin-controlled brand icon
// (owner 2026-06-10) can override the defaults. Everything else is constant.
const baseMetadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  title: {
    default: "Setnayan · Filipino wedding planning + verified vendors",
    template: '%s · Setnayan',
  },
  description:
    "Set na 'yan. Setnayan is the Philippines-first wedding platform — plan your whole wedding free, book verified Filipino vendors at 0% commission across Metro Manila, Cebu, Davao, Tagaytay, and nationwide, and keep every photo, video, and memory in one place for life. The wedding is where it starts; every celebration after it lives here too.",
  applicationName: 'Setnayan',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'Setnayan',
    statusBarStyle: 'default',
  },
  // OpenGraph + Twitter Card metadata — SEO/GEO Bucket 2 (CLAUDE.md 2026-05-29
  // SEO/GEO Sprint row). Every social share of a Setnayan URL renders this
  // 1200×630 brand card; AI answer engines (ChatGPT, Perplexity, Claude, Gemini)
  // ingest the same surface for grounded site descriptions. The 2026-05-28 13th
  // row GEO sprint shipped the homepage Organization JSON-LD in PR #570 — this
  // edit fixes the layout-level og:image (was /icon-512.svg 512×512 SVG · now
  // /brand/og-card.webp 1200×630 brand card) and the twitter:card type
  // (was 'summary' · now 'summary_large_image' which is the correct value for
  // the 1.91:1 OG ratio · 'summary' renders as a tiny 144×144 thumbnail).
  openGraph: {
    type: 'website',
    siteName: 'Setnayan',
    locale: 'en_PH',
    url: 'https://www.setnayan.com',
    title: "Setnayan · Filipino wedding planning + verified vendors",
    description:
      "Set na 'yan. Plan your whole Filipino wedding free, book verified vendors at 0% commission, and keep every photo and memory in one place for life — the wedding is just where it starts.",
    images: [
      {
        url: '/brand/og-card.webp',
        width: 1200,
        height: 630,
        alt: "Setnayan · Set na 'yan. · Filipino wedding planning · verified vendors · 0% commission",
        type: 'image/webp',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Setnayan · Filipino wedding planning + verified vendors",
    description:
      "Set na 'yan. Plan your whole Filipino wedding free, book verified vendors at 0% commission, and keep every photo and memory in one place for life — the wedding is just where it starts.",
    images: ['/brand/og-card.webp'],
  },
  // Robots-meta default to index,follow (we're shipping public marketing).
  // The auth-gated dashboard routes opt out of this default at their own layer.
  // Pre-launch (until 2026-12-01 public launch), this still applies — the pilot
  // 2026-06-01 cohort is link-shared not indexed-discoverable so SEO is harmless.
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  // Search-engine ownership via meta tag (owner action: paste the tokens into
  // the Vercel env vars, no redeploy-of-code needed). Google Search Console →
  // NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION; Bing Webmaster → NEXT_PUBLIC_BING_
  // SITE_VERIFICATION. When unset, Next emits nothing (no empty meta tag), so
  // this is inert until the owner supplies the strings. Unblocks GSC (Google
  // AI Overviews source) + Bing (Copilot source) property verification.
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    other: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION
      ? { 'msvalidate.01': process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION }
      : {},
  },
};

/**
 * Per-request metadata — spreads the static baseline and resolves the icon
 * links from the admin-controlled brand icon (owner 2026-06-10), falling back
 * to the built-in gold defaults when none is set.
 *
 *   - icon: a `<link rel="icon" href="/favicon.ico?v=N">` (the dynamic route
 *     serves the admin .ico or the gold default — fixes the orange Safari tab)
 *     plus the SVG favicon (admin SVG when uploaded, else the gold glyph).
 *   - apple: the opaque apple-touch tile (admin or gold default).
 *
 * The `?v=<brand_icon_version>` cache-buster forces browsers to re-fetch past
 * their sticky favicon caches whenever the admin changes the icon. The read is
 * cached (lib/brand-settings) so marketing pages stay static-capable.
 */
export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrandSettings();
  const v = brand.version;

  const svgIcon = brand.svgUrl
    ? [{ url: withBrandVersion(brand.svgUrl, v), type: 'image/svg+xml' }]
    : [
        {
          url: withBrandVersion(DEFAULT_ICON_SVG_192, v),
          type: 'image/svg+xml',
          sizes: '192x192',
        },
        {
          url: withBrandVersion(DEFAULT_ICON_SVG_512, v),
          type: 'image/svg+xml',
          sizes: '512x512',
        },
      ];

  // iOS home-screen icon = the filled tile (iOS composites transparency onto
  // black, so apple-touch must be opaque). Admin derives a 180×180 tile; the
  // built-in default is the 512 gold tile.
  const apple = brand.appleTouchUrl
    ? [{ url: withBrandVersion(brand.appleTouchUrl, v), sizes: '180x180' }]
    : [{ url: withBrandVersion(DEFAULT_APPLE_TOUCH, v), sizes: '512x512' }];

  return {
    ...baseMetadata,
    icons: {
      // Browser-tab favicon — the dynamic /favicon.ico route serves the .ico.
      // `sizes: 'any'` flags the multi-size container so SVG-capable browsers
      // still prefer the crisp SVG entry that follows.
      icon: [{ url: withBrandVersion('/favicon.ico', v), sizes: 'any' }, ...svgIcon],
      apple,
    },
  };
}

// Organization JSON-LD for the global brand entity — read by Google Knowledge
// Graph + AI answer engines for entity grounding. The homepage Organization
// node in page.tsx (PR #570 2026-05-28 13th row) is richer (includes
// SoftwareApplication + Offers); this layout-level block ensures EVERY
// public page emits the basic Organization entity so brand-name queries
// like "Setnayan" surface a Knowledge Panel as the platform matures.
//
// sameAs[] carries the Facebook Page (owner-confirmed live 2026-07-10). A
// LinkedIn Company Page does not exist yet — append its URL below when created.
const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': 'https://www.setnayan.com/#organization',
  name: 'Setnayan',
  alternateName: ["Set na 'yan.", 'SET-na-yan'],
  url: 'https://www.setnayan.com',
  logo: {
    '@type': 'ImageObject',
    url: 'https://www.setnayan.com/icon-512.svg',
    width: 512,
    height: 512,
  },
  image: 'https://www.setnayan.com/brand/og-card.webp',
  description:
    "Setnayan (SET-na-yan, from Tagalog \"Set na 'yan.\" — \"that's all set\") is the Philippines-first wedding platform, built to grow into a life-events collection — one place to plan each celebration, capture it, and keep it for life. Couples plan their wedding free — guest list, RSVP, seating, budget, and a personal event website — then add optional paid upgrades that set the day apart: Papic (guests' phones become a coordinated photo-and-video crew, with QR-tagged galleries and personal highlight reels — free to start on every event, with paid top-ups for more shots), Live Studio livestream on the event page, the Setnayan AI planner, a custom Pakanta wedding song, and an Animated Monogram — each priced individually in PHP. Everything a couple creates gathers into one living memory (Alaala) they keep, and the wedding becomes its own recurring anniversary — so a one-time wedding grows into the home for every celebration that follows. 0% commission on vendor bookings; verified Filipino wedding suppliers across Metro Manila, Cebu, Davao, Tagaytay, and nationwide.",
  foundingDate: '2026',
  knowsLanguage: ['en', 'tl', 'ceb'],
  areaServed: {
    '@type': 'Country',
    name: 'Philippines',
  },
  address: {
    '@type': 'PostalAddress',
    addressCountry: 'PH',
  },
  contactPoint: [
    {
      '@type': 'ContactPoint',
      contactType: 'data protection officer',
      email: 'iscasasolaii@gmail.com',
      areaServed: 'PH',
      availableLanguage: ['en', 'tl'],
    },
    {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      url: 'https://www.setnayan.com/help',
      areaServed: 'PH',
      availableLanguage: ['en', 'tl'],
    },
  ],
  // sameAs[] — verified brand profiles that ground the Setnayan entity in the
  // knowledge graph (Google/Bing + AI answer engines cross-reference these).
  // The list moved to lib/seo/org-same-as.ts so the SEO audit reads THE SAME
  // source it ships from: it used to check an env var nothing consumed, and so
  // reported "empty — create FB Page" every day while the Page was already live
  // and already emitted right here. Append new profiles in that module.
  sameAs: orgSameAs(),
};

// Light-locked 2026-06-04 (owner: "just always keep it light theme"). One
// theme-color matching the always-light app surface — Warm Alabaster #FBFBFA
// (== `--m-paper` / `bg-cream`, and now == the PWA manifest) so iOS Safari +
// Android Chrome tint the URL bar to the page with no seam. No
// `prefers-color-scheme: dark` variant, so a device in OS dark mode no longer
// gets a dark chrome that mismatches the light page.
// PWA-1 (2026-06-21): was #FFFFFF (pure white) while the manifest was #FAF7F2
// and the painted surface is #FBFBFA — three near-whites reconciled to one.
// Native-app feel (owner directive 2026-06-15: "disable zoom on the whole app
// except the seat-plan touch/drag area") is implemented WITHOUT touching this
// meta. `maximumScale: 1` / `userScalable: false` here would fail the
// Lighthouse `meta-viewport` accessibility audit (weight 10 → every page drops
// below the CI ≥0.9 gate — the exact red check on PR #1472), and iOS ignores
// it for the deliberate pinch anyway. Instead:
//   - Android/Chromium pinch  → `touch-action: pan-x pan-y` on html (globals.css)
//   - iOS pinch               → <ZoomGuard/> prevents WebKit gesturestart
//   - iOS input focus-zoom    → 16px input floor (globals.css, !important)
// The seat-plan editor canvas keeps its own gestures via [data-allow-zoom].
// ⚠ Trades away WCAG 1.4.4 browser pinch-zoom by owner decision; OS-level zoom
// (iOS/Android Accessibility → Zoom) remains as the user fallback.
export const viewport: Viewport = {
  themeColor: '#FBFBFA',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

function getOrigin(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Preconnect to backend origins the marketing + dashboard surfaces will
  // hit within the first second — saves the cold DNS+TCP+TLS roundtrip on
  // the first auth check, first analytics event, and first signed-URL fetch.
  const supabaseOrigin = getOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const posthogOrigin = getOrigin(process.env.NEXT_PUBLIC_POSTHOG_HOST);
  const r2Origin = getOrigin(process.env.R2_PUBLIC_URL);

  // Two independent cached reads that gate EVERY page's render — resolve them
  // concurrently so a cold cache / post-revalidate request doesn't pay two
  // serial Singapore round-trips in the global layout. (Perf sweep 2026-07-02,
  // findings #15/#30.)
  //   • brand mark for the in-app <Logo>/<LogoMark> (owner 2026-06-10; deduped
  //     with generateMetadata's call, null → built-in gold default).
  //   • nav/icon/menu-registry slot map for the public marketing nav (label-only;
  //     SiteChrome overlays public.site-nav.* labels; fails open to code defaults).
  //   • loader appearance (owner 2026-07-05; variant/veil/cadence/pop, threaded
  //     to every <SDLoader> via LoaderConfigProvider; DEFAULT on any DB error).
  const [brandSettings, navSlots, loaderConfig] = await Promise.all([
    getBrandSettings(),
    getNavSlotMap(),
    getLoaderSettings(),
  ]);
  const brandMarkUrl = resolveBrandMarkUrl(brandSettings);

  return (
    <html
      lang="en-PH"
      data-loader-variant={loaderConfig.variant}
      style={{ '--sd-veil': `${loaderConfig.veilOpacity}%` } as React.CSSProperties}
      className={`${cormorant.variable} ${fraunces.variable} ${manrope.variable} ${dmMono.variable} ${hanken.variable} ${spaceMono.variable} ${cinzel.variable} ${playfairDisplay.variable} ${greatVibes.variable} ${libreCaslon.variable} ${tangerine.variable} ${luxuriousScript.variable} ${vidaloka.variable}`}
    >
      <head>
        {/*
          FOUC-safe theme bootstrap — light-locked 2026-06-04. Runs
          synchronously before first paint and strips any stale `.dark` class
          from <html> (e.g. a cached shell from before the light lock) so the
          app always paints light. See _components/theme-provider.tsx.
        */}
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        {/*
          App cold-start splash gate — sets data-sn-boot before first paint on
          the first app-route / native-shell load of a session. See
          bootSplashScript above + #sn-init-splash in globals.css.
        */}
        <script dangerouslySetInnerHTML={{ __html: bootSplashScript }} />
        {/*
          Organization JSON-LD — Google Knowledge Graph + AI answer engine
          entity grounding. Renders on every public page. Page-specific JSON-LD
          (SoftwareApplication on homepage, LocalBusiness on /v/[slug], etc.)
          composes on top of this baseline entity via @id reference
          https://www.setnayan.com/#organization. See metadata block above.
        */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        {supabaseOrigin ? (
          <>
            <link rel="preconnect" href={supabaseOrigin} crossOrigin="anonymous" />
            <link rel="dns-prefetch" href={supabaseOrigin} />
          </>
        ) : null}
        {posthogOrigin ? (
          <>
            {/* PostHog is consent-gated and never loads until the visitor
                accepts analytics cookies, so a speculative preconnect (DNS+TCP+
                TLS) just burns one of the browser's limited early connections
                for a request most first-time visitors never make. Keep only the
                cheap dns-prefetch; the provider opens the real connection after
                consent. (Perf sweep 2026-07-02, finding #32.) */}
            <link rel="dns-prefetch" href={posthogOrigin} />
          </>
        ) : null}
        {r2Origin ? (
          <>
            <link rel="preconnect" href={r2Origin} crossOrigin="anonymous" />
            <link rel="dns-prefetch" href={r2Origin} />
          </>
        ) : null}
      </head>
      <body className="min-h-dvh bg-cream font-sans text-ink antialiased">
        {/*
          App cold-start ("initialization") splash — the animated brand mark on
          Warm Alabaster, shown only when the head gate set data-sn-boot (first
          app-route / native-shell load of a session). Server-rendered so it
          paints in the first frame (and in the native WebView's first paint);
          AppInitSplash fades it after hydration, CSS failsafe backs it up.
          Hidden (display:none) on every other surface — zero marketing impact.
        */}
        <div id="sn-init-splash" aria-hidden="true">
          {/* data-loader-variant mirrors the admin choice so the boot splash
              matches the in-app loader; the aurora + pulse decorative layers are
              CSS-toggled by variant (hidden for `gather`). Owner 2026-07-05. */}
          <div className="sd-loader" data-theme="light" data-loader-variant={loaderConfig.variant}>
            <div className="sd-stage">
              <div className="sd-scene">
                <div className="sd-core">
                  <div className="sd-glow" />
                  <div className="sd-aurora" />
                  <div className="sd-pulse">
                    <i />
                    <i />
                    <i />
                  </div>
                  <div
                    className="sd-lg"
                    style={{ backgroundImage: "url('/brand/setnayan-mark.svg')" }}
                  />
                  <div className="sd-orbit sd-orbit-a" />
                  <div className="sd-orbit sd-orbit-b" />
                </div>
              </div>
            </div>
          </div>
        </div>
        <AppInitSplash />
        {/* Native-app zoom suppression (pinch-zoom off app-wide; seat-plan
            canvas opts back in via [data-allow-zoom]). See _components/zoom-guard.tsx. */}
        <ZoomGuard />
        {/* Global top loading bar — the future-proof catch-all that shows a
            loading indicator on EVERY route navigation (incl. routes without
            their own loading.tsx, and any added later). Pure client → no
            static-generation impact. See _components/nav-progress.tsx. */}
        <NavProgress />
        {/* Mobile bottom-nav carousel page-slide (NAV · 2026-06-21). Global
            client interceptor; drives a directional View Transition on top-level
            tab taps. No-op on desktop / reduced-motion / unsupported browsers,
            and never touches the locked BottomNav. See nav-slide-controller.tsx. */}
        <NavSlideController />
        {/*
          DemoModeBanner is admin-only and now a CLIENT component: it reads a
          non-httpOnly presence-hint cookie and, only when present, fetches the
          authoritative /api/demo-mode/status (which does the httpOnly-cookie +
          admin check server-side). This keeps cookies() OUT of the root layout's
          SSR path so the marketing pages can be edge-cached/ISR'd. Normal
          visitors make no request and see nothing. (Perf sweep 2026-07-02.)
        */}
        <DemoModeBanner />
        {/* SiteChrome = the ONE persistent marketing top nav, mounted once
            here so it survives page navigations (the body swaps, the nav
            stays). It self-gates to public marketing routes and renders null
            everywhere else (dashboards/admin/auth own their chrome). Sits
            inside <Providers> so it shares the same theme/brand context the
            per-page navs had. Owner 2026-06-15 "one top nav for the whole
            website". */}
        <Providers brandMarkUrl={brandMarkUrl} loaderConfig={loaderConfig}>
          {/* SignInHereProvider = THE ONE sign-in panel, mounted once here so
              every public surface can open it over itself instead of
              navigating away (Redesign Session 6, "the seam"). It renders
              NOTHING until somebody presses Sign in, and — because the panel
              is a `dynamic()` import — DOWNLOADS nothing either, so a visitor
              who never signs in pays nothing for it. (Rendering nothing and
              costing nothing are different claims; only the second one needed
              a code change to be true.)
              Mounted at the root rather than per-page because the surfaces
              that need it do not share an ancestor: the front door at '/',
              the marketing nav, and the shop pages under '/[slug]' are three
              different trees. */}
          <SignInHereProvider>
            <SiteChrome navSlots={navSlots} />
            {children}
          {/* SiteFooterChrome = the ONE persistent reskin footer, mounted
              AFTER {children} so it sits at the end of every marketing page in
              normal flow, gated by the same route predicate as SiteChrome.
              Because it survives navigations it also powers the pinned-footer
              interaction: a footer link keeps the footer riding along as a
              bottom sheet until a top-nav press slides it away (owner
              2026-07-03). */}
            <SiteFooterChrome />
          </SignInHereProvider>
        </Providers>
        <ClientTypeDetector />
        <NativeBridge />
        {/* Site-wide cookie-consent banner (RA 10173). Mounted unconditionally;
            it SELF-GATES on pathname (same idiom as SiteChrome), suppressing
            itself only on the two Live Studio surfaces where it would be
            broadcast or cover the on-air controls — see
            _components/capture-safe-routes.ts. Every other route, including
            '/', still gets the ask. (The old note here claimed a '/' self-hide
            for a bespoke HomeReskin pill; no such pill exists — the only consent
            UI in the tree is this banner plus the "Cookie settings" re-open
            links, which all share state via lib/cookie-consent.) */}
        <CookieConsentBanner />
        {/*
          V2 Cutover Phase G — offline daemon mount (IndexedDB + SW for
          7 media services). Default OFF for pilot per CLAUDE.md
          2026-05-28 third row so the 5-20 family cohort doesn't get
          surprised by a second SW or Background Sync permission prompt.
          Flip NEXT_PUBLIC_OFFLINE_DAEMON_ENABLED='true' in env to enable.
        */}
        {envFlagEnabled(process.env.NEXT_PUBLIC_OFFLINE_DAEMON_ENABLED) ? (
          <OfflineDaemonMount />
        ) : null}
        <Script id="sw-register" strategy="afterInteractive">
          {`if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js').catch(function() {});
              });
            }`}
        </Script>
      </body>
    </html>
  );
}
