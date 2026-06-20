import type { ReactNode } from 'react';
import Link from 'next/link';
import { SiteFooter } from '@/app/features/_sections/_SiteFooter';

/**
 * Chrome for the public Maria & Jose tour. Reads the sample event per request
 * via the service-role resolver, so it's dynamic. A persistent ribbon makes the
 * "this is a sample, nothing is saved" promise unmissable on every stop.
 */
export const dynamic = 'force-dynamic';

export default function TourLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div
        role="note"
        className="sticky top-0 z-40 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 bg-[#5C2542] px-4 py-2 text-center text-xs font-medium text-[#FBF6EA]"
      >
        <span aria-hidden>●</span>
        <span>
          You&rsquo;re exploring <strong>Maria &amp; Jose</strong> — a sample wedding. Nothing you tap here is saved.
        </span>
        <Link href="/onboarding/wedding?from=tour" className="underline decoration-[#FBF6EA]/40 underline-offset-2 hover:decoration-[#FBF6EA]">
          Start your own, free
        </Link>
      </div>
      {children}
      <SiteFooter />
    </>
  );
}
