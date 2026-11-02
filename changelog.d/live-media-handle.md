## 2026-08-05 · fix(couple-dashboard): the livestream audience switch gets a handle

**SPEC IMPACT:** None (no schema change — the column already exists; this ships
the control that was missing).

🔴 **`events.live_media_public` HAD NO WRITER.** It shipped 2026-09-20 as *"the
couple's opt-in for anonymous live media"*, `NOT NULL DEFAULT FALSE`, read on
every render of the guest site — and **nothing anywhere set it**. Verified in
prod: all five events are `FALSE`, including the sample.

What that cost. The guest site computes:

```
liveMediaVisible = viewer is a guest OR live_media_public
```

So a **cookie-less visitor never saw the livestream or the live photo wall on
any event**. That visitor is the relative overseas who opened the link someone
forwarded on Messenger — precisely the person a wedding livestream exists for.
They got a page with no broadcast on it, on the day, while it was running.

Ships `setLiveMediaAudience` + a control on the website privacy page: *"Who can
watch on the day."* The couple opens the doors when they go live and closes them
after — which also answers the "Watch live is on because a link was saved"
finding (#4125 shipped the honest note; this is the cause).

⚠ **Service-role write, deliberately.** `live_media_public` is on the
withheld-from-authenticated list in `20271005100000_events_column_update_privileges.sql`,
whose own comment says the host path routes through service-role: `events` UPDATE
RLS is ROW-level and the anon key is public, so a host-writable column is one any
host session could PATCH on any row its policy admits. The host gate authorizes;
the admin client is only how it is written.

**`lib/gates-have-handles.test.ts`** guards the pattern, mutation-verified. This
is the SECOND time it has shipped — `papic_face_mode` stored nothing for seven
weeks with every flag green, for the same reason. The test detects a WRITE (the
column as a key inside `.update`/`.insert`/`.upsert`), not a mention: "the column
name appears somewhere" is exactly the check that passes for a column with forty
readers and no writer. It self-checks that its detector can still see a known
write, so it cannot quietly become decoration.
