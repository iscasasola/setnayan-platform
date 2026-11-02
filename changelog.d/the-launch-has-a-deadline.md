## 2026-09-24 · fix(ios): a launch that never arrives now has a deadline

Apple rejected iOS 1.0 (3) on 2026-09-22 — **Guideline 2.1, "The app crashed on
launch."** It did not crash. It showed white, forever.

`SetnayanBridgeViewController` already installs a proxying `WKNavigationDelegate`
that swaps in the bundled fallback when a load **fails**. That fix is good and is
untouched here. But **it only fires when iOS decides the load failed, and Apple's
failure was a load that never arrived.** A hung connection — captive portal, hotel
wifi, a host that accepts and never answers — produces no `didFailProvisionalNavigation`,
no `didFail`, no callback at all. The splash hid after `launchShowDuration` (2s) and
nothing was ever asked to notice. There was no `Timer` and no `asyncAfter` anywhere
in the file.

**The deadline is measured, not chosen.** `.lighthouserc.json` asserts this app's own
throttled-mobile ceilings (150ms RTT · 1638kbps · 4× CPU) against `/login` — which IS
the launch destination, since the middleware 307s every app request there:

```
first-contentful-paint   <= 1800ms
speed-index              <= 3400ms
largest-contentful-paint <= 4500ms
interactive              <= 5200ms   ← the slowest thing asserted
```

**12s is 2.3× the slowest measured ceiling** — headroom for a network materially worse
than the CI profile, while staying inside the window where a person is still waiting
rather than concluding the app is dead. Apple's reviewer concluded the latter.

⚖ **`didCommit` is forwarded and deliberately does NOT cancel the watchdog.** Commit
means the response started, not that anything painted — and "headers then a stalled
body" is the second hang shape, where the WebView is blank and no error will ever
come. Cancelling there would re-open the hole for the harder-to-reproduce half of it.
The cost of not cancelling is bounded and recoverable (a slow-but-working load past
12s gets the fallback, which carries Retry); the cost of cancelling is white, forever,
with no control on screen.

**VERIFIED BY WATCHING IT, not by reasoning about it** — Apple asked for device
testing by name, and a watchdog nobody has seen fire is a hypothesis:

- A black-hole listener (accepts TCP, never responds — the hang, **not** offline,
  which already worked) as `server.url`. **Before 12s: blank white, splash gone, no
  error — Apple's exact symptom, reproduced.** At 12s: `[launch-watchdog] nothing
  painted in 12s` and the branded fallback with Retry.
- Then rebuilt against the real `https://www.setnayan.com`: the login page renders and
  **the watchdog never fires** — the working path is not regressed.

⚠ **Simulator, not a physical device.** Apple's note says "test on physical devices";
this Mac can drive simulators only. The hang was reproduced at the network layer, which
is device-independent, but **someone must confirm on real hardware before resubmission.**

🪤 The first regression check reported the watchdog firing on the healthy load. It had
not: `log show --predicate 'eventMessage CONTAINS "launch-watchdog"'` writes its own
command line, arguments included, into the log — so the query matched itself. Filter by
`process == "App"`.

SPEC IMPACT: None.
