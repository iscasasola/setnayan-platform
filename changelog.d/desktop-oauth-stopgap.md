## 2026-06-26 · fix(auth): hide OAuth buttons in the native shells (email-only sign-in)

Google (and Apple) refuse OAuth inside an embedded WebView ("disallowed_useragent"),
so on the Tauri desktop app and the Capacitor Android shell the "Continue with
Google / Apple" buttons were a dead end — clicking did nothing useful (owner
report: "login is not bouncing to google"). Email + password works fine in those
WebViews.

Stopgap: `/login` + `/signup` now hide the entire OAuth row (and its "or continue
with email" divider) when the request comes from a native shell — detected
per-request via the `SetnayanApp` UA marker (`getRequestPlatform() !== 'web'`).
Web browsers are unchanged. Verified by curl: web UA shows Google/Apple; the
`SetnayanApp` UA shows email-only on both pages.

Ships via the **remote-URL shell** — takes effect in the installed desktop/Android
app on the next web deploy, **no app rebuild required**.

This is the interim half of the owner-approved (2026-06-26) "stopgap now + proper
fix" plan. The proper fix — system-browser OAuth with a callback hand-off back to
the app — is a separate native feature (needs a rebuild + Google Cloud redirect-URI
config) and is tracked as a follow-up.

SPEC IMPACT: None — conditional render of existing auth UI by client platform.
