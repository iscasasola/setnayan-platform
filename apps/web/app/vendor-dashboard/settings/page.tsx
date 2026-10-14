import { redirect } from 'next/navigation';
import { Bell, CircleHelp, Gem, Repeat, Store, UserRound, Users, Wallet, Wrench } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveVendorRole, canManageVendor } from '@/lib/vendor-role';
import { isStoreShellRequest } from '@/lib/request-platform';
import { countUnread } from '@/lib/notifications';
import { readSupplierPayoutReadiness } from '@/lib/vendor-payment-methods.server';
import { PAYMENT_OPTIONS_HREF } from '../_components/payout-method-nudge';
import { planWord } from '@/lib/vendor-plan-change-words';
import { teamSeats } from '@/lib/vendor-free-helper';
import { isMusicToolCategory } from '@/lib/songs';
import { formatCount } from '@/lib/format-number';
import { Fold } from '@/app/_components/fold';
import { Badge } from '@/app/_components/badge';
import { DatesRow } from '../customers/_components/dates-row';
import { PushToggle } from '../notifications/push-toggle';
import { settingsMoreTools, SETTINGS_HELP_HREF } from './settings-rows';

export const metadata = { title: 'Settings · Supplier' };

/**
 * /vendor-dashboard/settings — SETTINGS, one list (simpler supplier dashboard step 6; owner-APPROVED 2026-10-14;
 * prototype SCREENS.settings — reached from More › Settings and the avatar sheet).
 *
 * Every row opens a page that ALREADY exists; this page decides nothing and owns no write:
 *   Account (/dashboard/profile) · Notifications ▾ (the shipped PushToggle · how email reaches you · Recent →
 *   /notifications) · Plan (/subscription, web only) · Getting paid (Shop › How clients pay you) · Helpers (/team) ·
 *   Details · page · collections (Shop) · More tools ▾ (the shop's tool shelves, grant-gated, as rows) · Help ·
 *   Switch shop.
 *
 * ⛔ NO SIGN OUT HERE, although the prototype draws one. Owner 2026-08-13: *"sign out lives under the avatar and
 * nowhere else"* — held by `app/_components/auth/seam-invariants.test.ts`. The avatar sheet (the account menu)
 * carries it, as the prototype's SHEETS.avatar also does. Flagged for the owner in the PR rather than weakening the
 * guard.
 *
 * ⚠ "SETTINGS IS NOT A ROW" (lib/vendor-more-rows.ts, 2026-10-01) WAS TRUE UNTIL THIS PAGE: there was no settings
 * page to open, so a Settings row would have pretended. Now there is one, and More lists it.
 *
 * Reads (each once): role · profile · tier · team roles · payout readiness · unread count · moodboard access. A
 * scoped team member (agent / viewer) sees only the rows that are theirs: Account · Notifications · Help · Switch
 * shop.
 */
export default async function VendorSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [role, profile, storeShell] = await Promise.all([
    resolveVendorRole(supabase, user.id),
    fetchOwnVendorProfile(supabase, user.id),
    isStoreShellRequest(),
  ]);
  const manager = !role || canManageVendor(role);

  const [unread, tierRow, teamRead, payout, moodboard] = await Promise.all([
    countUnread(supabase, user.id),
    manager && profile
      ? supabase.from('vendor_profiles').select('tier_state').eq('vendor_profile_id', profile.vendor_profile_id).maybeSingle()
      : Promise.resolve(null),
    manager && profile
      ? supabase.from('vendor_team_members').select('user_id, role').eq('vendor_profile_id', profile.vendor_profile_id)
      : Promise.resolve(null),
    manager && profile
      ? readSupplierPayoutReadiness({
          adminClient: createAdminClient(),
          vendorProfileId: profile.vendor_profile_id,
          vendorUserId: profile.user_id,
        }).catch(() => 'unreadable' as const)
      : Promise.resolve('unreadable' as const),
    manager
      ? import('@/lib/moodboard-library-access').then((m) => m.resolveMoodboardLibraryAccess(supabase, user.id)).then((a) => a.allowed).catch(() => false)
      : Promise.resolve(false),
  ]);

  const tier = (tierRow?.data as { tier_state?: string | null } | null)?.tier_state ?? null;
  const team = teamRead && !teamRead.error ? ((teamRead.data ?? []) as { user_id: string; role: string }[]) : null;
  const helpers = team && profile ? teamSeats(team, profile.user_id).people : null;
  const tools = settingsMoreTools({
    hasMoodboardLibraryAccess: moodboard,
    hasMusicRepertoireAccess: isMusicToolCategory(profile?.services ?? null),
    storeShell,
  });
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
            lead={ic(Bell)}
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
              <Fold title="More tools" line={`${formatCount(toolCount)} · what couples see · with others · protection`} lead={ic(Wrench)} data="settings-more-tools">
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
        <DatesRow data="settings-switch" lead={ic(Repeat)} title="Switch shop" line="To your own events (Home) · another shop from the account menu" href="/dashboard?hub=1" />
      </div>
    </div>
  );
}
