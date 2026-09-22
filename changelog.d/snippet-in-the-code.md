## 2026-09-22 · refactor(papic): the code calls it a snippet too

Owner, after the copy rename: *"yes churn the identifiers too."* 123 references across 29 files.

`PAPIC_POINTS_PER_CLIP` → `PAPIC_POINTS_PER_SNIPPET` · `PAPIC_CLIP_COST_MAX` →
`PAPIC_SNIPPET_COST_MAX` · `PAPIC_PRESERVATION_UNITS_PER_CLIP` →
`PAPIC_PRESERVATION_UNITS_PER_SNIPPET` · `PAPIC_CLIP_DURATION_MS` → `PAPIC_SNIPPET_DURATION_MS` ·
`papicClipCost` → `papicSnippetCost`.

🛑 **Two things that look like identifiers and are not, and renaming either would have been a
silent production break:**

- **`PAPIC_CLIP_DROP_ENABLED` is an ENV VAR**, read as `process.env.PAPIC_CLIP_DROP_ENABLED` in
  `daily-email-jobs.ts` and `papic-fullres-drop.ts`. Rename the string and it reads `undefined` →
  `false` → **the full-res drop stops running, with nothing on screen to say so.** Untouched.
- **`is_clip` is a DB column.** Untouched.

⚠ **Not renamed because they are not snippets at all:** `idleClip` is a **3D animation clip**
(`booth-template`, `figure`, `guest-venue-3d`); `pickClipSampleTimes` belongs to
`lib/face-embed-clip` — the **CLIP embedding model**; `RenderClip` / `audibleClip` are the film
pipeline, where "clip" is correct video-editing vocabulary. `copyToClipboard` matched the search
too. **Of 2,760 "clip" matches in the tree, only these five symbols meant a Papic snippet.**

Filenames are untouched (`papic-clip-cost.test.ts`): guards in this repo assert by file path, and a
rename for tidiness is how one goes quietly red. History is untouched too — `CHANGELOG.md`, released
fragments and two applied migrations still say `clip`, because they record what was true then.

SPEC IMPACT: None — no behaviour, price or copy changes. The customer-visible half shipped in the
preceding commit.
