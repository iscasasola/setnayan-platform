import Link from 'next/link';
import { Bell, CircleHelp, Repeat, Store, UserRound, Wallet, Wrench } from 'lucide-react';
import type { PayoutReadiness } from '@/lib/deposit-pay-step';
import { PAYMENT_OPTIONS_HREF } from '../_components/payout-method-nudge';
import { formatCount } from '@/lib/format-number';
import { Fold } from '@/app/_components/fold';
import { DatesRow } from '../customers/_components/dates-row';
import { SETTINGS_HELP_HREF } from './settings-rows';
import { POLICY_LINKS } from '@/lib/policy-links';
import type { ShopToolShelf } from '../shop/shop-tool-shelves';

/**
 * SETTINGS — the screen (simpler supplier dashboard step 6; prototype SCREENS.settings). Presentational: every value
 * arrives read, every row opens a page that already exists. The page and `/dev/supplier-plan-lab` both mount it.
 *
 * ⛔ NO SIGN OUT HERE, although the prototype draws one. Owner 2026-08-13: *"sign out lives under the avatar and
 * nowhere else"* — held by `app/_components/auth/seam-invariants.test.ts`. The avatar sheet carries it.
 *
 * 📜 THE POLICIES, AS SMALL PRINT UNDER THE LIST (sweep 2026-10-19, row A2 — App Store 5.1.1(i)). The same four links,
 * in the same order and words, as the ☰ drawer's small print, read from the one list in `lib/policy-links.ts`. Plain
 * links, no frame: the drawer draws them as text, and so does this. Outside the `manager` gate on purpose — a scoped
 * team member is a signed-in person too. Account deletion is the Account row (`/dashboard/profile` › Delete my
 * account). Held by `lib/every-signed-in-menu-reaches-the-policies.test.ts`.
 */
export function SettingsView({
  unread,
  manager,
  payout,
  tools,
}: {
  unread: number;
  /** Owner or admin — a scoped team member sees Account · Notifications · Help · Your events only. */
  manager: boolean;
  payout: PayoutReadiness;
  tools: readonly ShopToolShelf[];
}) {
  const toolCount = tools.reduce((n, g) => n + g.tools.length, 0);
  const ic = (Icon: typeof Bell) => <Icon aria-hidden className="h-[18px] w-[18px] flex-none text-ink/55" strokeWidth={1.75} />;

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10" data-settings-screen="">
      <h1 className="sn-h1">Settings</h1>
      <div className="mt-3" data-settings-rows="">
        <DatesRow data="settings-account" lead={ic(UserRound)} title="Account" line="Profile · password · delete account" href="/dashboard/profile" />

        {/* 🏪 The push switch and the email line MOVED to the Shop ⚙ › Notifications, and Plan and Helpers to its Plan and
            billing and Team (owner 2026-10-31, "Yes follow your recommendation" — DECISION_LOG "SHOP ⚙ — WHAT A SUPPLIER
            SETS ONCE"). The inbox stays here: it is what you were told, not a setting. */}
        <DatesRow
          data="settings-recent"
          lead={ic(Bell)}
          title="Notifications"
          line={unread > 0 ? `${formatCount(unread)} new · someone else was booked · payments · reviews` : 'Someone else was booked · payments · reviews'}
          badge={unread > 0 ? { tone: 'no', word: `${formatCount(unread)} new` } : null}
          href="/vendor-dashboard/notifications"
        />

        {manager ? (
          <>
            <DatesRow
              data="settings-getting-paid"
              lead={ic(Wallet)}
              title="Getting paid"
              line={
                payout === 'ready'
                  ? 'Couples can see how to pay you'
                  : payout === 'in_review'
                    ? 'Waiting for Setnayan’s review'
                    : payout === 'none'
                      ? 'Not set up yet — couples can’t see how to pay you'
                      : 'Bank · GCash · QR'
              }
              badge={payout === 'none' ? { tone: 'wait', word: 'Set up' } : payout === 'in_review' ? { tone: 'quiet', word: 'Checking' } : null}
              href={PAYMENT_OPTIONS_HREF}
            />
            <DatesRow
              data="settings-details"
              lead={ic(Store)}
              title="Details · page · collections"
              line="What couples read about you, and your photos"
              href="/vendor-dashboard/shop"
            />

            <div className="border-t border-ink/10" data-settings-fold="more-tools" id="more-tools">
              <Fold title="More tools" line={`${formatCount(toolCount)} · what couples see · with others · protection`} lead={<span className="mr-1 flex">{ic(Wrench)}</span>} data="settings-more-tools">
                <div className="pb-3">
                  {tools.map((g) => (
                    <div key={g.key} data-settings-tools={g.key}>
                      <p className="home-k2 pt-3">{g.label}</p>
                      {g.tools.map((t) => (
                        <DatesRow key={t.href} data="settings-tool" title={t.label} line={t.sub} href={t.href} />
                      ))}
                    </div>
                  ))}
                </div>
              </Fold>
            </div>
          </>
        ) : null}

        <DatesRow data="settings-help" lead={ic(CircleHelp)} title="Help" line="How fees work · how booking works · report a problem" href={SETTINGS_HELP_HREF} />
        <DatesRow data="settings-switch" lead={ic(Repeat)} title="Your events" line="Switch to Home — the events you plan yourself · another shop from the account menu" href="/dashboard?hub=1" />
      </div>
      <div className="mt-4 border-t border-ink/10 pt-1">
        <nav aria-label="Policies" className="-mx-1.5 flex flex-wrap gap-x-1 text-[13px] text-ink/55" data-settings-policies="">
          {POLICY_LINKS.map((p) => (
            <Link key={p.href} href={p.href} className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center px-1.5 hover:text-ink hover:underline">
              {p.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
