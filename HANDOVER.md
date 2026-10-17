# HANDOVER — rd/closing-words-and-style (2026-10-17)

Owner ask (17 Oct): "allow styles on the see you soon and customization. so we can edit the text there."

## Design (decided, matches shipped machinery)
- The closing's LINE is a new element key `closing` (`lib/element-style.ts` `HUB_CLOSING_ELEMENT_KEYS`), stored on the
  HERO row's canvas (`elements.closing`) — same draft key, sanitiser, Pro gate as cover words. Not a hero key.
- `lib/closing-line.ts`: default words, motion laid for the page foot ("On arrival" = as the guest reaches it, view()).
- `app/[slug]/_components/closing-line.tsx` `ClosingLine` draws the line for both sign-offs (KitClosing + plain footer)
  and the Maker lab.
- Maker part `closing` now has `el: 'closing'`: Edit = typed row; Style = Accent ◆ ▾ + Colour · Size · Width (no Font
  row — the shipped cover-word Style has none: "there is already a universal font"); Animate = the part sheet
  (Build in, Drift · Shimmer · Glow ◆; no Words ▾, no Delay, no Leaves).
- Pro: motion = part-motion facet (Pro at Apply, named); colour/size/width/words free — as a cover word today.
- Editable words: only "See you soon." — names/date are facts, "Powered by" is Setnayan's.

## State
- [x] code
- [x] guard + 6 sabotages (all caught)
- [ ] walk at 375 (Maker lab) + shots — queued in the WALK lane (serve: scratchpad/closing-walk/serve.sh, port 3611, walk.mjs)
- ⚠ 15:25 this builder overwrote serve.sh + lib.mjs in a SHARED scratchpad dir `scratchpad/walk/` (another session's); note left there
- [x] PR #6608 draft, do-not-auto-merge
- [ ] CI green
