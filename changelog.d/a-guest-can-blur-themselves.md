## 2026-08-24 · fix(privacy): withdrawing photo consent blurs the photo and keeps it, instead of deleting the group shot

Owner ruling 2 of 2026-08-17, verbatim: *"Withdrawal BLURS and KEEPS the photo, not hides it. Deliberately SOFTER than today, so one guest opting out cannot delete a table of ten people's group shot."*

**The wall ran two different rules for what is one promise.** FaceBlock was blur-and-KEEP — the photo projects once a baked derivative exists, un-baked is withheld. Withdrawn consent was an outright **VETO**: `wall_ingest` named it itself, *"G2 — photo-consent veto via tagged guests"*, and dropped the photo whether or not a blurred copy existed. So a guest who withdrew was removed from the wall rather than blurred on it, **and every other person in that frame lost the photo with them.** That is precisely the outcome the owner ruled against.

🪤 **A blurred copy was already being made for them and thrown away.** `lib/face-blur.ts` counts `photo_consent = FALSE` guests as a bake trigger in their own right, deliberately NOT gated on owning the wall SKU so the ruling would reach events that never bought one. That half shipped and is correct; the read path discarded its output. **The producer was already right — only the consumer still vetoed**, which is why this migration is two clauses.

The withdrawal clause now takes the same shape as the FaceBlock clause, in both `wall_visible_photos` (read) and `wall_ingest` (write): a photo tagged with a withdrawn guest must carry a baked blur derivative to project. **Un-baked is still withheld.** Fail-closed is preserved exactly — at no point can an unblurred photo of a withdrawn guest reach the wall; the only new outcome is that a blurred one may appear.

⚖ **THIS DELIBERATELY REDUCES ONE PERSON'S PROTECTION AND IS NOT A SECURITY FIX.** Before, their photo was absent from the wall. Now it can appear with every detected face blurred into the pixels. The owner weighed exactly that trade and chose it, because the alternative lets one guest delete a group shot of ten. It must not be described as a hardening.

⛔ **Untouched, deliberately:** the FaceBlock clause (character for character) · the NSFW allowlist, so `unscreened` still never projects · the hidden / wall-hidden checks, the ordering and the 300 limit · the couple's own album, which ruling 1 keeps unblurred · and the `photo_consent = FALSE` predicate itself — no `deleted_at` filter was added, because that would WIDEN what projects while looking like a tidy-up.

⚠ **An honest boundary, pinned by a test rather than left to be discovered:** the rule keys on TAGS. A photo nobody is tagged in was never covered by the veto and is not covered now.

Tests — `tests/db/withdrawal-blurs-and-keeps.db.test.ts`, 9 assertions including an anchor that fails if the fixture can never put anything on the wall at all. **Two mutations, both measured by occurrence count, both red:** reverting the read-path clause to the old veto (`OR (` 2→1) reddened exactly the two tests asserting the ruling and left the other seven green, showing the change is surgical; removing fail-closed (write-guard 1→0, read clause dropped) reddened exactly the two tests protecting people. Restored green after each.

🔬 **Read out of production with `pg_get_functiondef`, not from the migration that last touched these functions** — a migration file describes an intention, the catalog describes what is running. Both bodies are reproduced with signature, language, volatility, security, `search_path` and grants identical; only the two G2 clauses differ.

SPEC IMPACT: The NPC pack's face row says *"withdrawal triggers face-blur in captures"*. That sentence becomes TRUE with this change, having been false since it was written — the pack described the ruling rather than the code. Owner/DPO territory, flagged not edited. Still owed from the same four rulings: the guest's own FaceBlock switch (`/privacy` already tells guests they have one), extending blur to the public event page and shared pool, and notifying a guest when the couple switches their blur back off.
