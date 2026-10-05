## 2026-10-06 · feat(rsvp): "When yes" gets a Celebration (Event Hub Pro)

The RSVP stage's **When yes** screen gets ONE **Celebration ▾** dropdown (PickMenu,
never a pill row): None (free, the default) · Confetti · Fireworks · Petals ·
Sparklers — the four effects ◆ Event Hub Pro. Each row carries a tiny looping
preview; picking one drafts it like every Maker pick and replays it on the page;
"Play it again" replays the current pick. A free couple may try every effect —
Apply names it ("RSVP · Celebration · Confetti") and holds it without Pro, while
any words or switches drafted beside it still go live. Back to None is always free.

- **Stored** in `events.rsvp_ask_config.celebration`, beside the When yes words —
  same draft path, same sanitizer (`lib/rsvp-ask.ts`), no migration (the column's
  CHECK is "an object under 2 KB"). Absent = None. Vocabulary + Pro rule:
  `lib/rsvp-celebration.ts`. Gate: `eventItemIsPro` + the free-part twin in
  `planHubDraftApply` (`rsvpAskFreePart`, lib/hub-draft.ts); named on the Apply
  sheet (`hub-draft-change-lines.ts`) and the Pro sheet (`hub-pro-effects.ts`).
- **Guest** (`/{slug}/invite/enter`, `WhenYesCelebration`): after a fresh YES
  (`?rsvp=ok`) the effect plays ONCE (2.3–3 s) and clears itself; the flag is taken
  off the address once it has ended (after the guest-reply funnel's "ticket" step has
  read it), so a reload never replays it. One full-screen canvas portalled to `<body>`
  (`pointer-events: none`), the Mood Board's colours, Sparklers around the guest's
  name only, reduced motion → one calm wash, and a clock watchdog ends it even if
  frames stop. None mounts nothing. The engine (`lib/celebration-engine.ts`, ported
  from the prototype) loads by `import()` only when there is something to play.
- **RSVP answers:** the tapped answer fills with the page's own button colour (the
  host's Look › Buttons choice still wins), and the other goes plain — CSS only, no
  new setting (`app/globals.css`, `.rsvp-form [data-rsvp-answer]`).
- `rsvp_ask_config` is now compared canonically on the Apply count (sanitized, key
  order ignored, NULL ≡ {}), so re-saving what is live is no phantom change.
- Guarded by `lib/when-yes-gets-a-celebration.test.ts` (13 tests, each fence
  sabotage-verified red → green).

SPEC IMPACT: Implements DECISION_LOG 2026-10-06 '"WHEN YES" GETS A CELEBRATION (PRO)'
(prototype `prototypes/when_yes_celebration_2026-10-06_fable.html`). No corpus edit —
the row already says what shipped. One deviation to note: the door's card is opaque,
so Fireworks and the reduced-motion wash are drawn OVER the page (the wash at a lower
peak) rather than "behind the words" as in the prototype's transparent page.
