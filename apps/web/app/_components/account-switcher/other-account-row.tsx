import { ChevronRight } from 'lucide-react';
import { realNameOrNull } from '@/lib/no-name';
import type { ParkedAccount } from '@/lib/account-jars';

/**
 * 🔁 ONE ROW FOR "ANOTHER ACCOUNT ON THIS PHONE": the avatar sheet's Switch-to card and `/login` draw THIS, never a
 * second copy (Batch 0 · L5, walk 27 Nov 12a: "Add another account" parked the session and `/login` then offered no
 * way back). The row posts the account's id to the switch route (`app/auth/accounts/switch/route.ts`), which
 * refreshes that account's jar, checks it IS that account and swaps the session; no password, no server action.
 *
 * `next` (already `safeNext`-checked by the page) is where the switch lands; without it the route's own Home.
 * Pure markup: a server page and the client sheet both mount it.
 */
export function OtherAccountRow({ acct, next, className }: { acct: ParkedAccount; next?: string | null; className: string }) {
  const name = realNameOrNull(acct.name) ?? acct.email;
  return (
    <form action="/auth/accounts/switch" method="post" data-sheet-place="account" data-sheet-account={acct.uid}>
      <input type="hidden" name="uid" value={acct.uid} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <button type="submit" className={className}>
        <span
          aria-hidden
          className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--m-ivory)] text-sn-lg font-bold text-ink"
        >
          {name.charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block [overflow-wrap:anywhere] text-base font-semibold leading-tight text-ink">{name}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sn-md text-[var(--m-slate-2)]">
            <span
              aria-hidden
              className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-[var(--m-line)] text-sn-3xs font-semibold text-ink"
            >
              @
            </span>
            <span className="[overflow-wrap:anywhere]">{acct.email}</span>
          </span>
        </span>
        <span className="shrink-0 rounded-full bg-[var(--m-ivory)] px-[9px] py-1 font-mono text-sn-2xs uppercase tracking-[0.14em] text-[var(--m-slate-2)]">
          Account
        </span>
        <ChevronRight aria-hidden className="h-[17px] w-[17px] shrink-0 text-[var(--m-slate-3)]" strokeWidth={2} />
      </button>
    </form>
  );
}
