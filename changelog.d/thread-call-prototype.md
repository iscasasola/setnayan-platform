## 2026-07-10 · feat(calls): free 1:1 voice/video call prototype (vendor ↔ couple)

A runnable prototype of the vendor↔couple call — the same free, peer-to-peer approach as the Live Studio demo, but as a proper two-party session. Two people open the same `/prototype/call?room=…` link on any two devices/networks, pick voice or video, and connect directly.

- `lib/call-webrtc.ts`: new 1:1 call transport — the SYMMETRIC sibling of `lib/demo-webrtc.ts`. Uses WebRTC "perfect negotiation" (polite/impolite glare resolution) over an ephemeral Supabase Realtime broadcast channel (`call:{room}`). Same cost/infra shape as the demo on purpose: media is P2P (never touches a server, nothing stored), signaling is a few tiny broadcasts, ICE is public STUN only (no TURN → fails cleanly on the rare both-sides-hard-NAT pair, exactly like the demo). Voice = mic-only tracks; video = camera+mic; a mid-call camera toggle just flips the video track's `enabled` (no renegotiation). `setVideoEnabled`/`setAudioEnabled`/`leave`.
- `app/prototype/call/page.tsx` + `_components/call-room.tsx`: standalone, no-auth room (noindex, force-dynamic) — shareable link, voice/video start, split-screen local+remote tiles, camera on/off, mute, hang up, and STUN-only "couldn't connect" hint.

Cost: **₱0 per call — identical to the demo** (P2P media, free STUN, signaling on existing Supabase Realtime; no per-minute SDK). TURN stays an optional later reliability top-up, not required.

Verification: `tsc --noEmit` + `next lint` clean on the new files. The P2P call itself is verified by opening the link on two real devices (camera/mic needed) — a headless preview can't exercise getUserMedia or a second peer.

Not yet wired into the thread: productionizing = embed `<CallRoom>` behind the accepted-thread gate (`inquiry_status='accepted'`) with a "Start call" ring via `emitNotification`; the transport is unchanged.

SPEC IMPACT: Un-retires vendor↔couple video (scoped: free P2P split-screen voice/video on the demo transport; supersedes the 2026-05-16 "use external tools" for this surface). Part of Vendor_Customer_Connection_Build_Plan_2026-07-10.md (PR 3, prototype stage). TURN flagged optional.
