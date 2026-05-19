import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Manrope, DM_Mono } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { ClientTypeDetector } from './_components/client-type-detector';
import { PilotModeBanner } from './_components/pilot-mode-banner';
import { Providers } from './providers';

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

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  title: {
    default: 'Setnayan',
    template: '%s · Setnayan',
  },
  description:
    "Set na 'yan. Setnayan is the Philippines-first life-events platform. V1 weddings.",
  applicationName: 'Setnayan',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon-192.svg', type: 'image/svg+xml', sizes: '192x192' },
      { url: '/icon-512.svg', type: 'image/svg+xml', sizes: '512x512' },
    ],
    apple: [{ url: '/icon-192.svg', sizes: '192x192' }],
  },
  appleWebApp: {
    capable: true,
    title: 'Setnayan',
    statusBarStyle: 'default',
  },
  openGraph: {
    type: 'website',
    siteName: 'Setnayan',
    locale: 'en_PH',
    images: [{ url: '/icon-512.svg', width: 512, height: 512, alt: 'Setnayan' }],
  },
  twitter: {
    card: 'summary',
    images: ['/icon-512.svg'],
  },
};

export const viewport: Viewport = {
  themeColor: '#FAF7F2',
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
      className={`${cormorant.variable} ${manrope.variable} ${dmMono.variable}`}
    >
      <head>
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
        <PilotModeBanner />
        <Providers>{children}</Providers>
        <ClientTypeDetector />
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
