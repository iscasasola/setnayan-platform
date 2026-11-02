## 2026-07-23 · copy(suite): "your day" → "your event" in the Suite framing

Owner 2026-07-23: the Suite serves every event type (weddings, debuts, birthdays, …), so its framing copy shouldn't be wedding-day-specific.

Changed the Suite's own section/framing copy from "your day" to "your event":
- The sellables section header **"Add to your day" → "Add to your event"** (+ its `aria-label`).
- Header intro "Everything for your **day**…" → "…for your **event**…".
- The "Yours" lede "Already working for your **day**." → "…your **event**.".
- Outcome labels "Plan your **day**" → "Plan your **event**", "Your **day**, captured" → "Your **event**, captured".
- The phase ledes ("…as your **day** gets closer", "…and the **day** itself") and the checklist tool blurb → "event".
- The vignette persona name fallback "Your **day**" → "Your **event**".

Left as-is on purpose: the Schedule blurb "every block of **the day**, in order" (the day-of run-of-show is genuinely about the event *day*) and the `day: 'numeric'` date-format option (not copy). Per-service catalog blurbs are unchanged (a separate copy surface).

Verified: `tsc --noEmit` clean · `next lint` clean · unit tests + Suite guardrails pass.

SPEC IMPACT: None — display copy only on the Suite surface.
