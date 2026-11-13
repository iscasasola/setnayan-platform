/**
 * /dev/account-lab — Profile & settings in the REAL account chrome, on fixtures: no sign-in, no database.
 * DEV-ONLY: production builds 404 it (`app/dev/layout.tsx`, and the line below).
 *
 * Built for lane 6 of the tablet/desktop plan (D5 "Account/launcher onto the 701 line", owner-approved
 * 2026-11-13), so the account tree can be walked at 390 / 768 / 1280 without an account. It draws what
 * `dashboard/(account)/layout.tsx` draws — the shipped `FrontDoorShell` (app variant), the account bar
 * (`AccountBarSlot`), the settings rows in the rail (`SettingsRailContext`) — around the REAL `SettingsShell`
 * in the profile page's own column. Only the six panes are fixtures (the real ones read the database).
 *
 *   ?b=lg   the line the account tree shipped with before D5 (1024) — no settings rows in the rail
 *   ?b=tab  the D5 line (701) — what the account layout hands its shell and its bar now (default)
 *   &tab=…  open a group, as the real page's `?tab=` does
 */
import { notFound } from 'next/navigation';
import '@/app/_components/frontdoor/front-door.css';
import { FrontDoorShell } from '@/app/_components/frontdoor/front-door-shell';
import { AccountBarSlot } from '@/app/dashboard/(launcher)/_components/account-bar-slot';
import { SettingsShell } from '@/app/dashboard/(account)/profile/_components/settings-shell';
import { SettingsRailContext } from '@/app/dashboard/(account)/_components/settings-rail-context';
import { PageMasthead } from '@/app/_components/page-masthead';
import { SETTINGS_GROUPS, SETTINGS_GROUP_META, isSettingsGroup, type SettingsGroup } from '@/lib/profile-settings-groups';

export const dynamic = 'force-dynamic';

const AT = '/dev/account-lab';

function FixturePane({ id }: { id: SettingsGroup }) {
  const meta = SETTINGS_GROUP_META[id];
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/60">Settings</p>
        <h2 className="mt-1 font-display text-3xl font-semibold text-ink">{meta.label}</h2>
        <p className="mt-2 max-w-xl text-sm text-ink/70">{meta.hint}</p>
      </div>
      <div className="sn-tile space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          {['First field', 'Second field', 'Third field', 'Fourth field'].map((l) => (
            <div key={l} className="space-y-1">
              <label className="block text-sm font-medium text-ink">{l}</label>
              <input /* field-ok: a fixture stand-in for a pane the lab cannot read */ className="input-field" defaultValue="" placeholder={l} />
            </div>
          ))}
        </div>
        <div className="border-t border-ink/10 pt-5">
          <button type="button" className="button-primary">Save</button>
        </div>
      </div>
    </div>
  );
}

export default async function AccountLab({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const boundary = sp.b === 'lg' ? 'lg' : 'tab';
  const tab = sp.tab;
  const panes = Object.fromEntries(SETTINGS_GROUPS.map((g) => [g, <FixturePane key={g} id={g} />])) as Record<
    SettingsGroup,
    React.ReactNode
  >;
  return (
    <div className="sn-ambient min-h-dvh" data-account-lab={boundary}>
      <FrontDoorShell
        variant="app"
        boundary={boundary}
        account={{ signedIn: true, initials: 'AM', shopName: null, isAdmin: false }}
        navLabels={{}}
        topBarSlot={
          <span className="grid h-11 w-11 place-items-center rounded-full sn-initials text-xs font-semibold">AM</span>
        }
        railContext={boundary === 'tab' ? <SettingsRailContext at={AT} /> : undefined}
      >
        <main className="sn-vt-page pb-[max(calc(var(--sn-bottomdock-h,calc(env(safe-area-inset-bottom)+64px))+1.5rem),var(--sn-thumb-room,0px))]">
          <div
            className={
              boundary === 'tab'
                ? 'mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 tab:max-w-3xl lg:px-8'
                : 'mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8'
            }
          >
            <PageMasthead title="Profile &amp; settings" />
            <SettingsShell
              initialGroup={isSettingsGroup(tab) ? tab : null}
              fromTab={isSettingsGroup(tab)}
              flash={null}
              identity={{ displayName: 'Ana Morales', tag: '@ana', fullName: 'Ana Reyes Morales', avatarUrl: null, initials: 'AM' }}
              accountId="S89U-7K2M9QX4PZ"
              indexExtras={null}
              showDeleteRow
              panes={panes}
            />
          </div>
        </main>
        <AccountBarSlot tabs={['home', 'discover']} boundary={boundary} />
      </FrontDoorShell>
    </div>
  );
}
