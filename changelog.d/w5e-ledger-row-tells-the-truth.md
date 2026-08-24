## 2026-08-25 · fix(budget): the supplier ledger row tells the truth about itself — five defects an adversarial audit found in my own merged work

An 11-agent adversarial audit of the two W5-E PRs, each finding re-verified by
hand against the commit production serves. **Five real defects, all mine.**

1. **The group name.** `<details className="group">` makes an ancestor `.group`
   for the whole card, and `group-hover:` matches **any** `.group` ancestor
   rather than the nearest — so hovering the card header lit the "Pay this
   supplier directly" chevron three components deep in `vendor-direct-pay.tsx`,
   as if that button were under the cursor. Now `group/ledger`.

2. **A sentence I wrote that was false.** The shipped comment and a test message
   both said the workspace embed must not collapse because *"the vendor
   workspace already wraps this card in its own Payments disclosure."* It does
   not — **that page contains zero `<details>` of any kind.** The true reason is
   simpler and is now the one recorded: the workspace **is** the page for one
   supplier, so folding away the only thing it exists to show is a door in front
   of the room you asked for. *A sentence is not a mechanism*, and I wrote one.

3. **A live region inside a control's name.** The refused-payments alert sat
   inside the `<summary>`, which is announced as **one control whose name is
   everything inside it** — so a screen-reader user heard a paragraph of error
   prose read out as part of the button label. It is an alert *about* the card,
   not part of the row: it now renders above the disclosure on both variants,
   still always visible. The decorative Open/Close words are `aria-hidden`
   (a `<summary>` already carries its own expanded state).

4. **Orphaned `<dt>`/`<dd>`.** The money strip's cells render term/figure pairs
   inside a plain `<div>`; with no `<dl>` ancestor the description-list
   semantics are dropped entirely and assistive tech reads six unrelated
   fragments instead of three labelled amounts. `dl > div > dt + dd` is the
   valid grouping form, so the cell wrapper is unchanged. Repo-wide this shape
   appears in **three** files; the other two are outside this screen and are
   reported, not touched.

5. **A comment describing a caller that has never existed.** It claimed the
   workspace's "Add milestone" CTA deep-links to `/budget#vendor-{id}`. Grepped:
   one occurrence of that URL shape in the whole repo, and it was the comment.
   The anchor is kept — it is the right landing spot — with the warning that a
   fragment must now target something *inside* the `<details>`.

### The guard was loud on refactors and silent on regressions — rewritten

The audit defeated rev 1 four ways, and each is now a rule:

| attack | why rev 1 missed it |
|---|---|
| `<details open>` — five characters | a presence check for `<details` matched `<details open>` |
| empty out what `ledgerRow` renders | the rule tracked the POSITION OF AN IDENTIFIER, not the money |
| hoist the `<details>` into a const above the split | it left both per-slice regions |
| `const isEmbed = variant === 'embed'` | went **RED** on a refactor that changes nothing a person sees |

Rev 2 anchors on the `if (variant === 'embed') {` **statement**, counts
disclosures across the **whole component**, and asks what the row **renders**
(≥3 money cells) rather than where its name appears.

🪤 And bounding the component with `indexOf('\n}')` lands on the **destructured
parameter list's** column-0 brace ~130 characters in — every rule then reads an
empty component and reports a clean file. Bounded by the next top-level
declaration, with a size floor.

SPEC IMPACT: None.
