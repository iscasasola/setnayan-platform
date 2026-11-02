## 2026-08-12 · fix(papic): the uploader does not decide whether their own photo passed the NSFW screen

Sixth instance of the shape (`20271132839561` chat sender · `20271132843141`
broadcast sender · `20271132891176` self-promotion to admin · `20271134103060`
self-awarded experience mark · `20271134376999` self-approved payout
destination). `papic_photos` has two PERMISSIVE `FOR ALL` policies — the
paparazzo who claimed the seat, and the couple — **zero BEFORE triggers**, and
nothing constraining `moderation_state`.

### This is screen EVASION, not a mislabel

`lib/nsfw-screen.ts:258` returns early on any row whose state is not
`'unscreened'` ("already decided"), and its UPDATE matches only `'unscreened'`
rows. Measured in the replay before this migration:

| | before | after |
|---|---|---|
| uploader inserts `moderation_state='clean'` | **ACCEPTED** | refused |
| …then the screen's real compare-and-set runs | row **still `clean`** | n/a |
| uploader flips a `nsfw_blocked` row → `clean` | **ACCEPTED** | refused |
| couple flips a `nsfw_blocked` row → `clean` | **ACCEPTED** | refused |
| ordinary capture (names nothing) | `unscreened` | `unscreened` — screen runs |
| couple hides a photo · admin override lifts a block | worked | still works |

The screen did not mis-rule on a forged row. **It never ran.** And because it
runs once, at upload, the second lane is never re-corrected either. Every guest,
couple and Live Wall surface gates on `moderation_state <> 'nsfw_blocked'`
(`lib/papic-gallery.ts:146,151,367`), and the corpus carries *"NSFW filter is on
by default and CANNOT be disabled"* as a hard product constraint.

### Why a plain column revoke here, unlike the experience mark

Every legitimate writer is already service-role — the screen, and the couple's
single-photo override (`.../papic/moderation/actions.ts:259-265`, which uses
`createAdminClient()` and is pinned to `.eq('moderation_state','nsfw_blocked')`
so it can only undo a classifier block, never touch a consent or faceblock
verdict). No RLS-scoped client writes this column, so unlike `20271134103060`
there is no end-user lane to preserve and the grant can simply go.

The DEFAULT is `'unscreened'`, which here is the **safe** value — the opposite of
`vendor_payment_methods`, where the default was the privileged one and had to be
flipped. An insert naming nothing lands unscreened and the screen then runs; the
documented fail-open posture is unchanged.

### The fix

1. `tg_pin_moderation_state` — BEFORE INSERT OR UPDATE on both tables, shared so
   the rule cannot drift from itself: forced to `'unscreened'` on insert, frozen
   to OLD on update, for end-user sessions only.
2. Table-level INSERT/UPDATE revoked from `authenticated`/`anon`, re-issued per
   column minus `moderation_state`. The allow-list is **computed from the
   catalog** (precedent `20271005100000`) — `papic_photos` has accreted columns
   across ~20 migrations (geo, clip keys, faceblock, QR-tag, caps) and a
   hand-typed keep-list is how one of them silently stops saving.

`editorial_vendor_media` carries the same column and is reachable the same way
(vendor insert/update + couple update policies), so it gets the same treatment.

**`papic_guest_captures` is deliberately untouched** — same column, but its only
write policy is `admin_all`, so no ordinary user can write a row there at all.
Verified rather than assumed, and a META test fails if it ever gains a non-admin
write policy.

⚠ **Noted, not fixed:** `editorial_vendor_media`'s vendor INSERT policy checks
only that you are the vendor on a thread for that event. The recommended-pick
gate and the 3-photos/3-clips cap live entirely in the server action — whose own
comment calls that gate *"the trust boundary"* — but it writes through the admin
client, so a direct PostgREST insert skips both. Different finding, unverified,
deliberately not bundled.

**Guards.** New `apps/web/tests/db/capture-moderation-not-self-screenable.db.test.ts`
— 14 tests: anti-vacuity META (including one that reads `nsfw-screen.ts` and
asserts it still early-returns on non-`unscreened` rows, because the entire
severity argument rests on that; the DEFAULT is the safe value on both tables;
the trigger covers both verbs on both tables; `papic_guest_captures` is still
admin-only; a real unprivileged probe role; service_role keeps the column),
behavioural coverage of both lanes and every path that must keep working, and two
NEUTRALISATION tests — the second re-runs the screen after restoring the pre-fix
state and asserts the forged `clean` **survives it**, so the test is proving
evasion rather than mislabelling.

`supabase/security/exposure-surface.baseline.txt` regenerated — the two tables
only, every line a narrowing, no widenings.

Prod: 14 `papic_photos` rows, all already `clean`; 0 `editorial_vendor_media`
rows. Nothing to backfill, and freezing the column cannot disturb them.

SPEC IMPACT: None. The NSFW rule is unchanged — it is now actually enforceable,
which is what the corpus already claimed.
