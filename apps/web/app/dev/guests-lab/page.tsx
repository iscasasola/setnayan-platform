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
 *   ?part=head      (retired with the phone title + ⋯ — redirects to part=screen)
 *   ?part=card      a guest's card (Daniel Ramos) — tap Invite or ⋯
 *   ?part=host      the bride's card — a host, ⋯ only
 *   ?part=rows      (retired with the old GuestListMultiselect — redirects to part=screen)
 *   ?part=screen    Guests › List and Map (Maker PR 4f) — the whole screen on
 *                   maria-and-jose's roster, with a stand-in shell bar and
 *                   dock: &gview=map for the map, &q=… to search, &empty=1 for
 *                   an empty list, &fail=1 for a refused read
 *   &low=1          push the card's ticket row to the bottom of a short phone
 *                   (375×667), where a menu has no room under it
 *   ?part=setup     Guests › Setup (2026-10-07) — the REAL `GuestSetupRows` on
 *                   fixture data: &getin=list|personal|requests|one_qr_approve|one_qr,
 *                   &hc=open|locked; "Send to N" is counted off the lab roster
 *                   by the one rule (`toInviteCount`). The Digital Pass is the shipped
 *                   SAMPLE event's pass (`?sample=1`, the public sample door) —
 *                   a lab has no event of its own. Saves go nowhere real: the
 *                   fixture event id fails the host fence, and a refusal says so.
 *   ?part=run       the send run (`/guests/send`) on the same roster — the REAL
 *                   `SendRun` over `sendRunGuests`; its "Not sent yet (N)" is
 *                   the List's "N to invite" and Setup's "Send to N". The QR
 *                   and the ticket are a real event's, so they do not draw here.
 *   ?part=rsvp      the Maker's Studio › RSVP (`MakerRsvpSettings studio`) on the
 *                   same fixture, so the two doors can be compared side by side
 */
import { notFound } from 'next/navigation';
import { redirect } from 'next/navigation';
import { NotificationsList } from '@/app/_components/notifications/notifications-list';
import type { NotificationRow } from '@/lib/notifications';
import { HomePillNav } from '@/app/dashboard/(launcher)/_components/home-pill-nav';
import { BottomDock } from '@/app/_components/nav/bottom-nav';
import { AddGuestSheet } from '@/app/dashboard/[eventId]/guests/_components/add-guest-sheet';
import { GuestCardBody } from '@/app/dashboard/[eventId]/guests/_components/guest-card-body';
import { guestCardErrorCopy } from '@/app/dashboard/[eventId]/guests/_components/guest-card-error-copy';
import { GuestInviteCell } from '@/app/dashboard/[eventId]/guests/_components/guest-invite-cell';
import { GuestMoreMenu, GuestTicketThumb } from '@/app/dashboard/[eventId]/guests/_components/guest-ticket-parts';
import type { GuestCardData } from '@/app/dashboard/[eventId]/guests/_components/guest-card-data';
import { guestDisplayName, guestFullName, type GuestRow } from '@/lib/guests';
import { DEFAULT_NAME_STYLE } from '@/lib/name-style';
import { sendRunGuests, toInviteCount } from '@/lib/guest-roster-view';
import { invitationLinkOn } from '@/lib/invitation-link';
import { SendRun } from '@/app/dashboard/[eventId]/guests/send/_components/send-run';
import { GuestSetupRows } from '@/app/dashboard/[eventId]/_components/guest-setup/guest-setup-rows';
import { MakerRsvpSettings } from '@/app/dashboard/[eventId]/launch/_components/maker-rsvp-ask';
import { guestsGetInPatch, isGuestsGetIn } from '@/lib/who-can-reply';
import { renderStyledUrlQrSvg } from '@/lib/qr';
import { GuestsScreen } from '@/app/dashboard/[eventId]/guests/_components/guests-screen';
import { TEMPLATE_KIT } from '@/app/dashboard/[eventId]/guests/_components/guest-card-template-kit';
import { UndoToastHost } from '@/app/dashboard/[eventId]/guests/_components/undo-toast';
import { LabGuestActions } from './lab-guest-actions';
import { RoleNamesProvider } from '@/app/dashboard/[eventId]/guests/_components/role-names-context';

