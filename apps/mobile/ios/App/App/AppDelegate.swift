import UIKit
import Capacitor

/**
 * Process-level hooks only. The window, and every URL / Universal Link the app
 * is opened with, belong to `SceneDelegate` — the UIScene life cycle (TN3187).
 *
 * ⚠ Do not put `var window` or `application(_:open:options:)` /
 * `application(_:continue:restorationHandler:)` back here: with a scene
 * manifest in Info.plist, UIKit never calls them, so a link handled here would
 * be silently dropped. Held by apps/web/lib/the-app-runs-on-scenes.test.ts.
 */
@main
class AppDelegate: UIResponder, UIApplicationDelegate {

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        return true
    }

    /// Every new window scene uses the one configuration Info.plist declares
    /// (`UIApplicationSceneManifest` → "Default Configuration": SceneDelegate +
    /// Main.storyboard).
    // 📱 APNs (owner 2026-10-31, "The notification on the phone not on the app").
    // iOS hands the device token to the APP delegate — not the scene — and
    // @capacitor/push-notifications listens for these two Capacitor notifications,
    // then gives the token to the web page (apps/web/lib/native-push.ts), which
    // saves it as a push subscription of kind 'apns'. Without them `register()`
    // never answers.
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    func application(
        _ application: UIApplication,
        configurationForConnecting connectingSceneSession: UISceneSession,
        options: UIScene.ConnectionOptions
    ) -> UISceneConfiguration {
        return UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    }
}
