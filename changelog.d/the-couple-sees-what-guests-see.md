## 2026-09-20 · fix(save-the-date): the couple's own preview plays the reveal their guests see

Two surfaces mount the same `<SaveTheDateFilm>`: the guest page
(`app/[slug]/_components/save-the-date.tsx`) and the couple's builder
(`StdBuilderClient`). The guest mount passed `animatedMonogram` + `studioAnim`;
the builder mount passed neither, so the film fell to its static `<img>` branch
there. **A couple who had bought Animated Monogram could not see it on the one
screen built for previewing their Save-the-Date.** No error, no warning, no
visual defect — just a still mark where guests watched it draw itself in.

The builder now resolves both through `resolveEventMonogram`, the shared resolver
that already carries the paid ANIMATED_MONOGRAM gate. An unpaid couple therefore
sees exactly what their guests currently get — static — rather than a teaser for
something not live. Same inputs, same component, same result: that is the
property, and `lib/the-couple-sees-what-guests-see.test.ts` asserts it at both
mounts, with the mount count pinned at 2 so a third surface cannot appear
unnoticed and the rule cannot pass by finding nothing.

That guard caught a real error during this change: the first edit added the two
props to `RevealPreview`, a different component thirty lines below the film's
mount, and everything still type-checked and lint-passed. The window is sliced to
the end of the opening tag (brace- and quote-aware, so `title={a > b}` does not
end it early) and a second test proves the window cannot leak into the next
component.

SPEC IMPACT: None.

### What this change deliberately does NOT do

An earlier note in this session claimed only two surfaces animate the mark. That
was wrong, and the correction matters more than the fix above. The paid gate
lives INSIDE `resolveEventMonogram` (`lib/hero-monogram-data.ts`), which 16 files
already call — the website hero, private landing, editorial, the guest
Save-the-Date, print, recap, the QR routes, the live screen, panood control and
program, and the photo wall. Grepping `eventAnimatedMonogramActive` finds only
its two DIRECT callers and misses every surface that gets it through the shared
resolver. So "apply to everything" was already true almost everywhere; the
builder was the hole.

Left static on purpose:
- **Chrome chips** (`event-monogram.tsx`, account switcher, launcher, album
  shelf) — 28–44px round icons. Motion there is noise, not delight.
- **Social cards + the admin social queue** — rendered images. There is no
  runtime to animate in.
- **Print** (`print-sheet`, concept PDF) — paper.
- **Live Studio overlays** (`lib/live-studio-overlays.ts`) — a broadcast bug that
  sits on screen for a whole stream; a looping reveal there would be a
  distraction, not a feature. Worth an owner call, not a silent change.
- **Seating lab** keeps its own `eventAnimatedMonogramActive` call: it gates an
  arrival *bloom*, a different effect from the mark reveal, so it is not
  duplication to consolidate.

`prefers-reduced-motion` needed no work — both `studio-reveal-player.tsx` and
`gold-monogram-reveal.tsx` already honour it and resolve their `onDone`.
