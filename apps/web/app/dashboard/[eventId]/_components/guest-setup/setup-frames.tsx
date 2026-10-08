'use client';

import type { ReactNode } from 'react';
import { ChosenRow, FormRow } from '@/app/_components/form-row';
import { DateRow } from '@/app/_components/form-row-date';
import type { GuestsGetInFrame } from './guests-get-in';
import { REPLY_BY_LINE, type ReplyByFrame } from './reply-by';

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
export const replyByFrame = (row: ReplyByFrame) => <DateRow data="reply-by" name={row.name} about={{ words: REPLY_BY_LINE }} value={row.own} shown={row.fallback} onKeep={row.keep} attrs={row.attrs} />;
/** 🎟 How guests get in → the dropdown in a Form row; the picked choice's one sentence is behind its ⓘ. */
export const getInFrame = (row: GuestsGetInFrame) => (
  <ChosenRow data="get-in" name={row.name} about={{ words: row.hint }} value={row.value} buttonText={row.buttonText} options={row.options} onPick={row.onPick} dataAttr={row.dataAttr} attrs={row.attrs} />
);
/** ✓ RSVP asks → a Form row whose answer is the chips under it; its sentence is behind its ⓘ. */
export const asksFrame = (row: { name: string; line: string; chips: ReactNode; attrs: Readonly<Record<`data-${string}`, string>> }) => (
  <FormRow data="asks" name={row.name} about={{ words: row.line }} attrs={row.attrs} below={<div className="pb-3 pt-0.5">{row.chips}</div>} />
);
