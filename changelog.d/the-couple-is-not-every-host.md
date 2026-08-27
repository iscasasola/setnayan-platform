## 2026-08-27 · fix(words): "the couple" is not every host — twelve public strings, four files

Twelve rendered strings said **"the couple"** on every event type. **Nine are on
the join door** — the screen a guest scanning a QR lands on — and **two of those
nine are in the SIGNED-OUT arm**, the branch a guest without an account actually
reaches. The plainest failure was the gift page: at a wake it said *"a quiet way
to help the family"* in one line and *"it goes directly to the couple's account"*
three lines below.

All four now read the event's own terminology:

- **The join door** — one `eventWordsForEvent(eventId)` covers all nine, refusal
  sentences included. It is already an async server component holding the event
  id, so no prop, no default, no call-site change.
- **The gift page** — `PabuyaTrustNote` takes a **required** `organizerPossessive`.
  Required, not optional-with-a-default: it has two guest-audience callers, the
  second being the couple's live preview of the guest view, whose whole point is
  that the two match byte for byte. A dropped prop is a typecheck failure.
- **The vision helper** — returns a reason **CODE**; the sentence is composed at
  the capture screen, where the resolved words already are. That file must never
  grow event context.
- **The recap prompts** — passed only the organiser noun, so every `{event}`
  token fell back to the literal "event": a guest who answered a prompt reading
  "birthday" met it again saying "event". Both nouns now.

🔒 A wedding reads **byte-identically** (`organizerNoun` is `'couple'`), and no
file falls back to **"host"** — a funeral's noun is `family`.

**And the guard meant to catch this class could not see 28% of its own tree.**
`s13-is-finished.test.ts` matched its exemption list by **bare basename** with
`rel.endsWith(k)`: `'page.tsx'` alone exempted **11 files**, `'actions.ts'` 4 —
**36 of 127 files**, so a new page under `app/[slug]/` was born exempt. Keys are
now tree-relative paths matched exactly. **Re-running the detector over every
previously-exempt file produces ZERO new offenders**, and a seeded room-shaped
`page.tsx` saying "Ask the couple…" goes offenders 0 → 1 RED under exact matching
and 1 → 0 GREEN the moment `endsWith` is restored.

FLAGGED, NOT FIXED: `couple-challenges-manager.tsx:566` passes the organiser noun
without the event word — the same half-resolve, on a couple-facing screen.

SPEC IMPACT: None — a repair to shipped copy. The unbuilt supplier room from
`WHATS_NEXT_Vendor_Hub_And_Answers_2026-08-26.md` is deliberately untouched, and
none of its nine § 7 owner decisions is answered here.
