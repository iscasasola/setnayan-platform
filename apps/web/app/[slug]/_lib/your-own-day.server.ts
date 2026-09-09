import 'server-only';

/**
 * WERE YOU THERE? — one person's own day, and nobody else's.
 *
 * `01_The_Story.md` §3.7 · `08` step 2.5 · prototype `story.html` `#you`.
 *
 * ── THE OWNER RULING THIS FILE EXISTS TO KEEP (2026-09-07) ─────────────────
 * 🔒 **THERE IS NO NAME FIELD, FOR ANYONE, EVER.** An earlier design had a box:
 * type your first name and the page tells you which minutes you are in and
 * where you sat. That is a roster lookup with a friendly face — a stranger with
 * the link types "Celine" and learns that a Celine attended and sat at table 2.
 *
 * So the identity is NOT typed and NOT looked up. It is the signed guest
 * session — the cookie minted from their own Papic link (`lib/guest-session.ts`,
 * HS256, 60 days, revoked when the QR rotates). Nothing here reads an id from a
 * form, a query string or a prop.
 *
 * ── WHY THE SERVICE ROLE IS ALLOWED HERE, AND ONLY HERE ────────────────────
 * ⚠ THE HOUSE RULE IS THAT EVENT CONTENT NEVER USES IT. This is not event
 * content: it is authorization scoped by a SESSION-PROVED ID. Every read below
 * is `.eq('guest_id', session.guest_id)` where `session.guest_id` came out of a
 * signed cookie and out of nowhere else, so the widest thing this file can
 * return is one person's own record of their own evening. The event id is
 * checked against the session's too — a guest of one wedding cannot ask this
 * question about another.
 *
 * ── A REFUSED QUERY IS AN ABSENCE ──────────────────────────────────────────
 * PostgREST answers a phantom column, a stale enum or a missing grant with
 * `{ data: null, error }` and never throws. Every read below therefore checks
 * `error` as well as catching — and every failure arm returns the EMPTY shape,
 * so a broken read shows a guest less of their own day and never somebody
 * else's.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { readGuestSession } from '@/lib/guest-session';
import { PUBLIC_SAFE_MODERATION_STATE } from '@/lib/public-media-visibility';
import { getGuestLiveGallery } from '@/lib/guest-live-gallery';

/** One thing of theirs, and the minute it happened. */
export type OwnDayItem = {
  /** `papic_photos:<uuid>` etc. — unique within the panel. */
  key: string;
  /** Which capture table, so the shipped consent controls can target the row. */
  sourceTable: 'papic_photos' | 'papic_guest_captures';
  sourceId: string;
  /** Epoch ms of the SHUTTER. Null when the row carries no time. */
  atMs: number | null;
  /** A picture of it, when there is one to show them. */
  url: string | null;
};

export type YourOwnDay = {
  /** True only when a signed session for THIS event was presented. */
  signedIn: boolean;
  /** Photographs of them. */
  appearsIn: OwnDayItem[];
  /** Photographs and clips they took. */
  shot: OwnDayItem[];
  /** Words they left — the text itself, because it is theirs. */
  said: Array<{
    key: string;
    id: string;
    body: string;
    atMs: number | null;
    /** Q2: are their words carrying their name right now? */
    namedPublicly: boolean;
  }>;
  /**
   * Their table's label, or null.
   *
   * 🔒 THE ONLY PLACE A TABLE IS EVER ATTACHED TO A PERSON. `story-room.ts`
   * emits table labels and no names, and the index's big room draws the plan
   * with numbers only — because who sat where is a fact about a guest. It is
   * shown to that guest, on their own account, and to nobody else.
   */
  tableLabel: string | null;
};

const EMPTY: YourOwnDay = {
  signedIn: false,
  appearsIn: [],
  shot: [],
  said: [],
  tableLabel: null,
};

