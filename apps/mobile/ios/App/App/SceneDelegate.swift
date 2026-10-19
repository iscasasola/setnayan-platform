import UIKit
import Capacitor

/**
 * The app's one window scene — the UIScene life cycle (Apple TN3187).
 *
 * WHY THIS EXISTS. Until 2026-10-19 the shell was the stock Capacitor template:
 * an `AppDelegate` that owned `var window` and an `Info.plist` with no
 * `UIApplicationSceneManifest`. iOS 26 already logs, as a fault, "`UIScene`
 * lifecycle will soon be required. Failure to adopt will result in an assert in
 * the future" (seen on the iOS 26.5 simulator, Xcode 27.1 build). TN3187 says
 * that in the release after iOS 26, an app built with the latest SDK that has
 * not adopted scenes does not launch. Scenes are also what iPad multitasking
 * and the iPhone Duo's display changes run on.
 *
 * WHAT MOVED HERE. With a scene manifest, UIKit stops calling the
 * `UIApplicationDelegate` URL hooks. It calls these instead:
 *
 *   application(_:open:options:)              →  scene(_:openURLContexts:)
 *   application(_:continue:restorationHandler:) →  scene(_:continue:)
 *   (a URL or link that LAUNCHES the app)     →  scene(_:willConnectTo:options:)
 *                                                 `connectionOptions`
 *
 * Every one still goes through `ApplicationDelegateProxy.shared`, which is how
 * Capacitor's App plugin hears about it (`appUrlOpen`, consumed by
 * apps/web/app/_components/native-bridge.tsx). That covers the
 * `setnayan://auth/callback` return from Google sign-in and every
 * `https://www.setnayan.com/…` Universal Link (App.entitlements
 * `applinks:www.setnayan.com`).
 *
 * WHAT DID NOT MOVE. The window still comes from `Main.storyboard`
 * (`UISceneStoryboardFile` in Info.plist), whose root is
 * `SetnayanBridgeViewController`, so the in-app plugins (SetnayanAuth,
 * SetnayanStore), the offline fallback and the 12 s launch watchdog are
 * created exactly as before.
 */
class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    /// Set by UIKit from `UISceneStoryboardFile` before `willConnectTo` runs.
    var window: UIWindow?

    func scene(
        _ scene: UIScene,
        willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        guard scene is UIWindowScene else { return }

        // A cold launch from a link does NOT call `openURLContexts` or
        // `continue` — the link arrives here, once, in `connectionOptions`.
        let urls = connectionOptions.urlContexts
        let activities = connectionOptions.userActivities
        guard !urls.isEmpty || !activities.isEmpty else { return }

        // ⚠ ORDER MATTERS. The App plugin subscribes to Capacitor's open-URL
        // notifications when the bridge loads its plugins, which happens in the
        // root view controller's `viewDidLoad`. At this moment the storyboard
        // has created the controller but not its view, so a notification posted
        // now would reach nobody (only `ApplicationDelegateProxy.lastURL` would
        // remember it, and the web never asks for that). Loading the view first
        // creates the bridge and its plugins; the plugin then holds the event
        // (`retainUntilConsumed`) until the web's listener attaches.
        window?.rootViewController?.loadViewIfNeeded()

        open(urls)
        activities.forEach(continueActivity)
    }

    /// A `setnayan://…` URL while the app is running (e.g. the Google sign-in
    /// return from the system browser).
    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        open(URLContexts)
    }

    /// A Universal Link (`https://www.setnayan.com/…`) while the app is running.
    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        continueActivity(userActivity)
    }

    // MARK: - Hand-off to Capacitor

    private func open(_ contexts: Set<UIOpenURLContext>) {
        for context in contexts {
            var options: [UIApplication.OpenURLOptionsKey: Any] = [
                .openInPlace: context.options.openInPlace
            ]
            if let source = context.options.sourceApplication {
                options[.sourceApplication] = source
            }
            if let annotation = context.options.annotation {
                options[.annotation] = annotation
            }
            _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, open: context.url, options: options)
        }
    }

    private func continueActivity(_ userActivity: NSUserActivity) {
        _ = ApplicationDelegateProxy.shared.application(
            UIApplication.shared,
            continue: userActivity,
            restorationHandler: { _ in }
        )
    }
}
