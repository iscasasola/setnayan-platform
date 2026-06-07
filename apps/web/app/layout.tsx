import type { Metadata, Viewport } from 'next';
import {
  Cormorant_Garamond,
  Manrope,
  DM_Mono,
  Saira_Condensed,
  Geist,
  Instrument_Serif,
  JetBrains_Mono,
  Cinzel,
  Playfair_Display,
  Great_Vibes,
} from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { Suspense } from 'react';
import { ClientTypeDetector } from './_components/client-type-detector';
import { NativeBridge } from './_components/native-bridge';
import { DemoModeBanner } from './_components/demo-mode-banner';
import { OfflineDaemonMount } from './_components/offline-daemon-mount';
import { PilotModeBanner } from './_components/pilot-mode-banner';
import { NavProgress } from './_components/nav-progress';
import { Providers } from './providers';
import { themeBootstrapScript } from './_components/theme-provider';

// Brand typography — iteration 0015 § Brand. Self-hosted via next/font/google
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
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
  variable: '--font-display',
});

const manrope = Manrope({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
});

const dmMono = DM_Mono({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500'],
  variable: '--font-mono',
});

// Monogram display faces — the couple's onboarding monogram renders in its
// EXACT chosen face in the dashboard chrome (event switcher + profile avatar),
// matching the onboarding medallion. Owner-locked 2026-06-03 ("yes exact font").
const cinzel = Cinzel({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '600'],
  variable: '--font-cinzel',
});

const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '600'],
  style: ['normal', 'italic'],
  variable: '--font-playfair',
});

const greatVibes = Great_Vibes({
  subsets: ['latin'],
  display: 'swap',
  weight: '400',
  variable: '--font-script',
});

// v2.1 marketing typography (Setnayan Vendor Keynote template package · CLAUDE.md
// 2026-05-28 11th row "v2.1 template package adoption"). Loaded alongside the
// existing editorial stack — marketing surfaces opt-in via `var(--font-condensed)`
// / `var(--font-sans-marketing)` / `var(--font-serif-marketing)` / `var(--font-mono-marketing)`
// inline styles or arbitrary Tailwind classes. Dashboard chrome keeps existing
// Cormorant / Manrope / DM Mono so the 200+ shipped components don't churn.
//
//   - Saira Condensed  → display headlines (WWDC keynote register · Setnayan
//     v2 brand mark "SET NA 'YAN" wordmark). Weights 400/600/700/800.
//   - Geist            → marketing body sans (more geometric than Manrope).
//   - Instrument Serif → editorial accent serif (italic supported).
//   - JetBrains Mono   → marketing mono (eyebrows, label chips, /sɛt na jan/
//     phonetic spelling).
const sairaCondensed = Saira_Condensed({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '600', '700', '800'],
  variable: '--font-condensed',
});

const geist = Geist({
  subsets: ['latin'],
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-sans-marketing',
});

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-serif-marketing',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500'],
  variable: '--font-mono-marketing',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  title: {
    default: "Setnayan · Filipino wedding planning + verified vendors",
    template: '%s · Setnayan',
  },
  description:
    "Set na 'yan. Setnayan is the Philippines-first wedding planning platform — free baseline tools for couples, 0% commission on vendor bookings, verified Filipino wedding suppliers across Metro Manila, Cebu, Davao, Tagaytay, and nationwide.",
  applicationName: 'Setnayan',
  manifest: '/manifest.json',
  icons: {
    // Browser-tab favicon = the transparent gold S/Y glyph (sits on the tab bg).
    icon: [
      { url: '/icon-192.svg', type: 'image/svg+xml', sizes: '192x192' },
      { url: '/icon-512.svg', type: 'image/svg+xml', sizes: '512x512' },
    ],
    // iOS home-screen icon = the filled white app-icon tile (owner 2026-05-31).
    // iOS composites transparency onto black, so apple-touch needs the opaque
    // padded PNG, not the transparent glyph. PWA maskable entry lives in
    // manifest.json pointing at the same /brand/setnayan-app-icon-512.png.
    apple: [{ url: '/brand/setnayan-app-icon-512.png', sizes: '512x512' }],
  },
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
      "Set na 'yan. Free baseline planning tools for couples, 0% commission on vendor bookings, verified Filipino wedding suppliers nationwide.",
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
      "Set na 'yan. Free baseline planning tools for couples, 0% commission on vendor bookings, verified Filipino wedding suppliers nationwide.",
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
};