const EVENT = '00000000-0000-4000-8000-000000000000';
/** A stand-in Event Hub address for the run's personal links (the shipped builder makes the link). */
const LAB_HUB = 'https://setnayan.com/maria-and-jose';

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
    offersThisIsMe: false,
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
 * (Daniel Ramos is the event's best man — `best_man`; a `best_woman` stands in
 * exactly the same place and row.)
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

/**
 * maria-and-jose's roster with the replies, invitations and groups a planning
 * couple has a month out — so every section, pill and count of the prototype
 * has something real to draw. Two of them (Rosa Santos, Cita Ramos) said they
 * can't come before anything was sent: they are in NO "to invite" count.
 */
function planningRoster(): GuestRow[] {
  const RSVP: GuestRow['rsvp_status'][] = ['attending', 'attending', 'attending', 'pending', 'maybe', 'attending', 'declined', 'pending'];
  return MJ_ROSTER.map(([first, last, role, side], i) =>
    guest({
      guest_id: `g-mj-${i}`,
      public_id: `S89G-LABMJ${String(i).padStart(5, '0')}`,
      first_name: first,
      last_name: last,
      role,
      side,
      group_category: 'family',
      rsvp_status: role === 'bride' || role === 'groom' ? 'attending' : RSVP[i % RSVP.length]!,
      invitation_sent_at: i % 5 === 4 || i > 26 ? null : '2026-09-20T00:00:00Z',
      plus_one_count: i === 6 ? 1 : 0,
      plus_one_allowed: i === 6,
    }),
  ).map((g) => (g.invitation_sent_at === null && g.rsvp_status !== 'declined' ? { ...g, rsvp_status: 'pending' as const } : g));
}

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

/**
 * The Digital Pass picture on the lab's Setup page: a small picture drawn INLINE (a `data:` image — the page's CSP allows it),
 * never the production address it once pointed at (`https://setnayan.com/api/hub-print/pass…`: refused by the page's own
 * `img-src` three times, and a lab page has no business asking the live site for anything). The REAL Setup view hands a
 * same-origin path (`/api/hub-print/pass?event=…`), which the CSP allows.
 */
const LAB_PASS_SRC =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="426" viewBox="0 0 320 426"><rect width="320" height="426" rx="20" fill="#fbf7f0" stroke="#d9cfbf"/><text x="160" y="150" font-family="Georgia,serif" font-size="26" text-anchor="middle" fill="#1e1a12">Maria &amp; Jose</text><text x="160" y="184" font-family="sans-serif" font-size="13" text-anchor="middle" fill="#6b6455">Digital Pass (lab sample)</text><rect x="100" y="224" width="120" height="120" rx="8" fill="#fff" stroke="#d9cfbf"/></svg>',
  );