function msOf(v: unknown): number | null {
  if (typeof v !== 'string') return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

/**
 * Their own day, or the empty shape.
 *
 * ⚠ `signedIn: false` AND "signed in, and nothing of yours is here" ARE
 * DIFFERENT ANSWERS and the panel says different things for them. Collapsing
 * the two once told every untagged guest that the page had broken
 * (`photos-of-you-gallery.tsx` learned this the hard way); here it would tell
 * somebody who was at the wedding that they were not.
 */
export async function loadYourOwnDay(eventId: string): Promise<YourOwnDay> {
  const session = await readGuestSession();
  // The cookie proves BOTH facts: that they were let in, and which celebration
  // they were let into. A session for another event is a stranger here.
  if (!session || session.event_id !== eventId) return EMPTY;

  const guestId = session.guest_id;
  const admin = createAdminClient();

  const [appearsIn, shot, said, tableLabel] = await Promise.all([
    loadAppearsIn(eventId, guestId),
    loadShot(admin, eventId, guestId),
    loadSaid(admin, eventId, guestId),
    loadTable(admin, eventId, guestId),
  ]);

  return { signedIn: true, appearsIn, shot, said, tableLabel };
}

/**
 * Photographs of them — through the SHIPPED gallery, not a second query.
 *
 * 🔑 RULE 0. `getGuestLiveGallery` already answers "which clean, un-hidden,
 * not-untagged captures is this guest tagged in", already resolves the display
 * URLs, and already drops a row the guest has said "not me" to. Writing that
 * again here would be a second opinion about the same question, and the two
 * would disagree the first time either was fixed.
 */
async function loadAppearsIn(eventId: string, guestId: string): Promise<OwnDayItem[]> {
  try {
    const gallery = await getGuestLiveGallery(eventId, guestId, 24, { prefer: 'display' });
    if (!gallery) return []; // the read FAILED — show less, never more
    return gallery.photos.map((p) => ({
      key: `${p.sourceTable}:${p.id}`,
      sourceTable: p.sourceTable,
      sourceId: p.id,
      atMs: msOf(p.capturedAt),
      url: p.url,
    }));
  } catch {
    return [];
  }
}

/** Photographs and clips THEY took — `papic_guest_captures.guest_id` is the shooter. */
async function loadShot(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
  guestId: string,
): Promise<OwnDayItem[]> {
  try {
    const { data, error } = await admin
      .from('papic_guest_captures')
      .select('capture_id, captured_at')
      .eq('event_id', eventId)
      .eq('guest_id', guestId)
      .is('hidden_at', null)
      .eq('moderation_state', PUBLIC_SAFE_MODERATION_STATE)
      .order('captured_at', { ascending: true })
      .limit(60);
    if (error || !data) return [];
    return data.map((r) => ({
      key: `papic_guest_captures:${r.capture_id as string}`,
      sourceTable: 'papic_guest_captures' as const,
      sourceId: r.capture_id as string,
      atMs: msOf(r.captured_at),
      /*
        NO PICTURE HERE, ON PURPOSE. The tiles a guest looks at live in their own
        gallery, which presigns them; this list exists to say WHICH MINUTES are
        theirs and to link back to them, and presigning sixty more URLs to draw a
        thumbnail strip nobody asked for costs a second of a wedding-day page.
      */
      url: null,
    }));
  } catch {
    return [];
  }
}

/**
 * What they said — their own Kwento messages, approved and screened.
 *
 * ⚠ IT CARRIES `namedPublicly`, WHICH IS THE HALF THE CONSENT CONTROL ACTS ON.
 * Owner gate Q2, ruled 2026-09-09: a photo message carries a name only if the
 * guest asked, and the role rides the same consent as the name. So "ask to be
 * unnamed" is not a request that waits for a person — it is this guest turning
 * their own flag back off, on their own words, and it is theirs to do.
 */
async function loadSaid(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
  guestId: string,
): Promise<Array<{ key: string; id: string; body: string; atMs: number | null; namedPublicly: boolean }>> {
  try {
    const { data, error } = await admin
      .from('photo_messages')
      .select('message_id, body_text, submitted_at, author_named_publicly')
      .eq('event_id', eventId)
      .eq('guest_id', guestId)
      .eq('status', 'approved')
      .eq('moderation_state', PUBLIC_SAFE_MODERATION_STATE)
      .is('user_deleted_at', null)
      .is('hard_deleted_at', null)
      .order('submitted_at', { ascending: true })
      .limit(20);
    if (error || !data) return [];
    return data
      .map((r) => ({
        key: `msg:${String(r.message_id)}`,
        id: String(r.message_id),
        body: String(r.body_text ?? '').trim(),
        atMs: msOf(r.submitted_at),
        namedPublicly: r.author_named_publicly === true,
      }))
      .filter((r) => r.body.length > 0);
  } catch {
    return [];
  }
}

/** Their table. One row, their own, by label. */
async function loadTable(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
  guestId: string,
): Promise<string | null> {
  try {
    const { data, error } = await admin
      .from('event_seat_assignments')
      .select('table_id')
      .eq('event_id', eventId)
      .eq('guest_id', guestId)
      .maybeSingle();
    if (error || !data?.table_id) return null;
    const { data: table, error: tableError } = await admin
      .from('event_tables')
      .select('table_label')
      .eq('event_id', eventId)
      .eq('table_id', data.table_id as string)
      .maybeSingle();
    if (tableError || !table?.table_label) return null;
    return String(table.table_label);
  } catch {
    return null;
  }
}