// Organization JSON-LD for the global brand entity — read by Google Knowledge
// Graph + AI answer engines for entity grounding. The homepage Organization
// node in page.tsx (PR #570 2026-05-28 13th row) is richer (includes
// SoftwareApplication + Offers); this layout-level block ensures EVERY
// public page emits the basic Organization entity so brand-name queries
// like "Setnayan" surface a Knowledge Panel as the platform matures.
//
// sameAs[] is intentionally empty — owner-side action pending (Facebook Page
// + LinkedIn Company Page creation per SEO_GEO_SPRINT_2026-05-29.md owner
// actions list). When those URLs arrive, append to this array via a small
// follow-up PR. AI engines tolerate empty sameAs[] gracefully.
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
    "Setnayan (SET-na-yan, from Tagalog \"Set na 'yan.\" — \"that's all set\") is the Philippines-first wedding and life-events software platform. Free baseline planning tools for couples, 0% commission on vendor bookings, verified Filipino wedding suppliers across Metro Manila, Cebu, Davao, Tagaytay, and nationwide.",
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
      email: 'dpo@setnayan.com',
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
  // sameAs[] pending — owner-side Facebook Page + LinkedIn Company Page
  // creation per SEO_GEO_SPRINT_2026-05-29.md. Add URLs here when they exist:
  //   sameAs: [
  //     'https://www.facebook.com/setnayan',
  //     'https://www.linkedin.com/company/setnayan',
  //   ],
};

// Light-locked 2026-06-04 (owner: "just always keep it light theme"). A single
// white theme-color so iOS Safari + Android Chrome tint the URL bar to match the
// always-light app — no `prefers-color-scheme: dark` variant, so a device in OS
// dark mode no longer gets a dark chrome that mismatches the light page.
export const viewport: Viewport = {
  themeColor: '#FFFFFF',
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Preconnect to backend origins the marketing + dashboard surfaces will
  // hit within the first second — saves the cold DNS+TCP+TLS roundtrip on
  // the first auth check, first analytics event, and first signed-URL fetch.
  const supabaseOrigin = getOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const posthogOrigin = getOrigin(process.env.NEXT_PUBLIC_POSTHOG_HOST);
  const r2Origin = getOrigin(process.env.R2_PUBLIC_URL);

  return (
    <html
      lang="en-PH"
      className={`${cormorant.variable} ${manrope.variable} ${dmMono.variable} ${sairaCondensed.variable} ${geist.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} ${cinzel.variable} ${playfairDisplay.variable} ${greatVibes.variable}`}
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
            <link rel="preconnect" href={posthogOrigin} crossOrigin="anonymous" />
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
        {/* Global top loading bar — the future-proof catch-all that shows a
            loading indicator on EVERY route navigation (incl. routes without
            their own loading.tsx, and any added later). Pure client → no
            static-generation impact. See _components/nav-progress.tsx. */}
        <NavProgress />
        <PilotModeBanner />
        {/*
          DemoModeBanner is admin-only (the server component itself
          short-circuits to null for non-admin sessions, even if a stale
          cookie is present). Wrapped in Suspense so anonymous + non-admin
          visitors don't wait on the cookie + auth lookup — the public
          marketing surface stays as fast as before; only admin sessions
          actually hit the banner-render path.
        */}
        <Suspense fallback={null}>
          <DemoModeBanner />
        </Suspense>
        <Providers>{children}</Providers>
        <ClientTypeDetector />
        <NativeBridge />
        {/*
          V2 Cutover Phase G — offline daemon mount (IndexedDB + SW for
          7 media services). Default OFF for pilot per CLAUDE.md
          2026-05-28 third row so the 5-20 family cohort doesn't get
          surprised by a second SW or Background Sync permission prompt.
          Flip NEXT_PUBLIC_OFFLINE_DAEMON_ENABLED='true' in env to enable.
        */}
        {process.env.NEXT_PUBLIC_OFFLINE_DAEMON_ENABLED === 'true' ? (
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
