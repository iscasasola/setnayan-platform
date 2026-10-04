package com.setnayan.app;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Native sign-in for the Android app — B3 (DECISION_LOG 2026-09-30 "…GOOGLE +
 * APPLE SIGN-IN COME TO THE PHONE APPS BEFORE THE APPLE CHECK").
 *
 * The app is a web view, and Google refuses sign-in inside an embedded web view
 * ("disallowed_useragent"). So apps/web/lib/native-oauth.ts never opens the
 * provider page in the web view; it asks this plugin to open it in the SYSTEM
 * browser as a Custom Tab. The provider returns to
 * setnayan://auth/callback?code=… — the custom-scheme intent filter in
 * AndroidManifest.xml brings this (singleTask) activity back, and the web's
 * `appUrlOpen` handler (native-bridge.tsx) opens /auth/callback in the web view,
 * where the session is finished.
 *
 * Apple has no native sheet on Android: "Continue with Apple" takes the same
 * system-browser path (Supabase's Apple web sign-in).
 *
 * Custom Tabs without the androidx.browser library: the documented low-level
 * form is an ACTION_VIEW intent carrying the EXTRA_SESSION key. A browser that
 * supports Custom Tabs shows one; any other opens the page normally — still the
 * system browser, never this web view. No new dependency.
 *
 * Nothing here logs or keeps a URL or token.
 */
@CapacitorPlugin(name = "SetnayanAuth")
public class SetnayanAuthPlugin extends Plugin {

    /** androidx.browser.customtabs.CustomTabsIntent.EXTRA_SESSION */
    private static final String EXTRA_CUSTOM_TABS_SESSION = "android.support.customtabs.extra.SESSION";

    private static final String CALLBACK_SCHEME = "setnayan";

    @PluginMethod
    public void openAuthSession(PluginCall call) {
        String raw = call.getString("url");
        Uri uri = raw == null ? null : Uri.parse(raw);
        if (uri == null || !"https".equals(uri.getScheme())) {
            call.reject("An https sign-in address is required.", "INVALID");
            return;
        }
        String scheme = call.getString("callbackScheme", CALLBACK_SCHEME);
        if (!CALLBACK_SCHEME.equals(scheme)) {
            call.reject("Unknown return scheme.", "INVALID");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
        Bundle extras = new Bundle();
        extras.putBinder(EXTRA_CUSTOM_TABS_SESSION, null);
        intent.putExtras(extras);
        intent.addCategory(Intent.CATEGORY_BROWSABLE);
        try {
            getActivity().startActivity(intent);
        } catch (ActivityNotFoundException e) {
            call.reject("No browser is available for sign-in.", "FAILED");
            return;
        }
        // The return arrives later through the custom-scheme intent (appUrlOpen),
        // not through this call: resolve with no url so the web waits for it.
        JSObject ret = new JSObject();
        ret.put("opened", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void signInWithApple(PluginCall call) {
        // The web never asks for this on Android (nativeOAuthPlan → system browser).
        call.unimplemented("Sign in with Apple's sheet is iOS-only.");
    }
}
