## 2026-11-14 · fix(vendor-dashboard): the live Files page draws the tag board (CHAT-03)

`#7622` shipped the inspiration-tag board (Select · "Tag to inspiration"), but the picked-client shell builds its
page bodies in `_pages/switch.tsx`, whose `files` body drew `<FilesPage>` without the `board` prop — only the old
`?tab=files` path passed it. So a supplier on the live Files page saw the shared-files list and never the board.
The switch now hands `FilesPage` `board={<EventFilesSection ctx={ctx} mode="files" />}` — the same board the old
path and the hub already render. No new server action, no schema change.

Guard: `the-files-page-draws-the-tag-board.test.ts` — the switch's Files body must carry the board, it must be the
only `<FilesPage` there, and the section must still hand the board its tags. Sabotage measured: deleting the `board=`
line (count 1 → 0) turns two tests red.

SPEC IMPACT: None.
