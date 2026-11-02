## 2026-09-20 · fix(monogram): saving a studio design no longer deletes the couple's uploaded logo

**Data loss, caught before it happened to anyone.** `saveStudioAction` set
`monogram_uploaded_svg: null` on every studio save. Its own comment gave the
reason: *"every surface resolves `uploaded ?? custom`, so a leftover
monogram_uploaded_svg would make this Save a silent no-op."*

That reason died on 2026-09-20, when precedence flipped to `custom ?? uploaded`
(PR #5788) — a saved design now wins on its own and needs nothing cleared. What
remained was pure deletion, made worse by PR #5786 the same day: the studio now
OPENS ON the uploaded logo so a couple can add frames and colours to it. So:
open your logo, add a frame, save — and the original is erased. The upload flow
never kept the source photo, so it would be gone for good.

Owner, asked whether to keep the original uploaded file: *"yes keep it."*

**Measured before fixing:** exactly ONE event in production had an uploaded mark
at risk — the owner's own — and it was still intact. Nothing was lost.

`lib/only-remove-upload-deletes-the-upload.test.ts`: only "Remove upload"
(`clearUploadedMarkAction`) may write `monogram_uploaded_svg` to null, and that
one delete must sit inside that function. Comments are stripped before scanning
so the rule's own explanation is not mistaken for the write. **Verified against
origin/main's studio-actions.ts: the guard goes red on exactly this bug.**

Also: the update now counts rows. A PostgREST UPDATE matching none returned
`error: null`, and the action redirected to "Your studio monogram is now your
mark everywhere" having written nothing.

🔑 My miss, recorded plainly: I flipped the precedence in #5788 and did not look
for code whose only justification was the OLD precedence. A precedence change is
a change to every write that assumed it.

SPEC IMPACT: None.
