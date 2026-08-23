## 2026-08-24 · fix(guest): the invitation greets you in English, not in markup

The first thing a guest ever reads on Setnayan was **`You&rsquo;re invited`** —
the raw HTML entity, on screen, in 24px semibold. Owner-reported from a live
production invitation.

🔑 **THE CAUSE IS A SPLIT CONTRACT ON ONE OBJECT.** `guided-tour.tsx` renders a
slide's `title` as ordinary React text and its `body` through
`dangerouslySetInnerHTML`:

```tsx
<h2>{current.title}</h2>                                  // text — entity shows literally
<p dangerouslySetInnerHTML={{ __html: current.body }} />  // HTML — entity resolves
```

Same object, same authoring style, opposite escaping, and nothing in the type or
at the call site said so. **That asymmetry is exactly why it survived**: the body
directly beneath the broken heading — written the same way by the same hand —
rendered correctly, so the file looked internally consistent and the mistake read
as house style.

- Both affected titles fixed to real characters (`’`). Both were in
  `guest_welcome_v1`, the tour shown on first opening an invitation link.
- `TourSlide` now documents which field is text and which is HTML, at the place
  an author is looking when they write one.
- `lib/tour-titles-are-text.test.ts` — fails on any entity (named **or** numeric)
  or tag in a title, pins the guest greeting by value, and asserts the
  text/HTML split the guard depends on still holds in the renderer.

⚖ **THE DANGEROUS RENDER STAYS — removing it was the tempting wrong fix.** Two
admin slides genuinely carry tags (`<code>is_internal</code>`,
`<code>admin_audit_log</code>`), so the body really is HTML. The asymmetry is
legitimate; it was only ever undocumented. The guard is deliberately one-sided
and says nothing about bodies — asserting there would fire on correct code, and
a guard that cries wolf teaches you to skim past the one time it is right.

🪤 **A SEARCH THAT CANNOT MATCH IS NOT A NEGATIVE RESULT — this nearly cost the
admin tour.** My first sweep looked for `<strong|em|b|i|br|a ` in body strings,
got **zero**, and I was one step from concluding no body needs HTML and deleting
the dangerous render. `<code>` was not in the list I searched for. Re-run
against *any* tag, it found two.

🪤 **And two of the five mutations silently did not apply** — `perl` was
byte-reading the UTF-8 apostrophe, so the sabotage never landed and would have
reported a pass. Caught only by printing the occurrence count before → after.
Re-run under Python; all five land and all five go red: the original bug
reintroduced · a numeric entity · a tag in a title · the title made dangerous ·
the body made plain text.

SPEC IMPACT: None.
