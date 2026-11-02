## 2026-07-03 · fix(vendor): un-nest the service delete ConfirmForm — no-JS "Save" could DELETE the service

**Bug (owner-reported, verified):** in My Shop → Your services, the per-service
edit `<form action={updateVendorService}>` contained the delete
`<ConfirmForm action={deleteVendorService}>` — which renders its OWN `<form>`.
Nested form tags are invalid HTML: the browser drops the inner start tag and
hoists its children (including React's `$ACTION_ID_` hidden input and the
`vendor_service_id` input) into the OUTER form. Next's no-JS/MPA action decoder
(`decodeAction`) takes the LAST `$ACTION_ID_` in FormData order, so a
**JS-disabled or pre-hydration click on "Save changes" dispatched
`deleteVendorService`** — irreversible service deletion with no confirmation
(the ConfirmDialog is client-JS only). It also caused a React hydration
mismatch on every service card. Narrow reachability, catastrophic consequence.

**Fix:**
- `ConfirmForm` gains an optional **`formId`** prop (`id` on its internal form)
  enabling the **external-trigger pattern**: render the ConfirmForm as a
  SIBLING of the other form (children = hidden inputs, `className="hidden"`)
  and trigger it from anywhere via `<button type="submit" form={formId}>`.
  Prop doc carries a loud ⚠ never-nest warning explaining the hoisting failure
  so the idiom can't creep back unexplained.
- `services-manager.tsx` — the delete ConfirmForm moved OUT of the update form
  (sibling, after `</form>`); the footer Delete button now reaches it via
  `form="svc-delete-<id>"`. Pixel-identical layout; dialog flow unchanged;
  Enter-key in the edit form still maps to Save (the delete button is not
  associated with the update form, so it can't be its default button).

**Repo-wide audit (multi-agent, adversarially verified):** all 23 ConfirmForm
consumer files + a structural nested-`<form>` scan of every `.tsx` under
`apps/web/app` → **zero other nesting sites**. Cross-file call sites the file
scan couldn't resolve (VendorItemizationCard × 2, GuestListMultiselect,
GroupsSidebar) were individually verified NOT inside any form. Notable healthy
near-miss: `admin/pricing` already places its createBundle ConfirmForm after
the mega-form with an explicit "HTML forms can't nest" comment.

**Regression guard (same PR):** new CI job **`lint nested forms`** running
`apps/web/scripts/lint-nested-forms.mjs` — an offset-preserving lexical scan
(comments/strings stripped, attribute-aware tag-end detection so
`onSubmit={(e) => …}` can't fake a `>`) that depth-tracks `<form>` /
`<ConfirmForm>` per `.tsx` under `app/` and fails on any form opening at
depth > 0. Self-tested both ways: 1,092 files → 0 hits on the fixed tree;
the pre-fix `services-manager.tsx` is flagged at exactly line 989. Same-file
lexical scope (composition-level nesting stays a review concern — the audit
found zero). Non-required check initially, per the lint-radius precedent;
promote via branch protection once proven quiet. Empty `ALLOWLIST` for any
future false positive (none known).

Verified: tsc (0) · next lint (0) · prod build · guard self-test (pass on
fixed tree, fail on pre-fix tree).

SPEC IMPACT: None (invalid-DOM correctness fix + CI guard; no product
behavior change on the JS path).
