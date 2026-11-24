## 2026-11-24 · copy(download): the computer requirement reads as a Live Watch requirement

Owner 24 Nov 2026. The line above the `/download` buttons ("Works on an Apple-silicon Mac on macOS 14 or later…") is the floor for **streaming Live Watch** from a computer, but a host who only plans read it as "my Mac may not work".

- `DESKTOP_ENCODER_READINESS_NOTICE` (`lib/live-studio-readiness.ts`) now reads: "Streaming Live Watch from this computer needs an Apple-silicon Mac on macOS 14 or later with the Safari 26 update, or Windows 10/11 with hardware video encoding. Older computers can stream with OBS instead."
- It is the one constant behind both places it shows: `/download` and Live Watch's readiness card (`BroadcastReadiness`). Same place, same layout.
- `desktop-readiness-gate-is-disclosed.test.ts` now also holds that the sentence leads with Live Watch streaming (sabotage seen red).

SPEC IMPACT: None. Copy only. The bigger `/download` change waits for the Mac App Store listing and a drawing (specs DECISION_LOG 24 Nov, "Mac … ships through the App Store").
