import type { SupabaseClient } from '@supabase/supabase-js';
import { publicDisplayName } from '@/lib/find-your-seat';

/**
 * ⭐👥 GUEST REVIEWS — what a guest who was THERE saw (owner, 6 Nov 2026).
 *
 * Owner, verbatim: *"Guest review and cohosts' review are different. Cohosts reviews are the ones who experience
 * planning with the supplier. Guests only experience the end result."* And his answers the same day:
 *   · the shop's overall stars are HOSTS / CO-HOSTS ONLY — a guest review shows in its own "From guests" group and
 *     never moves them (`vendor_trusted_review_stats` reads `vendor_reviews` only; guests have their own line,
 *     `vendor_guest_review_stats`);
 *   · ONE guest-review store and ONE "From guests" section; a guest is shown as first name + initial ("Gabriel D.")
 *     or initials ("G. D."); public at once, Setnayan admin can hide it;
 *   · the gate is a door check-in OR a received scanner claim, through ONE writer both doors call
 *     (`vendor_guest_review_submit`, migration 20271316933967 — see `submitGuestReview` below);
 *   · a guest who writes one gets the supplier's gift if the supplier set one, otherwise a thank-you
 *     (`guestReviewGiftFor` — the seam; nothing on main lets a supplier set a guest gift yet).
 *
 * Prototype: claude.ai/artifact/GWJhmWLcRijfyofpTLLs8o, sections 7–10.
 *
 * Pure + client-injected (no `server-only`): the reads take the client they run on, so the three-state contract is
 * tested against a stubbed client (`guest-reviews.test.ts`), the same shape as `lib/guests.ts`.
 */

/** Two lines at the card's 13 px type on a 390 px phone (prototype § 7, "Why 140"). Same CHECK in the table. */
export const GUEST_REVIEW_LINE_MAX = 140;
/** The shop's one public reply — the same ceiling as the hosts' (`VENDOR_REPLY_MAX_CHARS`). */
export const GUEST_REVIEW_REPLY_MAX = 500;

export type GuestShownAs = 'name' | 'initials';
export const GUEST_SHOWN_AS: ReadonlyArray<GuestShownAs> = ['name', 'initials'];

/**
 * How a guest reads on the card and the shop's page. `name` = first name + last initial — the shipped
 * `publicDisplayName` ("Gabriel D."), which is the owner's ruling verbatim; `initials` = "G. D.". Never anonymous,
 * never the full surname. A seat with no usable name reads "A guest" rather than an empty chip.
 */
export function guestShownName(first: string | null, last: string | null, shownAs: GuestShownAs): string {
  if (shownAs === 'initials') {
    const f = first?.trim().charAt(0).toUpperCase() ?? '';
    const l = last?.trim().charAt(0).toUpperCase() ?? '';
    const parts = [f, l].filter(Boolean).map((c) => `${c}.`);
    return parts.length > 0 ? parts.join(' ') : 'A guest';
  }
  return publicDisplayName(first, last) || 'A guest';
}

export function parseShownAs(raw: unknown): GuestShownAs {
  return raw === 'initials' ? 'initials' : 'name';
}

/** Why the one writer refused — the RPC raises one of these words; the screen says each in its own sentence. */
export type GuestReviewRefusal =
  | 'not_at_event'
  | 'not_a_guest'
  | 'supplier_not_on_event'
  | 'already_reviewed'
  | 'bad_stars'
  | 'line_too_long'
  | 'service_not_this_supplier'
  | 'capture_not_yours'
  | 'unknown';

const REFUSALS: ReadonlyArray<Exclude<GuestReviewRefusal, 'unknown'>> = [
  'not_at_event',
  'not_a_guest',
  'supplier_not_on_event',
  'already_reviewed',
  'bad_stars',
  'line_too_long',
  'service_not_this_supplier',
  'capture_not_yours',
];

export function refusalFromError(message: string | null | undefined): GuestReviewRefusal {
  const m = message ?? '';
  return REFUSALS.find((r) => m.includes(r)) ?? 'unknown';
}

export const GUEST_REVIEW_REFUSAL_LINE: Record<GuestReviewRefusal, string> = {
  not_at_event: 'We can’t find you on the door list for this event.',
  not_a_guest: 'We can’t find you on the door list for this event.',
  supplier_not_on_event: 'This supplier isn’t booked on this event.',
  already_reviewed: 'You already rated this supplier for this event.',
  bad_stars: 'Pick from one to five stars.',
  line_too_long: `Keep it to ${GUEST_REVIEW_LINE_MAX} characters.`,
  service_not_this_supplier: 'That card isn’t one of this supplier’s.',
  capture_not_yours: 'That photo isn’t one of your shots from this event.',
  unknown: 'We couldn’t send that just now. Try again.',
};

