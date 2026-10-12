/**
 * 🧪 STUDIO › E-GIFTS › WISH LIST ON FIXTURES (DEV-ONLY — `/dev/details-lab?studio=1&item=gifts`).
 *
 * The prototype's own seed (`egifts_wish_list_2026-10-08_fable.html` `SEED` +
 * `GENERAL`): five wishes, five gifts guests say they sent (₱14,500), one wish
 * that reached its price. Run through the REAL `studioWishListFrom`, so the lab
 * draws what the couple's read would hand the screen — no database, no R2 (a
 * fixture wish has no photo, and says so by showing none).
 *
 * `?wish=` picks the state: `five` (default) · `empty` · `fail` (the read was
 * refused) · `noway` (no way to give is on) · `off` (Accept gifts? No).
 * Writes go to the real action, which refuses without a session — the lab shows
 * states, it does not keep anything.
 */
import type { GiftRecordRow, WishItemRow } from '@/lib/wish-list';
import { studioWishListFrom, type StudioWishList } from '@/lib/wish-list-studio';
import { guestWishListFrom, type GuestWishList } from '@/lib/wish-list-guest';

const EVENT = '00000000-0000-4000-8000-000000000000';
const id = (n: number) => `00000000-0000-4000-8000-0000000001${String(n).padStart(2, '0')}`;

const wish = (n: number, name: string, price: number | null, got: 'auto' | 'host' | null = null, link: string | null = null): WishItemRow => ({
  wish_item_id: id(n),
  public_id: `S89H-LAB000000${n}`,
  event_id: EVENT,
  name,
  price_php: price,
  photo_r2_key: null,
  link_url: link,
  note: null,
  sort_order: n,
  got_at: got ? '2026-10-03T03:20:00.000Z' : null,
  got_by: got,
  created_at: '2026-10-01T00:00:00.000Z',
  updated_at: '2026-10-01T00:00:00.000Z',
});

const gift = (n: number, toward: number | null, who: string, amount: number, kind: string, at: string, message: string, shot = true): GiftRecordRow => ({
  gift_record_id: id(50 + n),
  public_id: `S89Y-LAB000000${n}`,
  event_id: EVENT,
  wish_item_id: toward == null ? null : id(toward),
  amount_php: amount,
  screenshot_r2_key: shot ? `r2://setnayan-thread-files/gift-shots/${EVENT}/lab-${n}.jpg` : null,
  message,
  giver_name: who,
  giver_guest_id: null,
  method_kind: kind,
  created_at: at,
  removed_at: null,
});

const WISHES: WishItemRow[] = [
  { ...wish(1, 'Air fryer', 4500), note: 'the 6 L one, black' },
  wish(2, 'Rice cooker', 3200),
  wish(3, 'Luggage set', 8900),
  wish(4, 'Coffee maker', 6000),
  wish(5, 'Bed linen', 2500, 'auto'),
];

/* Newest first, as the couple's read orders them (Manila is UTC+8). */
const GIFTS: GiftRecordRow[] = [
  gift(1, 1, 'Tita Nene', 2000, 'gcash', '2026-10-06T07:12:00.000Z', 'For your merienda machine! Love you both'),
  gift(2, 1, 'Kuya Jun', 2000, 'bank', '2026-10-05T01:40:00.000Z', 'Congrats, mga bata.', false),
  gift(3, 3, 'Ate Grace', 3000, 'gcash', '2026-10-04T11:05:00.000Z', 'For the honeymoon!'),
  gift(4, null, 'Ninong Bert', 5000, 'gcash', '2026-10-04T06:30:00.000Z', 'Congratulations to you both!'),
  gift(5, 5, 'Lola Cely', 2500, 'gcash', '2026-10-03T03:20:00.000Z', 'Sweet dreams, apo.'),
];

export type LabWishState = 'five' | 'empty' | 'fail' | 'noway' | 'off';

export function labWishState(raw: string | undefined): LabWishState {
  return raw === 'empty' || raw === 'fail' || raw === 'noway' || raw === 'off' ? raw : 'five';
}

export function labWishList(state: LabWishState): StudioWishList {
  if (state === 'fail') return { read: false };
  if (state === 'empty') return studioWishListFrom([], [], () => null);
  return studioWishListFrom(WISHES, GIFTS, () => null);
}

/* ── the guest's side (`/dev/maker-lab/guest?wish=…`) ────────────────────── */

/** The prototype's `MORE` — nine more wishes for the long list (frame 22); the last two are got. */
const MORE: Array<[string, number]> = [
  ['Indoor plant', 900],
  ['Reading lamp', 1800],
  ['Bath towels', 1500],
  ['Stand mixer', 12500],
  ['Dinner plates', 3400],
  ['Picture frames', 1200],
  ['Electric kettle', 1600],
  ['Throw pillows', 2200],
  ['Wall clock', 1900],
];

export type LabGuestWishState = 'five' | 'got' | 'long' | 'noprice' | 'fail';

export function labGuestWishState(raw: string | undefined): LabGuestWishState {
  return raw === 'got' || raw === 'long' || raw === 'noprice' || raw === 'fail' ? raw : 'five';
}

/** The same seed, through the REAL guest view builder — one sum per wish, no giver's name. */
/** `mine` — the reader has themselves sent ₱1,000 toward the luggage set (wish list 4/5: "You sent ₱1,000 ✓"). */
export function labGuestWishList(state: LabGuestWishState, mine = false): GuestWishList {
  if (state === 'fail') return { read: false };
  let wishes = WISHES;
  let gifts = GIFTS;
  if (state === 'got') {
    /* Frame 21: one more ₱500 reaches the air fryer's ₱4,500 — marked for the couple. */
    wishes = WISHES.map((w) => (w.name === 'Air fryer' ? { ...w, got_at: '2026-10-07T02:00:00.000Z', got_by: 'auto' as const } : w));
    gifts = [gift(9, 1, 'Tita Nene', 500, 'gcash', '2026-10-07T02:00:00.000Z', ''), ...GIFTS];
  }
  if (state === 'long') {
    const more = MORE.map(([name, price], i) => wish(10 + i, name, price, i > 6 ? 'auto' : null));
    wishes = [...WISHES, ...more];
    gifts = [...GIFTS, ...MORE.flatMap(([, price], i) => (i > 6 ? [gift(20 + i, 10 + i, 'Ate Grace', price, 'gcash', '2026-10-03T03:20:00.000Z', '')] : []))];
  }
  if (state === 'noprice') {
    wishes = WISHES.map((w) => ({ ...w, price_php: null, note: null, got_at: null, got_by: null }));
  }
  const luggage = wishes.find((w) => w.name === 'Luggage set');
  return guestWishListFrom(
    wishes,
    gifts,
    () => null,
    mine && luggage ? [{ wish_item_id: luggage.wish_item_id, amount_php: 1000, removed_at: null }] : [],
  );
}
