import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

// Browse strip — surfaces the /vendors marketplace as a discoverable entry
// point alongside the pre-launch funnel hero. Per CLAUDE.md decision-log row
// 426 (2026-05-19, "Both, with a toggle/banner"): pre-launch homepage keeps
// the vendor-pre-reg + couple-waitlist hero as the primary funnel; the browse
// strip sits just under the header so visitors who don't want to sign up yet
// still have a clear path into shipped content.
//
// Mobile + desktop both render the strip — on mobile it's a full-width
// pinned bar under the header; on desktop it stays a single line with a
// trailing arrow. The header's primary nav also exposes "Browse" at md+, so
// desktop visitors have two paths in (this strip + the nav link).
//
// Static, server-rendered. No client state.

export function BrowseStrip() {
  return (
    <div className="border-b border-ink/5 bg-cream">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6 lg:px-8">
        <p className="text-sm text-ink/70">
          <span className="hidden sm:inline">Looking around? </span>
          <span className="sm:hidden">Just browsing? </span>
          <Link
            href="/vendors"
            className="font-medium text-ink underline-offset-4 hover:underline"
          >
            Browse Filipino wedding vendors
            <ArrowRight aria-hidden className="ml-1 inline-block h-3.5 w-3.5" strokeWidth={2} />
          </Link>
        </p>
        <Link
          href="/weddings"
          className="hidden text-sm text-ink/55 underline-offset-4 hover:text-ink hover:underline sm:inline"
        >
          Real weddings
        </Link>
      </div>
    </div>
  );
}
