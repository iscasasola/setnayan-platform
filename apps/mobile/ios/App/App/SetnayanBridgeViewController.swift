import UIKit
import WebKit
import Capacitor

/**
 * Offline fallback for the remote-URL shell — the iOS half of a mechanism that
 * has shipped on Android since the shell was built.
 *
 * WHY THIS EXISTS. `capacitor.config.ts` states that `webDir` (./www) is "the
 * LOCAL FALLBACK shown when the remote URL is unreachable". That was true on
 * Android — `MainActivity` subclasses Capacitor's own `BridgeWebViewClient` and
 * loads the bundled page from `onReceivedError` — and false on iOS, which
 * carried a stock `AppDelegate` and a stock `CAPBridgeViewController` and no
 * `WKNavigationDelegate` of any kind. The bundled page said so in its own
 * comment: "Wiring it as the WebView error page is a per-platform follow-up
 * (iOS: WKNavigationDelegate...)".
 *
 * What the gap actually looked like: the splash auto-hides after
 * `launchShowDuration` (2s) whether or not the remote page arrived. If it did
 * not — a proxied or captive network, a DNS failure, the host down — the
 * reviewer or the couple was left looking at a blank white WebView with no
 * error, no explanation and no retry, forever.
 *
 * HOW IT ATTACHES. Capacitor owns the webView's `navigationDelegate`: it is a
 * `CAPWebViewDelegationHandler` that carries the bridge, and replacing it
 * outright would sever every plugin. `CAPBridgeViewController` exposes no hook
 * for substituting it, so this installs a proxy in front: the two failure
 * callbacks are handled here, and every other selector is forwarded to
 * Capacitor's handler through the ObjC runtime
 * (`forwardingTarget(for:)` + `responds(to:)`), which keeps
 * `decidePolicyFor`, the auth challenge, the script-message plumbing and the
 * scroll delegate exactly as they were.
 */
final class SetnayanBridgeViewController: CAPBridgeViewController {

    /// `WKWebView.navigationDelegate` is a WEAK reference, so the proxy has to
    /// be owned here or it deallocates immediately and the fallback silently
    /// never fires.
    private var offlineFallbackDelegate: OfflineFallbackNavigationDelegate?

    /// The launch deadline. Cancelled when the remote app finishes loading;
    /// otherwise it shows the fallback even though no error ever arrived.
    private var launchWatchdog: DispatchWorkItem?

    /// When the watchdog was first armed — only for the timing lines in the
    /// log, which are how a slow launch gets MEASURED instead of guessed.
    private var launchStartedAt: CFTimeInterval = 0

    /// Phase 1 — how long the app may wait for the FIRST RESPONSE (the first
    /// main-frame commit) before the fallback takes over.
    ///
    /// 🔴 THIS NUMBER IS MEASURED, NOT CHOSEN. `.lighthouserc.json` asserts
    /// this app's own throttled-mobile ceilings — 150ms RTT · 1638kbps · 4x CPU
    /// slowdown — against `/`, `/pricing` and `/login`, and `/login` IS the
    /// launch destination (the web middleware 307s `/` there for every app
    /// request). Those assertions are documented as "current pilot-week
    /// measurements + ~10% headroom":
    ///
    ///     first-contentful-paint   <= 1800ms
    ///     speed-index              <= 3400ms
    ///     largest-contentful-paint <= 4500ms
    ///     interactive              <= 5200ms   <- the slowest thing asserted
    ///
    /// 12s is 2.3x the slowest measured ceiling — and a first RESPONSE comes
    /// long before "interactive". Nothing back from the server in 12 s is the
    /// shape Apple's reviewer met (no error, no page), so this phase keeps the
    /// shipped number: a phone that is genuinely offline sees Retry exactly as
    /// soon as it did in build 4.
    ///
    /// ⚠ CHANGING IT: re-read the Lighthouse assertions first. If they are
    /// ratcheted down (the file says to do that quarterly), this can follow
    /// them down. If a REAL launch is ever measured slower than this, raise it
    /// — a fallback that interrupts a working load is a different bug.
    private static let launchDeadline: TimeInterval = 12

