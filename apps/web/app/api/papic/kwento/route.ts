import { NextResponse, after } from 'next/server';
import { readGuestSession } from '@/lib/guest-session';
import { createAdminClient } from '@/lib/supabase/admin';
import { moderateKwentoText } from '@/lib/kwento-moderation';
import { emitNotification } from '@/lib/notification-emit';

// POST /api/papic/kwento — a zero-account guest writes the story behind one
// of their captures (Kwento P1, 0012 § Kwento; owner-locked: text-only, free
// for every guest).
//
// Auth: the setnayan_guest_session JWT cookie (the shipped zero-account
// model) — guests have no auth.uid(), so the write goes through the
// service-role-only submit_photo_message RPC, which owns the integrity rules
// (anchor-same-event, block lever, 10/event cap, 3-per-60s burst, the
// one-caption-per-photo upsert with edit-resets-moderation).
//
// Two voice depths:
//   flash — ≤50 chars, fires immediately after a capture; clean Tier-1 auto-walls
//            after 5 seconds (coordinator kill-switch only, no couple approval).
//            Skips the kwento_flagged email on clean (Flash inbox is noise-free).
//   story — ≤280 chars, the existing couple-review path; debounced batch email.
//
// Tier-1 moderation runs HERE, synchronously, before the RPC: 'blocked' is
// rejected inline and never stored; 'flagged' stores couple-only (never
// wall-eligible — the DB CHECK backstops); 'clean' proceeds.

export const dynamic = 'force-dynamic';

// Notification debounce: skip kwento_story_batch email if one was sent in the
// last 10 minutes for this event (avoids per-message spam during a live reception).
const STORY_NOTIFY_DEBOUNCE_MS = 10 * 60 * 1000;

const FRIENDLY: Record<string, { status: number; error: string }> = {
  'kwento:blocked': { status: 403, error: 'messaging_disabled' },
  'kwento:cap': { status: 429, error: 'limit_reached' },
  'kwento:burst': { status: 429, error: 'too_fast' },
  'kwento:edit_limit': { status: 409, error: 'edit_limit' },
  'kwento:baked': { status: 409, error: 'already_in_keepsake' },
  'kwento:invalid_anchor': { status: 400, error: 'bad_photo' },
  'kwento:invalid_body': { status: 400, error: 'bad_message' },
};

export async function POST(req: Request) {
  const session = await readGuestSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: { captureId?: string; body?: string; consent?: boolean; voiceDepth?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const captureId = body.captureId?.trim();
  const text = (body.body ?? '').trim();
  const voiceDepth: 'flash' | 'story' =
    body.voiceDepth === 'flash' ? 'flash' : 'story';

  const maxLen = voiceDepth === 'flash' ? 50 : 280;
  if (!captureId || text.length < 1 || text.length > maxLen) {
    return NextResponse.json({ error: 'bad_message' }, { status: 400 });
  }

  // RA 10173: consent is captured on EVERY message — no tick, no send.
  // Flash is covered by the consent the guest gave when claiming their Papic
  // session, so the caller may omit it for Flash (we accept consent=true OR
  // voiceDepth=flash). Story always requires explicit consent.
  if (voiceDepth === 'story' && body.consent !== true) {
    return NextResponse.json({ error: 'consent_required' }, { status: 400 });
  }

  const verdict = moderateKwentoText(text);
  if (verdict.state === 'blocked') {
    // Never stored. Warm inline rejection — the guest rephrases.
    return NextResponse.json({ error: 'keep_it_sweet' }, { status: 422 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('submit_photo_message', {
    p_guest_id: session.guest_id,
    p_source_table: 'papic_guest_captures',
    p_source_id: captureId,
    p_body: text,
    p_prompt: null,
    p_moderation_state: verdict.state,
    p_moderation_labels: verdict.labels.length ? { labels: verdict.labels } : null,
    p_voice_depth: voiceDepth,
  });

  if (error) {
    const known = Object.keys(FRIENDLY).find((k) => error.message.includes(k));
    const friendly = known ? FRIENDLY[known] : undefined;
    if (friendly) {
      return NextResponse.json({ error: friendly.error }, { status: friendly.status });
    }
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { message_id?: string; moderation_state?: string }
    | undefined;
  const state = row?.moderation_state ?? verdict.state;
  const messageId = row?.message_id ?? null;

  // Post-response side effects — cron-free via after().
  if (voiceDepth === 'flash' && state === 'clean') {
    // Flash + clean: auto-wall after 5 seconds unless the coordinator kills it.
    // The coordinator can tap "Kill" in the live console within that window.
    // If kwento_flash_auto_wall is OFF for this event, Flash behaves like Story.
    after(async () => {
      try {
        const { data: evt } = await admin
          .from('events')
          .select('kwento_flash_auto_wall')
          .eq('event_id', session.event_id)
          .maybeSingle();

        if (evt?.kwento_flash_auto_wall === false) return; // coordinator disabled auto-wall

        if (!messageId) return;

        await new Promise((resolve) => setTimeout(resolve, 5000));

        // Re-check: did the coordinator kill it during the 5-second window?
        const { data: msg } = await admin
          .from('photo_messages')
          .select('status, hide_from_wall')
          .eq('message_id', messageId)
          .maybeSingle();

        if (!msg || msg.hide_from_wall || msg.status === 'rejected') return;

        await admin.rpc('wall_approve_caption', { p_message_id: messageId });
      } catch {
        // never fail the guest's send
      }
    });
  } else if (voiceDepth === 'story' && state === 'flagged') {
    // Flagged Story: nudge the couple to review (debounced — no per-message spam).
    after(async () => {
      try {
        // Check debounce: skip if we already sent a batch notify in the last 10 min.
        const { data: evt } = await admin
          .from('events')
          .select('last_kwento_notify_at')
          .eq('event_id', session.event_id)
          .maybeSingle();

        const lastNotify = evt?.last_kwento_notify_at
          ? new Date(evt.last_kwento_notify_at as string).getTime()
          : 0;
        if (Date.now() - lastNotify < STORY_NOTIFY_DEBOUNCE_MS) return;

        // Stamp the debounce BEFORE sending to prevent a race between concurrent requests.
        await admin
          .from('events')
          .update({ last_kwento_notify_at: new Date().toISOString() })
          .eq('event_id', session.event_id);

        const { data: members } = await admin
          .from('event_members')
          .select('user_id')
          .eq('event_id', session.event_id)
          .eq('member_type', 'couple');

        const seen = new Set<string>();
        for (const m of (members ?? []) as Array<{ user_id?: string }>) {
          const uid = m.user_id;
          if (!uid || seen.has(uid)) continue;
          seen.add(uid);
          await emitNotification({
            userId: uid,
            type: 'kwento_story_batch',
            title: 'Guest stories are waiting for your review',
            body: 'One or more guest stories need your okay before they can appear.',
            relatedUrl: `/dashboard/${session.event_id}/add-ons/papic/moderation`,
          });
        }
      } catch {
        // never let a notification failure affect the guest's send
      }
    });
  } else if (voiceDepth === 'story' && state === 'clean') {
    // Clean Story: no email — surfaces in the review queue without inbox noise.
    // Batched notification fires only on flagged (above).
  }

  return NextResponse.json({ ok: true, state, messageId });
}
