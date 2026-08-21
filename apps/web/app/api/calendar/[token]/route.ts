import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildFeedIcs, feedEntriesFor, type FeedEvent } from '@/lib/calendar-feed';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * THE SUBSCRIPTION FEED a person's calendar re-reads (owner 2026-08-21).
 *
 * `/api/calendar/<token>.ics` — added once as `webcal://…`, after which Google,
 * Apple and Outlook all fetch it on their own schedule and the dates in the
 * person's phone follow the dates in Setnayan.
 *
 * ── THIS ROUTE IS UNAUTHENTICATED BY NECESSITY, SO READ THIS BEFORE EDITING ──
 * A calendar client cannot log in. It sends no cookie, no header, nothing —
 * which is precisely why the token in the path IS the credential, and why this
 * route is held to a different standard than a normal page:
 *
 *   🔒 IT ANSWERS 404 FOR EVERY REFUSAL — unknown token, revoked token, no
 *      matching row. A 401 or a 403 would confirm that a token EXISTS and is
 *      merely revoked, which is a free oracle for anybody enumerating.
 *   🔒 IT NEVER ECHOES THE TOKEN, not in the body and not in a log line. A URL
 *      that turns up in an error log is a URL that has been handed out.
 *   🔒 IT SERVES ONE PERSON'S OWN MEMBERSHIPS AND NOTHING ELSE. No guest list,
 *      no email, no phone number, no supplier — a leaked link must cost the
 *      names and dates of that person's own celebrations and not one thing
 *      more.
 *
 * ⚠ `service_role` IS USED, AND IT IS NOT A SHORTCUT. There is no session to
 * scope RLS with, so the route establishes identity itself — token → user_id —
 * and then reads THAT user's rows explicitly. Every query below is filtered on
 * the resolved `user_id`; none of them is filtered by the caller.
 */

type Params = { params: Promise<{ token: string }> };

/** A refusal, in the one shape every refusal takes here. See the header. */
function notFound() {
  return new NextResponse('Not found', {
    status: 404,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function GET(_req: Request, { params }: Params) {
  const raw = (await params).token;
  // The route is `[token]` and clients append `.ics` so the file looks like a
  // calendar to the OS. Strip it before matching — a token that only resolves
  // when the suffix is absent would work in a browser and fail in every
  // calendar app, which is the hardest kind of bug to be told about.
  const token = raw.replace(/\.ics$/i, '');
  // Cheap shape check before touching the database: the column's CHECK is 32+.
  if (token.length < 32 || token.length > 128) return notFound();

  const admin = createAdminClient();

  const { data: row, error: tokenErr } = await admin
    .from('calendar_feed_tokens')
    .select('user_id, revoked_at')
    .eq('token', token)
    .maybeSingle();

  // ⚠ Supabase RESOLVES with an error, it does not throw. Treating a failed
  // read as "no such token" is the correct direction to fail here: it refuses,
  // it does not serve somebody else's calendar. Logged WITHOUT the token.
  if (tokenErr) {
    logQueryError('Calendar feed (token lookup)', tokenErr);
    return notFound();
  }
  if (!row || row.revoked_at) return notFound();
  const userId = (row as { user_id: string }).user_id;

  const { data: memberships, error: rowsErr } = await admin
    .from('event_members')
    .select(
      `member_type,
       events:event_id (
         public_id, display_name, event_date, event_end_date, archived,
         venue_name, venue_address
       )`,
    )
    .eq('user_id', userId)
    // The board admits these two stances; a supplier or coordinator seat is not
    // this person's own celebration and does not belong in their calendar.
    .in('member_type', ['couple', 'guest']);

  if (rowsErr) {
    logQueryError('Calendar feed (memberships)', rowsErr);
    // 🔑 A FAILED READ MUST NOT EMPTY SOMEBODY'S CALENDAR. Serving an empty
    // feed here would tell the calendar that every celebration was cancelled,
    // and it would delete them all from the person's phone over a transient
    // database blip. 404 leaves the last good copy exactly where it is.
    return notFound();
  }

  const events: FeedEvent[] = (memberships ?? []).flatMap((r) => {
    const e = (r as { events: FeedEvent | FeedEvent[] | null }).events;
    return e ? (Array.isArray(e) ? e : [e]) : [];
  });

  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.setnayan.com').replace(/\/$/, '');
  const ics = buildFeedIcs({
    entries: feedEntriesFor(events, baseUrl),
    calendarName: 'Setnayan — My Events',
    stampUtc: new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''),
  });

  // Best-effort, and deliberately NOT awaited into the response path: its only
  // job is to answer "is anything still using this link?" before somebody
  // resets it. A failure to stamp it must never cost the person their calendar.
  void admin
    .from('calendar_feed_tokens')
    .update({ last_read_at: new Date().toISOString() })
    .eq('token', token)
    .then(({ error }) => {
      if (error) logQueryError('Calendar feed (last_read stamp)', error);
    });

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="setnayan-my-events.ics"',
      // A subscribed calendar re-fetches on its own schedule; a shared cache
      // holding this would serve one person's feed from another's request path.
      'Cache-Control': 'private, no-store',
    },
  });
}
