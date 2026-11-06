import { ArrowUpRight } from 'lucide-react';

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
// 🍪 NO CLICK COUNTER (owner 2026-10-22 — essential cookies only). This used
// to lazy-load PostHog on click to count it. Setnayan runs no optional
// analytics now, so the link is plain HTML: it works with JavaScript off, no
// tracking happens on our side, and the merchant attributes the sale after the
// click, which is what an affiliate link has always been.

type Props = {
  href: string;
  label: string;
  merchant: string;
  /** Article slug. */
  slug: string;
};

export function ShopLink({ href, label }: Props) {
  return (
    <a
      href={href}
      target="_blank"
      rel="sponsored nofollow noopener noreferrer"
      className="mt-4 inline-flex items-center gap-2 rounded-full bg-mulberry px-5 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-600"
    >
      {label}
      <ArrowUpRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
    </a>
  );
}
