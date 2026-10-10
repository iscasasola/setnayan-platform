/**
 * 🧾 THE REPLY CARD, RENDERED FOR A TEST — the fixtures and the harness the reply card's render tests share
 * (`the-reply-card-is-todays-page.test.ts` and the tests of the card's lines). Not a test, not app code.
 *
 * 🪤 Importing this file sets up the harness (as `every-scene-style-draws.test.ts` does it): `globalThis.React`
 * before the DYNAMIC import of the widget (`"jsx": "preserve"`), `server-only` stubbed so the real server-action
 * import chain loads.
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const h = React.createElement;

export const CELEBRATE = { organizer: 'couple', theOrganizer: 'the couple', TheOrganizer: 'The couple', theOrganizerPossessive: 'the couple’s', TheOrganizerPossessive: 'The couple’s', eventWord: 'wedding', organizerIsHonoree: false };
export const SOLEMN = { ...CELEBRATE, organizer: 'family', theOrganizer: 'the family', TheOrganizer: 'The family', theOrganizerPossessive: 'the family’s', TheOrganizerPossessive: 'The family’s', eventWord: 'wake', solemn: true };
export const GUEST = {
  guest_id: 'g-1',
  first_name: 'Ana',
  last_name: 'Reyes',
  display_name: null,
  rsvp_status: 'pending',
  meal_preference: null,
  dietary_restrictions: null,
  guest_note: null,
  email: null,
  mobile: null,
  plus_one_allowed: true,
  plus_one_count: 1,
  qr_token: 't',
  photo_source: null,
  photo_url: null,
};
/** The Reply door's own save — a named function, so the form's markup is the same on every run. */
export async function doorAction(): Promise<void> {}

export type Case = Record<string, unknown>;
export const BASE: Case = { words: CELEBRATE, guest: GUEST, eventId: 'e-1', eventPublicId: 'S89E-X', faceMode: 'mode_b', termsOnSend: true };

/** Every case, by name. The order is the record's. */
export function replyCardCases(): Array<[string, Case]> {
  const out: Array<[string, Case]> = [];
  for (const style of [null, 'question', 'ticket'] as const) {
    for (const solemn of [false, true]) {
      for (const door of [false, true]) {
        for (const one of [false, true]) {
          for (const canvas of [false, true]) {
            out.push([
              `${style ?? 'reply-card'} · ${solemn ? 'solemn' : 'celebratory'} · ${door ? 'the Reply door' : 'the Event Hub sheet'} · ${one ? 'one at a time' : 'one page'} · ${canvas ? 'the Maker’s sample' : 'a guest'}`,
              { ...BASE, words: solemn ? SOLEMN : CELEBRATE, sceneStyle: style, oneAtATime: one, previewEveryQuestion: canvas, ...(door ? { doorAction } : {}) },
            ]);
          }
        }
      }
    }
  }
  const OWN = { attending: 'Count me in', declined: 'I cannot make it', eyebrow: 'Kindly answer', question: 'Will you join us in Tagaytay?', hint: 'Choose one' };
  for (const style of [null, 'question', 'ticket'] as const) {
    const name = style ?? 'reply-card';
    for (const status of ['attending', 'declined', 'maybe']) out.push([`${name} · already ${status}`, { ...BASE, sceneStyle: style, doorAction, guest: { ...GUEST, rsvp_status: status } }]);
    out.push([`${name} · the guest list is closed, attending`, { ...BASE, sceneStyle: style, doorAction, replyLocked: true, guest: { ...GUEST, rsvp_status: 'attending' } }]);
    out.push([`${name} · the guest list is closed, declined`, { ...BASE, sceneStyle: style, replyLocked: true, guest: { ...GUEST, rsvp_status: 'declined' } }]);
    out.push([`${name} · the couple’s own words`, { ...BASE, sceneStyle: style, doorAction, answerWords: OWN }]);
    out.push([`${name} · the couple’s own words, one at a time`, { ...BASE, sceneStyle: style, doorAction, oneAtATime: true, answerWords: OWN }]);
    out.push([`${name} · the couple’s own words, the Maker’s sample`, { ...BASE, sceneStyle: style, doorAction, previewEveryQuestion: true, oneAtATime: true, answerWords: OWN }]);
    out.push([`${name} · every question switched off`, { ...BASE, sceneStyle: style, doorAction, ask: { plus_ones: false, meal: false, dietary: false, song_request: false, note: false, mobile: false } }]);
    out.push([`${name} · the tagging question asked`, { ...BASE, sceneStyle: style, doorAction, askTagging: true }]);
    out.push([`${name} · a flash, a host pitch, no terms`, { ...BASE, sceneStyle: style, termsOnSend: false, hostPitch: true, flash: { tone: 'error', text: 'Please choose an answer.' }, guest: { ...GUEST, rsvp_status: 'attending' } }]);
  }
  out.push(['the key gate · only the meal is missing', { ...BASE, doorAction, gate: { missing: ['meal'], coupleMarked: true }, guest: { ...GUEST, rsvp_status: 'attending' } }]);
  out.push(['the key gate · the answer is missing', { ...BASE, doorAction, gate: { missing: ['attending', 'mobile'], coupleMarked: false } }]);
  return out;
}

export async function renderReplyCard(props: Case): Promise<string> {
  const { RsvpWidget } = await import('./rsvp-widget');
  return renderToStaticMarkup(h(RsvpWidget as never, props as never));
}
