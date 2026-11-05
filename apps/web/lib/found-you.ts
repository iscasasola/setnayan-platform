/**
 * 🕵️ FOUND-YOU — the words, and the one answer the database gives.
 *
 * Owner, 2026-11-05 (DECISION_LOG "THE 15 'ACT FIRST' ITEMS", item 2): *"we already had this plan which logs users
 * that has seen or shown in the app as a result. and it saves the date when you first saw that supplier. yes this
 * is important"*. The plan is DECISION_LOG 2026-07-27 (🕵️ FOUND-YOU rows) and
 * `Explore_Replan_BUILD_SPEC_2026-07-27.md` §10.
 *
 * WHERE EACH PIECE LIVES
 *   · the record — `public.event_vendor_found`, one row per (event, shop), written by a trigger on the profile-view
 *     row the app already writes (migration 20271313372071). Opening a shop from a Setnayan surface counts; a
 *     list, a rail or a search result that was never opened does not;
 *   · the check — `found_you_check_at_claim`, run inside the couple's Approve (`answer_claim_access_request`),
 *     answered as `found_you` and read here by {@link readFoundYou};
 *   · the supplier's lead alert — {@link foundYouLeadNotice}, sent IN-APP ONLY by `answerClaimAccess`
 *     (type `found_you_lead`, never an email);
 *   · the couple's nudge — {@link foundYouNudgeLine}, under a matching shop in the add walk's step 1.
 *
 * WHAT THE WORDS MAY NOT SAY (each pinned by `found-you.test.ts`)
 *   · nothing about a fee, a charge or "sourced" — couples are never told about the booking fee (owner
 *     2026-10-12), and the supplier's bill says its own words;
 *   · no contact detail of anybody — the alert carries the couple's event name, its type and date, and the
 *     found date and count (§10 "data-minimal");
 *   · "event", never "celebration".
 *
 * PURE — no database, no `server-only`.
 */
import { formatLongDate, formatLongTimestamp } from './format-date';
import { formatCount } from './format-number';

/** What `answer_claim_access_request` returned as `found_you`, made safe. Anything unreadable is NOT found. */
export type FoundYouAnswer =
  | { found: true; firstFoundAt: string; viewCount: number }
  | { found: false };

export function readFoundYou(raw: unknown): FoundYouAnswer {
  if (!raw || typeof raw !== 'object') return { found: false };
  const r = raw as { found?: unknown; first_found_at?: unknown; view_count?: unknown };
  if (r.found !== true) return { found: false };
  const firstFoundAt = typeof r.first_found_at === 'string' ? r.first_found_at : '';
  const viewCount = Number(r.view_count);
  if (!firstFoundAt || Number.isNaN(new Date(firstFoundAt).getTime())) return { found: false };
  if (!Number.isFinite(viewCount) || viewCount < 1) return { found: false };
  return { found: true, firstFoundAt, viewCount: Math.floor(viewCount) };
}

const times = (n: number) => (n === 1 ? 'once' : `${formatCount(n)} times`);

/**
 * The supplier's lead alert — "You were found on Setnayan on {date} by {couple} for their {type, date} event".
 * It opens the event the couple just let them into.
 */
export function foundYouLeadNotice(args: {
  eventId: string;
  eventName: string | null;
  eventType: string | null;
  eventDate: string | null;
  firstFoundAt: string;
  viewCount: number;
}): { title: string; body: string; relatedUrl: string } {
  const who = (args.eventName ?? '').trim() || 'A couple';
  // The type as a plain word ("wedding", "debut"); this file reaches the add walk's client bundle, so no label table.
  const rawType = (args.eventType ?? '').replace(/[_-]+/g, ' ').trim().toLowerCase();
  const type = rawType === 'unspecified' ? '' : rawType;
  const day = args.eventDate ? formatLongDate(args.eventDate) : '';
  const event = type && day ? `their ${type} on ${day}` : type ? `their ${type}` : day ? `their event on ${day}` : 'their event';
  return {
    title: `${who} found you on Setnayan`,
    body:
      `They first opened your page here on ${formatLongTimestamp(args.firstFoundAt)} and looked ${times(args.viewCount)} ` +
      `before adding you to ${event}. Keep your chat, quotes and payments here.`,
    relatedUrl: `/vendor-dashboard/clients/${args.eventId}`,
  };
}

/**
 * The couple's nudge in the add walk, under a matching shop they already opened here. It says what the couple
 * already knows (they looked at this shop) and that the shop will see it — the §10 disclosure, before they add.
 */
export function foundYouNudgeLine(firstFoundAt: string): string {
  return `You found them on Setnayan on ${formatLongTimestamp(firstFoundAt)}. If they join from your link, they will see that.`;
}
