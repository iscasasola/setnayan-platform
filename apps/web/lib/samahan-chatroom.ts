/**
 * samahan-chatroom.ts — THE GROUP IS A CHATROOM (owner 2026-10-28, verbatim: *"groups should look like a chatroom with
 * stories and events. all stories will run in a collage every hour"* → *"Groups chatroom approved. Send it to the
 * build screen"*; DECISION_LOG "GROUPS AS A CHATROOM"; prototype `prototypes/groups_chatroom_2026-10-28/`).
 *
 * The pure half: what the chat SAYS, in what order, derived at READ time from rows the group page already reads —
 * Usapan messages (`samahan_messages`), the group's events (`events.community_id`) and the live stories
 * (`samahan_stories`). Nothing here is stored and nothing is rendered twice: no collage row, no event-post row.
 *
 * 🎞 THE HOURLY COLLAGE IS A GROUPING, NOT A THING. On the hour, that hour's stories post into the chat as ONE item
 * ("3 PM · 6 stories"). It is the SAME clips — no upload, no render — bucketed by the hour of their `created_at`. So it
 * expires with them: a clip whose `expires_at` has passed leaves its tile (the read's RLS already hides it; this
 * module drops it again so a render after the clock passes never draws a dead tile), and a collage whose clips are
 * all gone is gone. An hour that has not ENDED has not posted yet — "on the hour" means when the hour closes.
 *
 * 🕒 THE HOUR IS MANILA'S, AND IT IS THE SAME HOUR EVERYWHERE. Manila is UTC+8 with no daylight saving, so the bucket
 * `floor(ms / 1h)` is a Manila hour as much as a UTC one — the server render and the phone agree on which hour a clip
 * belongs to whatever either clock's zone is. Only the WORDS ("3 PM", "Today") are formatted, and always in
 * `Asia/Manila`, so the server's text and the browser's text are the same string (no hydration mismatch).
 *
 * 🔒 Held by `lib/samahan-chatroom.test.ts`.
 */
import type { CommunityEventRow, SamahanMessage } from './communities';
import type { SamahanStory } from './samahan-stories';

export const HOUR_MS = 3_600_000;
const TZ = 'Asia/Manila';

/** One hour's stories, posted into the chat as one item when the hour ends. */
export type HourCollage = {
  /** Stable key — the hour's start, in ms. */
  key: string;
  /** The hour the clips were taken in (start, ms). */
  hourStartMs: number;
  /** When it posted: the end of that hour. */
  postedAtMs: number;
  /** "3 PM". */
  label: string;
  /** The hour's clips, oldest first — the order they were taken. */
  stories: SamahanStory[];
  /** When the LAST of its clips expires — the collage is gone then. */
  goneAtMs: number;
};

/** A community event with the moment it was planned (its card's place in the chat). */
export type ChatEvent = CommunityEventRow & { created_at?: string | null };

export type ChatItem =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'message'; key: string; at: number; message: SamahanMessage }
  | { kind: 'event'; key: string; at: number; event: ChatEvent }
  | { kind: 'collage'; key: string; at: number; collage: HourCollage };

const ms = (iso: string | null | undefined): number => {
  if (!iso) return Number.NaN;
  return new Date(iso).getTime();
};

/** "3 PM" — the hour, in Manila. */
export function hourLabel(hourStartMs: number): string {
  return new Date(hourStartMs).toLocaleTimeString('en-US', { hour: 'numeric', timeZone: TZ });
}

/** Manila calendar day of an instant, as YYYY-MM-DD. */
export function manilaDay(at: number): string {
  return new Date(at).toLocaleDateString('en-CA', { timeZone: TZ });
}

/** "Today" · "Yesterday" · "Mon, Oct 26" — the chat's day divider, in Manila. */
export function dayLabel(at: number, nowMs: number): string {
  const day = manilaDay(at);
  if (day === manilaDay(nowMs)) return 'Today';
  if (day === manilaDay(nowMs - 24 * HOUR_MS)) return 'Yesterday';
  return new Date(at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: TZ });
}

