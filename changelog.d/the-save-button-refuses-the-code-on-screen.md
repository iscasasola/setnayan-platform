## 2026-08-24 · fix(guest): the Save button no longer refuses the code on the screen beside it

Found by an adversarial pass over my own work from earlier the same day. **Both
defects below are mine, and the first one was live in production.**

### 🚨 The live one: a re-issued code could be seen but not saved

A host presses **Re-issue** on `/dashboard/[eventId]/invitation`. The guest's
60-day cookie is untouched. The guest opens their invitation — the page loads
their row **by `guest_id` alone** and renders the **new** QR, with the **new**
url in plain text underneath. They press **Save the code** and are told:

> *"This code has been replaced. Open your current invitation link."*

…while looking at it. Same for a guest with the page open on a second device
after any rotation.

🔑 **THE CHECK PROTECTED NOTHING.** I had required the session's embedded
`qr_token` to equal the row's current one, reasoning that a session minted from
a leaked, rotated code must not fetch the replacement. But the **page had
already handed that same session the new QR and the new url** — a stricter rule
on the download could not put that back. It only refused the honest guest: the
one the host had just re-issued a code *for*.

🔑 **AND REVOCATION IS NOT THIS ROUTE'S JOB.** Whether a session survives a
rotation is decided in exactly one place — `readGuestSession()`, behind
`GUEST_SESSION_TOKEN_CHECK`, a chokepoint deliberately covering all of its
consumers so none can be missed. Re-implementing a private, always-on version of
that policy in one endpoint made this route **disagree with the page rendering
the very image it refused**. Removed. When the owner turns that flag on, the
page and the route stop honouring a rotated session **together**.

The refusal wording is fixed too: no refusal now tells a person to open the link
they already have open. A test asserts that across every refusal path, and a
second asserts the token comparison has not come back.

### The guard from the same day was weaker than its own PR claimed

Three real holes, each measured:

- **41 files were exempt wholesale** — every file that fed `__html` a bare
  identifier. That included **`app/[slug]/_components/site-body.tsx`, the
  invitation page**: the exact surface the original `You&rsquo;re invited`
  defect shipped to. 🔑 **The blanket exemption is now gone**; a bare identifier
  contributes its NAME to the HTML set instead of switching the file off.
  Dropping it produced **zero** new false positives.
- **Hex entities were invisible.** `&#x2019;` — what most CMS exports and
  `he.encode()` emit for a curly apostrophe — sailed past, while `&#8217;` was
  caught. ⚠ The sibling guard written hours earlier already had the hex branch
  and its own comment said numeric entities *"fail exactly the same way"*.
  **Two guards written the same night disagreed about what an entity is.**
- **Template literals with a `${}` were never inspected**, because the walk only
  visited `StringLiteral`. Now the head/middle/tail parts are visited, and the
  binding name is resolved by walking UP the parent chain — which is what lets a
  template part be judged by the same rule as a plain string.

🛡 **5 mutations, all measured, both directions.** Hex entity → RED · template
literal → RED · an entity on the previously-exempt invitation page → RED · JSX
attribute → GREEN · escape map → GREEN.

⚠ **One reviewer lens (security) died mid-run on a connection error**, so the
new route's security has NOT had its full adversarial pass. Flagged rather than
quietly counted as covered.

✅ typecheck clean · lint exit 0 · **test:unit 9630/9630**.

SPEC IMPACT: None.
