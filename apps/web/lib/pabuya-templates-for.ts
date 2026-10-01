/**
 * WHICH STARTING POINTS A HOST IS OFFERED FOR THE GIFTS-PAGE MESSAGE.
 *
 * `PABUYA_TEMPLATES` (lib/pabuya-message.ts) are the owner's five, and they are
 * NEWLYWED-SHAPED — "our new home", "our life together", "dance with us". The
 * 2026-09-30 audit found them offered to every type, a wake included.
 *
 * So: a wedding keeps the five exactly; a wake (the solemn register) gets three
 * plain lines of thanks; every other type gets three neutral lines. Kept in its
 * own module so the Maker's lazy details chunk — which imports only the five —
 * carries none of this.
 *
 * Same rule as the five: no line opens with the ask (pabuya-message.test.ts).
 */
import { PABUYA_TEMPLATES, type PabuyaTemplate } from '@/lib/pabuya-message';

export const SYMPATHY_TEMPLATES: readonly PabuyaTemplate[] = [
  {
    key: 'kindness',
    name: 'Thank you',
    body: 'Thank you for your kindness to our family.',
  },
  {
    key: 'presence',
    name: 'Your presence is enough',
    body:
      'Your presence means more to us than anything. If you wish to help, any gift goes toward the family’s arrangements.',
  },
  {
    key: 'no-obligation',
    name: 'No obligation',
    body:
      'Please don’t feel you need to give anything — being with us is enough. If you would still like to help, it is received with gratitude.',
  },
];

export const NEUTRAL_TEMPLATES: readonly PabuyaTemplate[] = [
  {
    key: 'presence',
    name: 'Your presence is the gift',
    body:
      'Your presence is the gift. But if you’d like to give more, a gift here lets us choose something we truly need — from all of you.',
  },
  {
    key: 'no-obligation',
    name: 'No obligation at all',
    body:
      'Please don’t feel you have to give anything. Just come and enjoy the day with us. And if you’d like to leave a gift, thank you — it means a lot.',
  },
  {
    key: 'plainly',
    name: 'Plainly put',
    body:
      'If you’d like to give, a gift here lets us choose the thing we truly need. Thank you for thinking of us.',
  },
];

/** The templates for this event's words — the owner's five only for a wedding. */
export function pabuyaTemplatesFor(w: { eventWord: string; solemn: boolean }): readonly PabuyaTemplate[] {
  if (w.solemn) return SYMPATHY_TEMPLATES;
  return w.eventWord === 'wedding' ? PABUYA_TEMPLATES : NEUTRAL_TEMPLATES;
}
