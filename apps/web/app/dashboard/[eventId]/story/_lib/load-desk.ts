import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { guestColumnsActive } from '@/lib/guest-columns-gate';
import { bylineFor } from '@/lib/guest-columns';
import {
  captureHeldBack,
  deskCounts,
  wordsHeldBack,
  sortByArrival,
  statusFromDatabase,
  supplierHeldBack,
  EDITING_SOMEONE_ELSES_WORDS,
  FIVE_YESES,
  NAMED_BY_REQUEST,
  NOT_NAMED_BY_CHOICE,
  SUPPLIER_CREDIT_IS_FREE,
  type DeskItem,
  type HeldBackReason,
} from '@/lib/story-desk';

/**
 * THE DESK'S ONE READ — four tables, one queue (08 step 1.2).
 *
 * ═══ WHY THE ADMIN CLIENT HERE, AND WHY THAT IS NOT THE HOLE IT LOOKS LIKE ═══
 * The caller MUST have proved `hostUserId(eventId)` before calling this; there
 * is no event id taken from a client and trusted. That is the shipped house
 * pattern for a moderation queue — `studio/papic/moderation` and
 * `studio/guest-columns` both gate in the app and then read with the admin
 * client — and it is necessary here because the four sources disagree about who
 * their RLS admits: `papic_mission_completions` admits couple/coordinator but
 * NOT an accepted moderator, and `editorial_vendor_media` admits the couple
 * ALONE. Reading through the caller's session would hand a co-host a desk that
 * silently omits two of its four sources, and a missing card looks exactly like
 * a source with nothing in it.
 *
 * ⚠ THE RULE THIS DOES NOT BREAK: "authorization may use the service role
 * scoped by a session-proved id; EVENT CONTENT NEVER DOES" is a rule about
 * `/[slug]`, the PUBLIC page, where the app-side gate is the whole fence. This
 * is the host's own dashboard, reading the host's own event, after their
 * authority has been proved through their own session. **Every WRITE still goes
 * through the caller's own session** (`desk-actions.ts`), so RLS remains an
 * independent second fence on every decision — which is the half that matters,
 * because a read cannot change anything.
 */

type Row = Record<string, unknown>;

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/**
 * Captures tagged by a guest who opted OUT of photos — the RA 10173 veto, for
 * the `papic_guest_captures` source.
 *
 * 🔑 WHY THIS IS NOT `loadConsentVetoedPapicIds`. That gate is hardcoded to
 * `source_table = 'papic_photos'` and resolves BLURRED STAND-INS, which is a
 * public-render concern. `photo_tags.source_table` genuinely carries
 * 'papic_guest_captures' as its other legal value (CHECK constraint read out of
 * production), and this source lives entirely on that side. Same rule, same
 * direction, different table.
 *
 * ⚖ FAILS CLOSED. An unresolved veto returns `null`, and every caller reads
 * `null` as "hold everything back" — the design's own words: *"Veto unresolved
 * → withhold everything."* A veto that cannot be read must never resolve to
 * "nobody objected".
 */
async function vetoedCaptureIds(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
): Promise<Set<string> | null> {
  try {
    const { data: optedOut, error } = await admin
      .from('guests')
      .select('guest_id')
      .eq('event_id', eventId)
      .eq('photo_consent', false)
      .is('deleted_at', null);
    if (error) return null;
    const ids = (optedOut ?? []).map((r) => str((r as Row).guest_id)).filter((v): v is string => !!v);
    if (ids.length === 0) return new Set();

    const { data: tags, error: tErr } = await admin
      .from('photo_tags')
      .select('source_id')
      .eq('event_id', eventId)
      .eq('source_table', 'papic_guest_captures')
      .is('removed_at', null)
      .in('guest_id', ids);
    if (tErr) return null;
    const out = new Set<string>();
    for (const t of tags ?? []) {
      const id = str((t as Row).source_id);
      if (id) out.add(id);
    }
    return out;
  } catch {
    return null;
  }
}

export type DeskData = {
  items: DeskItem[];
  counts: ReturnType<typeof deskCounts>;
  /** Sources that could not be read — the desk says so rather than looking empty. */
  unreadable: string[];
  /** True when the letters source is switched off entirely (env + DPO control). */
  lettersDark: boolean;
};

