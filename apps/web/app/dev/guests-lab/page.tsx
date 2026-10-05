/**
 * /dev/guests-lab — the Guest list's phone head (the round +, the ⋯ sheet), the
 * guest card's top (their ticket, Invite · ⋯) and the account Notifications list,
 * on fixture data, with no sign-in and no database (owner's live iPhone review of
 * maria-and-jose, 2026-10-04). DEV-ONLY: production builds 404 this route, the
 * same kill-switch as `/dev/details-lab`.
 *
 * Why it exists: every defect in that review was LAYOUT — a pill squeezing a
 * message to one word per line, a menu spilling past a card's edge, a sheet
 * under the bottom bar — and no unit test lays out. It draws the REAL
 * components inside the same wrappers the real pages give them (the event
 * layout's `.sn-vt-page` <main> and its anchored dock; the account layout's
 * `pb-28` <main> and its thumb bar), so a stacking or clearance bug shows here
 * the way it shows on a phone.
 *
 *   ?part=notices   the Notifications list, scrolled under the account thumb bar
 *   ?part=head      Guests title + round + + ⋯ (tap ⋯ for the Guest list sheet)
 *   ?part=card      a guest's card (Daniel Ramos) — tap Invite or ⋯
 *   ?part=host      the bride's card — a host, ⋯ only
 *   ?part=rows      the Guest list ROWS, on maria-and-jose's real roster shape
 *                   (its 32 names, roles, sides and table names, read
 *                   2026-10-05) — "Sweetheart Table", "Table 9",
 *                   "Principal Sponsors 1"; &by=seat groups by table
 *   &low=1          push the card's ticket row to the bottom of a short phone
 *                   (375×667), where a menu has no room under it
 */
import { notFound } from 'next/navigation';
import { NotificationsList } from '@/app/_components/notifications/notifications-list';
import type { NotificationRow } from '@/lib/notifications';
import { HomePillNav } from '@/app/dashboard/(launcher)/_components/home-pill-nav';
import { BottomDock } from '@/app/_components/nav/bottom-nav';
import { OpenAddGuestButton, AddGuestSheet } from '@/app/dashboard/[eventId]/guests/_components/add-guest-sheet';
import { GuestsPhoneMenu } from '@/app/dashboard/[eventId]/guests/_components/guests-phone-menu';
import { RosterSort } from '@/app/dashboard/[eventId]/guests/_components/roster-controls';
import { RosterTabs } from '@/app/dashboard/[eventId]/guests/_components/roster-tabs';
import { GuestsViewSwitcher } from '@/app/dashboard/[eventId]/guests/_components/view-switcher';
import { AddDoors } from '@/app/dashboard/[eventId]/guests/_components/capture-bar';
import { GuestCardBody } from '@/app/dashboard/[eventId]/guests/_components/guest-card-body';
import { GuestInviteCell } from '@/app/dashboard/[eventId]/guests/_components/guest-invite-cell';
import { GuestMoreMenu, GuestTicketThumb } from '@/app/dashboard/[eventId]/guests/_components/guest-ticket-parts';
import type { GuestCardData } from '@/app/dashboard/[eventId]/guests/_components/guest-card-data';
import type { GuestRow } from '@/lib/guests';
import { GuestListMultiselect } from '@/app/dashboard/[eventId]/guests/_components/guest-list-multiselect';
import type { ArrangeKey } from '@/lib/roster-arrangement';

const EVENT = '00000000-0000-4000-8000-000000000000';

const NOTICES: NotificationRow[] = [
  {
    notification_id: 'n1',
    type: 'event_deletion_answered',
    title: 'Birthday Salubong ni Ate has been removed',
    body: 'since none of your papic credit has been used, you can use it for your next created event.',
    related_url: '/dashboard',
    read_at: null,
    created_at: new Date(Date.now() - 86_400_000).toISOString(),
  },
  ...["Ana RSVP'd: attending", "Ben RSVP'd: attending", "Carla RSVP'd: attending", "Dino RSVP'd: attending", "Ella RSVP'd: attending"].map((title, i) => ({
    notification_id: `r${i}`,
    type: 'rsvp_received' as NotificationRow['type'],
    title,
    body: 'Maybe for one of a few people sharing a mobile number. They told you what to call them.',
    related_url: '/dashboard',
    read_at: i > 2 ? new Date().toISOString() : null,
    created_at: new Date(Date.now() - (i + 2) * 3_600_000).toISOString(),
  })),
  {
    notification_id: 'last',
    type: 'rsvp_received',
    title: 'The LAST notice — it must end above the bar',
    body: 'If this line is under the thumb bar when scrolled to the bottom, the list has no room.',
    related_url: '/dashboard',
    read_at: null,
    created_at: new Date().toISOString(),
  },
] as NotificationRow[];