export type SubmitGuestReviewArgs = {
  eventId: string;
  guestId: string;
  vendorProfileId: string;
  serviceId: string | null;
  stars: number;
  line: string | null;
  captureId: string | null;
  shownAs: GuestShownAs;
};

/**
 * 🔑 THE ONE WRITER — every door calls this, and only this: the supplier's guest QR (`/v/<slug>/guest-review`), and
 * the scanner's "received" pop-up (PR #7291 switches to it). The client MUST be the service role: the guest is not
 * an RLS user, so `guestId` comes from the verified pass or the bound seat the SERVER resolved
 * (`readGuestSessionForEvent`), never from the browser. The function re-checks every gate itself.
 */
export async function submitGuestReview(
  admin: SupabaseClient,
  args: SubmitGuestReviewArgs,
): Promise<{ ok: true; reviewId: string } | { ok: false; refusal: GuestReviewRefusal }> {
  const { data, error } = await admin.rpc('vendor_guest_review_submit', {
    p_event_id: args.eventId,
    p_guest_id: args.guestId,
    p_vendor_profile_id: args.vendorProfileId,
    p_service_id: args.serviceId,
    p_stars: args.stars,
    p_line: args.line,
    p_capture_id: args.captureId,
    p_shown_as: args.shownAs,
  });
  if (error) {
    const refusal = refusalFromError(error.message);
    if (refusal === 'unknown') console.error('[guest-reviews] submit refused', error);
    return { ok: false, refusal };
  }
  return { ok: true, reviewId: String(data) };
}

/**
 * 🎁 THE GIFT SEAM (owner, 6 Nov: *"a guest who writes a review gets the supplier's gift if the supplier set one,
 * otherwise a thank-you"*). Measured on origin/main and on the in-flight gift PRs (#7297 supplier gifts slice 2,
 * #7298 badge rewards): the gift stock is offered to COUPLES on a quote; nothing lets a supplier set a gift for a
 * GUEST who reviews them. So this answers null for every shop and the thank-you shows alone. When that setting
 * ships, it answers here — the thank-you screen already renders whatever comes back, and nothing else moves.
 * The gift is shown AFTER Send only, and is the same for 1 star or 5 (a reward that varied would buy stars).
 */
export type GuestReviewGift = { line: string };
export async function guestReviewGiftFor(_vendorProfileId: string): Promise<GuestReviewGift | null> {
  return null;
}

// ─── Reads ────────────────────────────────────────────────────────────────────

export type GuestReviewRow = {
  review_id: string;
  vendor_profile_id: string;
  event_id: string;
  service_id: string | null;
  rating_overall: number;
  line: string | null;
  capture_id: string | null;
  shown_as: GuestShownAs;
  vendor_reply: string | null;
  vendor_reply_at: string | null;
  hidden_at: string | null;
  created_at: string;
  /** "Gabriel D." / "G. D." — derived at read time from the seat; never stored. */
  shown_name: string;
  /** The card it is for, by NAME only — a review never shows a price (owner, 6 Nov). */
  service_title: string | null;
};

export type GuestReviewStats = { count: number; average: number };

/**
 * 🔍 HONEST READ — three states, never two (the `lib/guests.ts` / `reads-are-honest` precedent):
 *   refused → the screen says "Couldn't load guest reviews";
 *   none    → no guest group at all (a shop with no guest reviews shows nothing — prototype § 9);
 *   rows    → the group.
 * A refused read is NEVER turned into `[]`, which would print "no guest reviews" over a shop that has forty.
 */
export type GuestReviewsRead =
  | { state: 'refused' }
  | { state: 'none' }
  | { state: 'rows'; rows: GuestReviewRow[]; stats: GuestReviewStats };

const GUEST_REVIEW_COLUMNS =
  'review_id, vendor_profile_id, event_id, guest_id, service_id, rating_overall, line, capture_id, shown_as, vendor_reply, vendor_reply_at, hidden_at, created_at';

type RawRow = Omit<GuestReviewRow, 'shown_name' | 'service_title'> & { guest_id: string };

/**
 * The guest reviews of one shop, newest first. `includeHidden` is for Setnayan admin only (Admin › Reviews) — the
 * public page and the shop never see a hidden one. Runs on the service role (the table has no anon grant: the
 * server names the guest, so `guest_id` never leaves it).
 */
