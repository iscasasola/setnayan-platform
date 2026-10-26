## 2026-10-26 · feat(papic): the Papic card lives on Home › Today; the Papic page is removed; challenges get a switch and an ✕

Owner, 2026-10-26 (DECISION_LOG "PAPIC CHALLENGES: A LIVE SWITCH AND AN ✕; HOME PAPIC CARD SHOWS THE COUNTS" and
"THE PAPIC CARD LIVES ON HOME › TODAY; THE STANDALONE PAPIC PAGE IS REMOVED"): *"this is the widget that should be at
home with the count of the total, taken, remaining and a button to add more"* · *"that papic frame with toggle, place
that on home and remove that page"* · *"it should be on the today"* · *"challenges will have a toggle … but it also
needs a (X) to remove that challenge. if the challenge is removed and someone did the challenge, the photo and
challenge is saved but anything after, you do not have the challenge"*.

- **Home › Today draws ONE Papic card** (under the Today line; Your services no longer draws a second Papic): the
  camera mark · Papic · Guest photos · the Papic switch · ›, and on its face Total · Taken · Remaining (credits, from
  the pot Home already reads — a failed read says "Couldn't check") and **Add more** (Apple's sheet where Apple sells,
  none in the bare store shell, the web sheet elsewhere — the Memories page's logic). The › grows every Papic setting
  in place (`PapicCameraSettings`, saving in place via #6970's forms), plus the save outcomes (`papic-outcome-banners.tsx`),
  "How the camera works" ⓘ (the old Setup & help) and the page's self-heals (`papic-self-heal.tsx`: free cameras, free
  pool, uploads camera, guest-camera sync — host-checked before any service-role write). The day console and the
  after-the-day services draw the same card. In the iPhone app (Apple selling) the card replaces the Papic row.
- **`/dashboard/<id>/studio/papic` is gone.** Old links forward in the middleware (`lib/legacy-redirects.ts`) to
  `/dashboard/<id>?papic=open#papic`, carrying a save's outcome; Drive / upload answers and `?gallery=open` go to
  Memories. Every link and save redirect now uses `papicHomeHref` (`lib/papic-home-href.ts`); album links go to
  Memories. Its child pages (crew, challenges, recap, run-of-show, moderation) stay.
- **Photo Notes Magazine, Your Recap and Life-Flash move to Memories** (unchanged components, host only).
- **Challenges are TEN SLOTS** (owner 2026-10-27: *"there will be 10 challenges the can make. choose a challenge or turn
  that challenge off. turning 1 off will become 9 of 10 challenges. it stays there, but just off."*). The card's header
  says "N of 10 challenges on"; each row = the challenge's name (a press — it opens the one challenge sheet: search the
  library · create your own; a pick REPLACES that slot's challenge in place) · its switch (off = it stays in its slot,
  greyed, not live). No "Add a challenge" button and no ✕ in the card (the ✕ the 2026-10-26 ruling asked for was
  replaced by the owner's 2026-10-27 wording — "off + change"). A replacement is inserted first (taking the old one's
  `created_at`, so the row does not move), then the old one is RETIRED — `is_active = false, removed_at, moment_key =
  null`, never deleted — so photos already taken keep it and its tag. Migration
  `20271292346034_a_removed_challenge_keeps_its_photos` adds `papic_missions.removed_at` + CHECK
  `papic_missions_removed_is_off`, and re-creates `ensure_papic_board` with ONE change: the Setnayan fill no longer
  hands the board a replacement for a challenge that is merely OFF (`v_fill = target − off`; slotting unchanged). The
  full challenges page's bin (couple's own only) is now the same soft retirement. Memories keeps a retired challenge
  in its filter only while a photo carries it.

Guards: `papic-lives-on-home.test.ts` (one card in Today with counts + Add more, the forward, every former control's
new home, no link to the gone page — each with a sabotage), `a-removed-challenge-keeps-its-photos.test.ts` +
`tests/db/a-removed-challenge-keeps-its-photos.db.test.ts` (photos kept, off keeps its slot, a change is one in one
out — sabotaged by reverting the fill); ~30 page-reading guards retargeted to the card's files.
Maps: port-control baseline (the old route's controls removed deliberately), Ugat screens, legacy redirects.

SPEC IMPACT: corpus note `0012_papic/PAPIC_ON_HOME_TODAY_2026-10-26.md` (Setnayan-specs) — records the controls' new homes;
the DECISION_LOG rows already exist (owner 2026-10-26). Ships with or after #6970 (this branch carries it).
