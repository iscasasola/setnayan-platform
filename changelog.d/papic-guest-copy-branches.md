## 2026-08-01 · fix(papic): the guest surfaces' OTHER branches still said "the couple" and "wedding"

Found while trying to fire the Papic shutter from a real browser: the signed-out
claim card read **"One of the couple asked you to be part of their wedding photo
crew."** Papic ships on all 16 event types, and these pages are reached by a
SEAT or GUEST token — they have no event loaded and genuinely cannot know the
type.

**How eight strings survived the 2026-07-31 copy sweep.** That pass fixed the
paragraph each page shows a SIGNED-IN visitor — because that is the render every
manual check produced, the tester being signed in every time. What stayed was in
the arms nobody rendered:

| surface | branch |
|---|---|
| `claim/[token]` | the **signed-out** gate |
| `claim/[token]` | seat-already-taken · seat-reissued |
| `join/[token]` | the **dead-link** state (fires only when the token resolves to nothing) |
| `join/[token]` | `metadata.description` — a surface no rendering shows at all |
| `me/[token]` | Papic-not-enabled · payment-confirming |
| `seat/[token]` | seat-reissued |

> **A conditional's other arm is a surface you have not looked at**, and page
> metadata is a surface nobody looks at.

All now type-neutral — "the host", "whoever sent it", or nothing. The dead-link
branch says "whoever sent it" specifically because it has *less* context than any
other: it fires when the token resolved to nothing, so there is no event at all.

**Added** `lib/papic-guest-copy.test.ts` — asserts the four token-reached guest
surfaces name no event type and never assume the host is a couple. It strips
comments first, so the explanatory notes above each fix don't self-trip. It found
five more instances the moment it ran, beyond the one I had spotted by eye.

⚠ `app/papic/page.tsx` is deliberately EXCLUDED and left wedding-heavy: it is the
public marketing page, and that copy plus its SEO keywords are the standing
"lead all-events, weddings deepest" positioning — not a defect.

SPEC IMPACT: None — copy only, no behaviour change.
