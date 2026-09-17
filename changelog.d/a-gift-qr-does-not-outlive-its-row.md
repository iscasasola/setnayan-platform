## 2026-09-17 · fix(pabuya): a gift QR does not outlive its row — "deleted with your event" becomes true

**Steps 8–9 of the Pabuya plan. Destructive, and scoped deliberately narrow.**

Nothing in the tree ever deleted a Pabuya QR. `deleteEgiftMethod` removed the
row; the edit path overwrote `qr_r2_key` and abandoned the displaced object; the
event media sweep never named the column; account erasure only nulled
`created_by_user_id`. Every QR ever uploaded — every retired account, every
replaced image, every deleted celebration — was still a live object, and (until
the bucket move) an anonymously readable one.

🔑 **`/privacy` already promised otherwise, in writing:** *"Gift-receiving
details (Pabuya) … You can edit or remove these details at any time, and they
are deleted with your event."* This makes that sentence true.

**The order is the whole thing.** Capture the previous key → write → COUNT the
affected rows → only then delete, and only when the key actually changed.
Deleting first destroys a live QR whenever the write then matches nothing;
deleting an unchanged key blanks the couple's page on a no-op save. The delete
path learns the key from `.select()` on the DELETE itself — reading it first
would race a concurrent edit.

⚠ **Removal counts as displacement.** A first cut scoped `previousRef` inside
the image-validation block, so a couple *removing* their QR — the case most
likely to matter, because they are retiring that account — would have left the
object behind.

⚠ **Through the house choke point, not `r2Delete`.** The first cut called the raw
primitive after its own ownership check, and
`every-cleanup-delete-is-pinned.test.ts` refused it — correctly. This key is read
from a column a non-admin can write, so it must be PLANNED with a `CleanupScope`
and EXECUTED by `cleanupDelete`. Otherwise a host could park another bucket's key
in their own row and have the platform delete somebody else's object: a cleanup
turned into a destruction primitive.

New `pabuyaQrScope` is **narrower** than `eventSiteMediaScope` — that scope
admits all of `events/<id>/` and would technically cover these, but the breadth
of a site-media scope is not an argument for what it may destroy — and names
**both** buckets, because during the migration a scope naming one would silently
abandon the other half.

`egiftMethods` is a **required** field on `EventMediaRows`. Optional would let a
future caller omit it and silently skip gift QRs, which is precisely the omission
being fixed; the seven existing call sites were updated instead.

Guards: gift QRs are planned for deletion in both buckets; another
celebration's key is REFUSED and counted, not deleted.

⚠ Three guard corrections, recorded in the files because the method matters more
than the number: a count matched a READ (`egift_method_id, sort_order`) as a
write; the statement-based recount then UNDER-counted because the reorder's two
updates share one `Promise.all` statement; and the recognition guard still
matched the pre-refactor comparison spelling.

SPEC IMPACT: None — `/privacy`'s existing wording becomes accurate; no ruling changes.
