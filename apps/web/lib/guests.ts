import type { SupabaseClient } from '@supabase/supabase-js';

export type GuestRole =
  | 'guest'
  | 'maid_of_honor'
  | 'matron_of_honor'
  | 'best_man'
  | 'bridesmaid'
  | 'groomsman'
  | 'principal_sponsor'
  | 'candle_sponsor'
  | 'veil_sponsor'
  | 'cord_sponsor'
  | 'coin_sponsor'
  | 'ring_bearer'
  | 'bible_bearer'
  | 'coin_bearer'
  | 'flower_girl'
  | 'officiant'
  | 'reader_lector'
  | 'soloist_musician';

export type GuestSide = 'bride' | 'groom' | 'both';
export type GuestGroupCategory =
  | 'family'
  | 'friends'
  | 'work'
  | 'school'
  | 'officiant'
  | 'other';
export type MealPreference =
  | 'beef'
  | 'chicken'
  | 'fish'
  | 'vegetarian'
  | 'vegan'
  | 'kids'
  | 'no_preference';
export type RsvpStatus = 'pending' | 'attending' | 'declined' | 'maybe';

export type GuestRow = {
  guest_id: string;
  public_id: string;
  event_id: string;
  first_name: string;
  last_name: string;
  display_name: string | null;
  side: GuestSide;
  group_category: GuestGroupCategory;
  role: GuestRole;
  plus_one_allowed: boolean;
  plus_one_name: string | null;
  plus_one_of_guest_id: string | null;
  plus_one_mode: 'full' | 'limited' | null;
  email: string | null;
  mobile: string | null;
  meal_preference: MealPreference | null;
  dietary_restrictions: string | null;
  photo_consent: boolean;
  invited_to_blocks: string[];
  rsvp_status: RsvpStatus;
  notes: string | null;
  qr_token: string;
  custom_tags: string[];
  created_at: string;
};

export const INVITED_TO_BLOCKS = [
  'ceremony',
  'reception',
  'cocktails',
  'after_party',
  'rehearsal_dinner',
] as const;

export type InvitedToBlock = (typeof INVITED_TO_BLOCKS)[number];

export const INVITED_TO_LABELS: Record<InvitedToBlock, string> = {
  ceremony: 'Ceremony',
  reception: 'Reception',
  cocktails: 'Cocktails',
  after_party: 'After-party',
  rehearsal_dinner: 'Rehearsal dinner',
};

export const MEAL_LABELS: Record<MealPreference, string> = {
  beef: 'Beef',
  chicken: 'Chicken',
  fish: 'Fish',
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  kids: 'Kids',
  no_preference: 'No preference',
};

export const ROLE_LABELS: Record<GuestRole, string> = {
  guest: 'Guest',
  maid_of_honor: 'Maid of Honor',
  matron_of_honor: 'Matron of Honor',
  best_man: 'Best Man',
  bridesmaid: 'Bridesmaid',
  groomsman: 'Groomsman',
  principal_sponsor: 'Principal Sponsor (Ninong/Ninang)',
  candle_sponsor: 'Candle Sponsor',
  veil_sponsor: 'Veil Sponsor',
  cord_sponsor: 'Cord Sponsor',
  coin_sponsor: 'Coin Sponsor (Arrhae)',
  ring_bearer: 'Ring Bearer',
  bible_bearer: 'Bible Bearer',
  coin_bearer: 'Coin Bearer',
  flower_girl: 'Flower Girl',
  officiant: 'Officiant',
  reader_lector: 'Reader / Lector',
  soloist_musician: 'Soloist / Musician',
};

export const SIDE_LABELS: Record<GuestSide, string> = {
  bride: "Bride's side",
  groom: "Groom's side",
  both: 'Both sides',
};

export const GROUP_CATEGORY_LABELS: Record<GuestGroupCategory, string> = {
  family: 'Family',
  friends: 'Friends',
  work: 'Work',
  school: 'School',
  officiant: 'Officiant',
  other: 'Other',
};

export const RSVP_LABELS: Record<RsvpStatus, string> = {
  pending: 'Pending',
  attending: 'Attending',
  declined: 'Declined',
  maybe: 'Maybe',
};

export type GuestStats = {
  total: number;
  attending: number;
  pending: number;
  declined: number;
  maybe: number;
  plus_ones: number;
};

const GUEST_FIELDS =
  'guest_id,public_id,event_id,first_name,last_name,display_name,side,group_category,role,plus_one_allowed,plus_one_name,plus_one_of_guest_id,plus_one_mode,email,mobile,meal_preference,dietary_restrictions,photo_consent,invited_to_blocks,rsvp_status,notes,qr_token,custom_tags,created_at';

export async function fetchGuestsByEvent(
  supabase: SupabaseClient,
  eventId: string,
): Promise<GuestRow[]> {
  const { data, error } = await supabase
    .from('guests')
    .select(GUEST_FIELDS)
    .eq('event_id', eventId)
    .is('deleted_at', null)
    .order('last_name', { ascending: true })
    .order('first_name', { ascending: true });

  if (error) {
    throw new Error(`fetchGuestsByEvent failed: ${error.message}`);
  }

  return (data ?? []) as unknown as GuestRow[];
}

export async function fetchGuestById(
  supabase: SupabaseClient,
  eventId: string,
  guestId: string,
): Promise<GuestRow | null> {
  const { data, error } = await supabase
    .from('guests')
    .select(GUEST_FIELDS)
    .eq('event_id', eventId)
    .eq('guest_id', guestId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    throw new Error(`fetchGuestById failed: ${error.message}`);
  }
  return (data ?? null) as unknown as GuestRow | null;
}

export function computeGuestStats(guests: GuestRow[]): GuestStats {
  const stats: GuestStats = {
    total: guests.length,
    attending: 0,
    pending: 0,
    declined: 0,
    maybe: 0,
    plus_ones: 0,
  };

  for (const guest of guests) {
    if (guest.rsvp_status === 'attending') stats.attending += 1;
    else if (guest.rsvp_status === 'pending') stats.pending += 1;
    else if (guest.rsvp_status === 'declined') stats.declined += 1;
    else if (guest.rsvp_status === 'maybe') stats.maybe += 1;
    if (guest.plus_one_allowed) stats.plus_ones += 1;
  }

  return stats;
}

export function guestDisplayName(guest: GuestRow): string {
  return guest.display_name?.trim() || `${guest.first_name} ${guest.last_name}`.trim();
}

export function guestInitials(guest: GuestRow): string {
  const first = guest.first_name.charAt(0).toUpperCase();
  const last = guest.last_name.charAt(0).toUpperCase();
  return `${first}${last}` || guest.first_name.slice(0, 2).toUpperCase() || '??';
}
