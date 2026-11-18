## 2026-11-16 · feat(app): the site updates by itself when nothing is typed (owner ruling 22e93e56)

When `/api/health` serves a newer version and the page holds NO unsaved typing, the page takes the update silently —
no notice: on the tab being shown again it reloads there and then; otherwise its next in-app link press becomes a
full load. With typing it NEVER reloads, and the existing "Setnayan was updated" notice shows for that case only.

- `lib/build-version.ts` — `hasUnsavedTyping` (a focused or dirty input / textarea / select / contenteditable, OR a
  field the person typed into that is still on the page — React keeps a controlled field's default in step with its
  value, so value≠default alone would miss it; no dirty-form helper existed to reuse), `claimSelfUpdate` (ONE
  self-update per served version, `sessionStorage` key written before reloading; a storage that throws or forgets
  never self-updates), `staleTabAction` ('none' · 'update' · 'notice').
- `app/_components/stale-tab-notice.tsx` — acts on them; the mount check only arms the next link press.
- 🔒 `lib/the-site-updates-itself.test.ts` — updates with nothing typed; never with typing; never twice. Each sabotaged
  once → red.

SPEC IMPACT: None.
