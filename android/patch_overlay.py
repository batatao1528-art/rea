"""Liga o OverlayResize ao OverlayService (smali do APK original).

Uso: python3 -I patch_overlay.py OverlayService.smali
Insere a chamada logo depois de o painel receber a posição inicial (panelParams.y), antes do arrasto.
"""
import sys

path = sys.argv[1]
src = open(path, encoding='utf-8').read()
anchor = 'iput v1, v0, Landroid/view/WindowManager$LayoutParams;->y:I\n'
marker = 'Lbr/poker/assistente/OverlayResize;->install'
if marker not in src:
    start = src.index('.method private createPanel()V')
    at = src.index(anchor, start) + len(anchor)
    call = (
        '\n    iget-object v1, p0, Lbr/poker/assistente/OverlayService;->panel:Lbr/poker/assistente/OverlayService$PanelLayout;\n'
        '    iget-object v2, p0, Lbr/poker/assistente/OverlayService;->windowManager:Landroid/view/WindowManager;\n'
        '    invoke-static {p0, v1, v2, v0}, ' + marker +
        '(Landroid/content/Context;Landroid/widget/LinearLayout;Landroid/view/WindowManager;Landroid/view/WindowManager$LayoutParams;)V\n'
    )
    src = src[:at] + call + src[at:]
    open(path, 'w', encoding='utf-8').write(src)
