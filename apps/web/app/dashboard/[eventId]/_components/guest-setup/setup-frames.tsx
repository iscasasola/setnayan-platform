'use client';

import { ChosenRow } from '@/app/_components/form-row';
import { plainRefusal } from '../../guests/_components/plain-refusal';
import { DateRow } from '@/app/_components/form-row-date';
import type { GuestsGetInFrame } from './guests-get-in';
import { REPLY_BY_LINE, type ReplyByFrame } from './reply-by';
import { rsvpAsksFace, rsvpAsksPick } from '@/lib/rsvp-ask';
import type { RsvpAsksFrame } from './rsvp-asks';

/**
 * setup-frames.tsx — GUESTS › SETUP'S ROWS ARE THE MAKER'S ROWS (owner 2026-10-09, step 3: *"maybe just for it to adapt to
 * the template"*; `GUESTS-MAP.md` § 2 "Setup view": *"the same Form-row frame the Maker already hands in"*).
 *
 * The three shared parts (`GuestsGetIn`, `RsvpAsks`, `ReplyBy`) keep the value, the choices and the one writer and carry no
 * template; each DOOR hands in the app's Form row to draw them with. The Maker's door does it in `maker-rsvp-ask.tsx`
 * (`getInFrame` · `asksFrame` · `replyByFrame`); THIS is Guests › Setup's door, and it draws the same three rows the same
 * way — so a part looks one way in both doors. (Not imported FROM the Maker's file: that file is in the Maker's first load
 * and would drag the whole Maker into the Guests page; the two are held equal by
 * `setup-and-maker-mount-the-same-parts.test.ts`, which compares their source.)
 *
 * The one difference, on purpose: Guests › Setup's Reply by row keeps its sentence — what the invitation prints — behind its
 * ⓘ. The Maker's does not carry it (its date waits for ✓ Apply).
 */

/** 📅 Reply by → the Form row with a date: the pill with the calendar mark, the one calendar behind it. */
export const replyByFrame = (row: ReplyByFrame) => <DateRow data="reply-by" name={row.name} about={{ words: REPLY_BY_LINE }} value={row.own} shown={row.fallback} onKeep={keepInPlainWords(row.keep)} attrs={row.attrs} />;
/** A refused date is told in a sentence of the page's own, never the database's (the part's answer is "It is back as it was. <the action's words>"). */
export const keepInPlainWords =
  (keep: ReplyByFrame['keep']): ReplyByFrame['keep'] =>
  async (day) => {
    const r = await keep(day);
    return r.ok ? r : { ok: false, error: plainRefusal(r.error, 'The reply-by date did not save, so it is back as it was.') };
  };
/** 🎟 How guests get in → the dropdown in a Form row; the picked choice's one sentence is behind its ⓘ. */
export const getInFrame = (row: GuestsGetInFrame) => (
  <ChosenRow data="get-in" name={row.name} about={{ words: row.hint }} value={row.value} buttonText={row.buttonText} options={row.options} onPick={row.onPick} dataAttr={row.dataAttr} attrs={row.attrs} />
);
/** ☑ RSVP asks → the dropdown with ticks in a Form row (owner 2026-11-01, "Dropdown with ticks"): a tick keeps it open,
    Done closes it; its face says how many are on; its sentence is behind its ⓘ. */
export const asksFrame = (row: RsvpAsksFrame) => (
  <ChosenRow data="asks" name={row.name} about={{ words: row.line }} attrs={row.attrs} value={null} picked={row.on} options={row.asks} buttonText={rsvpAsksFace(row.on.length, row.asks.length)} onPick={rsvpAsksPick(row)} dataAttr="data-rsvp-asks" />
);
