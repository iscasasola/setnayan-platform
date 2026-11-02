## 2026-09-09 · fix(papic): a guest who asks to be blurred is blurred in every other guest's album

Owner ruling 1 of 2026-08-17 — *"Public = everyone except the couple — blur on the venue wall, the
public event page, and the shared pool other guests browse. The couple's own album stays
unblurred"* — was built for three surfaces. The 2026-08-24 decision row called the shared pool
*"the last surface still vetoing."* It was not.

**Four more readers handed a guest somebody else's unblurred face**, each asking
`moderation_state = 'clean'` and `hidden_at IS NULL` and nothing else:

| reader | what it serves |
|---|---|
| `lib/guest-live-gallery.ts` | *"photos of you"* behind SIX surfaces — the guest's own Papic page, the celebration page loaders, the hub, your-own-day, the account photo library, the Alaala wall |
| `app/papic/me/[token]/download/route.ts` | a ZIP of the **full-resolution originals** |
| `app/papic/me/[token]/photo/route.ts` | the single **full-size save** |
| `lib/guest-stories.ts` | the story maker, which bakes them into a reel the guest keeps |

So Ana withdraws her photo consent, and Ben at the same table opens *"photos of you"*, sees her
unblurred, and downloads her at full resolution.

⛔ **Filtering on `moderation_state` would not have fixed it.** The two states that would hide such
a row — `consent_withheld` and `faceblock_withheld` — are in the CHECK constraint and have **zero
writers anywhere in the repo**. Nothing ever sets them.

🔑 **THE QUESTION IS ASKED IN ONE PLACE** — `lib/papic-guest-blur-gate.ts`, which calls
production's own `papic_captures_needing_blur` (the set form). The predicate is **not**
re-implemented in TypeScript: that is precisely how the public recap's own gate ended up with the
withdrawal half and **no FaceBlock arm at all**. Six places to remember is how this hole was dug.

⚖ **MONOTONE BY CONSTRUCTION** — this can only ever show LESS: not blurred → the original,
untouched · blurred + a bake → the blurred stand-in (previously the ORIGINAL) · blurred, no bake →
withheld (previously the ORIGINAL) · gate unresolved → withheld. Nothing hidden becomes visible.
The "no safe copy exists" answer is copied from the three shipped surfaces — **withhold** — not
invented: the pool admits a capture needing a blur only when `faceblock_baked_at IS NOT NULL` and a
blurred key exists, and a clip needing a blur is dropped because `lib/face-blur.ts` bakes stills
only.

🔢 **Safe by arithmetic at the merge, read out of prod by the object:** 47 guests · **0 FaceBlock
guests** · **0 withdrawn consents** · 14 photos, **0 needing a blur** when the live predicate is
asked with all 14 ids. Nothing a person can see changes today; it starts working the moment
somebody actually withdraws — which is the two-sided test this was blocking.

⚠ **NAMED, NOT FIXED:** `app/[slug]/_components/editorial/consent-veto.ts` gates the public recap
on withdrawn consent only and has **no FaceBlock arm**, while `papic_capture_needs_blur` treats
FaceBlock as event-wide. On a FaceBlock event the wall and the pool blur every frame and the public
event page does not. Inert today (0 FaceBlock guests) and a change to a published recap in its own
right, so it is recorded in the new guard's exemption bill rather than smuggled in here.

🛡 `lib/every-guest-read-asks-the-blur-gate.test.ts` **derives the reader set** — every file that
reads `photo_tags` scoped by a guest and names a capture table must be gated or carry a written
reason; a new reader fails until it is classified. It found a twelfth file the hand-run shell scan
had silently skipped. 9 mutations, every one measured before → after and red, including a wrong
`.rpc()` argument name caught by the shipped `rpc-argument-names.db.test.ts`.

SPEC IMPACT: `DECISION_LOG.md` — 2026-09-09 row recording that ruling 1 was incomplete after
2026-08-24, which four readers were missing it, and the public-recap FaceBlock gap left open.
