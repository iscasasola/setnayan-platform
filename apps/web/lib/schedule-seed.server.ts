import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { buildRunOfShowSeed } from '@/lib/schedule-run-of-show';
import { insertScheduleBlocks, type ScheduleBlockRow } from '@/lib/schedule';

/**
 * schedule-seed.server.ts — the first-open Run-of-Show seed for NON-WEDDING
 * events, as a plain server helper.
 *
 * ─── WHY IT LIVES HERE AND NOT IN `schedule/actions.ts` ──────────────────
 *
 * 🚨 THE FIRST EVER VISIT TO SCHEDULE ON A NON-WEDDING EVENT RETURNED A 500.
 * It was a `'use server'` action, and it ended with two `revalidatePath`
 * calls. Next.js forbids revalidating during a render, so the page's own
 * first-open call threw:
 *
 *     Error: Route /dashboard/[eventId]/schedule used "revalidatePath
 *     /dashboard/<id>/schedule" during render which is unsupported.
 *
 * The host saw *"Something on our end didn't work."*
 *
 * 🪤 **AND IT HID ITSELF PERFECTLY.** The INSERT commits before the
 * revalidate, so the rows land and the SECOND visit renders fine. Refresh,
 * it works, you move on. Found on 2026-08-21 only because the owner signed a
 * session in and a page was opened that nobody had ever opened: measured, the
 * five blocks on his Movie Night were written at 08:17:49 by the very request
 * that 500'd at 08:17:47.
 *
 * 🔑 **THE PAGE WAS THE ONLY CALLER.** Nothing submits this — there is no
 * form, no button. So the two `revalidatePath` calls never once did anything
 * useful and were fatal every time they ran. Revalidating the path you are
 * *currently rendering* is meaningless anyway: the page re-fetches on the very
 * next line. The action's own docblock said "first-open fixture, not a form
 * submit" and kept them regardless.
 *
 * ⚠ **AND IT IS NOW FAIL-SOFT.** The old version threw on a read or write
 * error, which during render is another 500 — a seeding hiccup taking down a
 * page whose actual job is showing a schedule. A failure now leaves the
 * schedule empty (the host can still add blocks by hand) and logs loudly.
 *
 * ─── AND IT RETURNS THE BLOCKS, NOT A COUNT (2026-08-23) ─────────────────
 *
 * 🚨 THE FIRST OPEN STILL SHOWED AN EMPTY SCHEDULE. The rows landed; the page
 * printed nothing; a reload printed five. The caller used to ask the database
 * for them a SECOND time, and that second question is never asked: Next
 * memoises identical GET requests for the length of one render, so the re-read
 * was handed the FIRST read's answer — the empty list from before the seed.
 *
 * Measured in the dependencies rather than guessed. `postgrest-js` issues a
 * plain `fetch(url, { method: 'GET', headers, body: undefined, signal:
 * undefined })`; Next's `dedupe-fetch` skips deduping only for a non-GET, a
 * `keepalive`, or a caller-supplied `signal` — none of which apply — and keys
 * the entry on the URL plus the headers, which are identical between the two
 * calls. Both reads therefore resolve from one response.
 *
 * 🔑 SO THE SEED HANDS BACK WHAT IT WROTE. `INSERT … RETURNING` costs no extra
 * round trip and cannot disagree with itself. This is also right if the
 * memoisation is ever removed — one question always beats two.
 */
export async function seedNonWeddingRunOfShow(
  eventId: string,
): Promise<ScheduleBlockRow[]> {
  if (!eventId) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return []; // page owns auth; the seed is best-effort

  // Access check through the RLS-gated read, exactly as before.
  const { data: existing, error: existingErr } = await supabase
    .from('event_schedule_blocks')
    .select('block_id')
    .eq('event_id', eventId)
    .limit(1);
  if (existingErr) {
    logQueryError('seedNonWeddingRunOfShow (existing blocks)', existingErr, { event_id: eventId }, 'graceful_degrade');
    return [];
  }
  if (existing && existing.length > 0) return []; // already has a schedule · skip

  // events_host, not events — signature_details is SELECT-denied to
  // `authenticated` on the base table by 20271025120000, and this seed reads it
  // to shape the Run-of-Show. On the base table the error would be swallowed by
  // the `const { data }` shape, eventType would fall back to 'wedding', and the
  // free non-wedding Run-of-Show seed would simply stop firing — silently.
  const { data: ev, error: evErr } = await supabase
    .from('events_host')
    .select('event_type, event_date, signature_details')
    .eq('event_id', eventId)
    .maybeSingle();
  if (evErr) {
    logQueryError('seedNonWeddingRunOfShow (event row)', evErr, { event_id: eventId }, 'graceful_degrade');
    return [];
  }
  const eventType = (ev?.event_type as string | null | undefined) ?? 'wedding';
  if (eventType === 'wedding') return []; // weddings use their own seed

  const blocks = buildRunOfShowSeed(
    eventType,
    (ev?.signature_details as Record<string, unknown> | null | undefined) ?? null,
    (ev?.event_date as string | null | undefined) ?? null,
  );
  if (blocks.length === 0) return [];

  const admin = createAdminClient();
  const rows = blocks.map((b) => ({
    event_id: eventId,
    label: b.label,
    block_type: b.block_type,
    start_at: b.start_at,
    end_at: b.end_at,
    is_public: b.is_public,
    sort_order: b.sort_order,
    parent_block_id: null,
    notes: b.notes,
  }));

  // RETURNING the inserted rows — see the docblock. Asking for them again is
  // the bug this replaces, not a safety net. The write goes through
  // `lib/schedule.ts` so the column list and the ordering stay in the one
  // module that owns them; this file never names a column.
  const { blocks: inserted, error } = await insertScheduleBlocks(admin, rows);
  if (error) {
    logQueryError('seedNonWeddingRunOfShow (insert)', error, { event_id: eventId }, 'graceful_degrade');
    return [];
  }

  /*
    🔒 NO `revalidatePath` HERE, AND THAT IS THE WHOLE POINT OF THIS FILE.
    This runs DURING a render, and the render already has the rows — they are
    the return value below. There is nothing to revalidate and nothing to gain
    from trying — only the throw.
  */
  return inserted;
}
