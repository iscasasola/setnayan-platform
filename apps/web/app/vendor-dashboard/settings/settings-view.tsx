import { Bell, CircleHelp, Gem, Repeat, Store, UserRound, Users, Wallet, Wrench } from 'lucide-react';
import type { PayoutReadiness } from '@/lib/deposit-pay-step';
import { PAYMENT_OPTIONS_HREF } from '../_components/payout-method-nudge';
import { planWord } from '@/lib/vendor-plan-change-words';
import { formatCount } from '@/lib/format-number';
import { Fold } from '@/app/_components/fold';
import { Badge } from '@/app/_components/badge';
import { DatesRow } from '../customers/_components/dates-row';
import { PushToggle } from '../notifications/push-toggle';
import { SETTINGS_HELP_HREF } from './settings-rows';
import type { ShopToolShelf } from '../shop/shop-tool-shelves';

/**
 * SETTINGS — the screen (simpler supplier dashboard step 6; prototype SCREENS.settings). Presentational: every value
 * arrives read, every row opens a page that already exists. The page and `/dev/supplier-plan-lab` both mount it.
 *
 * ⛔ NO SIGN OUT HERE, although the prototype draws one. Owner 2026-08-13: *"sign out lives under the avatar and
 * nowhere else"* — held by `app/_components/auth/seam-invariants.test.ts`. The avatar sheet carries it.
 */
export function SettingsView({
  unread,
  manager,
  storeShell,
  tier,
  payout,
  helpers,
  tools,
}: {
  unread: number;
  /** Owner or admin — a scoped team member sees Account · Notifications · Help · Your events only. */
  manager: boolean;
  storeShell: boolean;
  tier: string | null;
  payout: PayoutReadiness;
  /** People on the team beyond the founder; null = not read. */
  helpers: number | null;
  tools: readonly ShopToolShelf[];
}) {
  const toolCount = tools.reduce((n, g) => n + g.tools.length, 0);
  const ic = (Icon: typeof Bell) => <Icon aria-hidden className="h-[18px] w-[18px] flex-none text-ink/55" strokeWidth={1.75} />;

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10" data-settings-screen="">
      <h1 className="sn-h1">Settings</h1>
      <div className="mt-3" data-settings-rows="">
        <DatesRow data="settings-account" lead={ic(UserRound)} title="Account" line="Your name · email · password" href="/dashboard/profile" />

        <div className="border-t border-ink/10" data-settings-fold="notifications">
          <Fold
            title="Notifications"
            line={unread > 0 ? `${formatCount(unread)} new` : 'Nothing new'}
            lead={<span className="mr-1 flex">{ic(Bell)}</span>}
            aside={unread > 0 ? <Badge tone="no" data="settings-unread">{formatCount(unread)}</Badge> : undefined}
            data="settings-notifications"
          >
            <div className="pb-3">
              <div className="py-2" data-settings-push="">
                <PushToggle />
              </div>
              <DatesRow data="settings-email" title="Email" line="We email you when a couple writes, books or pays, and when a fee is due" />
              <DatesRow
                data="settings-recent"
                title="Recent"
                line="Someone else was booked · payments · reviews"
                badge={unread > 0 ? { tone: 'no', word: `${formatCount(unread)} new` } : null}
                href="/vendor-dashboard/notifications"
              />
            </div>
          </Fold>
        </div>

        {manager ? (
          <>
            {/* 🔒 The store shell refuses the Plan page (lib/store-shell.ts) — the row says the plan and goes nowhere. */}
            <DatesRow
              data="settings-plan"
              lead={ic(Gem)}
              title="Plan"
              line={storeShell ? `${planWord(tier)}` : `${planWord(tier)} · what it gives you · receipts`}
              href={storeShell ? null : '/vendor-dashboard/subscription'}
            />
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
              data="settings-helpers"
              lead={ic(Users)}
              title="Helpers"
              line={helpers === null ? 'Who can see your schedule' : helpers === 0 ? 'Just you · one Helper is free' : `${formatCount(helpers)} ${helpers === 1 ? 'person' : 'people'} with you`}
              href="/vendor-dashboard/team"
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
    </div>
  );
}
