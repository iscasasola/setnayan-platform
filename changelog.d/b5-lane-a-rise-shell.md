## 2026-11-10 · feat(rise): Rise full screen — the ONE shell, and every Shop tab door opens into it (Build 5 · Lane A, slice 1)

Owner 2026-11-10: *"risefull screen is what we call it"* · *"fullscreen everything"* · on the Shop screenshot *"Most of
these will be the fullscreen grow design"* (DECISION_LOG "RISE FULL SCREEN IS THE NAME; FULL SCREEN EVERYTHING";
prototypes approved 10 Nov — `settings_full_screen_2026-11-10` and `supplier_clients_2026-11-07/supplier-menu-r2.v119`).

- **`RiseScreen`** (`app/_components/rise/rise-screen.tsx`) — the one full screen, built from the picked-client shell:
  grows out of the thing you tapped (a clip from its rect on THE ONE rise, `RISE_MS`/`RISE_EASE` — 0.7 s when #7431
  lands; no number of its own), the bars slide away (`useChromeAway`), ✕ / Esc / the phone's Back play the exact reverse
  back into it, the page under it is held and put back on the same pixel (`useModalA11y`), a tab re-tap still reaches the
  top. Head per the settings prototype: ✕ · title over one line · the screen's own action · ⓘ. Pure half (origin +
  frames) in `lib/rise-screen.ts`; the origin is the last press on a pressable thing, fresh within 1.5 s (a deep link
  simply appears).
- **`MenuSettingsButton rise`** — a ⚙ opens its same rows in the risen screen (same name, line, ⓘ words). Every other ⚙
  keeps its sheet byte-for-byte until its own slice.
- **Shop tab map, rows that rise:** ⚙ (pinned row + cover via `?gear=1`) · Logo 📷 · Share · Promote · QR · Cover ·
  View shop (now the page as couples see it INSIDE the app, with "Open in browser ↗" — no new tab) · each Analytics card ·
  each Badge. Bodies unchanged; only the frame they open in.
- 🔒 `app/_components/rise/the-rise-screen-is-one-full-screen.test.ts` (red on main: tests 4 + 5; sabotaged once each).

Not in this slice (listed in the PR): the avatar rows (Your details · Your page · Helpers · Plan · Settings), the Today /
Clients / Portfolio ⚙s and their rearranged screens + the Clients "How many a day" stepper, the client row rise, Today's
pinned "Needs you today", the Shop services list / ＋ Create rising (next to Lane C's card), the cover crop full screen.

SPEC IMPACT: None — builds the approved Lane A design; no ruling changed.
