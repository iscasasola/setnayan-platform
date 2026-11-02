## 2026-07-21 · fix(live-studio): detect dropped cameras, and actually enforce the 24h window

Two gaps found by verifying the shipped code against what it claims to do. Both would have bitten
on a wedding day.

### 1. A dropped camera was undetectable

`onSlotState` was `() => {}` — the transport reported every failure into a no-op. Nothing ever
removed a stream from `camStreams`, so a camera that died mid-ceremony kept showing **its last
decoded frame** on the program monitor, on its thumbnail, and in the OBS capture that is going out
to the couple's YouTube. The tile chip meanwhile reported `cam.status` — a *database* column written
once at claim time and never updated — so every indicator on screen said "fine".

- Per-slot transport state is now tracked (`slotStates`).
- `dropSlot` removes the stream on failure, turning a frozen frame into an honest empty state.
- Two independent signals, because they fail differently: the peer's `connectionState`, **and**
  `track.onended` / `track.onmute` — a phone can release its camera (backgrounded, navigated away)
  while the `RTCPeerConnection` still reports `connected`.
- The on-air camera dropping now shows an unmissable **"Signal lost — pick another camera"** bar
  across the program monitor; other tiles get a `Dropped` chip. Deliberately no auto-switch: silently
  changing what is broadcasting mid-ceremony is worse than telling the operator to choose.

### 2. The 24-hour window was never enforced

`canStartBroadcast` had **zero call sites** outside its own test. One purchase bought unlimited
clean broadcasts, forever. It is now wired into the `setLive` server action, and only there:

- **On the way UP only.** Going off air is never blocked.
- **An in-flight broadcast is never interrupted** — that rule outranks the paywall and stays in
  `decideWatermark` (`expired-broadcasting`). This gate governs starting a *new* broadcast.
- **The free tier can still press live**, going to air overlaid. That is the model, and it is also
  what stamps `first_live_at`.

5 new unit tests pin the contract the action depends on (129 total, all passing). Typecheck +
production build clean.

SPEC IMPACT: None — makes shipped behaviour match its documented intent.
