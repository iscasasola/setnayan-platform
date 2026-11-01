## 2026-10-29 · fix(ui): one scrim — same darkness everywhere, no tap flash

Owner, verbatim: *"our scrim when tapped sometime show that the corners/edges brighten showing it is a frame of the
screen that pressed. And the darkness of each scrims from different places are different."* · *"make sure future
scrims are connected to our design. So i dont want it to show edges. Tapping on it will just fade cleanly. When the
scrim is on, i want a partial blur to keep focus on the pop up."*

- **The flash, found:** the scrim is a full-screen `<button>`, and `PressFeel` dipped it to .93 on the tap — the
  shrunken dark bared an undimmed frame of the page round the screen. `pressable()` now skips `SCRIM_SELECTOR`
  (`lib/scrim.ts`), and the stylesheet's "THE ONE SCRIM" rule strips the press scale/dimming, focus ring, tap
  highlight, border, radius, shadow and selection from every scrim.
- **One darkness:** tokens `--sn-scrim` (light: ink 42 % · dark mode: black 55 %), `--sn-scrim-solid` (no-blur /
  reduced-transparency: 55 % · 68 %), `--sn-scrim-blur` (6 px, the partial blur), `--sn-scrim-fade` (200 ms) on
  `:root` / `html.dark`; `.sn-popup-dark`, `.sn-side-panel-scrim`, `.sn-inspector-peek` read them.
- **Moved onto the one scrim** (before → now 42 %/6 px): 16 hand-made close layers → `<OverlayBackdrop>` (explore
  filters, copy-my-link, save-to-continue, choose-plan, ticker, inline checkout, vendor direct pay, march tray,
  print guest sheet, print settings, seat-plan move, Patiktok tag, shortlist requirements, service details,
  requirements modal, Maker "More" desktop sheet, canvas maker phone); stylesheet darks → the token (front door
  drawer .38, Ugat side card .28, wedding onboarding sheet .45, RSVP sheet .45, spotlight tour .64/.6, sign-in
  overlay .46 + 9 px, unused `.sn-scrim` .14 + 7 px).
- **Clean fade + one blur:** `<OverlayBackdrop>` fades a still copy out over `--sn-scrim-fade` when it unmounts (none
  under reduce-motion), and a scrim opened over another is `data-scrim-stacked` — dims, no second blur.
- **Guard:** `lib/one-scrim.test.ts` (tokens · no-edge rule · press skip · fade/stack · no literal scrim colour/blur in
  any stylesheet or `<style>` string · no dark full-screen close layer outside `<OverlayBackdrop>`), sabotaged five
  ways. `lib/one-backdrop-everywhere`, `a-popup-darkens-what-is-behind`, `every-stages-popup-follows-the-rule`,
  `the-press-feels-the-same-everywhere` updated to read the tokens. Port baseline regenerated.

SPEC IMPACT: `INTERACTION_RULES.md` § 9 "Anything popped up over the page" — added "One scrim (2026-10-29)": the
tokens, no edge, clean fade, one partial blur, the guard.
