/**
 * live-studio-go-live-confirm.ts — the ONE "Go live now?" question every go-live button asks first.
 *
 * Owner, 2026-11-05 (DECISION_LOG "THE 15 'ACT FIRST' ITEMS", item 11): Live Studio gets a confirm before going
 * live — *"important"*. A stray tap on Go live put the event on air with no second step.
 *
 * The copy says what really happens and nothing about money: since LS6 (2026-09-02, `lib/live-studio-window.ts`)
 * the multi-camera unlock is once per event with no clock, so a press does not "use up" a paid day. What a press
 * does do is create the broadcast and show it to guests on the Event Hub — and End stops it.
 *
 * Shared on purpose: the controller, Home's Live card, the setup card and the older control room each call the
 * go-live action, and four copies of the words drift. `live-studio-go-live-confirm.test.ts` holds every caller to it.
 */
export const GO_LIVE_CONFIRM = {
  title: 'Go live now?',
  body: 'Guests can watch on your Event Hub as soon as it starts. You can end it any time.',
  confirmLabel: 'Go live',
  cancelLabel: 'Not yet',
} as const;
