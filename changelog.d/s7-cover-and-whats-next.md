## 2026-09-09 · feat(story): the cover, and what comes next — Story Maker steps 4 and 5 (S7 · 08 steps 1.5 + 1.7)

The host chooses the one picture their story is known by, and — only if they want to — names the celebration that follows it. Two steps added to the desk that already ships at `/dashboard/[eventId]/story`, between Theme and Publish, in the order `02` §1 sets.

**RULE 0 paid for itself three times, and the third find is the one that mattered.**

1. **The capture candidates were already loaded.** `loadEditorialChaptersForEditor` — which the desk page already calls for the chapter editor — returns exactly the captures `02` §6 asks for: `hidden_at IS NULL`, `moderation_state='clean'`, `filterPublicSafeRows`, and every row through `publicKeyForCapture`, the one consent gate `04` rule 6 names. "Screened, and nobody in it opted out" needed no new query and no second opinion about who consented.
2. **The supplier-frame conditions were already written.** `data.ts` §6d publishes a supplier's frame on four terms (clean · host-accepted · not hidden · its supplier still `selection_match_rank = 1`). The cover uses those four, not a looser set — a cover offered on looser terms would put on the share card a frame the page below it withholds.
3. **`event_editorial.hero_photo_id` exists in production and HAS NO WRITER** — the public loader says so in its own comment ("the normal case — hero_photo_id has no writer yet"). It is the second rung of the story's existing lead-image ladder, and it has been waiting for this screen. So the cover's third job — the top of the story — is delivered **without touching the story render tree at all**, which S11 (#5365) holds open.

**The cover.** `events.story_cover_kind` + `story_cover_ref` (added by S4, verified present and granted in prod before use). One resolver, `lib/story-cover.ts`, is consulted by all three surfaces: the top of the story (through the ladder's own top rungs), the `/realstories` shelf card (`showcase-db.ts`), and the 1200×630 share card (`api/og/realstory-slug`). Five candidates — the living hero · any accepted capture from a **written** minute · a supplier frame · the animated monogram · upload another.

🔑 **The stored pointer is an ID wherever one exists, never a baked object key** — and that is a deliberate correction to S4's own column comment, which said "the supplier frame's key". A capture can be vetoed by a guest, reclassified by the screen or hidden by the host *tomorrow*; a supplier's frame can be withdrawn, or its supplier dropped as the recommended pick. Baking the key at the moment of choosing would freeze a permission that is not frozen, on the most-shared surface the product has. The ID lets `resolveStoryCover` re-ask every one of those questions at read time and step aside — back to the living hero — when the answer has changed. Migration `20271215970722` adds the pairing CHECK S4 explicitly deferred to this session ("a pairing rule guessed now is a rule S7 would have to loosen").

⚠ **Two of the five kinds cannot be said on the story's own lead ladder** (a supplier frame and the monogram have no rung), so for those the story keeps the living hero while the shelf and share cards carry the real choice. **The cover screen says so out loud** rather than letting the host find out later — a preview that promised otherwise would be the screen lying about the one thing it exists to show.

**What's next.** Optional, and nothing is pre-selected: the resting card reads "Nothing yet — the story ends on your words" and the back-cover preview stays quiet and dashed until the host chooses. Candidates are DERIVED (`lib/whats-next.ts` over `event-anchor.ts`), never created — the anniversary takes its date from the day just held and is badged "⟳ Derived, not created"; a christening is badged "◇ Waiting on a date" and we neither ask for a birthdate nor guess one. Two clearly different actions: announcing writes one `draft_json` key and creates nothing; "Start it now" is the go-signal tap that creates one event, pre-filled with the names, the mark and the colours, and writes `previous_event_id` back to this story.

⚖ **The solemn register is excluded by its register, not by its name.** Offering "a wake" as the happy sequel to a wedding is a sentence this product must never write, and hardcoding `'wake'` would let the next solemn type walk straight past it — so it is derived from `terminology.register`, and the test proves the register is doing the work by re-offering the same key with a celebratory one.

⚖ **OWNER QUESTION — the guest list.** `02` §7 promises No. 2 inherits "your guest list — as a starting point". The owner's 2026-07-12 recurrence lock scopes a carry-forward to *"Details, not the guest list"*, and the shipped clone keeps to that. **The lock wins here and the screen does not promise a list it will not bring.** Two documents disagree; only the owner can settle it.

**Guards, and the sabotage that measured each one.** Every guard below was sabotaged and the occurrence count printed before and after; all six turned their suite red, and the migration sabotage took the db suite 8 pass → 8 fail.

- `sanitizeStoryCover` stops refusing a pointerless capture (1→0) → 9 pass → 7 pass / 2 fail
- the consent veto is skipped for a capture cover (1→0) → 8 pass / 1 fail
- a dropped supplier's frame stays the cover (1→0) → 8 pass / 1 fail
- the solemn register is offered (1→0) → 9 pass / 3 fail
- announcing also creates an event row → 10 pass / 2 fail. 🪤 **Measured on the string it ADDS (`from('events').insert` 0→1), not on its own needle, which read 1→1 and proved nothing** — the appending-sabotage trap, hit exactly as recorded.
- a refused draft read treated as an empty draft (1→0) → 11 pass / 1 fail
- the pairing CHECK removed from the migration (1→0) → 8 pass → 0 pass / 8 fail
- the cover resolved to a presign instead of the stable streaming URL (1→0) → 6 pass → 5 pass / 1 fail
- the vetoed-capture DROP replaced by the blur ruling's softening (1→0) → 9 pass → 8 pass / 1 fail
- the capture arm's try/catch removed, so a throwing client escapes (2→1) → 10 pass → 9 pass / 1 fail
- the COVER load unguarded on the page → 2 pass → 1 pass / 1 fail · the ROSTER load unguarded → same

🔴 **A FOURTH DEFECT, AND THE RULE AGAINST IT WAS ALREADY IN THE FILE.** `/dashboard/[eventId]/story`
is a Server Component, so a throw anywhere in it takes the WHOLE route — desk, editor, theme,
cover, what's next and the publish ladder vanish together. The desk load has been wrapped since S5
with the reason in its own words (*"a desk that cannot load must not take the shipped editor down
with it"*); **both loads added by this change shipped without it**, twenty lines below that comment.
One unreadable supplier frame would have cost the host their entire Story Maker. Both are now
guarded and degrade to an honest empty step. Found only because S14 reported the same class of
defect in their own file and I went looking for it in mine.

⚠ **AND ITS GUARD RESOLVES POSITION, NOT COUNT.** "At least N `try` blocks" would be a threshold,
and the measurement proves why that matters: with the cover load unguarded the file still contained
**8** `try` blocks and the guard still failed. It strips comments through the repo's one stripper
first — every loader it names is also discussed in the prose above it, and a match inside a comment
would make it green on a page that had lost its fences. Its own bracket walk is exercised on inputs
with known answers, including a negative, because the guard's plumbing is a place the answer can be
manufactured.

🔴 **A SECOND REAL DEFECT, CAUGHT IN CROSS-SESSION REVIEW BEFORE MERGE — and my guard for it was
decoration.** `resolveStoryCover` delegated the capture arm to `publicKeyForCapture`, which
implements the 2026-08-17 blur ruling: a vetoed capture with a baked stand-in resolves to the
BLURRED COPY. That ruling deliberately **exempts the lead image** — `data.ts`'s hero rung keeps the
old drop because *"an all-faces-blurred photograph is not a thing to open a wedding recap with"* —
and a cover is a lead image on three surfaces at once. Worse, the story's own top goes through that
hero rung, so the surfaces would have **disagreed about one photograph**: dropped at the top of the
story, published blurred on the shelf card and the share card. The cover now drops, consulting the
veto without the softener (so a change to what *vetoed* means still reaches this file for free).
🪤 **My existing vetoed-capture test seeded NO baked stand-in, so it passed whether the code dropped
or softened** — it was green for the only case that mattered. The discriminating arm (vetoed **and**
a bake exists) is added, and sabotaging the drop back to the shipped behaviour takes it 9 pass →
8 pass / 1 fail.

🔴 **AND THE FULL SUITE CAUGHT A REAL DEFECT OF MINE — 14,225 tests, one red.** The cover was first
resolved straight to a presigned display URL, which `the-invitation-is-not-our-billboard.test.ts`
refuses: *"a presigned URL baked into a crawler's cache expires and the card silently breaks later
with nothing to blame — this repo has already paid for that on prerendered blog pages."* The cover
now takes the same stable, signature-less streaming route the hero does, with the presign only as
the fallback for a ref that route cannot serve — which is the hero's own existing behaviour. The
guard was widened to pin the cover's half too, and that new half was sabotaged and measured.

⚠ **And one guard of mine was decoration until it was rewritten.** The db test proving "announce creates no row" ran SQL the test itself wrote, so no change to production code could ever fail it. The write now lives in `lib/whats-next.ts` (the same reason `plan-next-year-authz.ts` was extracted: a rule inside a `'use server'` module is a rule the unit glob never collects) and the test drives it with a recording client, counting the tables touched.

⚠ **Two hand-maintained rosters pass by ABSENCE, and both were updated in this change:** `GUARDED_EVENT_INSERT_PATHS` (which caught the new insert path itself) and `vendor-event-creation.test.ts`'s `CREATION_PATHS` (which did NOT — it passed only because it had never heard of the new path; removing the shop gate afterwards took it 10 pass → 9 pass / 1 fail).

🔴 **A THIRD DEFECT, FOUND BY WRITING THE PRODUCTION PREDICTION BEFORE LOOKING.** Asking "which of
these could embarrass me?" surfaced it: `loadPublishedShowcases` builds every Real Stories card
inside one `try { … } catch { return []; }`, so an exception while resolving **one** card's cover
does not lose one picture — it returns an empty array and **the whole shelf renders as "no couple
has published yet"**. The share card's route is the same shape: its outer catch 302s to the static
brand image, replacing the couple's card with a logo on every share of their wedding. Both are
byte-identical to "there is simply nothing here", which is this repo's named disease. Both call
sites now resolve the cover in their own `try` and fall through to the living hero, and the
resolver holds its own end — a client that throws is answered with `null`. **A cover that fails
costs the cover, never the shelf**, the same rule the room freeze already keeps.

⏭ **Not in this change, and named rather than left to be discovered:** the story render tree reading `resolveStoryCover` directly — that removes the two-kind asymmetry above and the ladder-mirroring bridge with it. It belongs to the page lane, which S11 holds open.

Typecheck `TSC_EXIT=0` on an empty log (a first run reported `TSC_EXIT=134` with **zero** error lines — the OOM kill signature, not a pass; re-run at 8 GB). Root lint clean, 0 `Error:` lines.

SPEC IMPACT: None — `02` §6 and §7 and `08` steps 1.5/1.7 are built as written. The two departures are recorded here and in the PR for owner sign-off rather than applied to the corpus: the guest-list carry (owner lock vs `02` §7) and the pointer-is-an-ID correction to S4's column comment (now corrected in the database comment itself).
