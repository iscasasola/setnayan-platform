import UIKit
import WebKit

/**
 * Keeps the web view out of the LEFT and RIGHT safe areas — and only those.
 *
 * WHY THIS EXISTS (build 5, walk D1 of PR #6716). On the iPhone Duo's outer
 * screen (466×678 pt, iOS 27.1) the system status column — clock, Wi-Fi, the
 * sensor — runs down the RIGHT edge, not across the top. Capacitor's web view
 * fills the whole window (`contentInset` defaults to "never"), so in-flow page
 * content ran underneath it: the sign-in subtitle under the clock, the header
 * search and "Sign in" under the sensor. The web's own side-inset rule (#6681,
 * `env(safe-area-inset-left/right)`) moves FIXED bars clear; it cannot move
 * every paragraph. Landscape iPhones have the same shape on both sides.
 *
 * WHY NOT `ios.contentInset: 'always'`. Measured on the Duo in #6716: it moves
 * the content clear but insets EVERY edge, and WebKit still reports the full
 * `env(safe-area-inset-*)` to the page — so each env()-padded bar would pad
 * twice, top and bottom, on every iPhone.
 *
 * WHAT THIS DOES INSTEAD. The window's root becomes this small host, and the
 * Capacitor bridge controller is its only child. The child's view (which IS the
 * WKWebView — `CAPBridgeViewController.loadView()` is `final` and assigns
 * `view = webView`) is laid out with:
 *
 *   x      = the host's safe-area LEFT inset
 *   width  = the host's width − left − right safe-area insets
 *   y, height = the full height, exactly as before (top/bottom untouched)
 *
 * On a portrait iPhone or an iPad both side insets are 0, so the frame is the
 * full window and NOTHING CHANGES. Where a side inset exists, the web view no
 * longer overlaps it, so UIKit gives the web view a side safe area of 0 and the
 * page's `env(safe-area-inset-left/right)` reads 0 — #6681's bars do not
 * double-pad. Top and bottom env() values still come through, as today.
 *
 * The strips beside the web view show the page's own colour
 * (`underPageBackgroundColor`, which WebKit derives from the page), so a dark
 * invitation does not get light bars beside it.
 */
final class SideSafeAreaHostViewController: UIViewController {

    let bridgeController: UIViewController

    /// The host size the web view's HEIGHT was last set for. Height is only
    /// reset when the host itself changes size (rotation, a window resize) —
    /// between those, the Keyboard plugin (`resize: 'native'`) owns it and
    /// shortens the web view while the keyboard is up. Resetting it on every
    /// layout pass would undo that the moment anything else asked for layout.
    private var heightLaidOutFor: CGSize = .zero

    private var gutterColour: NSKeyValueObservation?

    /// Warm Alabaster — the launch screen's and `ios.backgroundColor`'s colour,
    /// for the moment before a page has a colour of its own.
    private static let launchColour = UIColor(red: 0xFB / 255, green: 0xFB / 255, blue: 0xFA / 255, alpha: 1)

    init(hosting bridgeController: UIViewController) {
        self.bridgeController = bridgeController
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("SideSafeAreaHostViewController is created in code") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = Self.launchColour

        // Loading the child's view here is what builds the Capacitor bridge
        // and its plugins — `SceneDelegate` relies on that happening inside
        // the root's `loadViewIfNeeded()`, before it forwards a launch link.
        addChild(bridgeController)
        let web = bridgeController.view!
        (web as? SideSafeWebView)?.host = view
        view.addSubview(web)
        bridgeController.didMove(toParent: self)

        if let webView = web as? WKWebView {
            gutterColour = webView.observe(\.underPageBackgroundColor, options: [.initial, .new]) { [weak self] webView, _ in
                self?.view.backgroundColor = webView.underPageBackgroundColor ?? Self.launchColour
            }
        }
    }

    override func viewSafeAreaInsetsDidChange() {
        super.viewSafeAreaInsetsDidChange()
        view.setNeedsLayout()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        guard let web = bridgeController.viewIfLoaded else { return }
        var frame = web.frame
        if view.bounds.size != heightLaidOutFor {
            frame.origin.y = 0
            frame.size.height = view.bounds.height
            heightLaidOutFor = view.bounds.size
        }
        // The horizontal half is applied by `SideSafeWebView`'s frame setter,
        // so it holds for every writer — this pass and the Keyboard plugin's.
        web.frame = SideSafeWebView.sideSafe(frame, in: view)
    }

    // The bridge controller still decides everything it decided as the root.
    override var childForStatusBarStyle: UIViewController? { bridgeController }
    override var childForStatusBarHidden: UIViewController? { bridgeController }
    override var childForHomeIndicatorAutoHidden: UIViewController? { bridgeController }
    override var childForScreenEdgesDeferringSystemGestures: UIViewController? { bridgeController }
    override var preferredStatusBarUpdateAnimation: UIStatusBarAnimation { bridgeController.preferredStatusBarUpdateAnimation }
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { bridgeController.supportedInterfaceOrientations }
}

/**
 * The web view Capacitor builds (via `CAPBridgeViewController.webView(with:
 * configuration:)`), with one difference: whatever sets its frame, the
 * horizontal part is held to the host's side-safe band.
 *
 * ⚠ WHY THE SETTER, NOT ONLY THE HOST'S LAYOUT. `@capacitor/keyboard` with
 * `resize: 'native'` writes the frame itself on every keyboard show and hide:
 * `CGRectMake(wf.origin.x, wf.origin.y, window.width − wf.origin.x, …)`. It
 * keeps our x but sets the width to "the rest of the window", which puts the
 * right edge back under the Duo's status column for as long as the keyboard is
 * up — and after it hides, until something else lays the host out. Holding the
 * band here keeps the plugin's vertical answer and corrects only the sides.
 */
final class SideSafeWebView: WKWebView {

    /// The host's view. `nil` until hosted, in which case frames pass through
    /// untouched.
    weak var host: UIView?

    override var frame: CGRect {
        get { super.frame }
        set { super.frame = host.map { Self.sideSafe(newValue, in: $0) } ?? newValue }
    }

    /// `frame` with its x and width replaced by `host`'s band between the left
    /// and right safe-area insets. y and height are returned unchanged.
    static func sideSafe(_ frame: CGRect, in host: UIView) -> CGRect {
        let insets = host.safeAreaInsets
        return CGRect(
            x: insets.left,
            y: frame.origin.y,
            width: max(0, host.bounds.width - insets.left - insets.right),
            height: frame.height
        )
    }
}
