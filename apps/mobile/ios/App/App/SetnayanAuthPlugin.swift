import Foundation
import UIKit
import Capacitor
import AuthenticationServices

/**
 * Native sign-in for the phone app — B3 (DECISION_LOG 2026-09-30 "…GOOGLE +
 * APPLE SIGN-IN COME TO THE PHONE APPS BEFORE THE APPLE CHECK").
 *
 * WHY NATIVE. The app is a web view over www.setnayan.com, and Google refuses
 * sign-in inside an embedded web view ("disallowed_useragent"). So the web side
 * (apps/web/lib/native-oauth.ts) never opens a provider page in the web view; it
 * calls this plugin instead:
 *
 *   signInWithApple({ nonce })      → the system Sign in with Apple sheet.
 *       `nonce` is the SHA-256 of a random value the web keeps; Apple puts it in
 *       the identity token and Supabase checks it (`signInWithIdToken`).
 *       Resolves { identityToken, givenName?, familyName? }.
 *
 *   openAuthSession({ url, callbackScheme }) → ASWebAuthenticationSession: the
 *       provider page in the SYSTEM browser (Safari's own cookies, so a Google
 *       account already signed in there is one tap). Resolves { url } with the
 *       `setnayan://auth/callback?code=…` it returned to.
 *
 * Cancelling either rejects with code "CANCELED" (the web treats it as "stay").
 *
 * 🔒 Nothing here logs, stores or forwards a token — the identity token goes
 * back to the page that asked, and only to it.
 *
 * Registered as an in-app plugin by SetnayanBridgeViewController.capacitorDidLoad
 * (no npm package: one small file, nothing third-party in the sign-in path).
 */
@objc(SetnayanAuthPlugin)
public class SetnayanAuthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SetnayanAuthPlugin"
    public let jsName = "SetnayanAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signInWithApple", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openAuthSession", returnType: CAPPluginReturnPromise)
    ]

    /// The only callback scheme a session may return to — the app's own
    /// (Info.plist CFBundleURLSchemes). A page cannot point it elsewhere.
    private static let callbackScheme = "setnayan"

    private var appleCall: CAPPluginCall?
    private var appleController: ASAuthorizationController?
    private var webSession: ASWebAuthenticationSession?

    // MARK: - Sign in with Apple

    @objc func signInWithApple(_ call: CAPPluginCall) {
        guard let nonce = call.getString("nonce"), !nonce.isEmpty else {
            call.reject("A nonce is required.", "INVALID")
            return
        }
        DispatchQueue.main.async {
            guard self.appleCall == nil else {
                call.reject("Sign in with Apple is already open.", "BUSY")
                return
            }
            let request = ASAuthorizationAppleIDProvider().createRequest()
            request.requestedScopes = [.fullName, .email]
            request.nonce = nonce
            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            self.appleCall = call
            self.appleController = controller
            controller.performRequests()
        }
    }

    private func finishApple(_ settle: (CAPPluginCall) -> Void) {
        guard let call = appleCall else { return }
        appleCall = nil
        appleController = nil
        settle(call)
    }

    // MARK: - The system browser (ASWebAuthenticationSession)

    @objc func openAuthSession(_ call: CAPPluginCall) {
        guard let raw = call.getString("url"), let url = URL(string: raw), url.scheme == "https" else {
            call.reject("An https sign-in address is required.", "INVALID")
            return
        }
        let scheme = call.getString("callbackScheme") ?? Self.callbackScheme
        guard scheme == Self.callbackScheme else {
            call.reject("Unknown return scheme.", "INVALID")
            return
        }
        DispatchQueue.main.async {
            guard self.webSession == nil else {
                call.reject("Sign-in is already open.", "BUSY")
                return
            }
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: scheme) { [weak self] callbackURL, error in
                DispatchQueue.main.async {
                    self?.webSession = nil
                    if let error = error as? ASWebAuthenticationSessionError, error.code == .canceledLogin {
                        call.reject("Sign-in was cancelled.", "CANCELED")
                        return
                    }
                    if let error {
                        call.reject(error.localizedDescription, "FAILED")
                        return
                    }
                    guard let callbackURL else {
                        call.reject("Sign-in did not return.", "FAILED")
                        return
                    }
                    call.resolve(["url": callbackURL.absoluteString])
                }
            }
            session.presentationContextProvider = self
            // Share Safari's cookies: a guest who saved their invitation with
            // Google in Safari is already signed in there — one tap, not a password.
            session.prefersEphemeralWebBrowserSession = false
            self.webSession = session
            if !session.start() {
                self.webSession = nil
                call.reject("Could not open the sign-in window.", "FAILED")
            }
        }
    }

    fileprivate func anchor() -> ASPresentationAnchor {
        if let window = bridge?.webView?.window { return window }
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        return scenes.flatMap { $0.windows }.first { $0.isKeyWindow } ?? ASPresentationAnchor()
    }
}

extension SetnayanAuthPlugin: ASAuthorizationControllerDelegate {
    public func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        guard
            let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
            let tokenData = credential.identityToken,
            let identityToken = String(data: tokenData, encoding: .utf8)
        else {
            finishApple { $0.reject("Apple returned no identity token.", "FAILED") }
            return
        }
        var result: [String: Any] = ["identityToken": identityToken]
        // Apple gives the name only on the FIRST authorization, and never in the token.
        if let given = credential.fullName?.givenName { result["givenName"] = given }
        if let family = credential.fullName?.familyName { result["familyName"] = family }
        finishApple { $0.resolve(result) }
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        if let error = error as? ASAuthorizationError, error.code == .canceled {
            finishApple { $0.reject("Sign in with Apple was cancelled.", "CANCELED") }
            return
        }
        finishApple { $0.reject(error.localizedDescription, "FAILED") }
    }
}

extension SetnayanAuthPlugin: ASAuthorizationControllerPresentationContextProviding {
    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        anchor()
    }
}

extension SetnayanAuthPlugin: ASWebAuthenticationPresentationContextProviding {
    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        anchor()
    }
}
