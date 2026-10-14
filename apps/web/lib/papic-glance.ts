/**
 * lib/papic-glance.ts — PAPIC AT A GLANCE: what Home's "Your services" row, the
 * Home Next card and the Papic page's top band say (pure, no I/O).
 *
 * 🎨 Owner "approve all", 2026-10-14 (DECISION_LOG 🎨) over the 📍/📸 rows of
 * 2026-10-13 — prototype `Setnayan/prototypes/papic_easy_home_and_band_2026-10-14_fable.html`,
 * whose `facts()` / `renderHome()` / `renderPapic()` this file translates:
 *
 *   Home row ·  "N credits left" + meter · Buy more · See N photos
 *               before the window   "N credits · On from [date]"        (gold)
 *               under 10%           "Running low · N credits left"      (amber)
 *               at zero             "0 credits left · Your cameras have stopped" (red)
 *   Next card · its moments — cameras ready before the first photo · stopped at
 *               zero · (owner call 1) running low ON THE EVENT DAY, once that morning.
 *               When it holds the card, the row drops the button the card offers;
 *               (call 3) at zero the row keeps the red meter only, no second "Stopped".
 *   Band     ·  N credits left · of M bought, meter, Buy more, See your N photos,
 *               "On from [date] · until 12 hours after your day".
 *
 * 🔑 NOTHING HERE IS A NEW READ OR A NEW RULE. The credits are the pool the
 * capture path meters against (`papic_event_pool_status`), "low" is `poolLevel`
 * (POOL_METER_LOW_PCT, the host meter's own rule), the window is
 * `resolveStoredWindow` (the 6-month default when none is saved) and its phase
 * is `captureWindowState` — the gate's own function.
 *
 * 🔴 A read that did not happen is "—", never 0 (S41b): a refused photo count
 * is not "no photos", and a thrown pool read is not "out of credits".
 */
import { formatCount } from '@/lib/format-number';
import { poolLevel } from '@/lib/papic-pool-meter';
import {
  captureWindowState,
  formatPapicDayInWords,
  manilaDate,
  PAPIC_CAPTURE_GRACE_HOURS,
} from '@/lib/papic-window';
import type { GlanceLine, ServiceGlance, ServiceMood } from '@/lib/service-glance';

/** The one unit word on every Papic surface (owner 2026-10-13: "credits", never shots / points). */
export const PAPIC_UNIT = 'credits';

/** "1 credit" · "1,240 credits". */
export function creditsWord(n: number): string {
  return `${formatCount(n)} ${n === 1 ? 'credit' : 'credits'}`;
}

/** "See 1 photo" · "See 240 photos" (Home). */
export function seePhotosWord(n: number): string {
  return `See ${formatCount(n)} ${n === 1 ? 'photo' : 'photos'}`;
}

/** How long the cameras keep going after the day — the gate's own number. */
export const PAPIC_UNTIL_WORDS = `until ${PAPIC_CAPTURE_GRACE_HOURS} hours after your day`;

export type PapicGlanceTile = {
  shotsLeft: number;
  shotsTotal: number;
  photosGathered: number | null;
};

export type PapicGlanceInput = {
  /** May this viewer see Papic's figures (couple · coordinator). */
  permitted: boolean;
  /** `resolvePapicHomeTile`'s answer — null = no Papic on this event; 'failed' = it threw. */
  tile: PapicGlanceTile | null | 'failed';
  /** `resolveStoredWindow`'s first day and closing instant (the 6-month default when unsaved). */
  window: { startDate: string | null; endIso: string | null };
  /** The event day (Manila) — for owner call 1, the running-low card on the day. */
  eventDate?: string | null;
  /**
   * The host's "Photos from your guests?" (`events.papic_on`). `null` = unread:
   * the row still says what it knows, but no Next moment is conjured from it.
   */
  papicOn: boolean | null;
  nowMs?: number;
};

/** The Home Next card's Papic moments. */
export type PapicMoment = 'ready' | 'stopped' | 'low-today';

export type PapicGlance = ServiceGlance & {
  /** Before the window (cameras wait) · in it · after it. */
  phase: 'waits' | 'open' | 'closed';
  /** Credits left — same as `count`, named for readers of the old tile. */
  credits: number | null;
  /** Photos gathered — same as `result`. */
  photos: number | null;
  /** The plain status (a fallback / screen-reader string). */
  status: string;
  /** Home's status line, the count bold. */
  line: GlanceLine;
  /** Offer "Buy more" (credits are buyable early; never after the window). */
  buy: boolean;
  /** The Home Next card's moment, if this is one. */
  moment: PapicMoment | null;
};

const NOTHING = {
  phase: 'open' as const,
  count: null,
  total: null,
  unit: PAPIC_UNIT,
  mood: 'plain' as ServiceMood,
  pct: 0,
  onFrom: null,
  result: null,
  credits: null,
  photos: null,
  buy: false,
  moment: null,
};

function plain(status: string): PapicGlance {
  return { ...NOTHING, status, line: { lead: status } };
}

