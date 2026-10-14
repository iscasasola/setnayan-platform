## 2026-10-14 · feat(rsvp): replies get their own open and close — and the Invitation opens on ONE date

Owner ruling 2026-10-14 (DECISION_LOG 📬 "RSVP GETS ITS OWN OPEN AND CLOSE").

- **Details › RSVP** gets two dropdowns under Reply by: *Replies open* ▾ With the invitation · On a date… · Now ·
  Closed, and *Replies close* ▾ On the event day · On the reply-by date · On a date…, with the one calendar under each
  "On a date…" (`replies-window-rows.tsx`). Stored as four sparse keys of `events.rsvp_ask_config`
  (`repliesOpen` · `repliesOpenOn` · `repliesClose` · `repliesCloseOn`) — **no migration**; drafted, live at ✓ Apply.
- **One resolver**, `replyWindow(event, now, tz, face)` (`lib/reply-window.ts`) → `not_yet | open | closed`, on the
  venue's clock. Rule 5 lives there: replies never open without the Invitation. "Now"/"Closed" override the dates;
  "On the event day" closes when the Invitation hands over to The Day (today's behaviour); a date closes after its last day.
- **Guests:** the Reply card reads "Replies open on Saturday, 14 November" (no button) or "Replies are closed. Need to
  change? Message the couple." (no Reply / Change); the reply page and the landing draw the same words and no form
  (`ReplyWindowNote`); the key gate never sends a guest to a shut form; every other reply door is hidden.
- **Server:** `submitRsvp` refuses outside the window (nothing written, `?rsvp=window` → "Your reply was not sent."),
  and so does the join door's request (`replies_not_yet` / `replies_closed`). The couple's own Guest list edits are
  not gated. The reminder email's reply line waits before open and stops after close.
- **The mismatch fixed:** the Invitation opens on `events.std_invitation_launch_date` when set, else 90 days out
  (`lib/invitation-opens-on.ts`), by venue day — `getLifecyclePhase` takes the date and every caller passes it; the
  Save the Date film's automatic date is the same day (was 3 calendar months).
- Guards: `lib/reply-window.test.ts` (every pick × stage, edge minutes, venue clock), `lib/every-reply-writer-asks-the-window.test.ts`,
  `lib/the-invitation-opens-on-one-date.test.ts` (tree walk), `tests/db/replies-have-their-own-open-and-close.db.test.ts`.
- **Join door (walk of batch 6):** a request refused before replies open is told the Reply card's own words and
  day ("Replies open on Saturday, 14 November") — the door hands `replyWindowWords` from its one read to the refusal copy.
- **Reply page at 320 × 568:** "Tap one to continue" no longer stands on "Joyfully accepts" — the hint is see-through to
  taps and, under 600 px tall, stays in the card instead of sticking. 375 × 667 and taller unchanged (measured).

SPEC IMPACT: the 📬 row's default close words change — owner 2026-10-14 on review: the default close pick reads "On the event day" (never the stage's old name);
join-door requests are refused outside the window. Builder readings (Now also re-opens after a close date; "On the
event day" = the hand-over to The Day) are in `controller-2026-10-12/handovers/rsvp-open-close.md`.
