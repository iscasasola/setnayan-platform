# Arrival slices — what is in flight, 2026-09-20

The design canvas: https://claude.ai/artifact/WhaPx4CKwbDTUqN1QCBedh
Every session pastes `ARRIVAL-COMMON.md` first.

## Merged
- **Slice 1 · the page opens on the mark** — PR #5781. The hero runs first; the status card, the
  home-screen offer and the account prompt moved below it. Guarded by
  `the-invitation-opens-on-the-mark.test.ts`, which reads POSITIONS, not presence.

## In flight
- **Slice 2 · one action under the mark** — PR #5783, OPEN, auto-merge armed.
  `lib/arrival-action.ts` + `PASS_ANCHOR`. ⚠ It is the DEPENDENCY for S5.
  🔴 Its first version invented every href (`#your-qr`, `#schedule`, `#photos`, `#rsvp` — none
  exist). Fixed on the branch: hrefs now come from `SITE_MENU_ANCHORS` + `PASS_ANCHOR`, and a test
  walks every branch of the resolver asserting each target is a real anchor.
- **S4 · RSVP is a half sheet** — running. Owns the RSVP surfaces.
- **S6 · a home for everything else** — running. Owns a new sheet + its row resolver.

## Held
- **S5 · the day rearranges itself** — STOPPED by the owner, to start after S4 finishes.
  It reads `lib/arrival-action.ts`, which is still only on #5783's branch:
  `git show origin/claude/one-action-says-where-you-stand:apps/web/lib/arrival-action.ts`
  Do not build a second resolver.

## The two rules that keep three sessions from hurting each other
1. **One heavy job at a time** — `heavy-lock.sh`. Queueing behind a peer is correct. Three
   concurrent typechecks shut this laptop down on 2026-09-13.
2. **`site-body.tsx` is shared** (4,100 lines). Keep the diff there to a mount line, rebase on
   `origin/main` right before pushing, and redo the mount on the merged tree rather than forcing.

## Not built yet
- **The pass** — the wallet-shaped card (name · table · arrive · party, then one big QR on a dark
  ground). `PASS_ANCHOR` already marks where it goes. Parked deliberately: it edits the same QR
  card region, and three concurrent editors of one file is how a slice gets lost.

## Owner checks that no session can do
- Open ONE guest's personal link: does the action label match that guest's real reply, and does a
  ninong see "You are Ninong · Suit · in the wedding colours"?
- Install the invitation from an iPhone and from an Android.
- On a real TV, does the mirrored livestream autoplay or wait on a play button?