export async function readGuestReviewsForVendor(
  admin: SupabaseClient,
  vendorProfileId: string,
  opts: { limit?: number; includeHidden?: boolean } = {},
): Promise<GuestReviewsRead> {
  let q = admin
    .from('vendor_guest_reviews')
    .select(GUEST_REVIEW_COLUMNS)
    .eq('vendor_profile_id', vendorProfileId);
  if (!opts.includeHidden) q = q.is('hidden_at', null);
  const { data, error } = await q.order('created_at', { ascending: false }).limit(opts.limit ?? 50);
  if (error) {
    console.error('[supabase-error] lib/guest-reviews.ts · from:vendor_guest_reviews.select', error);
    return { state: 'refused' };
  }
  const raw = (data ?? []) as RawRow[];
  if (raw.length === 0) return { state: 'none' };

  const [rows, stats] = await Promise.all([hydrateGuestReviews(admin, raw), readGuestReviewStats(admin, vendorProfileId)]);
  if (rows === null || stats === null) return { state: 'refused' };
  return { state: 'rows', rows, stats };
}

/** Names (from the seat) + card titles onto raw rows. null = a read failed — the caller says so. */
async function hydrateGuestReviews(admin: SupabaseClient, raw: RawRow[]): Promise<GuestReviewRow[] | null> {
  const [names, titles] = await Promise.all([
    readGuestNames(admin, raw.map((r) => r.guest_id)),
    readServiceTitles(admin, raw.map((r) => r.service_id).filter((s): s is string => Boolean(s))),
  ]);
  if (names === null || titles === null) return null;
  return raw.map(({ guest_id, ...r }) => {
    const n = names.get(guest_id);
    const shownAs: GuestShownAs = r.shown_as === 'initials' ? 'initials' : 'name';
    return {
      ...r,
      shown_as: shownAs,
      shown_name: guestShownName(n?.first ?? null, n?.last ?? null, shownAs),
      service_title: r.service_id ? (titles.get(r.service_id) ?? null) : null,
    };
  });
}

export type AdminGuestReviewRow = GuestReviewRow & { vendor_name: string | null };
export type AdminGuestReviewsRead = { state: 'refused' } | { state: 'none' } | { state: 'rows'; rows: AdminGuestReviewRow[] };

/**
 * 🛡 Admin › Reviews — the newest guest reviews across every shop, HIDDEN ONES INCLUDED (owner ruling A: public at once,
 * Setnayan can hide one; no approval queue). Service role, behind `requireAdmin` in the page.
 */
export async function readGuestReviewsForAdmin(admin: SupabaseClient, limit = 50): Promise<AdminGuestReviewsRead> {
  const { data, error } = await admin
    .from('vendor_guest_reviews')
    .select(GUEST_REVIEW_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('[supabase-error] lib/guest-reviews.ts · from:vendor_guest_reviews.select(admin)', error);
    return { state: 'refused' };
  }
  const raw = (data ?? []) as RawRow[];
  if (raw.length === 0) return { state: 'none' };
  const vendorIds = [...new Set(raw.map((r) => r.vendor_profile_id))];
  const [rows, shops] = await Promise.all([
    hydrateGuestReviews(admin, raw),
    admin.from('vendor_profiles').select('vendor_profile_id, business_name').in('vendor_profile_id', vendorIds),
  ]);
  if (rows === null || shops.error) return { state: 'refused' };
  const nameOf = new Map(
    ((shops.data ?? []) as Array<{ vendor_profile_id: string; business_name: string | null }>).map((v) => [v.vendor_profile_id, v.business_name]),
  );
  return { state: 'rows', rows: rows.map((r) => ({ ...r, vendor_name: nameOf.get(r.vendor_profile_id) ?? null })) };
}

/**
 * Hide or show one guest review (Admin › Reviews). Service role; the page's action has already checked `requireAdmin`.
 * Hidden → off the shop page, the shop's list and the guests' line at once; kept for the record.
 */
export async function setGuestReviewHidden(
  admin: SupabaseClient,
  reviewId: string,
  hidden: boolean,
  adminUserId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from('vendor_guest_reviews')
    .update(hidden ? { hidden_at: new Date().toISOString(), hidden_by_user_id: adminUserId } : { hidden_at: null, hidden_by_user_id: null })
    .eq('review_id', reviewId)
    .select('review_id');
  if (error) {
    console.error('[supabase-error] lib/guest-reviews.ts · from:vendor_guest_reviews.update(hidden)', error);
    return false;
  }
  return ((data ?? []) as unknown[]).length === 1;
}

