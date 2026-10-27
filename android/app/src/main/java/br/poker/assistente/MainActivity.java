package br.poker.assistente;

import android.Manifest;
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

// Tela única que roda o app web empacotado nos assets, totalmente offline.
public class MainActivity extends Activity {
    private WebView webView;
    // Usuário pediu a janela flutuante, mas ainda precisava liberar a permissão nas configurações.
    private boolean overlayRequested;

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
        startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:" + getPackageName())));
    }

    private void startOverlay() {
        // Sem esta permissão a janela funciona igual; só a notificação com o botão "Fechar" fica oculta.
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[] { Manifest.permission.POST_NOTIFICATIONS }, 1);
        }
        startForegroundService(new Intent(this, OverlayService.class));
        // Volta para o app anterior (o jogo) com a janela flutuante por cima.
        moveTaskToBack(true);
    }

    private class Bridge {
        @JavascriptInterface
        public void openOverlay() {
            runOnUiThread(MainActivity.this::openOverlay);
        }
    }
}
