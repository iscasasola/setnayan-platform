## 2026-10-01 · fix(wake): a wake never celebrates, part 2 — the leaks the 2026-09-30 audit found

From `EVENT_TYPE_RELIGION_AUDIT_2026-09-30.md` (wake rows). Every fix branches on the shipped words system (`words.solemn` / `register === 'solemn'`); the celebratory arm of each stays literally in place, so a wedding and every other type read as before.

- **Check-in arrival** — `ArrivalGreeting` (seat pass, via `YourSeatBlock` and the seat styles) now reads `useEventWords()`; at a wake it renders a quiet arm: a map pin (as the hub's own seat chip already does), "You're checked in", "Thank you for being here." — no party-popper, no champagne halo, no bloom.
- **Printed invitation** — `lib/print-set.server.ts` eyebrow: a wake reads "In loving memory of" (the post-event cover's `frontKicker` phrase + "of"). Weddings skip the extra words read entirely.
- **Onboarding** — generic flow: the name placeholder at a wake is "e.g. Wake for Lola Rosa" (not "Wake of the Year"); the services title is "A place to keep the photos."; `ServicesStep` gains an optional `solemn` prop (default false — the wedding and simple mounts are untouched) that swaps the "Included · already on" check pill, "right through to your wake" and "Papic is live on this wake" for quiet lines.
- **Host gift page** — `/dashboard/[eventId]/pabuya` title: wedding keeps "The digital money dance", a wake reads "Gifts of sympathy", every other type "E-Gifts". New `lib/pabuya-templates-for.ts` (`pabuyaTemplatesFor`): the owner's five newlywed templates only for a wedding; three plain sympathy lines for a wake; three neutral lines for the rest. The editor takes them as an optional prop (default = the five), so the Maker's Details mount is unchanged.
- **Guest gift door** — `guest-doorway-strip.tsx`: still titled "E-Gifts" (one-name rule), but a wake's card wears a heart instead of the gift-box. Icon only, to stay clear of #6212.
- **Wake picker photo** — `public/event-types/wake.webp` (880×1100, 48 KB, Recraft: white lilies and candlelight on linen, no people/text/symbols) replaces the 🕊️ gradient fallback.

Guard: `the-wake-never-celebrates.test.ts` §10 (six tests, each sabotage-checked); `event-words-mounted.test.ts` now lists `arrival-greeting.tsx` as a context consumer.

Not in this PR: `seat/_components/arrival-bloom.tsx` ("So glad you made it!") and the Maker's own Details mount of the message editor (still offers the five at a wake — the Maker was out of scope).

SPEC IMPACT: None