/**
 * The hourly collages, oldest hour first. A clip counts only while it is live (`expires_at` after now); an hour
 * posts only once it has ended. Pure — `nowMs` is handed in so the server and the phone draw the same chat.
 */
export function hourlyCollages(stories: readonly SamahanStory[], nowMs: number): HourCollage[] {
  const byHour = new Map<number, SamahanStory[]>();
  for (const s of stories) {
    const taken = ms(s.created_at);
    const expires = ms(s.expires_at);
    if (!Number.isFinite(taken)) continue;
    if (!(expires > nowMs)) continue; // gone after 24 hours — and the collage with it
    const hourStart = Math.floor(taken / HOUR_MS) * HOUR_MS;
    if (hourStart + HOUR_MS > nowMs) continue; // this hour has not ended — it has not posted yet
    const list = byHour.get(hourStart);
    if (list) list.push(s);
    else byHour.set(hourStart, [s]);
  }
  return [...byHour.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([hourStartMs, list]) => {
      const clips = [...list].sort((a, b) => ms(a.created_at) - ms(b.created_at));
      return {
        key: `h${hourStartMs}`,
        hourStartMs,
        postedAtMs: hourStartMs + HOUR_MS,
        label: hourLabel(hourStartMs),
        stories: clips,
        goneAtMs: Math.max(...clips.map((s) => ms(s.expires_at))),
      };
    });
}

/** "6 stories" · "1 story". */
export function storiesWord(n: number): string {
  return `${n} ${n === 1 ? 'story' : 'stories'}`;
}

/** "21h left" · "40m left" — until the collage's last clip goes. */
export function leftLabel(goneAtMs: number, nowMs: number): string {
  const left = goneAtMs - nowMs;
  if (left <= 0) return 'gone';
  const h = left / HOUR_MS;
  return h >= 1 ? `${Math.floor(h)}h left` : `${Math.max(1, Math.floor(left / 60_000))}m left`;
}

/**
 * The chat, oldest first: every message, a card for each event the group planned (at the moment it was planned),
 * and each hour's collage (at the moment its hour ended) — with a day divider wherever the Manila day changes.
 * An event with no readable `created_at` posts no card (it still shows pinned and under ⋯ › All events).
 */
export function chatTimeline({
  messages,
  events,
  collages,
  nowMs,
}: {
  messages: readonly SamahanMessage[];
  events: readonly ChatEvent[];
  collages: readonly HourCollage[];
  nowMs: number;
}): ChatItem[] {
  type Timed = Exclude<ChatItem, { kind: 'day' }>;
  const timed: Timed[] = [];
  for (const m of messages) {
    const at = ms(m.created_at);
    if (Number.isFinite(at)) timed.push({ kind: 'message', key: `m${m.message_id}`, at, message: m });
  }
  for (const e of events) {
    const at = ms(e.created_at ?? null);
    if (Number.isFinite(at) && at <= nowMs) timed.push({ kind: 'event', key: `e${e.event_id}`, at, event: e });
  }
  for (const c of collages) timed.push({ kind: 'collage', key: c.key, at: c.postedAtMs, collage: c });
  timed.sort((a, b) => a.at - b.at);

  const out: ChatItem[] = [];
  let day = '';
  for (const t of timed) {
    const d = manilaDay(t.at);
    if (d !== day) {
      day = d;
      out.push({ kind: 'day', key: `d${d}`, label: dayLabel(t.at, nowMs) });
    }
    out.push(t);
  }
  return out;
}

/**
 * The event pinned under the stories: the group's next DATED event, today or later (Manila). An undated event is
 * not "next" — it has no day to be next on; it stays under ⋯ › All events.
 */
export function nextGroupEvent<T extends Pick<CommunityEventRow, 'event_date'>>(
  events: readonly T[],
  todayISO: string,
): T | null {
  const upcoming = events
    .filter((e) => typeof e.event_date === 'string' && e.event_date.slice(0, 10) >= todayISO)
    .sort((a, b) => (a.event_date! < b.event_date! ? -1 : a.event_date! > b.event_date! ? 1 : 0));
  return upcoming[0] ?? null;
}
