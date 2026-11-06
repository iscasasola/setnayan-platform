import Link from 'next/link';
import { GUEST_REVIEW_REFUSAL_LINE } from '@/lib/guest-reviews';

/**
 * The guest review page's said states (prototype § 7: "never a silent empty form") — not on the door list, already
 * rated / not booked, and a refused read. Their own file so the dev lab mounts the real ones.
 */
export function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-xl px-4 pb-16 pt-4" data-guest-review-page>{children}</main>;
}


export function NotOnDoorList({ shopName, shopHref }: { shopName: string; shopHref: string }) {
  return (
    <div className="space-y-3" data-guest-review="not-on-door-list">
      <h1 className="text-2xl font-semibold tracking-tight">{GUEST_REVIEW_REFUSAL_LINE.not_at_event}</h1>
      <p className="max-w-prose text-[15px] text-ink/70">
        A guest review is for someone the door checked in. Open this from your own invitation on your phone, or ask the
        welcome table to check you in.
      </p>
      <Link href={shopHref} className="button-secondary inline-flex h-11 items-center">
        Open {shopName}&rsquo;s page
      </Link>
    </div>
  );
}

export function Said({ line, href, cta }: { line: string; href: string; cta: string }) {
  return (
    <div className="sn-glass-bare rounded-xl p-4" data-guest-review="said">
      <p className="text-[15px]">{line}</p>
      <Link href={href} className="button-secondary mt-3.5 inline-flex h-11 w-full items-center justify-center">
        {cta}
      </Link>
    </div>
  );
}

export function CouldNotLoad() {
  return (
    <p role="alert" className="text-[15px] text-ink/70" data-guest-review="unread">
      We couldn&rsquo;t load this just now. Reload to try again.
    </p>
  );
}
