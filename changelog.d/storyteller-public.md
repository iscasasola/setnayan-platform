## 2026-08-08 · design(public): a storyteller's page now says how many chapters there are, shows the newest one as a picture, and explains what Follow does

Three additions to the public storyteller page (`app/u/[userSlug]/page.tsx` +
`app/u/_components/follow-button.tsx`) from the Warm Editorial Archive spec
(E5 + E6). Additive only — nothing was removed, moved or reworded.

**What a person sees.**

1. The line of numbers under the name now starts with **"N chapters"**, ahead of
   followers and views. It counts exactly what the visitor can actually open
   below — published chapters that carry a video. It will honestly disagree with
   the storyteller's own dashboard number, which includes drafts. That is
   correct, not a bug: a stranger is told what a stranger can see.

2. Under the **Follow** button, one quiet line: *"Following a storyteller is
   one-way — they publish on purpose."* Nobody had said what following did. It
   appears only where the button itself appears — signed in, and not on your own
   page.

3. The **newest chapter** is now a proper poster card: a wide still from the
   video, a play circle, and a small "on YouTube" tag in the corner. Tapping it
   goes to the chapter page, exactly as before — the video still does not play
   here. Every chapter's little header line also now reads **"CHAPTER 3"**, and
   the newest one reads **"CHAPTER 3 · LATEST"**, so a profile reads as a
   continuing body of work rather than a pile of links.

**Honesty gates — what each does when the read FAILS, versus a genuine zero.**

- The chapter read already swallows its error to an empty list, so a broken read
  and "no chapters yet" look the same: no badge, no timeline, and now no chapter
  count either. That direction is fail-quiet — we show LESS. There is no path
  where a failed read prints "0 chapters".
- The Follow line rides inside the button's own island, past its render gate, so
  a failed sign-in check collapses to showing neither. We never explain a control
  the visitor cannot see.
- The poster only renders for the newest chapter that has a real date AND whose
  stored video is the YouTube shape. An Instagram or TikTok chapter falls back to
  the shipped text card — never an empty grey frame with a play button on it.
- A chapter with no publish date gets NO number at all rather than a guessed one,
  and can never be "latest". Numbering is a claim about sequence; without a date
  we do not have one.

**Traps hit while building this.**

🔑 **THE SPEC'S OWN COLOUR FOR THE FOLLOW LINE FAILS AA — it was not used.** The
spec asks for 11.5px `#A09A8E`, which measures **2.71:1** on the page's cream —
far under the 4.5:1 floor. `--m-slate-3` (`#8A857B`) is also short at 3.55:1.
Shipped `--m-slate-2` (`#6E6A62`) at 12.5px = **5.22:1**. ⚠ And
`lint-label-on-fill-contrast.mjs` **could not have caught it**: it reads Tailwind
`bg-x text-y` pairs and inline style objects, and this page's styling lives in a
CSS template literal the guard never parses. A colour pairing is an arithmetic
claim; the arithmetic is in the code comment. Same for the poster's scrim pill
(cream on `rgba(44,42,41,.75)` over a worst-case white thumbnail = 6.20:1).

🔑 **THE NEWEST CHAPTER IS NOT `chapters[0]`.** The read orders `published_at`
DESC, and Postgres DESC is **NULLS FIRST** — an undated published row would sort
to the top and be crowned "latest". Rank is derived from parsed dates, oldest
first. Do not simplify this back to index 0. That reasoning is not left as a
comment: it moved into a pure `rankChaptersByPublishedAt` in
`lib/creator-chapters.ts` with 6 tests, and all three natural ways to write it
wrong were applied on purpose and each turns the suite red — newest = index 0
(3 red), reversed sort (2 red), "Latest" on a set of one (2 red). A guard nobody
has broken on purpose is decoration.

🔑 **THE PADDING MOVE TOUCHES EVERY CARD, not just the poster one.** The card's
padding and gap moved onto a new inner body wrapper so the poster can run
full-bleed to the rounded edge. Every chapter card now wraps its text in that
span. The JSX wrapper and the CSS rule must never be edited apart, or all cards
lose their padding at once.

🪤 **VERIFIED ABSENT: there is no thumbnail column on `creator_chapters`.** Every
statement touching that table across the three migrations that create or alter it
was read — no thumb/poster/still/duration column exists. Adding one to the select
would have got the WHOLE query rejected and shipped as a silently empty timeline.
The poster is derived in pure code from the already-selected embed URL. This
closes the spec's own "not verified" note in § 6.1.

**Two things flagged, deliberately NOT built.**

🔴 **A moderation-hidden chapter can become the visual hero.** "Hide" on a
reported chapter clears its feature on `/realstories` and, by an explicit shipped
decision, leaves it published on the storyteller's own page. Until now it sat
there as a small text card; if it is the newest, it now gets a poster. Gating on
that would need a new database read on a public page and is a product call about
what "hide" should mean — owner territory, not a side effect of a design port.

🔴 **This page now loads one image from Google.** The still comes from
`i.ytimg.com`, so a visitor's browser touches YouTube where before only the
chapter detail page did. Precedent exists — the Real Stories tiles already
hotlink the same host — and our own CSP already allows it. Mitigation added here
that the shipped tile does NOT have: `referrerPolicy="no-referrer"`, so we stop
handing Google the profile URL being viewed. Worth an owner line given RA 10173.

A plain `<img>` is used on purpose: `next/image` would 400, exactly as it did for
the R2 logos, because `i.ytimg.com` is not in `remotePatterns`.

Chapter numbering is presentation, not an address: unpublishing and republishing
a chapter restamps its date and renumbers everything after it. A citable
"Chapter 3" would need a stored ordinal — a schema decision, not this pass.

SPEC IMPACT: None. Implements `Design_Warm_Editorial_Archive_2026-08-08/FABLE_Public_Marketplace_Spec_2026-08-08.md`
§ 2.A rows 4/5/7 + § 3.1 + § 3.2 (E5, E6) as written, with the one documented
departure above: the spec's `#A09A8E` helper-line colour is replaced by
`--m-slate-2` because the spec value fails WCAG AA on the page background.
