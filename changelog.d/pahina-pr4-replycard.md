## 2026-07-26 · feat(guest-site): Pahina wave A PR-4 — the reply card, the mosaic, and the end of app-green

Fourth PR of the Pahina premium-guest-site reskin (design spec §5/§7, build plan §1 PR-4 + §5).
Targets the wave branch `wave/a-pahina-reskin`, not `main` (§12 cost discipline).

### The reply card (`rsvp-widget.tsx`)

The RSVP is now the only thing on the site still shaped like a card — because it is the only thing
that is a card in real life. Heavier paper-deep stock with a lifted shadow and the printed inner
hairline, letterpress `RSVP`, a gild `Nº` ticket stub, and a perforation rule.

**Copy change (owner-visible):** the three options take the spec's reply-card wording —
"I'll be there / Maybe / Can't make it" → **"Joyfully accepts / Undecided, for now /
Regretfully declines"**. The option `key` values are byte-identical, so `submitRsvp`'s contract,
the stored `rsvp_status`, and every downstream consumer are unchanged. The selfie-reveal
`:has()` mechanism, `SubmitButton`, `GuestToHostCta`, the meal/dietary/notes fields, and the
`limited` +1 variant are all untouched.

The `Nº` is a 3-digit fold of the guest id computed for display only — per build plan §4 a raw
internal id is never exposed.

### Gallery mosaic (`our-photos-widget.tsx`) — `№ 06`

The uniform square contact-sheet grid becomes a magazine spread: a full-width cover plate followed
by two-up frames with a deliberate vertical offset on the right column. Raw `<img>` retained (the
URLs are presigned and would break `next/image`'s optimizer cache — the existing comment explains
why), along with `loading="lazy"` and the `aria-hidden` decorative treatment.

### Hub plate (`guest-hub-card.tsx`)

Per spec §11a the guest-personal layer is **starred, not numbered** — a gild `✦` marks "this
belongs to you" while editorial chapters carry a `№`. The fixed Atelier `champagne-gold` is
replaced by palette-derived `gild` so the plate re-skins with the couple's own colours. The
`<details>` disclosure, the pre-paint localStorage script, `#guest-hub-card`, and every gate and
link are untouched.

### Functional-color exile — COMPLETE (§4)

`grep -rn "success-\|warn-\|danger-\|emerald-" apps/web/app/[slug]` now returns **nothing but one
comment line**. 20 files swept. Green/amber/red notice boxes became gild-ruled veil plates (positive)
or ink-ruled paper-deep plates (neutral); status pills became mono stamps distinguished by rule and
label rather than hue; pulsing live dots became the palette accent.

Two judgement calls worth recording:

- `--color-gild` and `--color-terracotta` resolve to the **same** value on light surfaces, so a gild
  dot on a `bg-terracotta` pill would be invisible. `roam-watch-picker.tsx`'s in-pill dots use
  `bg-cream` instead, which reads on both the active gold pill and the ink surface.
- `gild` is decor-only and fails contrast as small body text, so sub-0.85rem copy that used to be
  green (`selfie-capture`, `hub/page`, `guest-hub-card`, `arrival-greeting`) moved to `text-ink/70`
  rather than gild. Gild is used only where the type is heading-scale.

`guest-hub-bar.tsx` is under the §6b CLONE rule — it received exactly one colour-token edit, no
size / spacing / radius / icon / prop touched.

`globals.css` — added `.pahina-letterpress`, `.pahina-deckle`, `.pahina-perforation` to the layered
Pahina block.

Verified: `tsc --noEmit` clean · `next lint` 0 errors · **3356/3356** unit + golden tests pass ·
production build compiles (352 static pages). No new dependencies.

Not verified: the visual pass — still owed on the wave branch's Vercel preview for PR-2/3/4
together (a local pass is blocked: the dev server falls back to the anon key, so the guest page
404s under RLS).

SPEC IMPACT: None schema-side. One user-facing COPY change (the three RSVP option labels), taken
from the owner-commissioned design spec §7 and flagged in the PR body for sign-off.
