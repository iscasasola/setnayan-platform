## 2026-09-09 · feat(vendor-dashboard): a file shared in a conversation can be found again

The supplier's customer card has a Files tab. It listed contracts the supplier uploaded and
handover deliverables they sent — and **not** the files the couple actually attached in the
conversation. A supplier hunting for the contract a couple sent last week could not find it there,
and the tab gave no hint it was looking in the wrong place: its empty state said *"share other
files in your chat"*, which is exactly where the missing files already were.

The tab's own comment explained why, and the reason had expired — *"since 0019 thread attachments
are deferred in V1 — there is no thread-attachments table to read"*. Thread attachments shipped on
2026-07-13 (`20270713300000_chat_message_attachments.sql`): `chat_messages` carries
`attachment_name`, `attachment_mime`, `attachment_size_bytes` and the stored reference.

**What changed.** `apps/web/lib/chat-shared-files.ts` (new, pure — no React, no I/O) merges the
three sources into ONE list, newest-first *across* them, each row saying what the file is, who sent
it, its type and size. `FilesTab` in `app/vendor-dashboard/clients/[eventId]/page.tsx` renders that
list; the page adds one RLS-scoped read of `chat_messages` for the thread it already resolves for
the header's [Open chat] button — same client, same scope, no admin client, no new SECURITY
DEFINER, no widening.

**🔒 The link goes through one function.** `chatAttachmentHref` is the only thing in the repo that
turns a chat message into a URL; no render site reaches into a stored reference. On this branch its
body returns the shipped `attachment_url` — which is what the chat bubble itself renders today.

⚠ **PR #5339 ("a file shared in a conversation is private, and small") has NOT merged** — it was
OPEN and its `typecheck + lint` check RED when this was built, so neither `attachment_r2_key` nor
the private `/api/chat/attachment/<message_id>` route exists yet. When it lands, `chatAttachmentHref`
is the whole migration for this surface: its body becomes the route, and both call sites follow
untouched. `chat-message-stream.tsx` is deliberately NOT edited here — #5339 edits the same lines
and a conflict there would block both changes.

⚠ **A refused read is not an empty one.** Production has never had a single chat attachment, so the
empty state is what every supplier sees today — which is precisely why it must not also be what a
refusal looks like. The page tracks `chatFilesMeasured` and the tab says the list may be incomplete
rather than saying "no files". The empty state now reads *"No files shared yet"* and no longer sends
suppliers to look in the chat this list already covers.

Guard: `lib/chat-files-appear-in-the-files-tab.test.ts` (12 tests, exit 0). MUTATION-TESTED — nine
mutations applied to real source, each printing anchor occurrences before/after: flipped sort
comparator, chat rows dropped, coordinator/system attributed to the couple, an href invented for a
row with no reference, the column read outside a query string, the refused/empty distinction
removed, the old empty-state copy restored, handover notes counted as files, a second builder call
site. All nine go RED; the suite restores to 12 pass / exit 0.

SPEC IMPACT: None — the Files tab already promised "files shared"; this makes the promise true.