export async function loadDesk(eventId: string): Promise<DeskData> {
  const admin = createAdminClient();
  const items: DeskItem[] = [];
  const unreadable: string[] = [];

  const [veto, lettersOn] = await Promise.all([
    vetoedCaptureIds(admin, eventId),
    guestColumnsActive(),
  ]);
  if (veto === null) unreadable.push('the photo-consent check');

  // Guest names, for the two sources whose byline is an opt-in. Resolved ONCE.
  const nameOf = new Map<string, string>();
  try {
    const { data } = await admin
      .from('guests')
      .select('guest_id, full_name')
      .eq('event_id', eventId)
      .is('deleted_at', null);
    for (const g of data ?? []) {
      const id = str((g as Row).guest_id);
      const n = str((g as Row).full_name);
      if (id && n) nameOf.set(id, n);
    }
  } catch {
    /* no names → every byline resolves to null, which is the SAFE direction */
  }

  /* ── ① Kwento wishes (photo_messages) ─────────────────────────────────── */
  try {
    const { data, error } = await admin
      .from('photo_messages')
      .select(
        'message_id, body_text, prompt_text, status, moderation_state, guest_id, ' +
          'author_named_publicly, author_publicly_hidden, submitted_at, user_deleted_at',
      )
      .eq('event_id', eventId)
      .is('hard_deleted_at', null)
      .order('submitted_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    for (const r of (data ?? []) as unknown as Row[]) {
      const id = str(r.message_id);
      if (!id) continue;
      const held =
        wordsHeldBack({
          moderationState: str(r.moderation_state) ?? 'unscreened',
          userDeletedAt: str(r.user_deleted_at),
        }) ?? (r.author_publicly_hidden === true ? ('withdrawn' as HeldBackReason) : null);
      const named = r.author_named_publicly === true;
      items.push({
        source: 'kwento',
        id,
        status: statusFromDatabase(str(r.status)),
        arrivedAt: str(r.submitted_at) ?? '',
        landsIn: 'What they said',
        lane: 'guest',
        title: 'A wish',
        body: str(r.body_text) ?? '',
        authorKind: 'guest',
        byline: bylineFor(
          { author_named_publicly: named, guest_id: str(r.guest_id) },
          nameOf,
        ),
        // ✅ Q2, owner/DPO 2026-09-09: the naming opt-in EXTENDS to Kwento. A
        // photo message carries a name only if the guest asked; otherwise it
        // runs unnamed, exactly as a letter does.
        flag: named ? NAMED_BY_REQUEST : NOT_NAMED_BY_CHOICE,
        editable: true,
        heldBack: held,
        set: null,
      });
    }
  } catch {
    unreadable.push('the wishes your guests left');
  }

  /* ── ② Letters (guest_columns) — may be switched off entirely ─────────── */
  if (lettersOn) {
    try {
      const { data, error } = await admin
        .from('guest_columns')
        .select(
          'column_id, title, body_text, status, moderation_state, guest_id, ' +
            'author_named_publicly, author_publicly_hidden, submitted_at, user_deleted_at',
        )
        .eq('event_id', eventId)
        .order('submitted_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      for (const r of (data ?? []) as unknown as Row[]) {
        const id = str(r.column_id);
        if (!id) continue;
        const held =
          wordsHeldBack({
            moderationState: str(r.moderation_state) ?? 'unscreened',
            userDeletedAt: str(r.user_deleted_at),
          }) ?? (r.author_publicly_hidden === true ? ('withdrawn' as HeldBackReason) : null);
        const named = r.author_named_publicly === true;
        items.push({
          source: 'letter',
          id,
          status: statusFromDatabase(str(r.status)),
          arrivedAt: str(r.submitted_at) ?? '',
          landsIn: 'Letters',
          lane: 'guest',
          title: str(r.title) ?? 'A letter',
          body: str(r.body_text) ?? '',
          authorKind: 'guest',
          byline: bylineFor(
            { author_named_publicly: named, guest_id: str(r.guest_id) },
            nameOf,
          ),
          flag: `${named ? NAMED_BY_REQUEST : NOT_NAMED_BY_CHOICE} ${EDITING_SOMEONE_ELSES_WORDS}`,
          editable: true,
          heldBack: held,
          set: null,
        });
      }
    } catch {
      unreadable.push('the letters your guests wrote');
    }
  }

  /* ── ③ Challenge answers (papic_mission_completions + their capture) ──── */
  try {
    const { data, error } = await admin
      .from('papic_mission_completions')
      .select('completion_id, mission_id, capture_id, consent_to_share, status, created_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    const rows = (data ?? []) as Row[];

    const captureIds = rows.map((r) => str(r.capture_id)).filter((v): v is string => !!v);
    const capById = new Map<string, Row>();
    if (captureIds.length) {
      const { data: caps } = await admin
        .from('papic_guest_captures')
        .select('capture_id, media_type, moderation_state, hidden_at, consent_to_public')
        .in('capture_id', captureIds);
      for (const c of (caps ?? []) as Row[]) {
        const id = str(c.capture_id);
        if (id) capById.set(id, c);
      }
    }
    const missionIds = rows.map((r) => str(r.mission_id)).filter((v): v is string => !!v);
    const promptById = new Map<string, string>();
    if (missionIds.length) {
      const { data: ms } = await admin
        .from('papic_missions')
        .select('mission_id, prompt')
        .in('mission_id', missionIds);
      for (const m of (ms ?? []) as Row[]) {
        const id = str(m.mission_id);
        const p = str(m.prompt);
        if (id && p) promptById.set(id, p);
      }
    }

    for (const r of rows) {
      const id = str(r.completion_id);
      if (!id) continue;
      const capId = str(r.capture_id);
      const cap = capId ? capById.get(capId) : undefined;
      // The guest's own opt-in is the FIRST yes. Without it there is nothing to
      // decide — it is not the host's to overrule, so it reads as withdrawn.
      const held: HeldBackReason | null =
        r.consent_to_share !== true
          ? 'withdrawn'
          : captureHeldBack({
              exists: Boolean(cap),
              hiddenAt: cap ? str(cap.hidden_at) : null,
              consentToPublic: cap ? cap.consent_to_public === true : false,
              moderationState: cap ? (str(cap.moderation_state) ?? 'unscreened') : 'unscreened',
              // veto === null ⇒ unresolved ⇒ treat EVERY capture as vetoed.
              taggedGuestOptedOut: veto === null || (capId ? veto.has(capId) : true),
            });
      items.push({
        source: 'challenge',
        id,
        status: statusFromDatabase(str(r.status)),
        arrivedAt: str(r.created_at) ?? '',
        landsIn: 'What we asked',
        lane: 'guest',
        title: str(r.mission_id) ? (promptById.get(str(r.mission_id)!) ?? 'A challenge answer') : 'A challenge answer',
        body: '',
        authorKind: 'guest',
        // Never a name: this source has no naming column and the shipped public
        // reader hardcodes `byline: null`. See FIVE_YESES.
        byline: null,
        flag: FIVE_YESES,
        editable: false,
        heldBack: held,
        set: null,
      });
    }
  } catch {
    unreadable.push('the answers to what you asked');
  }

  /* ── ④ What a supplier sent (editorial_vendor_media) ──────────────────── */
  try {
    const { data, error } = await admin
      .from('editorial_vendor_media')
      .select('media_id, media_type, caption, moderation_state, status, created_at, event_vendor_id')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    const rows = (data ?? []) as Row[];
    const evIds = Array.from(
      new Set(rows.map((r) => str(r.event_vendor_id)).filter((v): v is string => !!v)),
    );
    const vendorName = new Map<string, string>();
    if (evIds.length) {
      const { data: evs } = await admin
        .from('event_vendors')
        .select('vendor_id, vendor_name')
        .in('vendor_id', evIds);
      for (const e of (evs ?? []) as Row[]) {
        const id = str(e.vendor_id);
        const n = str(e.vendor_name);
        if (id && n) vendorName.set(id, n);
      }
    }
    for (const r of rows) {
      const id = str(r.media_id);
      if (!id) continue;
      const evId = str(r.event_vendor_id);
      items.push({
        source: 'supplier',
        id,
        status: statusFromDatabase(str(r.status)),
        arrivedAt: str(r.created_at) ?? '',
        landsIn: 'From your suppliers',
        lane: 'supplier',
        title: (evId && vendorName.get(evId)) || 'Your supplier',
        body: str(r.caption) ?? '',
        authorKind: 'supplier',
        byline: (evId && vendorName.get(evId)) || null,
        flag: SUPPLIER_CREDIT_IS_FREE,
        editable: false,
        heldBack: supplierHeldBack({
          moderationState: str(r.moderation_state) ?? 'unscreened',
        }),
        set: null,
      });
    }
  } catch {
    unreadable.push('what your suppliers sent');
  }

  const sorted = sortByArrival(items);
  return { items: sorted, counts: deskCounts(sorted), unreadable, lettersDark: !lettersOn };
}