export function papicGlance(input: PapicGlanceInput): PapicGlance {
  const nowMs = input.nowMs ?? Date.now();
  // A viewer the figures are not shared with gets the door, not a number.
  if (!input.permitted) return plain('Open');
  const { tile } = input;
  if (tile === 'failed') return plain('—');
  // No pool, no camera, no photo: this event has no Papic yet.
  if (tile === null) return plain('Not added');

  const phase: PapicGlance['phase'] = (() => {
    const s = captureWindowState(input.window.startDate, input.window.endIso, nowMs);
    return s === 'not_started' ? 'waits' : s === 'closed' ? 'closed' : 'open';
  })();
  const onFrom = formatPapicDayInWords(input.window.startDate, nowMs);
  const hasPool = tile.shotsTotal > 0;
  const count = hasPool ? Math.max(0, tile.shotsLeft) : null;
  const total = hasPool ? tile.shotsTotal : null;
  const level = hasPool ? poolLevel(tile.shotsLeft, tile.shotsTotal) : null;
  const pct = hasPool ? Math.min(100, Math.max(0, Math.round((Math.max(0, tile.shotsLeft) / tile.shotsTotal) * 100))) : 0;
  const photos = tile.photosGathered;
  const base = { ...NOTHING, phase, count, total, pct, onFrom, result: photos, credits: count, photos };
  const isOn = input.papicOn === true;

  if (phase === 'closed') {
    // The day is over: nothing more to buy (the purchase action refuses it too).
    const status = 'Cameras closed';
    return { ...base, mood: 'plain', status, line: { lead: status }, buy: false, moment: null };
  }
  if (count === null) {
    // No pot (e.g. the host answered "No") — say what we know, draw no meter.
    const status = phase === 'waits' && onFrom ? `On from ${onFrom}` : 'On';
    return { ...base, mood: 'plain', status, line: { lead: status }, buy: true, moment: null };
  }
  if (phase === 'waits') {
    // More than six months out: cameras wait, credits can be bought early.
    const tail = onFrom ? ` · On from ${onFrom}` : '';
    return {
      ...base,
      mood: 'wait',
      status: `${creditsWord(count)}${tail}`,
      line: { strong: creditsWord(count), tail },
      buy: true,
      moment: null,
    };
  }
  if (level === 'exhausted') {
    return {
      ...base,
      mood: 'gone',
      status: '0 credits left · Your cameras have stopped',
      line: { strong: '0 credits left', tail: ' · Your cameras have stopped' },
      buy: true,
      moment: isOn ? 'stopped' : null,
    };
  }
  if (level === 'low') {
    // Owner call 1 (2026-10-14): on the EVENT DAY, running low takes the Next
    // card — once that morning (its "Later" hides it for the day).
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date(nowMs));
    const onTheDay = manilaDate(input.eventDate ?? null) === today;
    return {
      ...base,
      mood: 'low',
      status: `Running low · ${creditsWord(count)} left`,
      line: { lead: 'Running low · ', strong: `${creditsWord(count)} left` },
      buy: true,
      moment: isOn && onTheDay ? 'low-today' : null,
    };
  }
  return {
    ...base,
    mood: 'ok',
    status: `${creditsWord(count)} left${photos === 0 ? ' · No photos yet' : ''}`,
    line: { strong: `${creditsWord(count)} left`, tail: photos === 0 ? ' · No photos yet' : '' },
    buy: true,
    // Cameras ready, nothing shot yet — the old "free camera" nudge's moment.
    moment: isOn && photos === 0 ? 'ready' : null,
  };
}

/**
 * NEVER TWICE (owner 2026-10-14) — WHILE THE CARD IS ON SCREEN. When Papic holds
 * the Next card, the row's own Buy more (and at zero, call 3, its "stopped"
 * words) would say what the card says. Returns WHICH parts are doubled; the row
 * still DRAWS them, marked, and they stand down only while the card is visible
 * (`[data-while-next]`, globals.css). 🔴 walk-b6 F1 (2026-10-14): they used to be
 * left out on the server, so a couple who pressed "Later" on "Your cameras have
 * stopped" was left with no Buy more anywhere on Home for the rest of the day.
 */
export function papicRowDoubled(next: PapicMoment | null): { buy: boolean; tail: boolean } {
  if (next === 'stopped') return { buy: true, tail: true };
  if (next === 'low-today') return { buy: true, tail: false };
  return { buy: false, tail: false };
}

/**
 * The Papic page's own read (`readPapicStandings`) as a glance tile — the page
 * already counts the library and reads the pot once, so its band reads nothing
 * more. An unread pool is 'failed' ("—"), never "0 credits left".
 */
export function glanceTileFromStandings(s: {
  credits: number | null;
  creditsTotal: number | null;
  poolRead: boolean;
  inLibrary: number | null;
}): PapicGlanceTile | 'failed' {
  if (!s.poolRead) return 'failed';
  return { shotsLeft: s.credits ?? 0, shotsTotal: s.creditsTotal ?? 0, photosGathered: s.inLibrary };
}