function guest(p: Partial<GuestRow>): GuestRow {
  return {
    guest_id: 'g-daniel',
    rsvp_responded_at: null,
    public_id: 'S89G-LAB0000001',
    event_id: EVENT,
    first_name: 'Daniel',
    last_name: 'Ramos',
    name_prefix: null,
    middle_name: null,
    name_suffix: null,
    pair_with_guest_id: null,
    display_name: null,
    side: 'groom',
    group_category: 'friends',
    role: 'guest',
    extra_roles: [],
    plus_one_allowed: false,
    plus_one_count: 0,
    plus_one_name: null,
    plus_one_of_guest_id: null,
    plus_one_mode: null,
    email: null,
    mobile: null,
    meal_preference: null,
    dietary_restrictions: null,
    photo_consent: false,
    faceblock_enabled: false,
    face_recognition_excluded: false,
    photo_url: null,
    photo_source: null,
    photo_updated_at: null,
    invited_to_blocks: [],
    rsvp_status: 'attending',
    notes: null,
    guest_note: null,
    qr_token: 'lab-token',
    custom_tags: [],
    seating_priority: null,
    attire: 'neutral',
    seniority_rank: null,
    relation: null,
    invitation_sent_at: null,
    created_at: '2026-01-01',
    ...p,
  } as GuestRow;
}

function cardData(g: GuestRow, isCouple: boolean): GuestCardData {
  return {
    guest: g,
    isCouple,
    hasSides: true,
    availableRoles: [],
    groupOptions: ['family', 'friends'],
    isIncWedding: false,
    showTeaCeremony: false,
    plusOneStateLabel: null,
    plusOneGuestId: null,
    initialInvited: [],
    seatedAt: isCouple ? 'Sweetheart Table' : 'Entourage',
    customGroups: [],
    recordedAt: null,
    access: null,
    canManageAccess: true,
    nameLinked: false,
    linkedAccount: null,
    profileName: null,
    roleNames: {},
    tables: null,
    seatTableId: null,
    groupChoices: null,
  } as unknown as GuestCardData;
}

/**
 * maria-and-jose's roster, as it is in production (read 2026-10-05): first and
 * last name, role, side, reply and the name of the table they sit at. Copied,
 * not invented — the row defects only show on the couple's own table names.
 */
