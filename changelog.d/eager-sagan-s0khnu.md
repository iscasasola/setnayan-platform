## 2026-11-23 · feat(store): "Try it first" demos for Song bank, Papic challenge and 3D plan

Stacked on #8193 (the Shop remaster and the Store). Rulings: specs DECISION_LOG eb51e640 (app store: "every item has its demo before buying") and 7d487adb Q6 ("all four paid tools get a 'Try it first' demo"), built in the shape of the 21 Nov ruling "A locked special tool shows its front-end experience, not its settings". Drawing: `prototypes/supplier_store_graphs_badges_2026-11-23/` frame 3 (the Cake Maker item's "Try it first" card), the same card on every paid tool.

- **Every paid tool's Store item now has "Try it first"** — the Cake Maker's card, word for word in its pattern ("A demo · …" + Open the demo), for Song bank, Papic challenge and 3D plan. One `ToolDemoButton` (in `store-client.tsx`) replaces `CakeDemoButton`; for the Cake Maker it still opens the couple's designer in demo mode.
- **The three new demos** open in the one full screen (`RiseScreen`, kind `zoom`) with the Cake Maker demo's calm bar at the thumb ("This special tool is included in Plus" · Upgrade). Each is the shipped customer-side piece on sample data:
  - **Song bank:** the couple's song list (`SongPreviewList`) — tap a cover to hear 30 seconds, tap a row to pick it.
  - **Papic challenge:** the guest camera's challenge pill and the line under the shutter (`ChallengePill`, `ChallengeFollowUp`) — pick a challenge, take the photo, it completes, then Share ⇄ Keep private with the shop.
  - **3D plan:** the couple's 3D room (`Plan3DSceneLoader`) on a sample reception, with the shop's own booth (its first service that has a booth; its name on it), drag to look around.
- **Nothing is read, saved or sent.** Sample data lives in `lib/store-tool-demos.ts` (no prices, no real ids, no links out). Picks, challenges and shares live in the screen's state. The demo screen is fetched only on the press.
- The Store's one read (`loadStore`) now also hands over the shop's name (from the profile it already reads — no new request), so the demos wear it.
- **Lab:** `/dev/supplier-lab?s=store-song|store-papic|store-3d` (the items; Open the demo opens the demo).
- **Guards:** new `lib/store-tool-demos.test.ts` — every paid tool has its line and demo; the demo screen's whole import graph reaches no `'use server'` module and no Supabase client, sends no request, never mounts the camera's fetching hook or the song bank's cache write; the sample holds no money. `lib/a-locked-cake-maker-is-a-demo.test.ts` re-aimed to the one button.

- **Money:** no price anywhere in the demos; the Store item's price is still read only from `vendor_billing_catalog`.

SPEC IMPACT: None. This builds rulings eb51e640 and 7d487adb Q6 as drawn (frame 3's card on every paid tool).
