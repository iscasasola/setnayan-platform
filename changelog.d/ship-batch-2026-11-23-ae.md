## 2026-11-23 · ship(batch-ae): #8210 desktop split view + one editor per part

One reviewed PR, batched from main.

- **#8210**: on a computer, a picked client's Chat sits on the left and their event on the right. A part can have one editor at a time; it frees 5 s after they stop, and a host can take over. A bumped helper's change is kept as a draft. The UI was reviewed against `prototypes/desktop_split_view_2026-11-21/desktop_split_view_v2_fable.html` (5 frames, light and dark).
  - Migration `20271360932916_one_editor_per_part.sql`, with a controller GO pinned to blob 953a5208c8.
  - Exposure +21 is exactly `event_part_editor_locks` (RLS, read-only for admin, the couple and moderators) plus its 4 SECURITY DEFINER RPCs.

Ship controller: generated files regenerated once. Two root-map baseline lines:
- `/dev/desktop-split-lab`: a dev lab, 404 in production.
- One duplicate line, ruled tab-level by the controller: the Hub tab and the chat tab's right column both read `get_vendor_event_brief.pax.attending`.

SPEC IMPACT: None (the PR's own fragment carries its spec notes)

- **CI follow-ups (Ship):**
  - The one-editor-per-part gate kept the Maker's first load in budget. It was 549.7 KB against the 508 KB ceiling, because the Maker embeds Schedule. The lock hook now loads the Supabase client when it first asks, and the "is editing" bar and cards load through their own lazy door (`part-edit-bar-lazy.tsx`), preloaded at idle by `MAKER_TOOLS`.
  - The erasure map lists `event_part_editor_locks` once, by `holder_user_id`. `bumped_user_id` is ON DELETE SET NULL, and deleting by it would free a host's pen.
