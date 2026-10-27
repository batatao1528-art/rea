package br.poker.assistente;

import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.IBinder;
import android.util.DisplayMetrics;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewConfiguration;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

// Janela flutuante por cima de outros apps: um balão arrastável que, ao ser tocado,
// abre um painel compacto (também arrastável) com o assistente.
public class OverlayService extends Service {
    private static final String CHANNEL_ID = "overlay";
    private static final String ACTION_STOP = "br.poker.assistente.STOP";
    private static final int NOTIFICATION_ID = 1;

    private WindowManager windowManager;
    private View bubble;
    private PanelLayout panel;
    private WebView webView;
    private WindowManager.LayoutParams bubbleParams;
    private WindowManager.LayoutParams panelParams;
    private boolean expanded;

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopSelf();
            return START_NOT_STICKY;
        }
        startInForeground();
        if (windowManager == null) {
            windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
            createBubble();
            createPanel();
            windowManager.addView(bubble, bubbleParams);
        }
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        if (windowManager != null) {
            if (bubble.isAttachedToWindow()) windowManager.removeView(bubble);
            if (panel.isAttachedToWindow()) windowManager.removeView(panel);
            webView.destroy();
        }
        super.onDestroy();
    }

    private void startInForeground() {
        NotificationManager nm = getSystemService(NotificationManager.class);
        nm.createNotificationChannel(new NotificationChannel(
                CHANNEL_ID, "Janela flutuante", NotificationManager.IMPORTANCE_LOW));

        PendingIntent stop = PendingIntent.getService(this, 0,
                new Intent(this, OverlayService.class).setAction(ACTION_STOP), PendingIntent.FLAG_IMMUTABLE);
        PendingIntent open = PendingIntent.getActivity(this, 0,
                new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE);

        Notification notification = new Notification.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle("Assistente de Poker")
                .setContentText("Janela flutuante ativa")
                .setContentIntent(open)
                .addAction(new Notification.Action.Builder(null, "Fechar", stop).build())
                .setOngoing(true)
                .build();

        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private void createBubble() {
        int size = dp(56);
        FrameLayout view = new FrameLayout(this);
        GradientDrawable circle = new GradientDrawable();
        circle.setShape(GradientDrawable.OVAL);
        circle.setColor(0xFF0F3D2E);
        circle.setStroke(dp(2), 0xFFF4C542);
        view.setBackground(circle);
        view.setElevation(dp(6));

        ImageView icon = new ImageView(this);
        icon.setImageResource(R.drawable.ic_launcher_foreground);
        view.addView(icon, new FrameLayout.LayoutParams(size, size));

        bubbleParams = overlayParams(size, size, true);
        bubbleParams.x = dp(8);
        bubbleParams.y = dp(160);
        bubble = view;
        bubble.setOnTouchListener(new DragListener(bubble, bubbleParams, this::expand));
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void createPanel() {
        DisplayMetrics dm = getResources().getDisplayMetrics();
        int width = Math.min(dm.widthPixels - dp(16), dp(360));
        int height = Math.min((int) (dm.heightPixels * 0.7f), dp(560));

        panel = new PanelLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(0xFF0A2A20);
        bg.setCornerRadius(dp(12));
        bg.setStroke(dp(1), 0xFF2E6B55);
        panel.setBackground(bg);
        panel.setClipToOutline(true);
        panel.setElevation(dp(8));

        // Barra de título: arraste por aqui para mover o painel.
        LinearLayout header = new LinearLayout(this);
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setBackgroundColor(0xFF0F3D2E);
        header.setPadding(dp(12), 0, dp(4), 0);

        TextView title = new TextView(this);
        title.setText("♠ Assistente  ⠿ arraste");
        title.setTextColor(0xFFF1F5F2);
        title.setTextSize(14);
        header.addView(title, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1));
        title.setGravity(Gravity.CENTER_VERTICAL);
        header.addView(headerButton("—", v -> collapse()));
        header.addView(headerButton("✕", v -> stopSelf()));
        panel.addView(header, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(40)));

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        webView.setWebViewClient(new WebViewClient());
        webView.setBackgroundColor(0xFF0A2A20);
        webView.loadUrl("file:///android_asset/www/index.html?compact");
        panel.addView(webView, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1));

        panelParams = overlayParams(width, height, false);
        panelParams.x = (dm.widthPixels - width) / 2;
        panelParams.y = dp(80);
        header.setOnTouchListener(new DragListener(panel, panelParams, null));
    }

    private TextView headerButton(String label, View.OnClickListener onClick) {
        TextView b = new TextView(this);
        b.setText(label);
        b.setTextColor(0xFFF1F5F2);
        b.setTextSize(18);
        b.setGravity(Gravity.CENTER);
        b.setOnClickListener(onClick);
        b.setLayoutParams(new LinearLayout.LayoutParams(dp(40), LinearLayout.LayoutParams.MATCH_PARENT));
        return b;
    }

    private void expand() {
        if (expanded) return;
        expanded = true;
        windowManager.removeView(bubble);
        windowManager.addView(panel, panelParams);
    }

    private void collapse() {
        if (!expanded) return;
        expanded = false;
        windowManager.removeView(panel);
        windowManager.addView(bubble, bubbleParams);
    }

    private WindowManager.LayoutParams overlayParams(int width, int height, boolean bubble) {
        int flags = WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
                | WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH;
        // O balão nunca pega o teclado; o painel só pega quando você toca nele (ver PanelLayout).
        flags |= WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE;
        WindowManager.LayoutParams p = new WindowManager.LayoutParams(width, height,
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY, flags, PixelFormat.TRANSLUCENT);
        p.gravity = Gravity.TOP | Gravity.START;
        if (!bubble) p.softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_PAN;
        return p;
    }

    private int dp(float v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    // Painel que só "rouba" o teclado enquanto está sendo usado: tocar nele permite digitar
    // pote/aposta; tocar fora devolve o teclado e o botão voltar para o jogo.
    private class PanelLayout extends LinearLayout {
        PanelLayout(Context context) {
            super(context);
        }

        @Override
        public boolean dispatchTouchEvent(MotionEvent ev) {
            if (ev.getAction() == MotionEvent.ACTION_OUTSIDE) {
                setWindowFocusable(false);
                return true;
            }
            if (ev.getAction() == MotionEvent.ACTION_DOWN) setWindowFocusable(true);
            return super.dispatchTouchEvent(ev);
        }

        @Override
        public boolean dispatchKeyEvent(KeyEvent event) {
            if (event.getKeyCode() == KeyEvent.KEYCODE_BACK) {
                if (event.getAction() == KeyEvent.ACTION_UP) collapse();
                return true;
            }
            return super.dispatchKeyEvent(event);
        }

        private void setWindowFocusable(boolean focusable) {
            int flags = panelParams.flags;
            if (focusable) flags &= ~WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE;
            else flags |= WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE;
            if (flags != panelParams.flags && isAttachedToWindow()) {
                panelParams.flags = flags;
                windowManager.updateViewLayout(this, panelParams);
            }
        }
    }

    // Arrasta uma janela flutuante; um toque curto sem arrastar conta como clique.
    private class DragListener implements View.OnTouchListener {
        private final View window;
        private final WindowManager.LayoutParams params;
        private final Runnable onTap;
        private final int touchSlop;
        private int startX, startY;
        private float downX, downY;
        private boolean dragging;

        DragListener(View window, WindowManager.LayoutParams params, Runnable onTap) {
            this.window = window;
            this.params = params;
            this.onTap = onTap;
            this.touchSlop = ViewConfiguration.get(OverlayService.this).getScaledTouchSlop();
        }

        @SuppressLint("ClickableViewAccessibility")
        @Override
        public boolean onTouch(View v, MotionEvent e) {
            switch (e.getActionMasked()) {
                case MotionEvent.ACTION_DOWN:
                    startX = params.x;
                    startY = params.y;
                    downX = e.getRawX();
                    downY = e.getRawY();
                    dragging = false;
                    return true;
                case MotionEvent.ACTION_MOVE:
                    float dx = e.getRawX() - downX, dy = e.getRawY() - downY;
                    if (!dragging && Math.hypot(dx, dy) > touchSlop) dragging = true;
                    if (dragging) {
                        DisplayMetrics dm = getResources().getDisplayMetrics();
                        params.x = clamp(startX + (int) dx, -window.getWidth() / 2, dm.widthPixels - window.getWidth() / 2);
                        params.y = clamp(startY + (int) dy, 0, dm.heightPixels - dp(40));
                        windowManager.updateViewLayout(window, params);
                    }
                    return true;
                case MotionEvent.ACTION_UP:
                    if (!dragging && onTap != null) onTap.run();
                    return true;
                default:
                    return false;
            }
        }
    }

    private static int clamp(int v, int lo, int hi) {
        return Math.max(lo, Math.min(hi, v));
    }
}