    /// Phase 2 (build 5, walk D8 of PR #6716) — once the server HAS answered
    /// (first main-frame commit), how much longer the page may take to finish
    /// loading before the fallback takes over. The deadline is re-armed from
    /// the commit, so the total ceiling for a reachable-but-slow launch is
    /// "time to first response + 20 s".
    ///
    /// ⚖ WHY A SECOND PHASE, NOT A BIGGER SINGLE NUMBER. Build 4's single 12 s
    /// clock ran from launch to `didFinish`, which waits for every subresource
    /// (scripts, fonts, images) — on a slow phone or a slow network that can
    /// pass 12 s with the server reachable and the page arriving, and the
    /// couple was then thrown onto "You're offline" in the middle of a working
    /// load (seen in the simulator walk, WebContent stalled 10–45 s). A commit
    /// proves the host is reachable, so the remaining risk is only "headers
    /// then a stalled body" — still bounded here, never white forever — while
    /// the genuinely offline case keeps phase 1's 12 s. 20 s is ~4x the
    /// slowest Lighthouse ceiling above.
    private static let paintDeadline: TimeInterval = 20

    /// In-app plugins (no npm package) register here — Capacitor's documented
    /// hook, which runs before the web view loads, so the JS proxy is injected
    /// for the very first page. `SetnayanAuth` is the native sign-in (B3):
    /// the Sign in with Apple sheet + Google in the system browser.
    /// The web view is a `SideSafeWebView` so `SideSafeAreaHostViewController`
    /// (SideSafeAreaHost.swift) can keep it out of the left/right safe areas —
    /// the Duo's outer-screen status column, a landscape iPhone's notch — under
    /// every writer of its frame, the Keyboard plugin included. Capacitor's own
    /// implementation is `WKWebView(frame:configuration:)`; this is the same
    /// call on the subclass, and everything Capacitor configures afterwards
    /// (delegates, scroll view, inspectable, user agent) is unchanged.
    override func webView(with frame: CGRect, configuration: WKWebViewConfiguration) -> WKWebView {
        SideSafeWebView(frame: frame, configuration: configuration)
    }

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(SetnayanAuthPlugin())
        // `SetnayanStore` is Apple In-App Purchase (StoreKit 2) — Papic credits,
        // Event Hub Pro, Live Watch (owner 2026-10-18). The web asks for it only
        // when this build's user-agent carries `SetnayanIAP/1`.
        bridge?.registerPluginInstance(SetnayanStorePlugin())
    }

    override func viewDidLoad() {
        // Installing AFTER super is deliberate. `capacitorDidLoad()` is the
        // documented extension point, but it runs BEFORE `loadWebView()` and
        // the exact moment Capacitor assigns the navigation delegate is an
        // internal detail of a binary framework. By the end of
        // `super.viewDidLoad()` the webView and its delegate both exist, and
        // the initial load is asynchronous — the delegate is read when the
        // failure fires, not when the request starts — so nothing is missed.
        super.viewDidLoad()

        guard let webView else {
            NSLog("[offline-fallback] no webView — fallback NOT installed")
            return
        }
        guard let capacitorDelegate = webView.navigationDelegate as? NSObject else {
            NSLog("[offline-fallback] no Capacitor navigation delegate — fallback NOT installed")
            return
        }

        let proxy = OfflineFallbackNavigationDelegate(forwardingTo: capacitorDelegate) { [weak self] in
            self?.showOfflineFallback()
        }
        proxy.onContentRendered = { [weak self] in self?.cancelLaunchWatchdog() }
        proxy.onFirstCommit = { [weak self] in self?.rearmWatchdogForPaint() }
        offlineFallbackDelegate = proxy
        webView.navigationDelegate = proxy

        startLaunchWatchdog()
    }

    deinit {
        launchWatchdog?.cancel()
    }

    /// Starts the deadline that turns "nothing happened" into a visible page.
    ///
    /// 🛑 THE GAP THIS CLOSES, AND WHY THE ERROR PATH COULD NOT: everything
    /// above reacts to a FAILURE. Apple's rejection (Guideline 2.1, 1.0 (3),
    /// 2026-09-22, "The app crashed on launch") was the other shape — a load
    /// that never arrives. A hung connection produces no `didFailProvisional`,
    /// no `didFail`, no callback of any kind: the splash hides after
    /// `launchShowDuration` (2s) and the WebView stays white forever. There was
    /// no timer anywhere in this file, so nothing could notice.
    private func startLaunchWatchdog() {
        launchStartedAt = CACurrentMediaTime()
        arm(after: Self.launchDeadline, phase: "no response")
    }

    /// The first main-frame commit: the server answered. Replace the
    /// first-response deadline with the (longer) finish-loading one.
    private func rearmWatchdogForPaint() {
        guard launchWatchdog != nil else { return }
        NSLog("[launch-watchdog] first response after %.1fs", CACurrentMediaTime() - launchStartedAt)
        arm(after: Self.paintDeadline, phase: "responded, not finished")
    }

    private func arm(after seconds: TimeInterval, phase: String) {
        launchWatchdog?.cancel()
        let deadline = DispatchWorkItem { [weak self] in
            guard let self else { return }
            // The proxy owns the one true answer to "has anything painted".
            // Asking it here rather than keeping a second flag is what stops
            // the two drifting apart.
            guard self.offlineFallbackDelegate?.hasRenderedContent == false else { return }
            NSLog(
                "[launch-watchdog] %@ after %.1fs — showing the bundled fallback",
                phase,
                CACurrentMediaTime() - self.launchStartedAt
            )
            self.launchWatchdog = nil
            self.showOfflineFallback()
        }
        launchWatchdog = deadline
        DispatchQueue.main.asyncAfter(deadline: .now() + seconds, execute: deadline)
    }

    private func cancelLaunchWatchdog() {
        if launchWatchdog != nil {
            NSLog("[launch-watchdog] finished loading after %.1fs", CACurrentMediaTime() - launchStartedAt)
        }
        launchWatchdog?.cancel()
        launchWatchdog = nil
    }

    /// Loads the bundled `public/index.html` — the same file Android serves
    /// from `file:///android_asset/public/index.html`. Its Retry button
    /// navigates back to `server.url`, which Capacitor treats as the app's own
    /// host and therefore keeps inside the WebView.
    private func showOfflineFallback() {
        guard let webView else { return }
        guard let fallback = Bundle.main.url(
            forResource: "index",
            withExtension: "html",
            subdirectory: "public"
        ) else {
            NSLog("[offline-fallback] public/index.html missing from the bundle")
            return
        }
        webView.loadFileURL(fallback, allowingReadAccessTo: fallback.deletingLastPathComponent())
    }
}

