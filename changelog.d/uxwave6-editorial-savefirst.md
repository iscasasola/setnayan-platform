## 2026-06-20 · fix(editorial): the website editorial editor saves your words before opening a sub-editor

2-step-down program (Wave 6) — kills the editorial editor's "save your text here first, then open one" footgun. The editor's text fields are client state, and the three sub-editor links (Living hero / Photos / Thank-you note) navigated away — so unsaved words were lost, and the page put the burden on the couple to remember to save first.

- **`website/editorial/_components/editorial-editor.tsx`** — tracks a `dirty` flag (set on any edit, cleared on save). A plain click on a sub-editor link now **saves a draft first, then navigates** (via `router.push`), so nothing typed is lost. Modifier-clicks (open in a new tab) pass through untouched — that tab keeps its state. Copy updated to "Open any — we'll save your words here first, so nothing's lost."

No schema change. tsc clean.

SPEC IMPACT: iteration 0046 editorial editor UX. Logged in `DECISION_LOG.md`.
