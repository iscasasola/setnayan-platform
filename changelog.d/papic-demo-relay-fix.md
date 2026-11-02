## 2026-07-03 · fix(demo): Papic homepage demo "No one recognized" — reliable vector relay + self-diagnosing captions

The two-phone Papic demo tagged every shot "No one recognized". An adversarial trace of the
`origin/main` source (5 independent hypotheses, reconciled) found the model infra is fully healthy
(face-api.js + weights serve 200 with CORS, CSP clears them, env var set) — the failure is a
transport defect in the demo's own relay, plus four supporting resilience gaps. Root cause and the
one-PR, self-diagnosing fix:

- **Root cause — `use-demo-channel.ts`: `send()` had no joined-state gate.** `channelRef.current`
  is set synchronously right after `.subscribe()` resolves, so a `send()` in the join window (the
  `face` / `face-request` handshake fires early in the phone flow) was pushed onto a not-yet-joined
  socket and — because Supabase broadcast has NO replay — silently dropped, permanently stranding
  the pair with no peer vector to match. It also explains the screenshot anomaly (photos arrive but
  the QR tiles stay "Waiting for a scan…": photos broadcast seconds later, once joined). Fix:
  `send()` now QUEUES until `channel.state === 'joined'` and FLUSHES in the `SUBSCRIBED` handler,
  which re-fires on every automatic rejoin — so a mobile reconnect re-asserts presence + drains the
  outbox too. Nothing is ever broadcast into the void.
- **Self-heal — `demo-join-flow.tsx`:** when the peer appears in presence, the phone re-broadcasts
  its `face` + a `face-request`, closing the race for any subscribe/register order.
- **`lib/face-embed.ts`: `getFaceApi` no longer caches a FAILED load.** A transient script/weight
  error on first paint (common over cellular) used to wedge the whole session as "no model"; it now
  clears the cache so the next call retries. Registration also retries `embedSingleFace` once when
  the model is configured but the first call returned null (races the ~13 MB weight download).
- **Diagnostics — no more silent miss.** Each shot now carries a demo-only, no-PII `DemoDiag`
  (`model` / `you` / `friend` / `faces` / `closest`); an untagged photo shows `untaggedReason()`
  ("Waiting for your friend's face to sync" / "No face in the frame" / "So close — best match 0.58"
  / "Face matching is warming up") on both the phone and the desktop mirror, so a single live
  two-phone test names the failing stage instead of hiding four failure modes behind one caption.
- **Presence latch — the tile can't revert to "Waiting" under live activity.** Owner observed the
  desktop QR tile flip to joined on scan, then return to "Waiting for a scan…" after the face was
  saved. The socket is up the whole time (photos arrive), but mobile Realtime presence flaps during
  the heavy on-device face step and the desktop was un-joining the tile on any sync that omitted the
  phone. Fix: once a role has proven it's in the session — a presence hit OR any photo/face traffic
  from it — it LATCHES joined for the session; a later flap only updates `registered`, never
  un-joins. A fresh overlay open (new sessionId → new subscription) resets the latch.
- **Threshold — `DEMO_TAG_MAX_DISTANCE = 0.60` (demo-only).** Real Papic auto-tags at 0.50 and
  SUGGESTS 0.50–0.60 for a human to confirm; the demo has no confirm step, so it tags at face-api's
  native 0.60 line — still ~0.19 below the validated impostor floor (0.79). `face-match-core.ts`'s
  global calibration is deliberately untouched.

Verified: `tsc --noEmit` + `next lint` clean on all four files. The cross-phone relay itself needs
two live cameras (a single harness holds both vectors and always tags), so it verifies on prod —
now self-diagnosing via the on-screen reason.

SPEC IMPACT: None. Demo-internal behavior only; real Papic's 0.50-auto / 0.60-suggest face-tag
calibration is unchanged. Notable-decision row appended to `DECISION_LOG.md`.