const MJ_ROSTER: ReadonlyArray<[string, string, GuestRow['role'], GuestRow['side'], string]> = [
  ['Maria', 'Santos', 'bride', 'bride', 'Sweetheart Table'],
  ['Jose', 'Dela Cruz', 'groom', 'groom', 'Sweetheart Table'],
  ['Andrea', 'Flores', 'maid_of_honor', 'bride', 'Entourage'],
  ['Daniel', 'Ramos', 'best_man', 'groom', 'Entourage'],
  ['Sofia', 'Navarro', 'bridesmaid', 'bride', 'Entourage'],
  ['Gabriel', 'Castillo', 'groomsman', 'groom', 'Entourage'],
  ['Antonio', 'Bautista', 'principal_sponsor_ninong', 'bride', 'Principal Sponsors 1'],
  ['Eduardo', 'Reyes', 'principal_sponsor_ninong', 'bride', 'Principal Sponsors 1'],
  ['Lourdes', 'Bautista', 'principal_sponsor_ninang', 'bride', 'Principal Sponsors 1'],
  ['Corazon', 'Reyes', 'principal_sponsor_ninang', 'bride', 'Principal Sponsors 1'],
  ['Fernando', 'Villanueva', 'principal_sponsor_ninong', 'groom', 'Principal Sponsors 2'],
  ['Ramon', 'Aquino', 'principal_sponsor_ninong', 'groom', 'Principal Sponsors 2'],
  ['Teresita', 'Aquino', 'principal_sponsor_ninang', 'groom', 'Principal Sponsors 2'],
  ['Imelda', 'Villanueva', 'principal_sponsor_ninang', 'groom', 'Principal Sponsors 2'],
  ['Rosa', 'Santos', 'guest', 'bride', 'Family of the Bride'],
  ['Divina', 'Mercado', 'guest', 'bride', 'Family of the Bride'],
  ['Carlo', 'Santos', 'guest', 'bride', 'Family of the Bride'],
  ['Angela', 'Santos', 'guest', 'bride', 'Family of the Bride'],
  ['Manuel', 'Santos', 'guest', 'bride', 'Family of the Bride'],
  ['Patricia', 'Dela Cruz', 'guest', 'groom', 'Family of the Groom'],
  ['Rodrigo', 'Dela Cruz', 'guest', 'groom', 'Family of the Groom'],
  ['Estrella', 'Dela Cruz', 'guest', 'groom', 'Family of the Groom'],
  ['Miguel', 'Dela Cruz', 'guest', 'groom', 'Family of the Groom'],
  ['Benigno', 'Garcia', 'guest', 'groom', 'Family of the Groom'],
  ['Joana', 'Cruz', 'guest', 'bride', 'Friends — Barkada'],
  ['Paolo', 'Mendoza', 'guest', 'groom', 'Friends — Barkada'],
  ['Bianca', 'Lim', 'guest', 'bride', 'Friends — Barkada'],
  ['Marco', 'Tan', 'guest', 'groom', 'Friends — Barkada'],
  ['Nena', 'Villar', 'guest', 'bride', 'Table 9'],
  ['Tomas', 'Villar', 'guest', 'bride', 'Table 9'],
  ['Cita', 'Ramos', 'guest', 'groom', 'Table 9'],
  ['Efren', 'Ramos', 'guest', 'groom', 'Table 9'],
];

/** A stand-in bottom bar, in the REAL anchored dock (z-30, outside <main>). */
function DockStandIn() {
  return (
    <BottomDock>
      <nav className="flex h-16 items-center justify-around bg-white/90 text-xs text-ink/70" data-lab-dock="">
        <span>Home</span>
        <span>Guests</span>
        <span>Suppliers</span>
        <span>Hub</span>
        <span>More</span>
      </nav>
    </BottomDock>
  );
}

