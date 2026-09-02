## 2026-09-02 · docs(live-studio): the capture-app citation was wrong twice over

Comments only — no behaviour change.

Two files told every future reader that the native capture app "was scoped but never built
(§ 4c)". Both halves were false, and the second is the expensive one.

- **§ 4c scopes no capture app.** § 4c of `Live_Studio_Unified_Spec_2026-07-25.md` is
  *"WAVE 1 + 2 SHIPPED — corrections the build forced"*. The real scope is **B4** in
  `Live_Studio_Cast_and_Roam_2026-07-23.md`.
- **⚠ AND B4 IS NOT THE ENCODER THESE COMMENTS ARE ABOUT.** B4 is a PHONE app: it captures a
  kit phone's own camera and pushes one RTMP stream per camera, for **Roam**. The gap these
  comments describe needs a DESKTOP encoder capturing the composited program output and
  pushing ONE stream, for **Cast**. Different input, different topology, different product —
  **building either leaves the other unbuilt**, so a plan that treats them as one item
  under-scopes Roam and does not find out until Roam has no capture path.

Also softened one categorical claim in the same docblock: *"the relay breaks the ₱0
marginal-cost lock"* was reasoning about a COMPOSITING relay, which re-encodes server-side. A
client shipping already-composited H.264 needs only a remux, which is far cheaper. The
accurate claim is that a **transcoding** relay is unaffordable. This changes no
recommendation — once the client composites and encodes, the desktop path is strictly better
— but it must not rule out remuxing on false grounds.

Found by the LS3 encoder-scope session (`Live_Studio_Encoder_Scope_2026-09-03.md` § 3.3 and
§ 4B), which surfaced rather than applied them because they are product claims. The matching
corpus banner is committed in the spec repo (`a485d0b`).

Two other files state the same fact WITHOUT citing § 4c and were left alone — they were
never wrong.

SPEC IMPACT: Applied — superseding banner added to `Live_Studio_Unified_Spec_2026-07-25.md`.
