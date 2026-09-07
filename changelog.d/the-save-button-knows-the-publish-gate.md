# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-09-07 · fix(vendor): the Save button knows the publish gate

Owner, hitting it in production while pricing a real service: *"the exclusive perk is blank. this
means, we should not have the save changes be available for save."*

### What happened

The service editor showed a **Setnayan Exclusive** panel badged **REQUIRED TO PUBLISH**, with the
help line *"Cannot be blank if you want to publish (activate) this service"* — and beneath it an
enabled **Save changes** that could only fail. Pressing it hit the database trigger
`enforce_service_publish_gate`, which refused with `23514` and a sentence written for a human:

> *"A Setnayan Exclusive perk is required to publish this service."*

The supplier saw **"there was an error."**

🔑 **THE MESSAGE EXISTED AT EVERY LAYER EXCEPT THE ONE THE VENDOR WAS LOOKING AT.** The trigger
wrote it, `PUBLISH_REFUSAL_MESSAGE` mirrors it, and the service WIZARD already coaches with
`PUBLISH_COACH_MESSAGE` + `unmetPublishRequirements`. The editor — which renders the very field —
imported none of it. Nothing was missing from the system; one screen just never asked.

Measured in prod: both of the platform's services have been live since 1 Aug with a null price AND
a null perk, so **no single-field edit could ever succeed** — setting the price alone always
tripped the perk check, and setting the perk alone always tripped the price check.

### The fix

`PublishGateSubmit` — a small client component around the existing `SubmitButton` (which already
accepted an external `disabled`, added in May for exactly this kind of required-field gating). It
reads the sibling `starting_price_php` and `exclusive_perk_text` inputs out of the enclosing form
and disables Save with the gate's own coach copy while the row would be refused.

- **A DRAFT is never blocked.** That is the trigger's own first branch — `IF NEW.is_active IS NOT
  TRUE THEN RETURN NEW`. Saving an unpublished card with blanks is legitimate and stays possible.
- **The copy is not re-written here.** Requirements and messages come from
  `lib/service-publish-gate`, the same module the wizard and the server action use, so the button
  cannot disagree with the trigger about what is missing or what to call it.
- It reads the DOM rather than lifting the fields into React state because the editor is a SERVER
  component with uncontrolled `defaultValue` inputs; controlling them would mean rewriting the
  whole panel to make one button honest.

### Tests

5 new (20 with the existing gate suite). Mutation-checked, each red on its own case: reverting to a
bare `SubmitButton` · blocking drafts as well as live cards · hand-writing the copy instead of using
the shared module · letting an empty or non-numeric price box read as priced (`Number('')` is 0 and
`Number('abc')` is NaN — either passing as "priced" reopens the hole).

SPEC IMPACT: None — this makes an existing, correct database rule visible in the one place it was
enforced silently.
