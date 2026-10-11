# HANDOVER — rd/release-leftovers (lock label `leftovers`) — 2026-10-12

Builder spec (from the controller): fix the known faults left in the live release (prod serves d2e38b7).
Evidence: `~/Documents/Claude/Projects/controller-2026-10-08/hub-walk/morning-batch/GUEST-WALK.md`
(N22/N23 lines + "LIVE re-walk d2e38b7") and `setnayan-handoff-src/CURRENT-STATE.md` ("KNOWN FAULTS").
One commit per item; before/after pictures at 375×812 on my own dev server; whole `pnpm preflight`; draft PR.

Do NOT touch: Maker files (`maker-*`, the stage panel), `public/sw.js`, `app/[slug]/_components/guest-preload.tsx`.

## Items — status

| # | Item | Shipped component found | Status |
|---|---|---|---|
| 1 | `/login` cookie notice under the sign-in backdrop | `app/_components/cookie-consent-banner.tsx` (z-[70]) vs `.home-reskin-ov` (z 200, `home-reskin.css`) — also /signup, /signup/you, home overlays, sign-in-here panel | DONE 0d66f5f30 + c7164f2fc. Walked locally: BEFORE "COVERED by home-reskin-ov", AFTER "PRESSABLE"; tap closes the notice, sign-in stays open; card bottom clear of the notice at 375 and 320 (shots/BEFORE-1-*, AFTER-1-*) |
| 2 | guest small labels < 4.5:1 (light + dark) | to measure (walk list: FACE TAGGING 3.45, SAVE THE DATE 3.48, "with Google · nothing to type" 3.62, "Show this at the door." 3.98, "Full invitation to follow…" 3.98) | DONE d1007e1bf + 60fbd8c2d (listed + sweep-found; lint:contrast guest-text ratchet over every hub theme, 312 → 282 remaining in the guest trees — the tail is NOT fixed, only frozen) |
| 3 | guest tap targets < 44 px | walk list: Switch 41×44, Terms 39×18, Privacy Notice 18 tall, /find-seat back 40×40, "The invitation" 114×40, /seat header link 113×28, /pabuya back 26×40, /avatar "← Back" 49×20 + swatches 28×44, /recap "Open their page" 143×42 | DONE c0808ba1d + 498f930d2 (walked-pages guard rows, WIDE + round checks) |
| 4 | checkout retry after a landed order shows raw DB sentence | `app/dashboard/[eventId]/checkout/actions.ts` orders INSERT returns `orderErr.message`; guard = one pre-minted reference per drawer open + `orders.reference_code UNIQUE` | DONE 43f1df33a (`lib/checkout-submit-refusal.ts` + test; reads the buyer's own order before saying "already reached us"). No picture: needs a real order on the prod DB — covered by test only |
| 5 | `/venue` "Back to the wedding" | `app/[slug]/venue/page.tsx` "← Back to the {noun}"; siblings (`/everyone`, `/find-seat`) say "Back to the invitation" | DONE 36fec50fa + 5ad6e41b8 (BEFORE picture on live: shots/LIVE-BEFORE-g-venue.png) |

## Decisions taken (no owner ruling needed)

- (5) match the sibling pages' "Back to the invitation" rather than "Back to the event".

## Skipped because the file is off-limits

(none yet)

## Walk / pictures

Dev server: port 3497 under the WALK lane (`walk:leftovers`), stopped. 🔑 LOCALLY THE GUEST PAGES DO NOT RENDER: `.env.local`
has no service-role key, so every `[supabase:admin]` read is refused ("permission denied for table events") and the pages
show "This invitation didn't load" / "This link can't be found". So: BEFORE for the guest pages was taken on LIVE
(www.setnayan.com = d2e38b7 = this branch's base) as Bean (`shots/LIVE-BEFORE-*`, `measure-LIVE-BEFORE-d2e38b7.json`);
/login rendered locally (BEFORE/AFTER). AFTER for the guest pages needs the controller's preview:
`BASE=<preview url> node ~/Documents/Claude/Projects/controller-2026-10-12/release-leftovers/walk.mjs after` (Bean's link is read from
the named-guest file; the run opens Bean's link + presses "Essential only"). Expected after: 0 faint and 0 small on Bean's pages
except the exempt ones (sr-only radios, the 20px checkbox inside its 44px label, field labels).
Driver: scratchpad `walk.mjs` + `measure.js` (Playwright Chromium 375×812, isMobile). Pictures go to
`~/Documents/Claude/Projects/controller-2026-10-12/release-leftovers/shots/` (BEFORE-* = base files checked out, AFTER-* = branch).

## Notes for whoever continues

- The reply card golden (`the-reply-card-is-todays-page.golden.json`) was re-recorded on purpose; a branch that also
  changes `rsvp-widget.tsx` must re-record after merging.
- `scripts/guest-faint-ink.baseline.json` is regenerated ONLY by `node apps/web/scripts/lint-label-on-fill-contrast.mjs --write-baseline`
  (it rewrites the CSS baseline too — it came out byte-identical).
