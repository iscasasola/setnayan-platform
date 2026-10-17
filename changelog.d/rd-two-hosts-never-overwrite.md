## 2026-10-18 · fix(two-hosts): two hosts never overwrite each other — every save is merged from what it was based on

Owner 2026-10-18 ("the similar fix", after #6621). Two hosts on one event — or one host on two phones — saving at once
silently wiped each other's changes; on 2026-10-17 the Mood Board & Dress Code editor dropped two colour sets on a
real event. One shared pattern now, **merge from base** (`apps/web/lib/merge-from-base.ts`): a save carries the value
it was built on; the server keeps everything it did not change; where both changed the same value the later save
wins and the screen says so in one calm line — "Changed on another screen a moment ago — showing the newest."

1. **The Maker draft row** (every Maker save, Undo, Reset, the Apply sheet's ×, Apply's trim, the date-change and
   go-public writers) — a compare-and-set on a new `event_site_drafts.revision` counter (`20271275174284`), built again
   on the newer draft when another screen's save landed first (`updateHubDraft`, `lib/hub-draft-store.ts`). Apply keeps
   what another screen saved while it ran (`draftLeftAfterApply`).
2. **Mood Board & Dress Code** — the whole board and the whole dress code carry their base; merged role by role,
   outfit by outfit (`lib/hub-draft-rebase.ts`); the board shows the merged colours.
3. **Love Story** — the whole story carries its base; moments merge by id, words key by key.
4. **The guest card** — writes only the columns this screen changed (`lib/guest-card-merge.ts`): another host's edit
   and the guest's own reply / consent from their phone stay; the card shows the newest values; Groups are written as
   this screen's change; its Undo puts back only what it changed.

The Maker's toolbar and the guest card's save line say the note; no modal, no choice, no email.

SPEC IMPACT: None — no product rule changed; a persistence fix under existing rulings. (The note names no person:
the draft keeps no record of who edited — naming one is an owner decision, raised in the PR.)