export default async function GuestsLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;

  /* 🧪 THE CARD'S WRITES, AS STAND-INS (step 4A, 2026-10-09). The card binds the shipped `updateGuest` / `releaseGuestClaim` /
     `inviteGuestByEmailAction` in the page that draws it; the lab hands in its own — INLINE server actions (not exported, so
     the server-action budget does not see them) that write NOTHING, so the lab's card can be pressed without reaching the
     database. `?refuse=1` makes them refuse the way the real ones do — a redirect back with `?error=` — in the DATABASE'S OWN
     WORDS, on purpose, so a guard can prove the card never prints them. */
  const labRefuses = sp.refuse === '1';
  const labBack = `/dev/guests-lab?part=${sp.part === 'host' ? 'host' : 'card'}${labRefuses ? '&refuse=1' : ''}`;
  const labWords = 'new row violates row-level security policy for table "guests"';
  const labRefusal = `${labBack}&error=${encodeURIComponent(labWords)}`;
  async function labUpdate(formData: FormData) {
    'use server';
    // Like the real `updateGuest`: a QUIET post (the autosave's) is RETURNED the refusal; any other post redirects.
    if (labRefuses) {
      if (formData.get('quiet') === '1') return { refused: labWords };
      redirect(labRefusal);
    }
  }
  async function labRelease(formData: FormData) {
    'use server';
    void formData;
    if (labRefuses) redirect(labRefusal);
  }
  async function labPartnerLink() {
    'use server';
    if (labRefuses) redirect(labRefusal);
  }
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
                <LabGuestActions refuse={labRefuses}>
                <GuestCardBody
                  eventId={EVENT}
                  data={cardData(g, host)}
                  invitationBase="https://www.setnayan.com/maria-and-jose"
                  photoDisplayUrl={null}
                  variant="page"
                  returnTo={labBack}
                  errorMessage={typeof sp.error === 'string' ? guestCardErrorCopy(sp.error) : null}
                  actions={{ update: labUpdate, release: labRelease, partnerLink: labPartnerLink }}
                  inviteFlash={null}
                  inviteSetup={{
                    facts: { hostsName: 'Maria & Jose', eventWord: 'wedding', eventDate: '2026-12-12', datePrecision: 'day' },
                    template: null,
                    slug: 'maria-and-jose',
                  }}
                  SendInvite={GuestInviteCell}
                  TicketThumb={GuestTicketThumb}
                  MoreMenu={GuestMoreMenu}
                  kit={TEMPLATE_KIT}
                />
                </LabGuestActions>
              </div>
            </div>
          </div>
        </main>
        <DockStandIn />
        {/* What the real card page mounts: the host that draws the autosave's Undo toast. */}
        <UndoToastHost />
      </div>
    );
  }

  /* ⚙ Guests › Setup (PR 4d) — the REAL rows on fixture data, drawn inside the
     real Guests screen (`?part=setup` = `?part=screen&gview=share`). */
  const getIn = isGuestsGetIn(sp.getin) ? sp.getin : 'list';
  const labConfig = { ...guestsGetInPatch(getIn), dietary: false, song_request: false, note: false };
  const hc = typeof sp.hc === 'string' ? sp.hc : 'open';
  const config = labConfig;
  const setupRows = (
                    <GuestSetupRows
                      eventId={EVENT}
                      config={config}
                      drafted={false}
                      reply={{ own: '2027-01-14', pricingMode: 'realtime', fallback: null }}
                      toInvite={toInviteCount(sp.fail === '1' ? [] : planningRoster(), sp.fail !== '1')}
                      passSrc={LAB_PASS_SRC}
                      oneLink={{
                        url: 'https://setnayan.com/cale-ice/invite',
                        qrSvg: await renderStyledUrlQrSvg('https://setnayan.com/cale-ice/invite', undefined, 240),
                        notice: null,
                      }}
                      headcount={{ locked: hc === 'locked', attending: 7, heads: 7 }}
                    />
  );
  if (part === 'rsvp') {
    return (
      <div className="sn-ambient min-h-screen">
        <main className="sn-vt-page">
          <div data-shell-main>
            <div className="sn-page-enter">
              <section className="mx-auto flex w-full max-w-[720px] flex-col gap-4 px-4 py-6" data-lab-setup="rsvp">
                <MakerRsvpSettings
                  eventId={EVENT}
                  studio
                  current={labConfig}
                  drafted={false}
                  replyBy={{ date: '2027-01-14', isDefault: false }}
                  replyByOwn={{ deadline: '2027-01-14', pricingMode: 'realtime' }}
                  requests={{ count: 0, list: null }}
                />
              </section>
            </div>
          </div>
        </main>
        <DockStandIn />
      </div>
    );
  }

  if (part === 'screen' || part === 'setup') {
    const roster = planningRoster();
    const GROUPS: Record<string, string[]> = {
      'g-mj-24': ['Barkada'],
      'g-mj-25': ['Barkada'],
      'g-mj-26': ['Barkada', 'Choir'],
      'g-mj-27': ['Barkada'],
      'g-mj-14': ['Choir'],
    };
    const tables = [...new Set(MJ_ROSTER.map((r) => r[4]))].map((label, i) => ({ tableId: `t-${i}`, label }));
    const tableByGuest = Object.fromEntries(MJ_ROSTER.map(([, , , , table], i) => [`g-mj-${i}`, table]).filter((_, i) => i % 3 !== 2));
    const gview = sp.gview === 'map' ? 'map' : sp.gview === 'share' || part === 'setup' ? 'share' : 'list';
    const empty = sp.empty === '1';
    const fail = sp.fail === '1';
    return (
      <RoleNamesProvider names={{}}>
        <div className="sn-ambient min-h-screen">
          {/* A stand-in for the shell's sticky top bar (same class, same height). */}
          <div className="shell-topbar sticky top-0 z-20 flex h-[61px] items-center border-b border-ink/10 bg-white/90 px-4 text-sm font-semibold tracking-[0.18em] text-[#A9834B]" data-hidden="false">
            SETNAYAN
          </div>
          <main className="sn-vt-page">
            <div data-shell-main>
              <div className="mx-auto w-full px-4 pb-6 pt-3 sm:px-6 sm:pt-6 lg:px-8">
                <section className="sn-col max-w-none flex flex-col gap-6" data-lab-screen="">
                  <LabGuestActions refuse={sp.refuse === '1'}>
                  <GuestsScreen
                    eventId={EVENT}
                    gview={gview}
                    guests={empty || fail ? [] : roster}
                    measured={!fail}
                    hasSides
                    groupsByGuest={GROUPS}
                    groups={[
                      { group_id: 'grp-b', label: 'Barkada' },
                      { group_id: 'grp-c', label: 'Choir' },
                    ]}
                    tables={tables}
                    tableByGuest={tableByGuest}
                    songsByGuest={{}}
                    linkedGuestIds={roster.filter((_, i) => i % 2 === 0).map((g) => g.guest_id)}
                    faceByGuest={{}}
                    requests={3}
                    rootLabel="Maria & Jose"
                    initialQuery={typeof sp.q === 'string' ? sp.q : ''}
                    setup={setupRows}
                    empty={
                      empty || fail ? (
                        <p className="p-8 text-center text-base text-ink/70" data-guests-empty="">
                          {fail ? 'We couldn’t load your guest list.' : 'No guests yet.'}
                        </p>
                      ) : null
                    }
                  />
                  </LabGuestActions>
                </section>
              </div>
            </div>
          </main>
          <DockStandIn />
          <AddGuestSheet eventId={EVENT} defaultSide="both" />
          {/* What the real page mounts (guests/page.tsx): the host that draws the Undo toast and every guest-list result. */}
          <UndoToastHost />
        </div>
      </RoleNamesProvider>
    );
  }

  if (part === 'run') {
    // The REAL run over the REAL rule's list (`sendRunGuests`) — the page's own two lines.
    const failed = sp.fail === '1';
    const runGuests = sendRunGuests(failed ? [] : planningRoster()).map((g) => ({
      guestId: g.guest_id,
      formalName: guestFullName(g, DEFAULT_NAME_STYLE),
      firstName: g.first_name,
      fullName: guestDisplayName(g),
      inviteUrl: invitationLinkOn(LAB_HUB, g.guest_id),
      sentAt: g.invitation_sent_at,
    }));
    return (
      <div className="sn-ambient min-h-screen">
        <main className="sn-vt-page">
          <div className="mx-auto w-full max-w-xl px-4 pb-24 pt-4 sm:px-6" data-lab-run="">
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Send invites one by one</h1>
            <SendRun
              eventId={EVENT}
              guests={runGuests}
              measured={!failed}
              facts={{ hostsName: 'Maria & Jose', eventWord: 'wedding', eventDate: '2026-12-12', datePrecision: 'day' }}
              template={null}
            />
          </div>
        </main>
        <DockStandIn />
      </div>
    );
  }

  // part=head (the retired phone title + ⋯) now draws the Guests screen.
  redirect('/dev/guests-lab?part=screen');

}
