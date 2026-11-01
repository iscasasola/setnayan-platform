## 2026-11-01 · feat(ci): the Field ratchet — no new hand-drawn typed box; the 1 Nov walk's misses converted

- New blocking guard `Lint field template` (`apps/web/scripts/lint-field-template.mjs`, `pnpm lint:field-template`),
  wired into the guards job and its aggregator. It counts, per file, the JSX boxes a person types words into that are
  not the Field template (`TypedRow`, `app/_components/form-row.tsx`): every `<textarea>`, and every `<input>` whose
  type is absent, text, email, tel, url or not a literal. The corpus plan's §6 exceptions are spared by KIND (hidden,
  checkbox, radio, file, range, color, date/time, password, one-time-code, search, number), the template's own file
  by path, and a genuine other template by a `// field-ok: <why>` comment in its tag.
- A ratchet both ways against the generated `apps/web/scripts/field-template.baseline.txt`: a rise (or a new file
  with any) fails, and a fall fails until the baseline is regenerated in the same PR. Never hand-merge it.
- Converted to `TypedRow`, each posting the same field name with the same limits: "New hangout" Event name + Where
  (`needs-step.tsx`), the You card's Display name + @name, the booking-ask decline note, the supplier's two "Why?"
  boxes (`why-row.tsx`), "Your custom domain", Admin › Categories' "＋ Add" row (group · category · service), the
  card maker's "What's included" lines (the worth is an amount row: ₱, whole pesos only) and the Invite-a-supplier
  email + business name. Required rows hold their form's post and shake into view (`required-rows-hold.tsx`, and
  `nudgeFormRows` in the forms that already had a submit handler), as the raw boxes' `required` did.
- Baseline 782 → 769 raw boxes (328 → 323 files).
- 🐛 The ✕ inside an open Field sat low on an iPhone (owner, guest card › First): it was the app-wide ✕
  (`GlobalClearField`) measured against the input's own line box. The template now draws the shared `ClearButton`
  itself as its box's last item — centred on the box, its disc's right edge at the resting pencil's inset (the pill's
  `pr-2.5` + border) — and the app-wide ✕ steps aside for it. Not on amounts, numbers, empty boxes or long notes. Guard:
  `lib/the-field-clear-sits-where-the-pencil-does.test.ts`. (The row's name stepping aside while it edits is by design:
  the template docblock, DECISION_LOG 2026-10-08 and 2026-11-01.)
- ⚡ Event Hub Maker first load: converting more screens put the ⓘ (`Explain`) in more routes and re-packed the Maker's
  shared chunks 0.3 KB over budget (same 804 modules, worse gzip context). What an ⓘ OPENS (popup / note) is now
  `explain-open.tsx`, loaded on the first press and warmed on pointer-down; the decline row in the chat's lock card loads
  on demand. Maker measured 507.2 → 506.2 KB (main 506.9; budget 507, unchanged).

SPEC IMPACT: None — implements `SCHEDULE_CHAPTERS_BUILD_PLAN_2026-11-01.md` §6 ("a ratchet stops raw inputs growing")
and §12 Step 1 ("Field ratchet guard") as written.
