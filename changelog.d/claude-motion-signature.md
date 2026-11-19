## 2026-11-19 · feat(motion): the six signature moments — The Tie · Foil glint · Go live · Reply arrives · Day turns · Capiz light

Motion standard Phase 6 (b). Owner 18 Nov, verbatim: *"Ghost + all six"* (DECISION_LOG "SKELETON = GHOST · SIX SIGNATURE
MOMENTS"); un-parked 19 Nov: *"animations build the rest"* · *"add the builds including whisper as well"*. Visual contract:
`Setnayan-specs/prototypes/motion_standard_2026-11-18_fable.html` Part I — copied, not redrawn.

**The shared parts** (`apps/web/app/_components/signature/*`, look in `app/signature-moments.css`, rules in
`lib/signature-moments.ts`). Each is transform / opacity only, reads `--sn-m-*` tokens only, fills `backwards`, rests on
its finished picture and has its own reduced-motion still. "Have I already played?" is a mark on the DEVICE
(localStorage / sessionStorage, every read and write wrapped; no storage → the still, never a replay). No moment adds a
server write or a read.

| Moment | Screen · trigger | Once |
|---|---|---|
| ① The Tie | couple: Suppliers › Booked (`booked-body.tsx` → `BookedTie`) · supplier: the customer card on `?lock_agree=ok` (`vendorAgreeToLock`'s redirect) | per booking, per device |
| ② Foil glint | the event menu's mark (`event-rail-context.tsx`, round `EventMonogram`) · created = first open after the create-event screen (`FoilArm`) · the morning of `event_date` | created once · morning once |
| ③ Go live | the Maker, when Apply answers `live` (`hub-draft-bar.tsx` → `MakerGoLive`) | whole moment on the first publish; after that the chip |
| ④ Reply arrives | Home › Guests "coming" (`home-tile.tsx` `FaceFigure` on phones · `home-control-row.tsx` from 768) | once per visit |
| ⑤ Day turns | Home's event card countdown (`home-cover-band.tsx`) | once a day |
| ⑥ Capiz light | supplier plan screen (`plan-screen.tsx`, also `?applied=1`) · the event's plan screen (`studio/website-pro/page.tsx`) | once per plan seen on |

- **Celebrate:** not touched (a sibling builds it). The Tie takes "booking confirmed" — Celebrate's booking hook should
  render `TheTie` and nothing of its own; the note is in `the-tie.tsx` and at the supplier mount.
- **One new token:** `--sn-m-sig-step` 70 ms (Capiz light's "panes 70 ms apart"), mirrored as `MOTION_TABLE.sigPaneStepMs`.
  `scripts/lint-motion-raw.mjs` did not grow (1294 = baseline).
- **Lab:** `/dev/signature-lab` (the six on the shipped parts, stand-in words) — in the screens map, regenerated.
- `useEventCoverWords()` (`home-loading-cover.tsx`) hands a moment the couple's names and short date the layout already
  read — no new read.

**Guard:** `apps/web/lib/the-six-signature-moments.test.ts` — one test per moment (transform/opacity only · reduced
still · once only) and one for what they share. Each seen RED once, then restored:

| Sabotage | Went red |
|---|---|
| `tieFromList`: the first look at a list ties an old booking | ① |
| the foil's reduced rule loses `opacity: 0` | ② |
| `sn-sig-live-glow` animates `filter: blur()` | ③ |
| `replyArrives` no longer claims the visit | ④ |
| Day turns fills `both` | ⑤ |
| Capiz pane reads `700ms` instead of `--sn-m-rise` · `capizPlays` always true | ⑥ (twice) |
| `<FoilArm />` removed from the create-event screen | shared |

**Not verified:** a real iPhone (WebKit in Playwright parsed and ran the `linear()` spring; § 3.9's device test is still
owed) · the moments inside the running app (proved on a static harness built from the shipped parts and stylesheet, not
on a signed-in screen) · whether the event menu's mark is on screen at 390 px when the Foil glint plays · delays are sums
of tokens, so three land 20–60 ms off the prototype's own offsets.

SPEC IMPACT: `MOTION_STANDARD_2026-11-18.md` § 9 ("Signature moments — all six decided") is now BUILT; § 2 gains one wait,
`--sn-m-sig-step` 70 ms. Corpus not edited in this change (the spec folder handed to this build was a read-only copy) —
the controller applies the "built" note.
