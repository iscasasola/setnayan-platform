## 2026-09-05 · feat(marketing): every Studio doorway presents its features as spotlights

Owner, pointing at a rival's features page from `/setnayan-ai`: *"i like how this page
presents its features"* … *"we also want to deliver the same concept across the rest of the
studio description pages."* The shape is the one already approved for `/papic` on 2026-08-29 —
one idea · one picture · one sentence, alternating sides, in the locked palette.

**Built once, used everywhere.** `_components/marketing/_spotlights.tsx` is the shared block
(`Spotlights` · `SpotlightExtras` · `SpotlightSection`); `PapicFeatures` renders through it
unchanged on screen and keeps its own test-pinned `<details>` fold. Seven doorways gain a section
through `DoorwayPage`'s `children` slot: `/setnayan-ai` (framed as *"a 24-hour secretary,
working inside your wedding"*, the owner's words) · `/pawebsite` · `/panood` · `/patiktok` ·
`/mood-board` · `/pakanta` · `/palogo`. `/pa3d` is untouched: its 2026-09-02 owner-ruled shape
already is this concept.

**The picture is the honesty test.** Each spotlight shows a captured still of the product's OWN
demo scene (`public/add-ons/demo/stills/<slug>-<n>.jpg`, from `scripts/capture-demo-stills.mjs`
→ `pnpm capture:stills`, driving `/demo-capture/[slug]?scene=N&plain=1`), a photograph of our
demo celebration, or the product's film via the new shared `DemoFilm` (which `/papic` and
`/pa3d`'s players now wrap instead of duplicating). `spotlights-are-real.test.ts` fails if any
page names a picture that is not on disk.

**A picture is a claim — four were wrong, and looking is what caught it.** The frames were first
chosen by reading each demo scene's caption. Opened and inspected before shipping:
`animated-monogram-1.jpg` reads *"One price for your wedding · ₱1,000"* with an "Upgrade" pill, on
a page whose rule is that it quotes no price; all three `custom-qr-guest` frames show the PAID
branded QR ("Your branded QR cards are ready", "CUSTOM QR PER GUEST") where `/guest-list` may claim
only the free per-guest QR — dodging the one frame with the tier pill had left three frames of the
same upsell with the pill out of shot. All four replaced with photographs, and
`spotlights-are-real.test.ts` now bans them by name with the reason, plus a companion test that
fails if a banned frame is deleted (a rotted ban protects nothing).

**Every sentence is traceable.** Copy was drafted with the Fable model against, and only against,
each page's existing copy, its `studio-apps.ts` record, its scenes' captions, and (for Setnayan
AI) `setnayan-ai-value-copy.ts`. Dropped on purpose and recorded in each page: a ₱2,500 button in
a Pakanta scene, a "3 couples inquired" number in a Setnayan AI scene, Custom QR's tier pill,
"chases quiet vendors", "learns your taste", any Mood Board/colour claim for Setnayan AI (no
shipped link exists — the palette engine is deterministic).

## 2026-09-05 · feat(rail): the three free planning tools join the Studio rail, each with a doorway

Owner: *"Also add the other services. Marketplace to search for vendors with compare, Guestlist,
Seatplan"* · *"when logged out or logged in and not inside an event, these links will direct to the
service description page … when they enter the event, it will move to the different control
centers."* Asked where the rows live, the owner chose **all three as new Studio rows** (9 → 12).

- New doorways on the shared kit, each with spotlights: `/marketplace` · `/guest-list` ·
  `/seat-plan`. Copy drafted with Fable against, and only against, `/explore` and compare,
  `/features`, `lib/help.ts`, `lib/llms-txt.ts`, `compat-score.ts` and the shipped editors; each
  page's docblock lists what was dropped (counts, prices, the "Upgrade" QR pill, "see who else is
  looking", "no paid placement" — the last two are false claims the sources rule out).
- `StudioApp.eventHref` — an honest in-event target for a free tool with no catalogue add-on; the
  rail checks it before `addOnHref`. Seat plan keeps `addOnKey: 'seating'` so the Suite grid and
  the sidebar still gate on the same surface, and opens the free 2D editor, not the 3D lab.
- Guards raised on purpose: Studio anchor 9→12 · doorways 10→13 · rail rows 13/12/11/8 (date /
  hangout / travel get no seat plan — no seats). Sitemap and SEO health list updated.
- Migration `20271205860548` reserves the three words in `business_slug_is_reserved`, body copied
  from production's definition (verified: none reserved, no shop holds them).

⚠ Surfaced, not resolved: the shell keeps its own Marketplace destination row, so the rail now
carries the word twice (owner chose this knowingly; removing the destination row is a separate
call). And `lib/llms-txt.ts` publishes "Custom QR per Guest — free" while the guest list page and
its demo scene treat it as the paid upgrade — the new page claims only the free per-guest QR.

SPEC IMPACT: DECISION_LOG row added (rail structure: three free tools promoted to Studio rows,
2026-09-05). No spec iteration file changes.
