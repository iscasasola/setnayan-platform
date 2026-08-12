'use client';

import { ArrowUpRight } from 'lucide-react';
import { analyticsAllowed } from '@/lib/cookie-consent';

// The outbound shopping link inside a Journal article (iteration 0038 § 3).
//
// 🔒 THE `rel` CARRIES FOUR TOKENS, ALL LOAD-BEARING:
//   sponsored  Google's required marking for a commercial link. WITHOUT IT the
//              whole DOMAIN risks a link-scheme penalty — all 81 Journal
//              articles, i.e. exactly the organic traffic the affiliate money
//              depends on. This is the single most expensive thing on the page
//              to get wrong, and nothing in the app would ever tell us.
//   nofollow   belt-and-braces for crawlers that predate `sponsored`.
//   noopener   the merchant tab must not get a handle on ours.
//   noreferrer keeps our reader's article path out of the merchant's logs.
// Asserted by lib/journal-affiliate-links.test.ts — do not thin this list.
//
// 🔑 WHY THIS IS A CLIENT COMPONENT AT ALL: only to count the click. The href,
// the rel and the target are plain HTML that work with JavaScript off, because
// an affiliate link that only functions after hydration earns nothing from the
// reader who taps it early. The counter is the optional half, never the link.
//
// ⚠ TWO THINGS THIS DELIBERATELY DOES NOT DO, both learned from the existing
// PostHog provider rather than invented here:
//
//   1. IT DOES NOT STATICALLY IMPORT `posthog-js`. The SDK is ~60 kB gzipped
//      and the provider lazy-loads it into its own async chunk on purpose. A
//      static import here would drop 60 kB into the ARTICLE bundle — on the one
//      page in the product whose entire job is to rank and load fast. Loading
//      it inside onClick costs the page nothing: by then the reader is leaving.
//
//   2. IT DOES NOT FIRE WITHOUT CONSENT. `analyticsAllowed()` is the same gate
//      the provider uses under RA 10173. Counting a click from a reader who
//      declined analytics would be third-party tracking we tell the public on
//      /privacy that we do not do — on the very feature where that promise is
//      what keeps affiliate links clear of the display-ad problem.
//
// Net effect: no tracking happens on our side. The merchant attributes the sale
// after the click, which is what an affiliate link has always been.

type Props = {
  href: string;
  label: string;
  merchant: string;
  /** Article slug — so we can see WHICH guide actually earns. */
  slug: string;
};

export function ShopLink({ href, label, merchant, slug }: Props) {
  return (
    <a
      href={href}
      target="_blank"
      rel="sponsored nofollow noopener noreferrer"
      onClick={() => {
        // Fire-and-forget, never awaited, never blocking the navigation.
        if (!analyticsAllowed()) return;
        void import('posthog-js')
          .then((mod) => {
            const ph = mod.default ?? mod;
            ph?.capture?.('journal_affiliate_click', {
              article_slug: slug,
              merchant,
            });
          })
          .catch(() => {
            /* the link is the product; the metric is not */
          });
      }}
      className="mt-4 inline-flex items-center gap-2 rounded-full bg-mulberry px-5 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-600"
    >
      {label}
      <ArrowUpRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
    </a>
  );
}