/**
 * A `WKNavigationDelegate` that handles main-frame load failures and forwards
 * everything else, untouched, to Capacitor's own handler.
 */
final class OfflineFallbackNavigationDelegate: NSObject, WKNavigationDelegate {

    private let target: NSObject
    private let onUnreachable: () -> Void

    /// True once anything has painted — the remote app OR the fallback itself.
    ///
    /// This is the guard that keeps the fix from becoming a new bug. A WKWebView
    /// that already has content KEEPS showing it when a later navigation fails;
    /// only the very first load leaves the blank screen this class exists to
    /// remove. Falling back unconditionally would therefore REPLACE a working
    /// page — mid-session, losing whatever the couple was doing — every time a
    /// single navigation failed. Android's `onReceivedError` has exactly that
    /// bug today; it is noted in the PR rather than fixed here.
    private(set) var hasRenderedContent = false

    /// Called once the remote app has actually finished loading, so the view
    /// controller can cancel its launch deadline.
    var onContentRendered: (() -> Void)?

    /// Called once, on the first main-frame commit — the server answered — so
    /// the view controller can move its launch deadline to the finish phase.
    var onFirstCommit: (() -> Void)?
    private var hasCommitted = false

    init(forwardingTo target: NSObject, onUnreachable: @escaping () -> Void) {
        self.target = target
        self.onUnreachable = onUnreachable
        super.init()
    }

    private var navigationTarget: WKNavigationDelegate? { target as? WKNavigationDelegate }

    // MARK: - Failure handling

