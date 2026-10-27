## 2026-10-27 · feat(pinned-rows): one pinned row on Guests, Home and Suppliers — each keeps its selector, simplified

Owner, 27 Oct: *"pinned approve"* (Guests B · Home A · Suppliers A) and *"On the pinned the selectors should stay but simplified."*

- **Guests** (`guests-screen.tsx` + `.module.css`): the sticky block is ONE 44-px row (8 + 44 + 8). At rest it is the
  shipped `List · Map · Settings` pill; once the Replies strip has scrolled under it (`data-collapsed`, one rect read per
  frame, written only on change) a summary face laid OVER the pill cross-fades in — `List · Map` (the same pill, small,
  words only) · `✓ ✕ ?` (the SAME `data-reply-filter` doors) · `Invite N ›` (the SAME `/guests/send` door). The strip
  (Replies ⓘ, %, bar, +1s, Excel) left the sticky block and scrolls. The block's in-flow height never changes, so the
  group header pinned under it never jumps. `prefers-reduced-motion` → no travel, no fade.
- **Home** (`home-cover-band.tsx`, new `home-cover-pin.tsx`, `lib/home-cover-words.ts` `shortDate`): the cover band is
  `sticky` with a NEGATIVE top (bar − (band − 52 px)); stuck, the big words fade and one line `<names> · <date>` shows in
  the band's bottom 52 px. No ⚙ (Home's cover has had none since 24 Oct; the amendment keeps ⚙ out of pinned rows).
  `useShellBarOffset` gained a property-name argument so Home reads the bar through the same hook.
- **Suppliers** (`services-takeover.tsx`): only `Find · Build · Booked` is sticky; the date · place line is plain content
  above it and scrolls away (still the only place the date and place appear).
- New guard `apps/web/lib/the-pinned-row-is-one-row.test.ts` (sabotaged 5 ways, each red). Three guards follow the
  ruling: `your-team-phone-first` (a) — the date · place line now sits OUTSIDE the pinned block;
  `opening-an-event-shows-its-name-at-once` — `homeCoverWords` returns `shortDate`; `the-home-leads-with-one-next` — the
  pinned line is the one allowed third (aria-hidden) copy of the name.

SPEC IMPACT: DECISION_LOG.md 2026-10-27 rows "PINNED ROWS ON SCROLL — ONE ROW PER MENU (Guests B · Home A · Suppliers A)"
and "PINNED ROWS KEEP THEIR SELECTORS — SIMPLIFIED" — build note appended; prototype copied to
`prototypes/guests_pinned_row_2026-10-27/`.
- **Found while shooting — the pinned rows hid UNDER the bar on a desk.** `data-hidden="true"` is only the scroll's
  request; `front-door.css` slides the bar away below 1024 px only, so at 1280 every sticky head read "bar hidden" and
  pinned at `top: 0`, behind the 60-px bar (already true of the shipped Guests block; with one row it vanished whole).
  One shared read now, `shellBarShows` in `use-shell-bar-offset.ts`, used by Guests, People, Home and Suppliers;
  `suppliers-keeps-the-shell-bar.test.ts` now holds the helper (sabotage: dropping its 1024 rule → red).
