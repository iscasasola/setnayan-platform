# MB9 — Renders become an inspiration gallery

**Goal:** every Make-It-Real render is kept and becomes a browsable reference photo in section
01 (Inspiration) — a third source alongside the vendor gallery and the couple's own uploads.
**No free lane. Every render always costs the stated credits, with no exceptions.**

**Model:** Opus · high effort — a server-side watermark pipeline plus a gallery source feeding
into an already-live picker; getting the "picking a reference" vs "generating a render" boundary
wrong is exactly the kind of silent-substitution bug this session exists to avoid.
**Size:** half-day. **Depends on:** MB8 (renders exist and are kept) + MB10 (the gallery picker
this reuses).

## ⚠ Superseded design — read this before touching the old brief

The original MB9 was a **cache**: silently substitute an existing render for a "close enough"
match and tell the couple it's free. **The owner cancelled that on 2026-09-03: "no need to give
free renders. always charge for renders."** No coarse-digest matching, no free/paid labelling
box, no cache-hit UI state. If any of that language survives elsewhere in the repo or in an
in-flight session, it is stale — this file is the current spec.

The replacement is better and simpler: **a render is always paid. What becomes free to *look
at* is the growing library of past renders, as inspiration — not as a substitute output.**

## Delivers

- **Every kept render (MB8's `event_renders`, `reusable = true` rows) is eligible to appear as a
  pickable photo in section 01's inspiration picker** (MB10's gallery, same paged/capped shape —
  reuse it, do not build a second picker). A render stays out of this pool when `reusable = false`
  (a note was used — MB2's flag, unchanged) or the couple never opted in to sharing it.
- **Picking a rendered photo as inspiration costs nothing.** It is a reference selection, exactly
  like picking a vendor's portfolio photo — no credit, no generation call, no debit. This is a
  different action from rendering and must not be able to trigger one.
- **Generating an actual render always costs the stated credits** — 1 per part, 5 for the whole
  look, from `moodboard_render_config`. No coarse-match lookup, no substitution, no discount for
  a "close enough" prior render. Every render call reaches MB8's provider pipeline.
- **The Setnayan watermark applies to every render that enters this gallery.** Server-side —
  the existing `lib/watermark.ts` is Canvas-based and browser-only, so it cannot touch a render
  produced entirely server-side by the Gemini pipeline. Build the server-side equivalent with
  `sharp` (already a dependency) and apply it before the render is written to R2, or as a
  distinct "gallery copy" derived from the original — the couple's own private copy in their
  gallery does not need the mark; a render that becomes public inspiration does.
- Consent to appear in the gallery is the couple's choice, not automatic — surface it plainly
  ("share this render as inspiration for other couples?") rather than opting them in silently.

## What this session does NOT touch

No cache-key digest, no matching-radius decision, no "from our library — free" UI state. MB2's
config-digest column and `reusable` flag stay as built — `reusable` still means "safe to reuse
as a *reference*," it just no longer means "safe to serve as a substitute output for free."

## Verify

- `pnpm exec tsc --noEmit` from `apps/web`
- guard: **picking a gallery render as inspiration never debits a credit and never calls the
  render provider.** Sabotage: wire the pick action to also trigger a render, confirm a new test
  catches it, restore.
- guard: **a note-bearing render (`reusable = false`) never appears in the picker.** Sabotage:
  drop the check, confirm red, restore.
- guard: **every render entering the gallery carries the watermark** — assert on the actual
  output bytes/pixels, not on a flag claiming it was applied. Sabotage: skip the watermark step,
  confirm the guard catches the unmarked image, restore.
- guard: the couple's own private gallery copy and the public inspiration-gallery copy are
  provably different assets or the mark is conditionally applied correctly — do not accidentally
  watermark a couple's private "keep photo" copy of their own render.

## Owner decides first

Nothing new — the coarseness question from the old brief no longer applies.
