## 2026-07-03 · feat(homepage): Live Studio live demo — two phones become cameras in a mini control room

The Panood/Live Studio dock tile's hero gains a "Try the control room · two phones"
button (demos program PR-2, owner spec DECISION_LOG 2026-07-03). Opening it mints a
fresh `demo_sessions` row (`demo_kind='panood'`, reusing the PR #2676 scaffold — no
schema change; the CHECK constraint already allowed 'panood') and shows ONE QR that
both phones scan. Each phone becomes a live WebRTC camera; the desktop overlay is a
mini control room: program view + lower-third (sample monogram + "· LIVE") + two
camera thumbnails as the cut switcher. Slots are assigned by claim order via an
atomic conditional UPDATE (`claimDemoCamSlot`); a third phone gets a friendly
"both cameras are taken." Nothing is recorded or stored — video flows peer-to-peer
(public STUN only, no TURN; graceful same-Wi-Fi hint on failure), and signaling
rides an ephemeral Supabase Realtime channel (`demo-rtc:{sessionId}`).

Strategic: `lib/demo-webrtc.ts` is the codebase's first real video transport,
deliberately structured as a reusable publisher/viewer lib — groundwork for the
actual Live Studio media core.

New: `lib/demo-webrtc.ts` · `app/panood/demo/[token]/` (join page + cam flow) ·
`app/_components/home/panood-demo-overlay.tsx`. Touched: `demo-sessions.ts`
(claim), `demo-session-actions.ts` (claim action), `HomeOverlays.tsx` (OverlayId),
`HomeReskin.tsx` (hero CTA).

Verified locally end-to-end: two synthetic cameras over the real prod Realtime
channel, both connected, cut switcher pixel-verified both directions, third-phone
full path, expired-token fail-closed.

SPEC IMPACT: DECISION_LOG.md row appended (Live Studio demo shipped per the
2026-07-03 demo-program spec; no iteration .md edits — the demo briefs are the
corpus source and remain accurate).
