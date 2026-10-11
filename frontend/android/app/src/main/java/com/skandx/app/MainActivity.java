package com.skandx.app;

import android.os.Bundle;
import android.view.KeyEvent;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                dispatchHardwareBackToWebView();
            }
        });
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && event.getRepeatCount() == 0) {
            dispatchHardwareBackToWebView();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    private void dispatchHardwareBackToWebView() {
        if (bridge != null && bridge.getWebView() != null) {
            final WebView webView = bridge.getWebView();
            webView.evaluateJavascript(
                "(function() {" +
                "  try {" +
                "    if (typeof window.__skandxHandleHardwareBack === 'function') {" +
                "      return window.__skandxHandleHardwareBack();" +
                "    }" +
                "  } catch (e) {}" +
                "  return 'FALLBACK';" +
                "})()",
                value -> {
                    if (value != null && value.contains("EXIT_APP")) {
                        moveTaskToBack(true);
                    } else if (value == null || value.contains("FALLBACK")) {
                        if (webView.canGoBack()) {
                            webView.goBack();
                        } else {
                            moveTaskToBack(true);
                        }
                    }
                }
            );
        } else {
            moveTaskToBack(true);
        }
    }
}
