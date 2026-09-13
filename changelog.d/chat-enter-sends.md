## 2026-09-11 · fix(chat): Enter sends the message, Shift+Enter starts a new line

The chat composer's `<textarea>` had no key handling — Enter always inserted a
newline, and sending only worked via the button tap. Added a shared decision
helper, `lib/chat-enter-to-send.ts` (`shouldSendOnEnter`), and wired it into
`ChatSendForm` (the one composer used by the couple thread page, couple vendor
workspace, supplier client page, and supplier messages thread) and into the
tour's `TourChatThread` demo composer, which previously had its own smaller
hand-rolled `key === 'Enter' && !shiftKey` check.

- Enter (no modifiers) sends; Shift+Enter inserts a new line — the standard
  desktop chat convention.
- IME composition (`isComposing`, or the legacy `keyCode === 229` fallback)
  holds Enter back, since Filipino/Japanese/Chinese input methods use Enter to
  confirm a composed word, not to submit.
- Alt/Ctrl/Meta+Enter are left alone — never hijacked into sending.
- On a coarse-pointer (touch) device, Return always inserts a newline instead;
  a phone's on-screen keyboard has no Shift+Enter, so if Return sent the
  message a person could never write a second line. Sending on a phone stays
  button-only. Detected via `window.matchMedia('(pointer: coarse)')`,
  evaluated per-keystroke and SSR-guarded.
- `ChatSendForm` guards against a double-send from a fast double-Enter with a
  pending ref set for the duration of the awaited `sendAction` call.
- Added `lib/chat-enter-to-send.test.ts` (unit coverage of the decision) and
  `lib/chat-enter-to-send-is-wired.test.ts` (source-scan guard asserting both
  composers actually call the shared helper instead of drifting back to an
  inline copy).

No change to `sendAction`, compression, the contact-info block, telemetry, or
the post-send clear — all untouched.

SPEC IMPACT: None
