## 2026-09-13 · feat(encoder): the hosted broadcast goes out encrypted, with a real failover

DSK-3 (ENC-RTMPS). A hosted-channel broadcast published over **plain RTMP on port
1935** — the port a venue's Wi-Fi, a hotel captive portal and a hotel's corporate
firewall routinely block — and had **no second address to fail over to**.

Both halves of the fix were already built and merged, and neither had ever been
reachable:

- `sender.rs` wraps the socket in rustls whenever the endpoint is `rtmps://`
  (real roots, SNI, ring provider). TLS was never the missing part.
- `reconnect.rs` `ingest_for_attempt` already alternates to a backup after three
  consecutive primary failures (S7, #5223), and `Destinations::with_backup`
  already existed.

**What was missing was persistence.** `createYoutubeStream` has RETURNED
`rtmpsIngestionAddress` and `rtmpsBackupIngestionAddress` since the RTMPS-ingest
change, and **nothing ever stored them** — both writers saved only
`ingestion_url`, the plain-RTMP primary. YouTube hands these back exactly once,
at `liveStreams.insert`; by broadcast time the Data API is not called again, so
an address not stored at creation is gone for that wedding.

- Migration `20271224546826`: `panood_broadcasts` gains `rtmps_ingestion_url` and
  `rtmps_backup_ingestion_url`, both nullable. No grant changes — the table is
  already service-role only (RLS on, no policy, anon revoked) because it carries
  the secret `stream_key`.
- Both writers persist them: go-live at creation, and the reconnect **rebind**
  carries them forward — that rebind reuses the SAME YouTube stream, so dropping
  them there would have silently downgraded a wedding to plain RTMP at the exact
  moment it was recovering from a drop.
- `exchangeEncoderClaim` returns them through `resolveEncoderIngest`, a pure
  tested resolver. The primary falls back to `ingestion_url`; **the backup never
  falls back to anything.**
- Rust stores the backup on the held key and builds `Destinations::with_backup`.

**The backup is never synthesised.** `null` means no backup, and the encoder then
stays on the primary — which `ingest_for_attempt` already does correctly. A
fabricated backup host is a wedding published to a server that was never
provisioned, and it is worse than none: the supervisor would spend every other
attempt on an address that cannot accept the stream while reporting a failover.

An own-channel paste holds no backup. That is not a gap — the couple gives us one
address, and sending them into YouTube Studio to find a backup URL is not
something this product should do.

SPEC IMPACT: None. RTMPS-on-443 and backup alternation are already the recorded
design (the `createYoutubeStream` docblock, `destinations()`'s own docblock, and
S6/S7). This makes the stored data reach the transport that was built for it.
