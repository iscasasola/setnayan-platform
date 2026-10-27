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
 *   ?part=card      a guest's card (Daniel Ramos) — tap Invite or ⋯; &plusone=1 a +1's seat (TBA), &named=1 a named +1;
 *                   &frame=panel the card in the real sheet over the list (its sticky header, face, pinned Invite)
 *                   &seats=2 a guest who brings TWO +1s (one named, one not yet) — every seat a line (2026-10-22);
 *                   &seatread=empty the card as origin/main's `.maybeSingle()` loader drew that guest (the read erred → []),
 *                   &seatread=fail a refused seat read ("Couldn’t read …", never the empty state)
 *   ?part=host      the bride's card — a host, ⋯ only
 *   ?part=rows      (retired with the old GuestListMultiselect — redirects to part=screen)
 *   ?part=screen    Guests › List and Map (Maker PR 4f) — the whole screen on
 *                   maria-and-jose's roster, with a stand-in shell bar and
 *                   dock: &gview=map for the map, &q=… to search, &empty=1 for
 *                   an empty list, &fail=1 for a refused read
 *   &req=0          (screen) no requests to join waiting — the carousel's card ① says "No requests waiting"
 *   &oneqr=1        (screen) a one-link event with no list to walk (just the couple): card ② reads
 *                   "One link for everyone · Share" (owner 2026-10-27, "THE SEND RUN ALSO SERVES A ONE-QR EVENT")
 *   &low=1          push the card's ticket row to the bottom of a short phone
 *                   (375×667), where a menu has no room under it
 *   ?part=setup     Guests ⚙ (settings per menu, 2026-10-27; was Guests › Setup) — the REAL `GuestSetupRows` on
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
 *   &typed=1        (screen) two names typed all lower case — the list shows them cased (displayPersonName)
 *   &marked=1       (card · screen) replies the host set — "Attending · Marked by you", the rows' quiet "marked"
 *   &sides=1        (card · screen) cale-ice's own groups as measured 2026-10-20 — Childhood + College (groom),
 *                   Family + Relatives (one bride, one groom) — plus one both-sides group, so the ONE Group list's
 *                   "follows the guest's side" can be walked; on the card &side=bride|groom|both picks the guest's side
 *                   (default bride) and the guest is already in College (groom's side)
 */
import { papicHomeHref } from '@/lib/papic-home-href';
import { LabPageSpotlight } from '@/app/dev/_components/lab-page-spotlight';
import { TOURS } from '@/lib/tours';
import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { WEDDING_ROLE_SET } from '@/lib/role-sets';
import { redirect } from 'next/navigation';
import { NotificationsList } from '@/app/_components/notifications/notifications-list';
import type { NotificationRow } from '@/lib/notifications';
import { AccountBottomNav } from '@/app/dashboard/(launcher)/_components/account-bottom-nav';
import { BottomDock } from '@/app/_components/nav/bottom-nav';
import { AddGuestSheet } from '@/app/dashboard/[eventId]/guests/_components/add-guest-sheet';
import { QuickAddSheet } from '@/app/dashboard/[eventId]/guests/_components/quick-add-sheet';
import { GuestCard } from '@/app/dashboard/[eventId]/guests/_components/guest-card';
import { LabCardSheet } from './lab-card-sheet';
import { guestCardErrorCopy } from '@/app/dashboard/[eventId]/guests/_components/guest-card-error-copy';
import type { GuestPapicState } from '@/lib/papic-guest-camera';
import type { GuestCardData } from '@/app/dashboard/[eventId]/guests/_components/guest-card-data';
import { guestOutfitOf, guestOutfitWords } from '@/lib/guest-outfit';
import { guestDisplayName, guestFullName, type GuestRow } from '@/lib/guests';
import { DEFAULT_NAME_STYLE } from '@/lib/name-style';
import { sendRunGuests, toInviteCount } from '@/lib/guest-roster-view';
import { plusOneOfWords } from '@/lib/plus-one-of';
import { plusOneSeatLines, plusOneSeatPeople } from '@/lib/extra-seats';
import { invitationLinkOn } from '@/lib/invitation-link';
import { SendRun } from '@/app/dashboard/[eventId]/guests/send/_components/send-run';
import { GuestSetupRows } from '@/app/dashboard/[eventId]/_components/guest-setup/guest-setup-rows';
import { MakerRsvpSettings } from '@/app/dashboard/[eventId]/launch/_components/maker-rsvp-ask';
import { guestsGetInPatch, isGuestsGetIn } from '@/lib/who-can-reply';
import { renderStyledUrlQrSvg } from '@/lib/qr';
import { GuestsScreen } from '@/app/dashboard/[eventId]/guests/_components/guests-screen';
import type { TitleWaitingPerson } from '@/app/dashboard/[eventId]/guests/_components/titles-waiting';
import { titleButtonText, titleKey } from '@/lib/guest-title';
import { UndoToastHost } from '@/app/dashboard/[eventId]/guests/_components/undo-toast';
import { LabGuestActions } from './lab-guest-actions';
import { LabShell } from '@/app/dev/_components/lab-shell';
import { RoleNamesProvider } from '@/app/dashboard/[eventId]/guests/_components/role-names-context';
import { InspectorLayout } from '@/app/_components/inspector/inspector-column';

const EVENT = '00000000-0000-4000-8000-000000000000';
/** 👥 `&sides=1` — cale-ice's own groups as measured in prod 2026-10-20 (names + sides only), plus one both-sides group;
 *  and (measured 2026-10-21, the owner's "why do i see dupes on group names") the same-name pairs on two sides — Bob ·
 *  Loo · Mama on both sides and the groom's, and a both-sides Relatives beside the bride's and the groom's. */
const SIDE_GROUPS: { group_id: string; label: string; team_side: 'bride' | 'groom' | 'both' }[] = [
  { group_id: 'lab-sg-barkada', label: 'Barkada', team_side: 'both' },
  { group_id: 'lab-sg-bob', label: 'Bob', team_side: 'both' },
  { group_id: 'lab-sg-bob-g', label: 'Bob', team_side: 'groom' },
  { group_id: 'lab-sg-childhood', label: 'Childhood', team_side: 'groom' },
  { group_id: 'lab-sg-college', label: 'College', team_side: 'groom' },
  { group_id: 'lab-sg-family-b', label: 'Family', team_side: 'bride' },
  { group_id: 'lab-sg-family-g', label: 'Family', team_side: 'groom' },
  { group_id: 'lab-sg-loo', label: 'Loo', team_side: 'both' },
  { group_id: 'lab-sg-loo-g', label: 'Loo', team_side: 'groom' },
  { group_id: 'lab-sg-mama', label: 'Mama', team_side: 'both' },
  { group_id: 'lab-sg-mama-g', label: 'Mama', team_side: 'groom' },
  { group_id: 'lab-sg-relatives', label: 'Relatives', team_side: 'both' },
  { group_id: 'lab-sg-relatives-b', label: 'Relatives', team_side: 'bride' },
  { group_id: 'lab-sg-relatives-g', label: 'Relatives', team_side: 'groom' },
];
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

/** 🪪 `?part=screen&titles=1` — the List's "N people need Woman or Man for their title" row, on stand-in names. */
const LAB_TITLES_WAITING: TitleWaitingPerson[] = [
  { guestId: 'g-t1', name: 'Atty. Eufemia Dela Cruz', roleWord: 'Parents of the Groom', title: 'Atty.', key: titleKey('Atty.', null), text: titleButtonText('Atty.', null, true) },
  { guestId: 'g-t2', name: 'Dr. Eduardo Santos', roleWord: 'Parents of the Bride', title: 'Dr.', key: titleKey('Dr.', null), text: titleButtonText('Dr.', null, true) },
  { guestId: 'g-t3', name: 'Regional Prosecutor Rex Diaz', roleWord: 'Grandparents of the Groom', title: 'Regional Prosecutor', key: titleKey('Regional Prosecutor', null), text: titleButtonText('Regional Prosecutor', null, true) },
  { guestId: 'g-t4', name: 'Carmen Diaz', roleWord: 'Grandparents of the Groom', title: null, key: titleKey(null, null), text: titleButtonText(null, null, true) },
];

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

/** `&seats=2`'s two +1 rows: one named (Ana Cruz, attending), one still waiting for a name. */
const LAB_TWO_SEATS = [
  { guest_id: 'g-lab-s1', first_name: 'Ana', last_name: 'Cruz', plus_one_name_confirmed_at: '2026-10-01T00:00:00Z', created_at: '2026-09-30T00:00:00Z', rsvp_status: 'attending' as const },
  { guest_id: 'g-lab-s2', first_name: 'TBA', last_name: '+1', plus_one_name_confirmed_at: null, created_at: '2026-09-30T00:00:01Z', rsvp_status: 'pending' as const },
];

function cardData(g: GuestRow, isCouple: boolean): GuestCardData {
  return {
    guest: g,
    isCouple,
    hasSides: true,
    /* The wedding's real role picker (what `guest-card-data.ts` offers a non-couple guest), so the card's
       Details › Role in wedding opens on the shipped list rather than an empty menu. */
    availableRoles: WEDDING_ROLE_SET.offeredRoles.filter((r) => !WEDDING_ROLE_SET.coupleRoles.has(r)),
    groupOptions: ['family', 'friends'],
    isIncWedding: false,
    showTeaCeremony: false,
    plusOneLines: [],
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
/** `&many=N` — N generated guests (a long list to scroll), every name distinct and none matching the roster's. */
const MANY_FIRST = ['Ana', 'Ben', 'Celia', 'Dado', 'Ellen', 'Fermin', 'Gina', 'Hector', 'Iris', 'Jun', 'Karla', 'Leo', 'Mila', 'Noel', 'Olga', 'Pido'];
const MANY_LAST = ['Aquino', 'Bautista', 'Castillo', 'Domingo', 'Espiritu', 'Flores', 'Gonzales', 'Hernandez', 'Ilagan', 'Jacinto', 'Katigbak', 'Lualhati', 'Macaraeg', 'Navarro', 'Ocampo'];
function manyGuests(n: number): GuestRow[] {
  return Array.from({ length: n }, (_, i) =>
    guest({
      guest_id: `g-many-${i}`,
      public_id: `S89G-LABMN${String(i).padStart(5, '0')}`,
      first_name: MANY_FIRST[i % MANY_FIRST.length]!,
      last_name: `${MANY_LAST[Math.floor(i / MANY_FIRST.length) % MANY_LAST.length]!}${i >= MANY_FIRST.length * MANY_LAST.length ? ` ${Math.floor(i / (MANY_FIRST.length * MANY_LAST.length)) + 1}` : ''}`,
      role: 'guest',
      side: i % 2 ? 'groom' : 'bride',
      group_category: 'friends',
      rsvp_status: 'pending',
      invitation_sent_at: '2026-09-20T00:00:00Z',
      plus_one_count: 0,
      plus_one_allowed: false,
    }),
  );
}

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

/**
 * 🤝 `?plusones=1` — the owner's 2026-10-19 shape (cale-ice's List, read-only count): unnamed "+1 · TBA" seats on
 * side "both" under a bridesmaid, a principal sponsor, a family guest and a guest, plus one NAMED +1 — appended at
 * the END, the way the page's sort put them together under GUESTS. Stand-in names; nothing is read.
 */
function withPlusOnes(roster: GuestRow[], backfilled = false, paired = false): GuestRow[] {
  const seat = (id: string, of: string, p: Partial<GuestRow> = {}) =>
    guest({
      guest_id: id,
      public_id: `S89G-LABP1${id.slice(-4).padStart(5, '0')}`,
      first_name: 'TBA',
      last_name: '+1',
      display_name: '+1 · TBA',
      side: 'both',
      role: 'guest',
      rsvp_status: 'pending',
      invitation_sent_at: null,
      plus_one_of_guest_id: of,
      plus_one_mode: 'limited',
      ...p,
    });
  const bring = new Set(['g-mj-4', 'g-mj-6', 'g-mj-14', 'g-mj-24', 'g-mj-2']);
  return [
    ...roster.map((g) => (bring.has(g.guest_id) ? { ...g, plus_one_count: g.guest_id === 'g-mj-14' ? 2 : 1, plus_one_allowed: true } : g)),
    seat('g-p1-0004', 'g-mj-4'),
    seat('g-p1-0006', 'g-mj-6'),
    seat('g-p1-0014', 'g-mj-14'),
    seat('g-p1-0114', 'g-mj-14'),
    seat('g-p1-0024', 'g-mj-24'),
    seat('g-p1-0002', 'g-mj-2', { first_name: 'Paulo', last_name: 'Reyes', display_name: null, rsvp_status: 'attending', invitation_sent_at: '2026-09-20T00:00:00Z' }),
    /* 🪑 2026-10-20, live cale-ice, read-only: two of the groom's immediate family (`groom_immediate_family`, groom's side)
       whose "+1" seat rows were REMOVED (soft-deleted 2026-10-14) while their "+1" stayed — so the List drew a +1 pill
       over a seat with no row. Stand-in names, the same roles, sides and numbers; no seat row for either. */
    guest({ guest_id: 'g-p1-h001', public_id: 'S89G-LABP1H0001', first_name: 'Juana', last_name: 'Sison', role: 'groom_immediate_family', side: 'groom', group_category: 'family', rsvp_status: 'pending', invitation_sent_at: '2026-09-20T00:00:00Z', plus_one_count: 1, plus_one_allowed: true, ...(paired ? { pair_with_guest_id: 'g-p1-h002' } : {}) }),
    guest({ guest_id: 'g-p1-h002', public_id: 'S89G-LABP1H0002', first_name: 'Maxima', last_name: 'Sison', role: 'groom_immediate_family', side: 'groom', group_category: 'family', rsvp_status: 'pending', invitation_sent_at: '2026-09-20T00:00:00Z', plus_one_count: 1, plus_one_allowed: true, ...(paired ? { pair_with_guest_id: 'g-p1-h001' } : {}) }),
    /* 🤝 `&paired=1` — the same two as a PAIR (`pair_with_guest_id`, as live: Juanita ↔ Maxima Sacdalan) after the owner
       re-added their +1 on 2026-10-22: each has a live "+1 · TBA" row again, made the older way (host_seeded, limited).
       A pair is not drawn on the List (pairs live in the Wedding March) — each +1 still sits under their own guest. */
    ...(paired
      ? [seat('g-p1-0h01', 'g-p1-h001', { side: 'groom', group_category: 'family' }), seat('g-p1-0h02', 'g-p1-h002', { side: 'groom', group_category: 'family' })]
      : []),
    /* 🪑 2026-10-21, live cale-ice, read-only: a guest allowed +1 since 2026-09-14 whose seat was NEVER made (Antonio
       Loo, Ronald Llarena — owner: "why does Ronald Dane Llarena have a +1 but no row under him"). `&backfilled=1`
       draws the row the backfill (20271282098748) mints for him; without it, the List as it stood. */
    guest({ guest_id: 'g-p1-h003', public_id: 'S89G-LABP1H0003', first_name: 'Antonio', last_name: 'Loo', role: 'guest', side: 'groom', group_category: 'family', rsvp_status: 'pending', invitation_sent_at: '2026-09-20T00:00:00Z', plus_one_count: 1, plus_one_allowed: true }),
    ...(backfilled ? [seat('g-p1-0003', 'g-p1-h003', { side: 'groom', group_category: 'family' })] : []),
  ];
}

/**
 * 🧍‍♀️➡️🧍 THE CALE-ICE PAIR (owner 2026-10-27, verbatim: *"in cale-ice, mrs. ma. theresa sacdalan-tria will be proxied by
 * mrs. maria catherine sacdalan"*) — FIXTURES ONLY, nothing is read or written: a principal sponsor (Ninang) and the guest
 * who stands in for her. `?part=card&proxy=offer|named|holder|proxy|plain` draws each card; `?part=screen&proxies=1` adds
 * the pair to the List (one row).
 */
const LAB_HOLDER = { guest_id: 'g-proxy-theresa', name_prefix: 'Mrs.', first_name: 'Ma. Theresa', last_name: 'Sacdalan-Tria', role: 'principal_sponsor_ninang' as const, side: 'bride' as const, group_category: 'family' as const };
const LAB_PROXY = { guest_id: 'g-proxy-catherine', name_prefix: 'Mrs.', first_name: 'Maria Catherine', last_name: 'Sacdalan', role: 'guest' as const, side: 'bride' as const, group_category: 'family' as const };
function labProxyPair(): GuestRow[] {
  return [
    guest({ ...LAB_HOLDER, public_id: 'S89G-LABPX00001', rsvp_status: 'declined', invitation_sent_at: '2026-09-20T00:00:00Z', represented_by_guest_id: LAB_PROXY.guest_id, represented_since: '2026-10-27T01:00:00Z' }),
    guest({ ...LAB_PROXY, public_id: 'S89G-LABPX00002', rsvp_status: 'attending', invitation_sent_at: '2026-10-27T01:00:00Z' }),
  ];
}

/** 🤝 `?part=card&plusone=1` — the card opened on a plain guest's unnamed seat (live: Rose Marie Buanhug's), bride's side. */
const LAB_SEAT_HOST = { guest_id: 'g-mj-14', first_name: 'Rosa', last_name: 'Santos', display_name: null, side: 'bride' as const };

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

/* ⚡ ONE SAVE, ONE RENDER — the lab counts its own server renders (dev log `[one-render]`, and `data-lab-render` on the card's
   panel), so a walk can SEE how many times one press makes the server draw this page (`lib/one-save-one-render.ts`). */
let labRenders = 0;

/** 🪪 A lab guest's card as the Guest list draws it — in its panel (`?part=screen&open=1`). */
function labListCard(
  g: GuestRow,
  actions: { update: (f: FormData) => Promise<unknown>; release: (f: FormData) => Promise<void>; partnerLink: () => Promise<void> },
  refuse: boolean,
) {
  return (
    <LabGuestActions refuse={refuse}>
      <GuestCard
        frame="panel"
        eventId={EVENT}
        data={cardData(g, g.role === 'bride' || g.role === 'groom')}
        invitationBase="https://www.setnayan.com/maria-and-jose"
        photoDisplayUrl={null}
        returnTo={`/dev/guests-lab?part=screen&open=1&inspect=${g.guest_id}`}
        errorMessage={null}
        actions={actions as never}
        inviteFlash={null}
        inviteSetup={{ facts: { hostsName: 'Maria & Jose', eventWord: 'wedding', eventDate: '2026-12-12', datePrecision: 'day' }, template: null, slug: 'maria-and-jose' }}
        papic={{ access: 'on', ceiling: null }}
        storeShell={false}
        ticketVersion={null}
        helper={null}
      />
    </LabGuestActions>
  );
}

export default async function GuestsLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  labRenders += 1;
  console.log(`[one-render] /dev/guests-lab render #${labRenders} part=${typeof sp.part === 'string' ? sp.part : 'head'}`);

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
    // …and a save that lands REVALIDATES, as the real one does (`updateGuest` → `revalidatePath(…/guests)` before its quiet return).
    revalidatePath('/dev/guests-lab');
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
        <AccountBottomNav tabs={['events', 'discover', 'memories', 'people', 'shop']} />
      </div>
    );
  }

  if (part === 'card' || part === 'host') {
    const host = part === 'host';
    const low = sp.low === '1';
    const labPapic: GuestPapicState =
      sp.papic === 'off'
        ? { access: 'off', ceiling: undefined, door: papicHomeHref(EVENT) }
        : sp.papic === 'unknown'
          ? { access: 'unknown', ceiling: undefined }
          : { access: 'on', ceiling: sp.papic === 'set' ? 40 : sp.papic === 'none' ? 0 : null };
    /* 🪪 `&title=atty` — the groom's mother as cale-ice holds her ("Atty.", no woman / man yet: the pending pick);
       `&gender=woman` after she is picked as "Atty. (Woman)". */
    const pickedGender: GuestRow['gender'] = sp.gender === 'woman' ? 'woman' : sp.gender === 'man' ? 'man' : null;
    const titled: Partial<GuestRow> =
      sp.title === 'atty'
        ? { first_name: 'Eufemia', last_name: 'Dela Cruz', role: 'groom_parents', group_category: 'family', name_prefix: 'Atty.', gender: pickedGender }
        : {};
    /* 🏷 `&role=bride_immediate_family` — a sibling of the bride (stand-in name), for "Rename this section";
       `&vip=1` — the event's words with Immediate Family renamed "VIP" (owner 2026-10-19). The lab has no event: a keep
       is refused by the host fence, so the after-state is drawn from these fixture words. */
    const labRole = typeof sp.role === 'string' && sp.role ? (sp.role as GuestRow['role']) : null;
    const seatCard = sp.plusone === '1';
    const g0 = host
      ? guest({ guest_id: 'g-maria', first_name: 'Maria', last_name: 'Santos', side: 'bride', group_category: 'family', role: 'bride' })
      : seatCard
        ? sp.named === '1'
          ? /* 🚫 `&named=1` — a NAMED +1, as the owner's report showed one (2026-10-21, "Ms. pamela mitra labriaga · +1 of
               Pam"): their card has no Extra seats pick — "A +1 can't bring their own +1." */
            guest({ guest_id: 'g-p1-0015', name_prefix: 'Ms.', first_name: 'pamela', middle_name: 'mitra', last_name: 'labriaga', side: 'groom', group_category: 'work', rsvp_status: 'pending', invited_to_blocks: ['ceremony', 'reception', 'cocktails'] as GuestRow['invited_to_blocks'], plus_one_of_guest_id: LAB_SEAT_HOST.guest_id })
          : guest({ guest_id: 'g-p1-0014', first_name: 'TBA', last_name: '+1', display_name: '+1 · TBA', side: 'bride', rsvp_status: 'pending', plus_one_of_guest_id: LAB_SEAT_HOST.guest_id })
        : guest(labRole ? { ...titled, first_name: 'Bianca', last_name: 'Santos', role: labRole, group_category: 'family', side: 'bride' } : titled);
    /* 🖐 `&marked=1` — the guest's reply was set by the host (owner 2026-10-21): the RSVP row reads "Attending · Marked by you". */
    const g1: GuestRow = sp.marked === '1' ? { ...g0, rsvp_status: 'attending', rsvp_set_by: 'host' } : g0;
    /* 🪑 `&seats=2` — live: Antonio Loo / Darryl Jan Patrick Lim bring two +1s each. Here one is named, one is not yet. */
    const twoSeats = sp.seats === '2' && !seatCard && !host;
    const g: GuestRow = twoSeats ? { ...g1, plus_one_count: 2, plus_one_allowed: true } : g1;
    const seatLines = twoSeats
      ? {
          plusOneLines:
            sp.seatread === 'fail'
              ? null
              : sp.seatread === 'empty'
                ? []
                : plusOneSeatLines(g.guest_id, LAB_TWO_SEATS),
          /* 🪪 The same two seats as people — Additional Guests draws one card each (`plusOneSeatPeople`). */
          plusOnePeople: sp.seatread === 'fail' ? null : sp.seatread === 'empty' ? [] : plusOneSeatPeople(g.guest_id, LAB_TWO_SEATS),
        }
      : {};
    /* 🔗 `&linked=1` — a guest who has linked their account: Access › the level dropdown, and "Linked" under Account. */
    const linkedData =
      sp.linked === '1'
        ? { access: { level: 'none', live: true, lock: null }, linkedAccount: { email: 'daniel.ramos@example.com', memberType: 'guest' } }
        : {};
    const seatOf = seatCard ? { plusOneOf: plusOneOfWords(g, LAB_SEAT_HOST, 0) } : {};
    const labWords = sp.vip === '1' ? { 'section:immediate_family': { one: 'VIP' } } : {};
    /* 👥 `&proto=1` — the prototype's guest (guest_group_and_fast_add_2026-10-20.html, strip A): Corazon Reyes, a Ninang who is
       also the Candle Sponsor, in Family and two of the couple's own groups — the ONE Group / ONE Role dropdowns' after-state. */
    const proto = sp.proto === '1';
    const protoGuest = proto ? guest({ first_name: 'Corazon', last_name: 'Reyes', side: 'bride', group_category: 'family', role: 'principal_sponsor_ninang', extra_roles: ['candle_sponsor'] as GuestRow['extra_roles'] }) : null;
    const protoData = proto
      ? {
          groupOptions: ['family', 'friends', 'work', 'school', 'officiant', 'other'],
          groupChoices: {
            options: [
              { groupId: 'lab-g1', label: 'College Friends', teamSide: 'both' },
              { groupId: 'lab-g3', label: 'Cebu cousins', teamSide: 'both' },
              { groupId: 'lab-g4', label: 'Office — Makati', teamSide: 'both' },
              { groupId: 'lab-g2', label: 'Out of town', teamSide: 'both' },
            ],
            memberIds: ['lab-g1', 'lab-g2'],
          },
          customGroups: [
            { label: 'College Friends', teamSide: 'both' },
            { label: 'Out of town', teamSide: 'both' },
          ],
        }
      : {};
    /* 👥 `&sides=1` — a guest on `&side=` (default bride) with cale-ice's groups, already in College (groom's side). */
    const sides = sp.sides === '1';
    const labSide: GuestRow['side'] = sp.side === 'groom' ? 'groom' : sp.side === 'both' ? 'both' : 'bride';
    const sidesGuest = sides ? guest({ first_name: 'Lea', last_name: 'Ramos', side: labSide, group_category: 'friends', role: 'guest' }) : null;
    const sidesData = sides
      ? {
          groupOptions: ['family', 'friends', 'work', 'school', 'officiant', 'other'],
          groupChoices: {
            options: SIDE_GROUPS.map((x) => ({ groupId: x.group_id, label: x.label, teamSide: x.team_side })).sort((x, y) => x.label.localeCompare(y.label)),
            memberIds: ['lab-sg-college'],
          },
          customGroups: [{ label: 'College', teamSide: 'groom' }],
        }
      : {};
    /* 👗 `&dress=1` — a dress code as the Studio stores it (VIP · Immediate Family: men Suit and tie · women Long gown;
       Principal Sponsors: men Barong · women Filipiniana; Guests: men Suit · women Long dress), so the Seat fold's
       "Attire · 3D seat plan" line is drawn by the ONE reading (`guestOutfitOf`); without it, nothing is picked. */
    /* 🧍 `&proxy=` — the cale-ice pair (fixtures): offer · named (she typed a name on her reply) · holder (represented;
       `&after=1` she said she can come after all) · proxy (Maria Catherine's card, standing in) · plain (a plain guest: no row). */
    const proxyMode = typeof sp.proxy === 'string' ? sp.proxy : null;
    const proxyGuest =
      proxyMode === 'proxy'
        ? guest({ ...LAB_PROXY, rsvp_status: 'attending' })
        : proxyMode === 'plain'
          ? guest({ ...LAB_PROXY, rsvp_status: 'pending' })
          : proxyMode
            ? guest({
                ...LAB_HOLDER,
                rsvp_status: proxyMode === 'named' ? 'declined' : proxyMode === 'holder' && sp.after === '1' ? 'attending' : proxyMode === 'holder' ? 'declined' : 'attending',
                ...(proxyMode === 'holder' ? { represented_by_guest_id: LAB_PROXY.guest_id, represented_since: '2026-10-27T01:00:00Z' } : {}),
                ...(proxyMode === 'holder' && sp.after === '1' ? { rsvp_set_by: 'guest' as const, rsvp_responded_at: '2026-10-27T05:00:00Z' } : {}),
                ...(proxyMode === 'named' ? { proxy_named_by_guest: 'Maria Catherine Sacdalan', rsvp_set_by: 'guest' as const } : {}),
              })
            : null;
    const labChoices = [
      { guestId: LAB_PROXY.guest_id, name: 'Maria Catherine Sacdalan' },
      { guestId: 'g-mj-14', name: 'Rosa Santos' },
      { guestId: 'g-mj-15', name: 'Divina Mercado' },
      { guestId: 'g-mj-16', name: 'Carlo Santos' },
      { guestId: 'g-mj-24', name: 'Joana Cruz' },
    ];
    const proxyData = proxyMode
      ? {
          proxy:
            proxyMode === 'proxy'
              ? {
                  offer: false,
                  representedBy: null,
                  standingInFor: { guestId: LAB_HOLDER.guest_id, name: 'Ma. Theresa Sacdalan-Tria', role: LAB_HOLDER.role, extra_roles: [], roleWord: 'Principal Sponsor · Ninang', callTime: '2:00 PM' },
                  namedByGuest: null,
                  cameAfterAll: false,
                  choices: null,
                  unread: false,
                }
              : proxyMode === 'plain'
                ? { offer: false, representedBy: null, standingInFor: null, namedByGuest: null, cameAfterAll: false, choices: null, unread: false }
                : {
                    offer: true,
                    representedBy: proxyMode === 'holder' ? { guestId: LAB_PROXY.guest_id, name: 'Maria Catherine Sacdalan', rsvp: 'attending' as const } : null,
                    standingInFor: null,
                    namedByGuest: proxyMode === 'named' ? 'Maria Catherine Sacdalan' : null,
                    cameAfterAll: proxyMode === 'holder' && sp.after === '1',
                    choices: labChoices,
                    unread: false,
                  },
          tables: [{ tableId: 't-sponsors', label: 'Principal Sponsors 1' }],
          seatTableId: proxyMode === 'holder' ? null : 't-sponsors',
          seatedAt: proxyMode === 'holder' ? null : 'Principal Sponsors 1',
        }
      : {};
    const cardGuest = proxyGuest ?? sidesGuest ?? protoGuest ?? g;
    const labDress = sp.dress === '1'
      ? {
          groups: { vip_family: { style: 'suit' }, principal_sponsors: { style: 'barong_tagalog' } },
          roles: { guest: { style: 'suit' } },
          women: { groups: { vip_family: { style: 'long_gown' }, principal_sponsors: { style: 'filipiniana' } }, roles: { guest: { style: 'long_gown' } } },
        }
      : null;
    const labOutfit = guestOutfitWords(
      guestOutfitOf({
        // 🧍 A proxy wears the role they stand in for (`effectiveRoleOf`) — the same reading the real card makes.
        role: proxyMode === 'proxy' ? LAB_HOLDER.role : cardGuest.role,
        dressCodeConfig: labDress,
        palette: {},
        roleNames: labWords,
        person: { name_prefix: cardGuest.name_prefix ?? null, display_name: cardGuest.display_name ?? null, gender: cardGuest.gender ?? null, attire: cardGuest.attire },
      }),
    );
    const panelFrame = sp.frame === 'panel';
    const labCard = (
      <LabGuestActions refuse={labRefuses}>
        <GuestCard
          frame={panelFrame ? 'panel' : 'page'}
          eventId={EVENT}
          data={{ ...cardData(cardGuest, host), ...protoData, ...sidesData, ...seatOf, ...seatLines, ...linkedData, ...proxyData, roleNames: labWords, outfit: { wear: labOutfit.wear, from: labOutfit.from } } as GuestCardData}
          invitationBase="https://www.setnayan.com/maria-and-jose"
          photoDisplayUrl={null}
          returnTo={labBack}
          errorMessage={typeof sp.error === 'string' ? guestCardErrorCopy(sp.error) : null}
          actions={{ update: labUpdate, release: labRelease, partnerLink: labPartnerLink }}
          inviteFlash={null}
          inviteSetup={{
            facts: { hostsName: 'Maria & Jose', eventWord: 'wedding', eventDate: '2026-12-12', datePrecision: 'day' },
            template: null,
            slug: 'maria-and-jose',
          }}
          /* 📸 ?papic=off · ?papic=unknown · ?papic=set (40 credits) · ?papic=none — else on, sharing with everyone. */
          papic={labPapic}
          storeShell={false}
          ticketVersion={null}
          helper={null}
        />
      </LabGuestActions>
    );
    if (panelFrame) {
      return (
        <div className="sn-ambient min-h-screen" data-lab-render={labRenders}>
          <LabCardSheet>{labCard}</LabCardSheet>
          <UndoToastHost />
        </div>
      );
    }
    return (
      <div className="sn-ambient min-h-screen">
        <main className="sn-vt-page">
          <div data-shell-main>
            <div className="sn-page-enter">
              {/* The panel over the Guest list, as a phone shows it: inset from the left. */}
              <div className="ml-12 min-h-dvh rounded-l-3xl bg-cream px-[18px] pb-10 pt-6 shadow-xl" data-lab-card="" data-lab-render={labRenders}>
                {low ? <div aria-hidden className="h-[440px]" data-lab-low="" /> : null}
                {labCard}
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

  /* ⚙ Guests settings — the REAL rows on fixture data, in the real Guests screen's ⚙ sheet, opened
     (`?part=setup` = `?part=screen&settings=1`; `&row=<key>` lands on a row). */
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
                      requests={3}
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
    const roster00 = sp.plusones === '1' ? withPlusOnes(planningRoster(), sp.backfilled === '1', sp.paired === '1') : planningRoster();
    /* 📜 `&many=N` — N more guests after maria-and-jose's (owner 2026-10-24, live: a search on a long list left the hit
       above the screen), so a search can be walked on a list a phone has to scroll. */
    const roster0 = roster00
      .concat(manyGuests(Math.min(400, Math.max(0, Number(typeof sp.many === 'string' ? sp.many : 0) || 0))))
      // 🧍 `&proxies=1` — the cale-ice pair (fixtures): ONE row on the List, counted once.
      .concat(sp.proxies === '1' ? labProxyPair() : []);
    /* 🖐 `&marked=1` — two replies the host set (owner 2026-10-21), so the rows' quiet "marked" can be seen. */
    const roster1 = sp.marked === '1'
      ? roster0.map((g) => (g.guest_id === 'g-mj-5' || g.guest_id === 'g-mj-9' ? { ...g, rsvp_status: 'attending' as const, rsvp_set_by: 'host' as const } : g))
      : roster0;
    /* 🪪 `&typed=1` — two names typed all lower case (guest_page_fixes_2_4 fix 3, owner 2026-10-21): the list SHOWS them
       cased ("Pamela Labriaga", "Jose de los Santos"), the rows keep what was typed. */
    const TYPED: Record<string, [string, string]> = { Daniel: ['jose', 'dela cruz'], Gabriel: ['gabriel', 'de los santos'] };
    const roster = sp.typed === '1'
      ? roster1.map((g) => {
          const t = g.first_name ? TYPED[g.first_name] : undefined;
          return t ? { ...g, first_name: t[0], last_name: t[1], display_name: null } : g;
        })
      : roster1;
    const GROUPS: Record<string, string[]> = {
      'g-mj-24': ['Barkada'],
      'g-mj-25': ['Barkada'],
      'g-mj-26': ['Barkada', 'Choir'],
      'g-mj-27': ['Barkada'],
      'g-mj-14': ['Choir'],
    };
    const tables = [...new Set(MJ_ROSTER.map((r) => r[4]))].map((label, i) => ({ tableId: `t-${i}`, label }));
    const tableByGuest = Object.fromEntries(MJ_ROSTER.map(([, , , , table], i) => [`g-mj-${i}`, table]).filter((_, i) => i % 3 !== 2));
    const gview = sp.gview === 'map' ? 'map' : 'list';
    const empty = sp.empty === '1';
    const fail = sp.fail === '1';
    /* `&addMs=N`: an add answers after N ms, as a real one waits on the server (lab-stand-ins.ts › labTimedAdds). */
    const labAddMs = Math.min(10_000, Math.max(0, Number(typeof sp.addMs === 'string' ? sp.addMs : 0) || 0));
    const labActs = { update: labUpdate, release: labRelease, partnerLink: labPartnerLink };
    const listCard = (g: GuestRow) => labListCard(g, labActs, labRefuses);
    /* ⚡ What a tap reads now: ONE card, alone (the lab's stand-in for `openGuestCard`) — an INLINE server action (not
       exported), so a tap is a real round trip to the server that answers with this card and nothing else. ⚠ Declared
       BEFORE the JSX that hands it on: Next compiles an inline server action into a binding at its declaration, so it is
       not hoisted like a plain function — handed on above it, it arrives undefined. */
    const labMany = Math.min(400, Math.max(0, Number(typeof sp.many === 'string' ? sp.many : 0) || 0));
    async function labOpenCard(guestId: string) {
      'use server';
      const g = planningRoster().concat(manyGuests(labMany)).find((x) => x.guest_id === guestId);
      return g
        ? { ok: true as const, card: labListCard(g, labActs, labRefuses) }
        : { ok: false as const, reason: 'This guest isn’t on your guest list any more.' };
    }
    const screen = (
                <section className="sn-col max-w-none flex flex-col gap-6" data-lab-screen="">
                  <LabGuestActions refuse={sp.refuse === '1'} addMs={labAddMs} openCard={labOpenCard}>
                  <GuestsScreen
                    eventId={EVENT}
                    gview={gview}
                    guests={empty || fail ? [] : sp.oneqr === '1' ? roster.filter((g) => g.role === 'bride' || g.role === 'groom') : roster}
                    measured={!fail}
                    hasSides
                    groupsByGuest={GROUPS}
                    groups={
                      sp.sides === '1'
                        ? SIDE_GROUPS
                        : [
                            { group_id: 'grp-b', label: 'Barkada', team_side: 'both' },
                            { group_id: 'grp-c', label: 'Choir', team_side: 'both' },
                          ]
                    }
                    tables={tables}
                    tableByGuest={tableByGuest}
                    songsByGuest={{}}
                    linkedGuestIds={roster.filter((_, i) => i % 2 === 0).map((g) => g.guest_id)}
                    faceByGuest={{}}
                    requests={sp.req === '0' ? 0 : 3}
                    oneQr={sp.oneqr === '1'}
                    titlesWaiting={sp.titles === '1' ? LAB_TITLES_WAITING : []}
                    rootLabel="Maria & Jose"
                    initialQuery={typeof sp.q === 'string' ? sp.q : ''}
                    setup={setupRows}
                    settingsOpen={part === 'setup' || sp.settings === '1'}
                    settingsRow={typeof sp.row === 'string' ? sp.row : null}
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
    );
    /* 🪪 `&open=1` — the screen inside the REAL `InspectorLayout` the Guests page draws it in (`mobileSheet`), so a tap
       on a row opens that guest's card the way the page does and tap → card can be TIMED (guest card opens fast,
       2026-10-28; `&many=150` for a list the size of a real one). `&inspect=<id>` is the page's own address for an open
       card: the lab draws that guest's card on the server, as `guests/page.tsx` does — the cold-load / deep-link path. */
    const openMode = sp.open === '1';
    const inspectedGuest = openMode && typeof sp.inspect === 'string' ? (roster.find((g) => g.guest_id === sp.inspect) ?? null) : null;
    const opened = openMode ? (
      <InspectorLayout
        paramKey="inspect"
        className="sn-inspector-shell--card"
        mobileSheet
        hasSelection={Boolean(inspectedGuest)}
        inspectorId={inspectedGuest?.guest_id ?? null}
        master={screen}
        inspector={inspectedGuest ? listCard(inspectedGuest) : null}
      />
    ) : null;
    /* `&shell=1` — the REAL One Shell around the screen (rail + bar + the event's
       menu, `boundary="tab"`), for the tablet/desktop walk. */
    if (sp.shell === '1') {
      return (
        <RoleNamesProvider names={{}}>
          <LabShell eventId={EVENT}>{screen}</LabShell>
          <LabGuestActions refuse={sp.refuse === '1'} addMs={labAddMs}>
            <AddGuestSheet eventId={EVENT} defaultSide="both" />
          </LabGuestActions>
          <UndoToastHost />
        </RoleNamesProvider>
      );
    }
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
                {opened ?? screen}
              </div>
            </div>
          </main>
          <DockStandIn />
          {/* &spot=1 — the Guests page's first-visit spotlight (customer_guest_list_v2), first run, nothing recorded. */}
          {sp.spot === '1' ? <LabPageSpotlight tourKey="customer_guest_list_v2" script={TOURS.customer_guest_list_v2.spotlight!} /> : null}
          {/* The + sheet's name box reaches its add through the SAME stand-ins as the screen — never the real action. */}
          <LabGuestActions refuse={sp.refuse === '1'} addMs={labAddMs}>
            <AddGuestSheet eventId={EVENT} defaultSide="both" />
            {/* "Add another way › With details" — the shipped Quick add, on the lab's roster. */}
            <QuickAddSheet
              eventId={EVENT}
              existingGuests={roster.map((g) => ({ guest_id: g.guest_id, first_name: g.first_name, last_name: g.last_name, side: g.side, role: g.role, extra_roles: g.extra_roles ?? [] }))}
              groups={[
                { group_id: 'grp-b', label: 'Barkada' },
                { group_id: 'grp-c', label: 'Choir' },
              ]}
            />
          </LabGuestActions>
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
