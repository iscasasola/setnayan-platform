## 2026-11-10 · fix(shop): tapping a card's switch without a cover no longer crushes the card

Owner screenshot ("Toggle issue"): on Shop › Your services, tapping the switch on a card with no cover printed "Add a cover photo before you publish this card…" INSIDE the card row — `StayForm` renders its refusal as a sibling of the form, i.e. a flex child of the row — so it took half the width, the card face collapsed into a one-word column and the switch was drawn over the chips. The row now wraps and gives `[data-stay-error]` its own full-width line under the card. Guard `card-row-refusal-own-line.test.ts`.

SPEC IMPACT: None.

## 2026-11-10 · feat(switch): the card's live switch reads Online (green) / Offline (grey); an offline card is no longer greyed out

Owner, on an Online/Offline pill picture: "The toggle should show a momentary animate button online green and greyed out to offline" · "And removing that greyed out look". `SwitchTrack` gains an optional `words` (the worded 92 × 30 track — `SWITCH_TRACK_WORDED`, colours in `globals.css` `.sn-switch--worded`: `--sn-success` on, ink 38 % off; words cross-fade, knob slides on the family spring and squashes while pressed). Used on Shop › Your services' Show-on-Explore switch; every other switch is unchanged. The card's `opacity: 0.7` when offline is removed. Guards: `every-switch-wears-the-one-look` 8/8 · `card-row-refusal-own-line` 3/3.

SPEC IMPACT: DECISION_LOG row 2026-11-10 (worded switch for live/offline; terracotta/grey stays for every other switch).
