/**
 * lib/papic-glance.ts — PAPIC AT A GLANCE: what Home's "Your services" row and
 * the Papic page's top band say (pure, no I/O).
 *
 * 📍 Owner "Yes", 2026-10-13 (DECISION_LOG 📍 WHERE PAPIC SITS ON THE EVENT
 * DASHBOARD) and 📸 EASY BUY · GALLERY · MORE CREDITS · ON 6 MONTHS BEFORE:
 *
 *   Home row ·  "N credits left · Buy more · See N photos"
 *               before the window  "On from [date]"
 *               under 10%          "Running low · Buy more"   (Home only, no email)
 *   Next card · at its moments: cameras ready before the first photo;
 *               "Your cameras have stopped" at zero — never twice.
 *   Top band ·  credits left · Buy more · See N photos,
 *               "On from [date] · until 12 h after your day".
 *
 * 🔑 NOTHING HERE IS A NEW READ OR A NEW RULE. The credits are the pool the
 * capture path meters against (`resolvePapicHomeTile` → `papic_event_pool_status`),
 * "low" is `poolLevel` (POOL_METER_LOW_PCT, the host meter's own rule), the
 * window is `resolveStoredWindow` (the 6-month default when none is saved) and
 * its phase is `captureWindowState` — the gate's own function. Two screens that
 * worked any of these out a second way would be two deciders of one fact.
 *
 * 🔴 A read that did not happen is "—", never 0 (S41b): a refused photo count
 * is not "no photos", and a thrown pool read is not "out of credits".
 */
import { formatCount } from '@/lib/format-number';
import { poolLevel, type HostPoolMeterLevel } from '@/lib/papic-pool-meter';
import {
  captureWindowState,
  formatPapicDayInWords,
  PAPIC_CAPTURE_GRACE_HOURS,
} from '@/lib/papic-window';

/** The one unit word on every Papic surface (owner 2026-10-13: "credits", never shots / points). */
export const PAPIC_UNIT = 'credits';

/** "1 credit" · "1,240 credits". */
export function creditsWord(n: number): string {
  return `${formatCount(n)} ${n === 1 ? 'credit' : 'credits'}`;
}

/** "See 1 photo" · "See 240 photos". */
export function seePhotosWord(n: number): string {
  return `See ${formatCount(n)} ${n === 1 ? 'photo' : 'photos'}`;
}

/** How long the cameras keep going after the day — the gate's own number. */
export const PAPIC_UNTIL_WORDS = `until ${PAPIC_CAPTURE_GRACE_HOURS} h after your day`;

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
  /**
   * The host's "Photos from your guests?" (`events.papic_on`). `null` = unread:
   * the row still says what it knows, but no Next moment is conjured from it.
   */
  papicOn: boolean | null;
  nowMs?: number;
};

export type PapicGlance = {
  /** Before the window (cameras wait) · in it · after it. */
  phase: 'waits' | 'open' | 'closed';
  /** `poolLevel` — null when the pool was not measured or does not exist. */
  level: HostPoolMeterLevel | null;
  /** Credits left in the shared pool — null when not measured. */
  credits: number | null;
  /** Photos + clips gathered — null when a count was refused. */
  photos: number | null;
  /** The one status line. */
  status: string;
  tone: 'ok' | 'low' | 'stopped' | 'waits' | 'plain';
  /** Offer "Buy more" (credits are buyable early; never after the window). */
  buy: boolean;
  /** "Saturday, 12 June" — when the cameras switch on (null when no date). */
  onFrom: string | null;
  /** The Home Next card's moment, if this is one. */
  moment: 'ready' | 'stopped' | null;
};

const NOTHING: Omit<PapicGlance, 'status'> = {
  phase: 'open',
  level: null,
  credits: null,
  photos: null,
  tone: 'plain',
  buy: false,
  onFrom: null,
  moment: null,
};

export function papicGlance(input: PapicGlanceInput): PapicGlance {
  const nowMs = input.nowMs ?? Date.now();
  // A viewer the figures are not shared with gets the door, not a number.
  if (!input.permitted) return { ...NOTHING, status: 'Open' };
  const { tile } = input;
  if (tile === 'failed') return { ...NOTHING, status: '—' };
  // No pool, no camera, no photo: this event has no Papic yet.
  if (tile === null) return { ...NOTHING, status: 'Not added' };

  const phase: PapicGlance['phase'] = (() => {
    const s = captureWindowState(input.window.startDate, input.window.endIso, nowMs);
    return s === 'not_started' ? 'waits' : s === 'closed' ? 'closed' : 'open';
  })();
  const onFrom = formatPapicDayInWords(input.window.startDate, nowMs);
  const hasPool = tile.shotsTotal > 0;
  const credits = hasPool ? Math.max(0, tile.shotsLeft) : null;
  const level = hasPool ? poolLevel(tile.shotsLeft, tile.shotsTotal) : null;
  const photos = tile.photosGathered;
  const base = { phase, level, credits, photos, onFrom };

  if (phase === 'closed') {
    // The day is over: nothing more to buy (the purchase action refuses it too).
    const status = photos === null ? 'Cameras closed' : photos > 0 ? `Cameras closed · ${formatCount(photos)} ${photos === 1 ? 'photo' : 'photos'}` : 'Cameras closed';
    return { ...base, status, tone: 'plain', buy: false, moment: null };
  }
  if (phase === 'waits') {
    // More than six months out: cameras wait, credits can be bought early.
    const when = onFrom ? `On from ${onFrom}` : 'Switches on before your day';
    return {
      ...base,
      status: credits !== null ? `${when} · ${creditsWord(credits)}` : when,
      tone: 'waits',
      buy: true,
      moment: null,
    };
  }
  // In the window.
  if (credits === null) {
    // A pool that does not exist (e.g. the host answered "No") — say what we know.
    return { ...base, status: photos ? `${formatCount(photos)} ${photos === 1 ? 'photo' : 'photos'}` : 'On', tone: 'plain', buy: true, moment: null };
  }
  if (level === 'exhausted') {
    return {
      ...base,
      status: 'Stopped · 0 credits left',
      tone: 'stopped',
      buy: true,
      moment: input.papicOn === true ? 'stopped' : null,
    };
  }
  if (level === 'low') {
    return { ...base, status: `Running low · ${creditsWord(credits)} left`, tone: 'low', buy: true, moment: null };
  }
  return {
    ...base,
    status: `${creditsWord(credits)} left`,
    tone: 'ok',
    buy: true,
    // Cameras ready, nothing shot yet — the old "free camera" nudge's moment.
    moment: input.papicOn === true && photos === 0 ? 'ready' : null,
  };
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
