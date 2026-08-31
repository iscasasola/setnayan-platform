## 2026-08-31 · docs(build-sessions): P0-a is in flight, and the channel is already connected

The board said P0-a was `not started`. It is in flight, and one of the two things a parallel
session was **waiting for the owner to confirm** was already true in the database:

    live_studio_roam_channel_pool   1 row    ← the YouTube channel IS connected
    live_studio_roam_streams        0 rows   ← nothing has ever streamed

🔑 **The row is the proof, and the row was already there.** A question addressed to the owner sat
open while the answer was one query away. Rule 0's sixth clause — *never ask the owner a question
the corpus answers* — and a live table is corpus.

What is left on P0-a is **step 5: run one real five-minute stream.** Connecting is not streaming,
and no part of that path has ever run end to end in production.

⛔ Also records the **open owner decision** that was living only in a session's scrollback:
`LIVE_STUDIO` is `is_active = true` at **₱3,000**, while the Google consent screen is
*External + Testing*, where refresh tokens expire every 7 days. On sale, auth dies weekly, no cron
can fix it. Deactivating pending the durable fix is a money call and stays the owner's.

SPEC IMPACT: None — programme tracking. The catalogue row was read, not changed.
