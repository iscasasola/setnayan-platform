package com.setnayan.app;

import android.os.Bundle;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Offline fallback. The shell normally loads the hosted app
        // (server.url in capacitor.config.ts). When the device is offline or
        // the remote URL is unreachable, show the bundled www/index.html
        // instead of the bare WebView network-error page.
        //
        // We subclass Capacitor's OWN BridgeWebViewClient (not a plain
        // WebViewClient) so the native bridge — Camera / Network / BLE plugin
        // message handling — stays fully intact; we only add error handling.
        //
        // NOTE: compile-verified by the Gradle build; not yet runtime-tested on
        // a device/emulator (no AVD in the build env). Validate the offline →
        // online → retry path on a real device before store submission.
        final WebView webView = this.bridge.getWebView();
        webView.setWebViewClient(new BridgeWebViewClient(this.bridge) {
            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request.isForMainFrame()) {
                    view.loadUrl("file:///android_asset/public/index.html");
                }
            }
        });
    }
}
