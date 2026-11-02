## 2026-08-24 · fix(copy): words, not markup — and a guard that knows the difference

Follow-up to the invitation greeting (`You&rsquo;re invited`). A sweep for the
same class found the scope is **much smaller and sharper** than a grep suggests,
and that most apparent hits are correct code.

### The rule is about POSITION, not about the file

Measured by actually rendering, not reasoned about:

| where the entity sits | what a person sees |
|---|---|
| `<p>a &amp; b</p>` — JSX child | `a & b` ✅ |
| `<Shell label="a &middot; b"/>` — JSX **attribute** | `a · b` ✅ decoded |
| `<Shell label={'a &middot; b'}/>` — plain JS string | `a &middot; b` 🔴 |
| `{cond ? <>x</> : 'a &amp; b'}` — expression container | `a &amp; b` 🔴 |

**A regex over string literals flags all four.** 22 of the ~25 things a naive
sweep reports are JSX attributes that already render correctly; "fixing" them
changes nothing. So the classifier walks the TypeScript AST instead.

### What was actually broken (6 strings, all user-visible)

- **`Jehovah&apos;s Witnesses`** — a religious denomination offered to a couple
  choosing their ceremony, with the raw entity in it.
- **`Lock &amp; submit downpayment`** — the downpayment button, rendered from an
  expression container so React escaped it.
- Four more ceremony/sukob options and meaningful-date labels.

### Two workarounds deleted, and the second was worse than the bug

The date-selection file already carried **two patches for this same root cause**,
both at the render site rather than in the data:

1. `{KIND_LABEL[k].replace(/&apos;/g, "'")}` — stripping the entity on the way
   out. Fragile: one entity, one call site.
2. ```tsx
   {/* Escape sequences in source render literally in option hints */}
   <span dangerouslySetInnerHTML={{ __html: opt.hint }} />
   ```
   **A permanent HTML-injection surface on a user-facing value, bought to make an
   apostrophe display.** With the data fixed, both are gone — this PR removes a
   `dangerouslySetInnerHTML` rather than adding one.

### 🪤 The first version of the guard was decoration — and failed in the worst way

It exempted any file containing `dangerouslySetInnerHTML` anywhere. **Both files
carrying real bugs contain one**, so it exempted precisely the code it existed to
police. Reintroducing the Jehovah's Witnesses defect left it **GREEN**.
🔑 **A per-FILE signal cannot answer a per-STRING question.** It now asks per
PROPERTY: which names does this file feed to `__html`? In that file, `hint` — and
never `label`, which is exactly where the defect lived.

### 🪤 And a "fix" of mine was based on a false premise

I changed four `&middot;` in `_PlanningToolkit.tsx` before checking that
`b.label` there is rendered *through* `dangerouslySetInnerHTML` — they were
correct as written. Reverted. **Read the render site before calling a string
broken.**

### The guard

`lib/words-not-markup.test.ts` — subject list **derived** (walks every `.ts`/`.tsx`
under `app/ lib/ components/`), never enumerated. Six exemptions, each recognised
by **shape** so new instances are exempt automatically: JSX attribute · the string
is only an entity (escape map) · the string contains a tag · the property is fed
to `__html` here · the module escapes HTML (`esc(`) · a library-documented HTML
property (Leaflet `attribution`). One file-level exemption, `lib/tours.ts`, whose
HTML contract lives in another file and which has a stricter dedicated guard.

⛔ **Escape maps are untouched by design** — `{'&':'&amp;','<':'&lt;',…}` is XSS
protection on markup built from guest-supplied names, not a copy defect.

🛡 **6 mutations, all measured.** Three real regressions → all **RED** (including
the one that left v1 green). Three legitimate uses → all stayed **GREEN** (JSX
attribute · escape map · `esc()` builder), because a guard that cries wolf teaches
you to skim past the one time it is right.

✅ typecheck clean · lint exit 0 · **test:unit 9626/9626**.

SPEC IMPACT: None.
