## 2026-07-26 · feat(guest-site): Pahina wave A PR-5 — scroll choreography (fail-visible)

Sixth PR of the Pahina wave-A reskin (design §6, build plan §1 PR-5 + ground rule 8).

Chapters now fade up 22px as the guest reaches them — ~15 lines of JS, no library, no client
bundle (both scripts are inline, rendered by server components).

### The interesting part is the safety, not the effect

The hidden state is **not** the default. It exists only while the root carries `.pahina-js`, and
three independent paths withhold or remove it:

1. `PahinaMotionRootFlag` never sets it when `IntersectionObserver` is missing or the guest asked
   for reduced motion.
2. It arms a **2s self-heal**: if `PahinaMotionObserver` never runs — parse error, truncated HTML,
   an extension stripping inline scripts — the flag is dropped and every section becomes visible.
3. The observer drops the flag itself if it finds nothing to observe, or if constructing the
   `IntersectionObserver` throws.

Plus a CSS `prefers-reduced-motion` block. So with no JS, broken JS, slow JS, or reduced motion,
the page renders exactly as it does today: fully visible. That is the ground-rule-8 contract — a
guest must never see blank sections.

Two scripts rather than one because the flag has to arm **before** first paint (otherwise sections
paint visible, then hide, then re-reveal — a flash strictly worse than no animation) while the
observer can only be built **after** the content exists. Same inline-sync idiom `GuestHubCard`
already uses for its pre-paint localStorage read.

### Reveal targeting is opt-in, deliberately

The obvious selector (`article > *`) is a trap: `<article>` is used liberally in this tree — guest
columns, the editorial takeover, and 8 times in `/[slug]/hub` — so it would hide THEIR children
too, with no observer scoped to reveal them. Instead the single top-level chapters article in
`site-body.tsx` carries `data-pahina-chapters`, and both the CSS and the observer key off that.

The `fullBleed` path (veil reveal + STD film) gets no motion — those own their own choreography and
the build plan leaves them untouched.

### Deferred out of PR-5, with reasons

- **Candlelight Pro toggle.** It ships a **migration** (`events.site_art_direction`), an editor
  control bound by the shared-fields/no-new-write-path rule, and a dark recipe for the whole guest
  site. Three reasons to give it its own PR rather than bundle it with a CSS animation: a schema
  change deserves its own reviewable unit and its own post-merge verification (migrations in this
  repo auto-apply unreliably, and one blocked main's entire pipeline earlier today); it is the most
  visually risky item in the wave; and the wave has still not been eyeballed once.
- **Dropping Cormorant — investigated, and the answer is NO.** The build plan's condition was "if
  nothing else consumes it." It does: `.sn-editorial` maps `--font-display` → `--font-editorial-display`
  → Cormorant, so every `font-display`/`font-serif` in the guest tree still resolves to it, and
  `app/global-error.tsx` names the family directly. Dropping the `next/font` load today would
  restyle guest surfaces that have not been visually verified, for ~35 KB. The stale "Cormorant
  stays until wave-A PR-5 confirms no other consumer" comment in `layout.tsx` is updated to record
  the verification result instead of leaving it an open question.
- **Cover parallax.** Held back on purpose: it is the one effect that can visibly break a hero crop,
  and the hero has not been looked at since PR-2 restructured it. Worth adding once the wave
  preview has been reviewed.

Verified: `tsc --noEmit` clean · `next lint` 0 errors · **3356/3356** unit + golden tests pass ·
production build compiles (352 static pages). No new dependencies; no client bundle added.

SPEC IMPACT: None.
