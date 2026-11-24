import Foundation
import Capacitor

/**
 * 📱 ONE CODEBASE, TWO iPHONE APPS (owner, DECISION_LOG 24 Nov 2026 "Three iOS apps: Setnayan · Supnayan · Chatnayan").
 *
 * This project builds two App Store apps from ONE target, the same Swift and the same web app:
 *
 *   · Setnayan (com.setnayan.app)      — configurations Debug · Release, scheme App. Everything, with role jumps.
 *   · Supnayan (com.setnayan.supnayan) — configurations Debug Supnayan · Release Supnayan, scheme Supnayan. Suppliers
 *     and coordinators only. Its name, bundle id, icon, entitlements and build number are `ios/supnayan.xcconfig`.
 *
 * The build names the app in Info.plist `SetnayanShell` (the `SETNAYAN_SHELL` build setting). For any app other than
 * Setnayan, `capacitor.config.ts` → `plugins.SetnayanShell.<app>` holds its start address, its user-agent and the
 * other hosts it opens in place. `apply(to:)` writes them onto Capacitor's own descriptor from
 * `SetnayanBridgeViewController.instanceDescriptor()` (Capacitor's documented hook, read once in `loadView`, before the
 * web view exists), so the very first request already carries the app's user-agent. Setnayan reads nothing here and
 * runs exactly as it did.
 *
 * 🚪 What makes Supnayan a different app is not here: it is the web's ONE door flag (lib/doors.ts), which its
 * user-agent turns on. There is no second copy of any page.
 */
enum SetnayanShell {

    /// The Info.plist key the build writes the app's name into.
    static let infoKey = "SetnayanShell"

    /// The block in `capacitor.config.ts` `plugins` that holds every non-Setnayan app.
    static let configKey = "SetnayanShell"

    /// The default — the main app. It has no block and changes nothing.
    static let main = "setnayan"

    /// The app this build is: "setnayan" or "supnayan".
    static var current: String {
        let raw = (Bundle.main.object(forInfoDictionaryKey: infoKey) as? String) ?? ""
        let name = raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return name.isEmpty ? main : name
    }

    /// Writes this app's address, user-agent and allowed hosts onto the descriptor. A no-op for Setnayan.
    static func apply(to descriptor: InstanceDescriptor) {
        let app = current
        guard app != main else { return }

        // 🛑 A build that says it is another app but carries no block for it would open as the Setnayan app under
        // another app's name and icon — exactly the near-copy Apple's guideline 4.3 rejects. Never ship that: stop.
        // apps/web/lib/supnayan-is-the-same-app.test.ts holds the block in place.
        guard let apps = descriptor.pluginConfigurations[configKey] as? [String: Any],
              let shell = apps[app] as? [String: Any],
              let url = shell["url"] as? String, URL(string: url) != nil,
              let userAgent = shell["appendUserAgent"] as? String, !userAgent.isEmpty
        else {
            preconditionFailure("[shell] this build is \"\(app)\" but capacitor.config.json has no plugins.\(configKey).\(app) url + appendUserAgent — run `npx cap sync ios`")
        }

        descriptor.serverURL = url
        descriptor.appendedUserAgentString = userAgent
        if let hosts = shell["allowNavigation"] as? [Any] {
            descriptor.allowedNavigationHostnames = hosts.compactMap { $0 as? String }
        }
    }
}
