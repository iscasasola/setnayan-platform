/**
 * THE REHEARSAL FIXTURE — the one place its names and ids are written.
 *
 * `seed.mts` hands these to `seed.sql` as settings, and `journey.spec.ts` /
 * `sweep.spec.ts` walk to them — so neither can be looking for a guest the seed
 * did not make. Everything here exists only in the throw-away database a
 * rehearsal run starts and discards. No real person, no real address, no real
 * account.
 */

/**
 * One guest per way a reply can stand (rsvp_status × who set it, plus the two
 * "no reply yet" shapes and a plus-one). The control sweep opens each one's
 * card on its own, because a card draws different controls for each state —
 * the reply dropdown that crashed on 2026-11-23 is one of them.
 */
export const REPLY_STATE_GUESTS = [
  { id: '61616161-0000-4000-8000-000000000001', firstName: 'Lorna', lastName: 'Reyes', rsvp: 'pending', setBy: null, invited: false, plusOne: false },
  { id: '61616161-0000-4000-8000-000000000002', firstName: 'Marites', lastName: 'Reyes', rsvp: 'pending', setBy: null, invited: true, plusOne: false },
  { id: '61616161-0000-4000-8000-000000000003', firstName: 'Nestor', lastName: 'Reyes', rsvp: 'attending', setBy: 'guest', invited: true, plusOne: false },
  { id: '61616161-0000-4000-8000-000000000004', firstName: 'Ofelia', lastName: 'Reyes', rsvp: 'attending', setBy: 'host', invited: true, plusOne: false },
  { id: '61616161-0000-4000-8000-000000000005', firstName: 'Pacita', lastName: 'Reyes', rsvp: 'attending', setBy: 'guest', invited: true, plusOne: true },
  { id: '61616161-0000-4000-8000-000000000006', firstName: 'Quintin', lastName: 'Reyes', rsvp: 'declined', setBy: 'guest', invited: true, plusOne: false },
  { id: '61616161-0000-4000-8000-000000000007', firstName: 'Rosario', lastName: 'Reyes', rsvp: 'declined', setBy: 'host', invited: true, plusOne: false },
  { id: '61616161-0000-4000-8000-000000000008', firstName: 'Servando', lastName: 'Reyes', rsvp: 'maybe', setBy: 'guest', invited: true, plusOne: false },
  { id: '61616161-0000-4000-8000-000000000009', firstName: 'Teodora', lastName: 'Reyes', rsvp: 'maybe', setBy: 'host', invited: true, plusOne: false },
] as const;

const ATTENDING_REPLY_STATES = REPLY_STATE_GUESTS.filter((g) => g.rsvp === 'attending').length;

/**
 * Every guided-tour key the app ships, marked seen for both accounts — a
 * welcome tour drawn over a screen would cover the controls the sweep presses.
 * A NEW tour key that is not here shows up in the sweep as "could not press".
 */
export const TOURS_SEEN = [
  'couple_welcome_v1', 'customer_account_bar_v2', 'customer_adaptive_theme_v1', 'customer_add_scene_v1',
  'customer_apply_pro_v1', 'customer_budget_v1', 'customer_details_bound_v1', 'customer_details_guided_v1',
  'customer_event_menu_v1', 'customer_galleries_v1', 'customer_guest_invite_v1', 'customer_guest_list_v1',
  'customer_guest_list_v2', 'customer_hero_designs_v1', 'customer_library_v1', 'customer_love_story_v1',
  'customer_ombre_background_v1', 'customer_papic_v1', 'customer_people_v1', 'customer_people_v3',
  'customer_post_event_v1', 'customer_print_menu_v1', 'customer_print_story_poster_v1', 'customer_pro_qr_v1',
  'customer_schedule_v1', 'customer_seat_plan_v1', 'customer_vendors_v1', 'customer_wish_list_v1',
  'discover_upcoming_v1', 'host_day_spotlight_v1', 'host_spotlight_v1',
  'supplier_spotlight_v1', 'vendor_customers_v1', 'vendor_setup_tour_v1', 'vendor_welcome_v1',
] as const;

export const FIXTURE = {
  hostEmail: 'host@rehearsal.test',
  /** Fixed so the walk can open the event without first reading the database. */
  eventId: 'e0e0e0e0-0000-4000-8000-000000000001',
  slug: 'rehearsal-maria-juan',
  eventName: 'Maria & Juan',
  brideName: 'Maria Santos',
  groomName: 'Juan Dela Cruz',
  /** What a guest must see on the door and the public page. */
  hostNames: ['Maria', 'Juan'],
  /** The one guest the walk invites: not yet invited, not yet replied. */
  invitedGuest: {
    id: '60606060-0000-4000-8000-000000000001',
    firstName: 'Andres',
    lastName: 'Bonifacio',
    fullName: 'Andres Bonifacio',
    qrToken: 'c0ffee00000000000000000000000001',
  },
  /** The couple, the invited guest, the reply-state guests, and this many more. */
  otherGuests: 27,
  /** Of those 27: this many already said yes. */
  attendingAtStart: 14,
  /** Everyone "coming" before the walk's guest replies: the 27's yeses plus the reply-state yeses. */
  comingAtStart: 14 + ATTENDING_REPLY_STATES,
  /** 2 (the couple) + 1 (the invited guest) + the reply-state guests + the 27. */
  guestsInAll: 3 + REPLY_STATE_GUESTS.length + 27,
  suppliers: 12,
  orders: 3,
  /**
   * The SUPPLIER account the control sweep signs in as. It owns shop 3 (the
   * photographer): published, verified, three live services, and booked on the
   * couple's event — so its client view of that event opens too.
   */
  supplier: {
    email: 'supplier@rehearsal.test',
    fullName: 'Lito Camacho',
    shopNumber: 3,
    shopSlug: 'rehearsal-shop-03',
  },
} as const;
