## 2026-08-09 · fix(guards): the publish guard shipped with three holes in it — a real comment lexer, and detectors that are tested instead of assumed

Follow-up to #4274, which deleted the orphaned `saveVendorProfile` and added `apps/web/lib/vendor-publish-guard.test.ts` to stop the blind `is_published` write coming back. An adversarial review of that PR reproduced **three evasions of the new guard**. All three left every one of its four tests green — the guard was weaker than the PR claimed.

### What was wrong

**1. The comment stripper was a regex, and it deleted real code.** The guard rolled its own:

```ts
src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
```

A `/*` inside a **string** opens a comment that never existed. `accept="image/*"` — an ordinary file input — starts a block comment running to the next real `*/`, usually the end of the next JSDoc. Measured over `app/` + `lib/`: **5,104 distinct lines of real code across 1,031 files were being blanked before the scan read them**, one such window in `lib/papic-fullres-drop.ts` opened by the string `video/*` alone. (Set-difference on trimmed lines, which under-counts — a lost line that also appears elsewhere in the same file does not register. The review that surfaced this reported a smaller figure over a narrower corpus; this is the number reproduced here, with its method stated, rather than the one quoted.) The verbatim hazard line — `{ is_published: formData.get('is_published') === 'on' }` — pasted into that window left the guard fully green. Reproduced on disk both before and after the fix.

The window also **moves silently**: one new `accept="image/*"` anywhere blinds the guard up to that file's next `*/`, with no signal.

The same regex's `^\s*` anchor meant a **trailing** `// comment` was never stripped at all — the false-positive direction, where a colleague's note about the banned line red-lights their own PR.

**2. A quoted key evaded both scans.** `{ 'is_published': fd.get('publish') === 'on' }` — the normal spelling when an object is pasted from a column list or from generated types — matched neither regex.

**3. ES6 shorthand evaded both scans.** `{ is_published }`.

### The fix

- **`apps/web/lib/strip-comments.ts`** (new) — a real string-aware lexer, tracking quotes, template literals and escapes, blanking to spaces so byte offsets stay true. ⚠ **This is a PORT, not a rewrite:** `scripts/port-controls.mjs` already had exactly this lexer, and its docblock already recorded being bitten by `href="https://…"`. Rolling a fourth stripper instead of finding that one is the whole mistake. They remain separate copies for one mechanical reason — `tsconfig.json` sets `allowJs: false` and the lint scripts run under plain `node` — and the file says so.
- **`apps/web/lib/strip-comments.test.ts`** (new, 8 tests) — every case is a *reproduced* failure of the regex, not an invented edge case. Includes a live assertion that the old regex **still** eats real code from this codebase, so nobody can quietly simplify the lexer back into a regex and see green.
- **The detectors are now pure exported functions with a sensitivity battery.** `readsIsPublishedFromForm` + `assignsIsPublished` are tested against known-bad input — all three reproduced evasions, plus a receiver not named `formData`, plus bracket assignment — and against known-good input (type declarations, `.select()` column lists, `.eq()` filters, destructuring). **A scan whose sensitivity is assumed rather than proven is how all three evasions survived review.** The battery caught a fourth gap while being written: `fd.has('is_published')` slipped a receiver-name-anchored regex, so the receiver is no longer named at all.
- **A coverage assertion.** An empty corpus passes every scan and looks identical to success, so the guard now fails if it finds fewer than 500 files or if `app/vendor-dashboard/actions.ts` is missing from the scanned set. `walk()` also survives a broken symlink instead of throwing.
- **`lib/vendor-compatibility.test.ts`** — the twin weak stripper (added in the same PR #4274) now goes through the shared lexer.

### Also

Two docblock lines in `app/vendor-dashboard/actions.ts` still described `saveVendorProfile` in the present tense — including "`saveVendorProfile` stays the untouched full-form escape hatch", which became false the moment it was deleted. Corrected. #4274 fixed five such comments and missed these two.

### Verification

Each evasion was planted on disk and confirmed **CAUGHT** by the hardened guard (quoted key, shorthand, bare key), and the `papic-fullres-drop.ts` blind-window reproduction now fails both scans at the same line that was previously invisible. `tsc --noEmit` exit 0 with zero diagnostics; `next lint` clean on every touched file; full `lib/**/*.test.ts` suite green.

SPEC IMPACT: None. Test and guard infrastructure only — no product behavior, no schema, no locked decision touched.
