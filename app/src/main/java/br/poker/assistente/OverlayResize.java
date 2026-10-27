package br.poker.assistente;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.DisplayMetrics;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * Barra na base da janela flutuante para redimensioná-la: arrastar para cima/baixo muda a altura,
 * para os lados muda a largura. O tamanho fica salvo para a próxima vez que a janela abrir.
 */
public final class OverlayResize implements View.OnTouchListener {
    private static final String PREFS = "overlay";

    private final Context context;
    private final View panel;
    private final WindowManager windowManager;
    private final WindowManager.LayoutParams params;
    private float downX, downY;
    private int startW, startH;

    private OverlayResize(Context context, View panel, WindowManager wm, WindowManager.LayoutParams params) {
        this.context = context;
        this.panel = panel;
        this.windowManager = wm;
        this.params = params;
    }

    /** Restaura o tamanho salvo e acrescenta a barra de redimensionar na base do painel. */
    public static void install(Context context, LinearLayout panel, WindowManager wm, WindowManager.LayoutParams params) {
        OverlayResize r = new OverlayResize(context, panel, wm, params);
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        int w = prefs.getInt("width", 0), h = prefs.getInt("height", 0);
        if (w > 0 && h > 0) {
            params.width = w;
            params.height = h;
            r.clampToScreen();
        }

        TextView bar = new TextView(context);
        bar.setText("═══   arraste para ajustar o tamanho   ⇲");
        bar.setTextColor(0xFFA9C4B8);
        bar.setTextSize(11f);
        bar.setGravity(Gravity.CENTER);
        bar.setBackgroundColor(0xFF0F3D2E);
        bar.setOnTouchListener(r);
        panel.addView(bar, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, r.dp(26)));
    }

    @Override
    public boolean onTouch(View v, MotionEvent e) {
        switch (e.getActionMasked()) {
            case MotionEvent.ACTION_DOWN:
                downX = e.getRawX();
                downY = e.getRawY();
                startW = panel.getWidth();
                startH = panel.getHeight();
                v.setBackgroundColor(0xFF1D5C46);
                return true;
            case MotionEvent.ACTION_MOVE:
                params.width = startW + Math.round(e.getRawX() - downX);
                params.height = startH + Math.round(e.getRawY() - downY);
                clampToScreen();
                if (panel.isAttachedToWindow()) windowManager.updateViewLayout(panel, params);
                return true;
            case MotionEvent.ACTION_UP:
            case MotionEvent.ACTION_CANCEL:
                v.setBackgroundColor(0xFF0F3D2E);
                context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                    .putInt("width", params.width).putInt("height", params.height).apply();
                return true;
            default:
                return false;
        }
    }

    private void clampToScreen() {
        DisplayMetrics dm = context.getResources().getDisplayMetrics();
        params.width = clamp(params.width, dp(200), dm.widthPixels - Math.max(0, params.x));
        params.height = clamp(params.height, dp(140), dm.heightPixels - Math.max(0, params.y));
    }

    private static int clamp(int x, int lo, int hi) {
        return Math.max(lo, Math.min(hi, x));
    }

    private int dp(float v) {
        return Math.round(v * context.getResources().getDisplayMetrics().density);
    }
}
