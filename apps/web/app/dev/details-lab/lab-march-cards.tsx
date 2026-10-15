import { GuestCardBody } from '@/app/dashboard/[eventId]/guests/_components/guest-card-body';
import type { GuestCardData } from '@/app/dashboard/[eventId]/guests/_components/guest-card-data';
import type { MarchCardResult } from '@/app/dashboard/[eventId]/launch/march-card-actions';
import type { GuestRow } from '@/lib/guests';
import { LAB_MARCH_RENAMES, labMarchPerson } from './march-fixture';

/**
 * 🪪 THE LAB'S STAND-IN FOR A TAPPED NAME'S GUEST CARD (DEV-ONLY — `/dev/details-lab?item=march`,
 * `/dev/maker-lab?studio=1`; production 404s the labs).
 *
 * The Wedding March opens a person's OWN guest card over the march (owner 2026-10-14). In the Maker that card is read by
 * `openMarchGuestCard`; here, with no database, this INLINE server action (not exported from a "use server" file, so the
 * server-action budget does not count it) draws the SAME `GuestCardBody` — the hand-drawn kit, the panel variant — over
 * maria-and-jose's lab march, with the card's three writes stood in: a save of the name keeps it in this dev server's memory
 * (`LAB_MARCH_RENAMES`, read by the lab march), so "rename → close → the march shows the new name" can be walked. Nothing
 * reaches a database.
 */
const LAB_EVENT = '00000000-0000-4000-8000-000000000000';

function labGuest(p: NonNullable<ReturnType<typeof labMarchPerson>>): GuestRow {
  const side = p.role.startsWith('groom') ? 'groom' : p.role.startsWith('bride') ? 'bride' : 'both';
  return {
    guest_id: p.id,
    rsvp_responded_at: null,
    public_id: 'S89G-LABMARCH01',
    event_id: LAB_EVENT,
    first_name: p.first,
    last_name: p.last,
    name_prefix: p.prefix,
    middle_name: null,
    name_suffix: null,
    pair_with_guest_id: null,
    display_name: null,
    side,
    group_category: 'family',
    role: p.role,
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
  } as unknown as GuestRow;
}

export async function labOpenMarchCard(eventId: string, guestId: string): Promise<MarchCardResult> {
  'use server';
  const p = labMarchPerson(guestId);
  if (!p) return { ok: false, reason: 'This lab card is not on the lab’s guest list — the owner-shaped march has no cards.' };
  const g = labGuest(p);
  const couple = p.role === 'bride' || p.role === 'groom';
  const data = {
    guest: g,
    isCouple: couple,
    hasSides: true,
    availableRoles: [],
    groupOptions: ['family', 'friends'],
    isIncWedding: false,
    showTeaCeremony: false,
    plusOneStateLabel: null,
    plusOneGuestId: null,
    initialInvited: [],
    seatedAt: null,
    customGroups: [],
    recordedAt: null,
    access: null,
    canManageAccess: false,
    offersThisIsMe: false,
    nameLinked: false,
    linkedAccount: null,
    profileName: null,
    roleNames: {},
    tables: null,
    seatTableId: null,
    groupChoices: null,
  } as unknown as GuestCardData;
  const id = p.id;
  async function labUpdate(formData: FormData) {
    'use server';
    const first = String(formData.get('first_name') ?? '').trim();
    const last = String(formData.get('last_name') ?? '').trim();
    if (!first || !last) return { refused: 'missing_name' };
    const prefix = String(formData.get('name_prefix') ?? '').trim();
    LAB_MARCH_RENAMES.set(id, { prefix: prefix || null, first, last });
  }
  async function labRelease() {
    'use server';
  }
  async function labPartnerLink() {
    'use server';
  }
  return {
    ok: true,
    card: (
      <GuestCardBody
        eventId={eventId}
        data={data}
        invitationBase="https://www.setnayan.com/maria-and-jose"
        photoDisplayUrl={null}
        variant="panel"
        returnTo={`/dev/details-lab?item=march`}
        errorMessage={null}
        inviteFlash={null}
        actions={{ update: labUpdate, release: labRelease, partnerLink: labPartnerLink }}
      />
    ),
  };
}