    func webView(
        _ webView: WKWebView,
        didFailProvisionalNavigation navigation: WKNavigation!,
        withError error: Error
    ) {
        navigationTarget?.webView?(webView, didFailProvisionalNavigation: navigation, withError: error)
        handleFailure(error)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        navigationTarget?.webView?(webView, didFail: navigation, withError: error)
        handleFailure(error)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        hasRenderedContent = true
        onContentRendered?()
        navigationTarget?.webView?(webView, didFinish: navigation)
    }

    /// ⚖ COMMIT IS FORWARDED AND DELIBERATELY DOES NOT STOP THE WATCHDOG.
    ///
    /// A committed navigation means the response STARTED — headers arrived and
    /// the old page was torn down. It does not mean anything painted, and
    /// "headers then a stalled body" is one of the two hang shapes this
    /// watchdog exists for: the WebView is blank, WebKit is still waiting, and
    /// no error will ever be raised. Cancelling here would re-open exactly the
    /// hole Apple found, for the harder-to-reproduce half of it.
    ///
    /// What the FIRST commit does instead (build 5, D8) is RE-ARM the deadline
    /// with `paintDeadline`: the host is now proven reachable, so a slow page is
    /// given longer to finish, and a stalled body still ends on the fallback's
    /// Retry — bounded, never white forever.
    ///
    /// It is implemented rather than omitted so the forwarding stays explicit:
    /// Capacitor's handler must still see the callback.
    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        navigationTarget?.webView?(webView, didCommit: navigation)
        if !hasCommitted && !hasRenderedContent {
            hasCommitted = true
            onFirstCommit?()
        }
    }

    /// Capacitor's own policy handler only recognises `server.url`. It treats
    /// everything else as an external link, cancels the navigation and hands
    /// the URL to Safari — which silently swallowed the `file://` fallback and
    /// left the WebView blank. Allow our own bundle through; forward the rest
    /// untouched so external-link behaviour is unchanged.
    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        if let url = navigationAction.request.url, isOwnBundleFile(url) {
            decisionHandler(.allow)
            return
        }
        // `Void?` is nil when the target does not implement the selector, in
        // which case nobody would ever call the handler and the WebView would
        // hang on every navigation.
        if navigationTarget?.webView?(webView, decidePolicyFor: navigationAction, decisionHandler: decisionHandler) == nil {
            decisionHandler(.allow)
        }
    }

    /// Scoped deliberately: only files inside this app's own bundle, never an
    /// arbitrary `file://` URL a remote page could hand us.
    private func isOwnBundleFile(_ url: URL) -> Bool {
        guard url.isFileURL else { return false }
        return url.standardizedFileURL.path.hasPrefix(Bundle.main.bundleURL.standardizedFileURL.path)
    }

    private func handleFailure(_ error: Error) {
        guard !hasRenderedContent else { return }

        guard isUnreachable(error) else { return }
        onUnreachable()
    }

    /// Distinguishes "the host could not be reached" from the two errors that
    /// are routine control flow and must NOT show an offline page:
    ///
    /// - `NSURLErrorCancelled` (-999) — a navigation the app replaced, e.g. a
    ///   redirect or a link tapped while the previous page was still loading.
    ///   The middleware 307s every app request from `/` to `/login`, so this
    ///   one is on the normal launch path.
    /// - `WebKitErrorDomain` 102, "frame load interrupted by policy change" —
    ///   raised whenever Capacitor's own `decidePolicyFor` sends a URL to
    ///   Safari instead of the WebView.
    private func isUnreachable(_ error: Error) -> Bool {
        let error = error as NSError
        if error.domain == NSURLErrorDomain && error.code == NSURLErrorCancelled { return false }
        if error.domain == "WebKitErrorDomain" && error.code == 102 { return false }
        return true
    }

    // MARK: - Transparent forwarding

    override func forwardingTarget(for aSelector: Selector!) -> Any? {
        if target.responds(to: aSelector) { return target }
        return super.forwardingTarget(for: aSelector)
    }

    override func responds(to aSelector: Selector!) -> Bool {
        if super.responds(to: aSelector) { return true }
        return target.responds(to: aSelector)
    }
}