export default async function GuestsLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const part = typeof sp.part === 'string' ? sp.part : 'head';

  if (part === 'notices') {
    // The account layout's wrappers, as `app/dashboard/(account)/layout.tsx` draws them.
    return (
      <div className="sn-ambient min-h-dvh">
        <main className="pb-28 sm:pb-0">
          <div className="sn-page-enter">
            <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
              <NotificationsList
                items={NOTICES}
                returnTo="/dev/guests-lab?part=notices"
                emptyState={{ title: 'No notifications yet.', body: null }}
              />
            </div>
          </div>
        </main>
        <HomePillNav hasSpaces spacesHref="/vendor-dashboard" />
      </div>
    );
  }

  if (part === 'card' || part === 'host') {
    const host = part === 'host';
    const low = sp.low === '1';
    const g = host
      ? guest({ guest_id: 'g-maria', first_name: 'Maria', last_name: 'Santos', side: 'bride', group_category: 'family', role: 'bride' })
      : guest({});
    return (
      <div className="sn-ambient min-h-screen">
        <main className="sn-vt-page">
          <div data-shell-main>
            <div className="sn-page-enter">
              {/* The panel over the Guest list, as a phone shows it: inset from the left. */}
              <div className="ml-12 min-h-dvh rounded-l-3xl bg-cream px-[18px] pb-10 pt-6 shadow-xl" data-lab-card="">
                {low ? <div aria-hidden className="h-[440px]" data-lab-low="" /> : null}
                <GuestCardBody
                  eventId={EVENT}
                  data={cardData(g, host)}
                  invitationBase="https://www.setnayan.com/maria-and-jose"
                  photoDisplayUrl={null}
                  variant="page"
                  returnTo="/dev/guests-lab"
                  errorMessage={null}
                  inviteFlash={null}
                  inviteSetup={{
                    facts: { hostsName: 'Maria & Jose', eventWord: 'wedding', eventDate: '2026-12-12', datePrecision: 'day' },
                    template: null,
                    slug: 'maria-and-jose',
                  }}
                  SendInvite={GuestInviteCell}
                  TicketThumb={GuestTicketThumb}
                  MoreMenu={GuestMoreMenu}
                />
              </div>
            </div>
          </div>
        </main>
        <DockStandIn />
      </div>
    );
  }

  if (part === 'rows') {
    const roster = MJ_ROSTER.map(([first, last, role, side], i) =>
      guest({
        guest_id: `g-mj-${i}`,
        public_id: `S89G-LABMJ${String(i).padStart(5, '0')}`,
        first_name: first,
        last_name: last,
        role,
        side,
        group_category: 'family',
      }),
    );
    const seatByGuest = Object.fromEntries(
      MJ_ROSTER.map(([, , , , table], i) => [`g-mj-${i}`, { placed: table, suggested: null }]),
    );
    const tables = [...new Set(MJ_ROSTER.map((r) => r[4]))].map((label, i) => ({ tableId: `t-${i}`, label }));
    const grouping: ArrangeKey[] = sp.by === 'seat' ? ['seat'] : ['role'];
    return (
      <div className="sn-ambient min-h-screen">
        <main className="sn-vt-page">
          <div data-shell-main>
            <div className="sn-page-enter">
              <section className="flex flex-col gap-4 px-4 py-6" data-lab-rows="">
                <GuestListMultiselect
                  eventId={EVENT}
                  guests={roster}
                  palette={{}}
                  groups={[]}
                  groupMemberships={{}}
                  currentGroupId={null}
                  selfJoinIds={[]}
                  seatByGuest={seatByGuest}
                  photoDisplayUrls={{}}
                  accountFaceByGuest={{}}
                  grouping={grouping}
                  sort="importance"
                  tables={tables}
                />
              </section>
            </div>
          </div>
        </main>
        <DockStandIn />
      </div>
    );
  }

  // part=head — the event layout's wrappers (`app/dashboard/[eventId]/layout.tsx`).
  const rosterTabs = (
    <RosterTabs
      eventId={EVENT}
      view="list"
      finished={false}
      hasJoinLink
      viewSwitch={<GuestsViewSwitcher eventId={EVENT} active="list" search={{}} bare />}
    />
  );
  return (
    <div className="sn-ambient min-h-screen">
      <main className="sn-vt-page">
        <div data-shell-main>
          <div className="sn-page-enter">
            <section className="flex flex-col gap-4 px-4 py-6">
              <div className="flex items-center justify-between gap-3" data-guests-phone-title="">
                <span aria-hidden className="font-display text-2xl text-ink">
                  Guests
                </span>
                <div className="flex items-center gap-2">
                  <OpenAddGuestButton label="Add a guest" />
                  <GuestsPhoneMenu
                    sort={
                      <RosterSort
                        sorts={[
                          { key: 'name', label: 'Name' },
                          { key: 'side', label: 'Side' },
                        ]}
                        current="name"
                      />
                    }
                    doors={rosterTabs}
                    addDoors={<AddDoors eventId={EVENT} rows />}
                  />
                </div>
              </div>
              <p className="text-sm text-ink/60">Guests can reply until you finalize.</p>
              <div className="hidden lg:block">{rosterTabs}</div>
              {['Ana Cruz', 'Ben Reyes', 'Carla Lim', 'Dino Tan', 'Ella Go', 'Fe Uy', 'Gino Sy', 'Hana Ong', 'Ivy Chua', 'Jun Dy', 'Kat Yu', 'Leo Co'].map((who) => (
                <div key={who} className="border-b border-ink/10 py-3 text-sm text-ink/70">
                  {who}
                </div>
              ))}
            </section>
            {/* Inside the page, where the real Guest list mounts it. */}
            <AddGuestSheet
              nameBox={<input className="w-full rounded-lg border border-ink/15 px-3 py-2" placeholder="Type a name…" />}
              doors={<AddDoors eventId={EVENT} rows />}
            />
          </div>
        </div>
      </main>
      <DockStandIn />
    </div>
  );
}
