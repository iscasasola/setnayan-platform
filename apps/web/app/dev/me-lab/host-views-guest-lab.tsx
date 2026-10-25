import { GuestMe } from '@/app/[slug]/_components/guest-me';
import { HeldPassLine } from '@/app/[slug]/_components/held-pass-line';
import { guestAccountState, type GuestAccountState } from '@/lib/guest-one-path';

/**
 * 👀 `/dev/me-lab?host=1` — Me on a guest's invitation (owner 2026-10-21, Pam's link on his own wedding), with no
 * database, through the guest page's OWN `GuestMe` and the account state the page builds (`guestAccountState`):
 *
 *   before     the host who pressed "Open as Pam", as `origin/main` computed it — main never asked whether the
 *              viewer is a host (here: `viewerManagesEvent: false`), so the host met "This invitation is for Pam.
 *              Save it to <his email>?";
 *   after      the same host, as the page computes it now — "You're viewing Pam's invitation as the host";
 *   guest      an ordinary signed-in guest on her own link — still asked, unchanged.
 *
 * The presses go nowhere here (the lab is signed out, so no server action can bind anything).
 */
const HOST_EMAIL = 'host@example.com';
const GUEST_EMAIL = 'pam@example.com';

function MeFor({ account, hostOpened }: { account: GuestAccountState; hostOpened: boolean }) {
  return (
    <>
      {hostOpened ? (
        <div className="mb-6">
          <HeldPassLine slug="maria-and-jose-lab" firstName="Pam" mode="host_preview" />
        </div>
      ) : null}
      <GuestMe
        name="Pam"
        slug="maria-and-jose-lab"
        eventId="00000000-0000-4000-8000-0000000000e1"
        guestId="00000000-0000-4000-8000-00000000a001"
        askMeal={false}
        askDietary={false}
        askPlusOnes={false}
        eventName="Maria & Jose"
        guests={[{ guestId: '00000000-0000-4000-8000-00000000a009', name: 'Rico Santos', inviteUrl: '/dev/me-lab' }]}
        account={account}
        personalLink="/dev/me-lab"
        userAgent={null}
        termsCarried
      />
    </>
  );
}

export function HostViewsGuestLab({ only }: { only: string | null }) {
  const seat = { seatHolderUserId: null, seatName: 'Pam', seatIsCouple: false };
  const rows: Array<{ key: string; label: string; account: GuestAccountState; hostOpened: boolean }> = [
    {
      key: 'before',
      label: 'Before · the host, as origin/main computed it',
      // origin/main never asked, which is the same answer as "not a host" — said explicitly, so every call site asks.
      account: guestAccountState({ viewerUserId: 'host', viewerEmail: HOST_EMAIL, ...seat, viewerManagesEvent: false }),
      hostOpened: true,
    },
    {
      key: 'after',
      label: 'After · the host',
      account: guestAccountState({ viewerUserId: 'host', viewerEmail: HOST_EMAIL, ...seat, viewerManagesEvent: true }),
      hostOpened: true,
    },
    {
      key: 'guest',
      label: 'Unchanged · Pam herself, signed in',
      account: guestAccountState({ viewerUserId: 'pam', viewerEmail: GUEST_EMAIL, ...seat, viewerManagesEvent: false }),
      hostOpened: false,
    },
  ];
  return (
    <main className="min-h-dvh bg-cream px-4 py-8 text-ink">
      {rows
        .filter((r) => !only || r.key === only)
        .map((r) => (
          <section key={r.key} data-lab-host-view={r.key} className="mx-auto mb-16 max-w-[430px] border-t border-ink/10 pt-6">
            <p className="mb-6 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-ink/50">{r.label}</p>
            <MeFor account={r.account} hostOpened={r.hostOpened} />
          </section>
        ))}
    </main>
  );
}