/** The guests' own line — count + average of what is not hidden. null = the read failed (say so, never "0"). */
export async function readGuestReviewStats(
  admin: SupabaseClient,
  vendorProfileId: string,
): Promise<GuestReviewStats | null> {
  const { data, error } = await admin
    .from('vendor_guest_review_stats')
    .select('guest_review_count, guest_avg_rating')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  if (error) {
    console.error('[supabase-error] lib/guest-reviews.ts · from:vendor_guest_review_stats.select', error);
    return null;
  }
  const row = data as { guest_review_count: number; guest_avg_rating: number | string } | null;
  return { count: Number(row?.guest_review_count ?? 0) || 0, average: Number(row?.guest_avg_rating ?? 0) || 0 };
}

/**
 * The guests' line PER CARD (prototype 6 Nov § 4 / § 9 — "4.9 · 40 guests" inside the card). Not hidden; never blended
 * into the hosts' number. null = the read failed: the card draws no guests' line rather than "none".
 */
export async function readCardGuestReviewStats(
  admin: SupabaseClient,
  vendorProfileId: string,
): Promise<Map<string, GuestReviewStats> | null> {
  const { data, error } = await admin
    .from('vendor_guest_review_service_stats')
    .select('service_id, guest_review_count, guest_avg_rating')
    .eq('vendor_profile_id', vendorProfileId);
  if (error) {
    console.error('[supabase-error] lib/guest-reviews.ts · from:vendor_guest_review_service_stats.select', error);
    return null;
  }
  const m = new Map<string, GuestReviewStats>();
  for (const r of (data ?? []) as Array<{ service_id: string | null; guest_review_count: number | null; guest_avg_rating: number | string | null }>) {
    const count = Number(r.guest_review_count ?? 0);
    if (r.service_id && count > 0) m.set(r.service_id, { count, average: Number(r.guest_avg_rating ?? 0) });
  }
  return m;
}

async function readGuestNames(
  admin: SupabaseClient,
  guestIds: string[],
): Promise<Map<string, { first: string | null; last: string | null }> | null> {
  const ids = [...new Set(guestIds)];
  if (ids.length === 0) return new Map();
  const { data, error } = await admin.from('guests').select('guest_id, first_name, last_name').in('guest_id', ids);
  if (error) {
    console.error('[supabase-error] lib/guest-reviews.ts · from:guests.select', error);
    return null;
  }
  const out = new Map<string, { first: string | null; last: string | null }>();
  for (const g of (data ?? []) as Array<{ guest_id: string; first_name: string | null; last_name: string | null }>) {
    out.set(g.guest_id, { first: g.first_name, last: g.last_name });
  }
  return out;
}

/** Card names — title only. Deliberately never selects a price column (owner, 6 Nov: "Don't show the price"). */
export async function readServiceTitles(admin: SupabaseClient, serviceIds: string[]): Promise<Map<string, string> | null> {
  const ids = [...new Set(serviceIds)];
  if (ids.length === 0) return new Map();
  const { data, error } = await admin.from('vendor_services').select('vendor_service_id, title').in('vendor_service_id', ids);
  if (error) {
    console.error('[supabase-error] lib/guest-reviews.ts · from:vendor_services.select', error);
    return null;
  }
  const out = new Map<string, string>();
  for (const s of (data ?? []) as Array<{ vendor_service_id: string; title: string | null }>) {
    if (s.title?.trim()) out.set(s.vendor_service_id, s.title.trim());
  }
  return out;
}

/** "4.9" — one decimal, the hosts' own formatting. */
export function formatGuestAverage(avg: number): string {
  return (Math.round(avg * 10) / 10).toFixed(1);
}

/**
 * 💬 The shop's ONE public reply to a guest review (prototype § 9: "The supplier's one reply per review applies to
 * guest reviews too"). Runs on the SUPPLIER'S OWN session: `vendor_guest_review_reply` checks the caller is this shop's
 * owner or team and refuses a second reply (final once posted, like the hosts' — Vendor Agreement § 3.10).
 */
export async function submitGuestReviewReply(
  supabase: SupabaseClient,
  reviewId: string,
  reply: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const text = reply.trim();
  if (text.length === 0 || text.length > GUEST_REVIEW_REPLY_MAX) {
    return { ok: false, message: `A reply is 1 to ${GUEST_REVIEW_REPLY_MAX} characters.` };
  }
  const { error } = await supabase.rpc('vendor_guest_review_reply', { p_review_id: reviewId, p_reply: text });
  if (error) {
    console.error('[supabase-error] lib/guest-reviews.ts · rpc:vendor_guest_review_reply', error);
    return { ok: false, message: 'That reply could not be posted — it may already have one.' };
  }
  return { ok: true };
}
