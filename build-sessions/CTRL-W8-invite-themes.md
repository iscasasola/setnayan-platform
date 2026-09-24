# W8 · INVITE THEMES — a looking session, not a building one

**Model / effort: Opus 5 · high.** You will be reading rendered pages and judging
whether they match a design intent, which is the one thing a source guard cannot
do. Do not run this on a lower tier.

**You need the Browser pane.** That is the whole reason this is a separate
session: every remaining item is "does it actually look right", and the session
that wrote this brief could not see a screen.

---

## 🛑 READ THIS FIRST — the register is wrong about this group

`ONE_REGISTER.md` (2026-09-21) says:

| row | register says | **measured on `origin/main`, 2026-09-22** |
|---|---|---|
| I-3 · S2 Velvet | MID-BUILD (branch + 4 dirty files) | ✅ **SHIPPED** — `velvet.tsx` 104 lines, `velvet.module.css` 224 |
| I-4 · S3 Galeriya | NOT STARTED | ✅ **SHIPPED** — 85 / 209 lines |
| I-5 · S4 Abaca | NOT STARTED | ✅ **SHIPPED** — 99 / 351 lines |
| I-6 · Q1 typefaces | NOT STARTED | ✅ **DONE** — all three import `localFont` from `next/font/local` |

```bash
ls apps/web/app/\[slug\]/invite/_components/themes/     # four themes + two guards
grep -n "INVITE_THEME_IDS" apps/web/lib/invite-themes.ts
```

**So do NOT build three themes.** They exist, they are Pro-tier in the registry,
and they load their own fonts. Your job is to find out whether they are *right*.

🔑 The register's own header says *"status is carried from the pack that found
it, not re-verified"*. Four rows in this group rotted in a day. Re-measure every
row before acting on it — that is the single most expensive lesson from the
session that wrote this.

---

## What is actually left

**The owner-look rows are the point (I-1, I-2).** Nobody has confirmed these
render correctly on a phone:

1. Open a **Capiz** invite on a phone viewport: the reveal, then all three doors
   in Capiz over the couple's photo, with their monogram as the seal.
2. A couple **without Event Hub Pro** who saved Capiz must still show guests the
   plain **House** door. (Registry: `resolveInviteTheme` falls back to `'house'`
   when the theme is not available — verify the RENDER, not the function.)
3. Then the same pass for **Velvet**, **Galeriya**, **Abaca**.

**The Q-series, each a small check that may already pass:**

* **Q2** — on a Pro theme the one invite button takes the couple's own colour,
  with a fallback. Check a couple whose colour is unset.
* **Q3** — everywhere Event Hub Pro lists what it includes, the invite theme
  appears in that list.
* **Q6** — a guest who just watched the reveal on door 01 is not shown it again
  on the others. This one is behavioural and needs a real click-through.
* **Q7** — only celebrations carrying the Save-the-Date film (weddings) can
  choose a Pro theme. ⚠ `lib/invite-themes.ts` shows availability logic but the
  session that wrote this could not confirm it keys on event type — measure it.
* **S5-1** — the theme picker tells the couple where to change the invite's
  colour.

---

## How to run it

```bash
git worktree add ../wt-w8 -b pf/invite-themes origin/pf/platform-floor
```

🪤 **Name the branch `pf/…` or `rd/…`, NEVER `claude/…`.** `apps/web/vercel.json`'s
`ignoreCommand` opens with `case "$VERCEL_GIT_COMMIT_REF" in claude/*) exit 0;;`
— exit 0 means *skip the build*, so **every `claude/*` branch silently gets no
Vercel preview** and reports "Canceled by Ignored Build Step". You need a preview.

⚠ **The dev server 500s in a fresh worktree** (no `.env.local`, middleware throws
on every route). Either reuse a worktree that has one, or verify against the
Vercel preview the `pf/` branch builds.

⚠ **The Browser pane cannot run Turnstile.** If a flow needs sign-in and stalls
on a captcha, that is the pane, not the app — `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
is not set in Production, so the wiring is inert there.

**Test accounts:** `testnayan1..5@test.com`, by **email + password**, never the
Google button — and never the owner's account, which is `is_internal` and passes
every paid gate, hiding exactly the Pro-vs-House difference I-2 is about.

---

## The two guards already on this tree — do not break them

* `themes-stay-skins.test.ts`
* `the-print-never-reaches-the-wordmark.test.ts`

🔒 **Hard sequencing, if you do end up changing more than one theme:** they share
one skin switch, one font loader and `lib/invite-themes.test.ts`. Velvet →
Galeriya → Abaca, strictly serial, never in parallel.

---

## Reporting

One bundle → one PR → base `pf/platform-floor`, so the chain stays one merge to
`main`. Report to the **REDESIGN CONTROLLER**
(`local_764dda74-bc29-4889-9fde-2910dbb760ef`), which owns conflict resolution
for this territory; bring it conflicts rather than improvising a merge.

Run `build-sessions/merge-control.sh --branch HEAD` before reporting, and paste
the verdict.

**If the looking finds nothing wrong, say so and close the rows.** "I looked and
it is correct" is a complete result and the most valuable thing this session can
produce — four rows in this group are already stale in the other direction, and
a fifth false "not built" costs the next person a day.
