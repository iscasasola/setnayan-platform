/**
 * /dev/you-lab — the first-run "You · How should we call you?" card (`/signup/you`) on fixtures: no
 * sign-in, no database. DEV-ONLY: production builds 404 it, the same kill-switch as every `/dev/*` lab.
 *
 * Owner 2026-10-21: "i noticed some misalignment where they upload their first profile photo. on that
 * page. can you show me that step". This draws the REAL card (`YouCard`, the component the page renders)
 * and the couple's next screen — so the photo row can be walked at every phone width without an account. The
 * supplier's first run is walked on the real `/open-shop` itself (signed out, it is a guest's page): a shop's own
 * form, which no couple-reachable tree may import (`lib/no-door-out-of-the-app.test.ts`).
 *
 *   ?state=new        a brand-new account: no photo, no @name, consent unanswered (default)
 *   ?state=returning  a returning account: photo on file, @name set, formal name filled (folded open)
 *   ?state=long       a brand-new account with a long display name
 *   ?door=picker      the couple's next screen after Done: the REAL event-type picker in the REAL app bar, for an
 *                     account with no event yet (no "Back to events" — `&behind=1` draws the way back);
 *                     `&loved=1` gives the account one loved one on file, which draws the "For · You ▾" dropdown;
 *                     `&loved=shop` gives it the business alaga a shop opens with (owner 2026-10-22: an event
 *                     "for" the shop is the shop's on every type — pick it in "For ▾", then any type)
 *   &dark=1           (a walk adds `html.dark`) — the card's dark rules are inert until the route is DARK_READY
 *
 * The photo's live moments (chosen and not saved yet · uploading · refused) are the REAL upload widget
 * driven by a walk that answers `/api/upload` locally — the lab itself sends nothing anywhere. Done is a plain
 * GET back to the lab (no server action), so a lab press never reaches the database.
 */
import { notFound } from 'next/navigation';
import { YouCard, type YouCardMe } from '@/app/signup/you/_components/you-card';
import '@/app/_components/frontdoor/front-door.css';
import { FrontDoorShell } from '@/app/_components/frontdoor/front-door-shell';
import { AccountBarSlot } from '@/app/dashboard/(launcher)/_components/account-bar-slot';
import { NewEventHead } from '@/app/dashboard/(account)/create-event/_components/new-event-head';
import { EventTypePicker } from '@/app/dashboard/(account)/create-event/_components/event-type-picker';
import { getCreatableEventTypes } from '@/lib/event-types-db';
import { getBudgetBands } from '@/lib/budget-bands';
import { buildSelfSubject, buildUnspecifiedSubject, dependentSubjects } from '@/lib/create-subjects';
import { manilaToday } from '@/lib/std-views';

export const dynamic = 'force-dynamic';

const LAB_PHOTO_REF = 'r2://media/profile-photo/lab-user/isabel.avif';
const LAB_PHOTO_URL = '/portraits/isabel-santos.avif';

const STATES: Record<string, { me: YouCardMe; email: string; photos: Record<string, string> }> = {
  new: { me: { display_name: 'Isabel', account_type: 'customer' }, email: 'isabel@example.com', photos: {} },
  long: {
    me: { display_name: 'Maria Isabel Concepcion Dela Cruz-Santos', account_type: 'customer' },
    email: 'maria.isabel.concepcion@example.com',
    photos: {},
  },
  returning: {
    me: {
      display_name: 'Isabel Santos',
      slug: 'isabel-santos',
      phone: '+63 917 555 0142',
      profile_photo_url: LAB_PHOTO_REF,
      account_type: 'customer',
      public_summary_consent_at: '2026-09-30T08:00:00Z',
      name_prefix: 'Ms.',
      first_name: 'Isabel',
      last_name: 'Santos',
    },
    email: 'isabel@example.com',
    photos: { [LAB_PHOTO_REF]: LAB_PHOTO_URL },
  },
};

export default async function YouLabPage({ searchParams }: { searchParams: Promise<{ state?: string; door?: string; behind?: string; loved?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;

  if (sp.door === 'picker') {
    // The page's own reads, which fall back to their shipped constants with no database.
    const [types, budgetBands] = await Promise.all([getCreatableEventTypes(), getBudgetBands()]);
    return (
      <FrontDoorShell
        variant="app"
        account={{ signedIn: true, initials: 'IS', shopName: null, isAdmin: false }}
        navLabels={{}}
        topBarSlot={
          <span className="grid h-11 w-11 place-items-center rounded-full sn-initials text-xs font-semibold">IS</span>
        }
      >
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8" data-you-lab="picker">
          <NewEventHead nothingBehind={sp.behind !== '1'} samahan={null} />
          <EventTypePicker
            types={types}
            budgetBands={budgetBands}
            subjects={[
              buildSelfSubject('Isabel', { birth_date: null }),
              // A fixture loved one (no database): the row a `dependents` read would hand the page.
              ...(sp.loved === '1'
                ? dependentSubjects(
                    [{ dependent_id: 'lab-lola', name: 'Lola Rosa', dependent_kind: 'person', birth_date: '1946-05-01', sex: 'female' }],
                    'lab-user',
                  )
                : []),
              ...(sp.loved === 'shop'
                ? dependentSubjects(
                    [{ dependent_id: 'lab-shop', name: 'Aling Nena’s Store', dependent_kind: 'business', birth_date: null, sex: null }],
                    'lab-user',
                  )
                : []),
              buildUnspecifiedSubject(),
            ]}
            todayISO={manilaToday()}
          />
        </div>
        {/* The account bar the (account) layout draws — its marker is what puts "Setnayan" beside the mark above. */}
        <AccountBarSlot tabs={['events', 'discover', 'memories', 'people']} />
      </FrontDoorShell>
    );
  }

  const key = sp.state && sp.state in STATES ? sp.state : 'new';
  const s = STATES[key]!;
  return (
    <div data-you-lab={key}>
      <YouCard
        // The lab's Done is a plain GET back to the lab: nothing is saved, nothing is sent.
        action="/dev/you-lab"
        next="/dashboard"
        errorMessage={null}
        userId="lab-user"
        email={s.email}
        me={s.me}
        photoDisplayMap={s.photos}
      />
    </div>
  );
}
