package br.poker.assistente;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

/** Tela principal: mostra a parte web (assets/www) e abre a janela flutuante quando pedido. */
public class MainActivity extends Activity {
    private WebView webView;
    private boolean overlayRequested;

    /** Exposto para o JavaScript como window.Android. */
    private class Bridge {
        @JavascriptInterface
        public void openOverlay() {
            runOnUiThread(MainActivity.this::openOverlay);
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        webView.setWebViewClient(new WebViewClient());
        webView.setBackgroundColor(0xFF0A2A20);
        webView.addJavascriptInterface(new Bridge(), "Android");
        setContentView(webView);
        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl("file:///android_asset/www/index.html");
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Voltou da tela de permissão: se foi liberada, abre a janela.
        if (overlayRequested && Settings.canDrawOverlays(this)) {
            overlayRequested = false;
            startOverlay();
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    private void openOverlay() {
        if (Settings.canDrawOverlays(this)) {
            startOverlay();
            return;
        }
        overlayRequested = true;
        Toast.makeText(this, "Ative \"Sobrepor a outros apps\" para o Assistente de Poker", Toast.LENGTH_LONG).show();
        startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getPackageName())));
    }

    private void startOverlay() {
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[] {"android.permission.POST_NOTIFICATIONS"}, 1);
        }
        startForegroundService(new Intent(this, OverlayService.class));
        moveTaskToBack(true);
    }
}
