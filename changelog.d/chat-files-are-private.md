## 2026-09-09 · fix(chat): a file shared in a conversation is private, and small

Chat attachments fell through the bucket-routing default into the **public**
bucket, and the row stored a permanent unauthenticated URL. A contract, a
receipt or a bank slip shared in a private conversation was readable forever by
anyone the link reached. Measured before touching it: **zero attachments have
ever existed in production**, so nothing had to be migrated and nobody was
exposed.

The bytes now land in the private bucket; the row carries the house stored-asset
ref; readers fetch `/api/chat/attachment/<message_id>`, which re-proves thread
membership on **every** request (a signed URL on the row would keep working for
somebody who had since been removed) and reads with the caller's own session so
RLS decides.

Owner ruling the same day — *"all files uploaded on chat should be compressed
and minimum"*: photographs are compressed **in the browser before upload**,
reusing the shipped compressor the composer had never called. Documents are not
re-encoded (a contract is evidence and must arrive byte-for-byte) and drop from
25 MB to 10 MB instead. GIFs are excluded — a canvas keeps one frame and would
turn a reaction into a still.

Two silent defects found on the way: **erasing an account left every file that
person had shared in storage** (the sweep read only the legacy column), and
`deletePublicAsset` handed the house ref returned null and **silently did
nothing** — which would have hit every future feature storing files this way.

Guard: `apps/web/lib/chat-files-are-private-and-small.test.ts` — 9 assertions,
10 occurrence-counted mutations, all red.

SPEC IMPACT: None.
