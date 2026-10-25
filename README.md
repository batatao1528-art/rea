# ATRASADO! 🏃‍♂️🚌

Jogo mobile hyper-casual de **um toque**: o Zé está atrasado, de pijama e gravata, correndo atrás do ônibus. Toque para trocar de calçada e desviar do caos da cidade. Troque no último instante para um **"POR UM TRIZ!"**.

- 📄 **Game Design Document completo:** [`docs/GDD.md`](docs/GDD.md)
- 💻 **Protótipo (Unity C#):** [`Unity/Assets/Scripts`](Unity/Assets/Scripts)
- 📱 **APK jogável (Android 7+):** [`dist/atrasado-1.2.apk`](dist/atrasado-1.2.apk)
- 🌐 **Versão HTML5 (mesmas mecânicas):** [`web/index.html`](web/index.html) — abra no navegador do celular

## Testar no celular

Baixe `dist/atrasado-1.2.apk` no Android, toque para instalar e permita "instalar apps desconhecidos" quando pedir (é um build de teste, assinado com chave de debug).

## Gerar o APK de novo

O APK é uma casca nativa mínima (WebView em tela cheia, retrato, offline) em volta de `web/index.html`:

```bash
cd android
echo "sdk.dir=$ANDROID_HOME" > local.properties
gradle assembleDebug   # → app/build/outputs/apk/debug/app-debug.apk
```

## Montar a cena de protótipo em 5 minutos (Unity 2021.3+ com TextMeshPro)

1. Copie a pasta `Unity/Assets/Scripts` para o `Assets/` do seu projeto.
2. **GameManager:** GameObject vazio com `GameManager`.
3. **Jogador (Zé):** cápsula em `(1.6, 0, 0)` com:
   - tag `Player`, `CapsuleCollider` com **Is Trigger** (~15% menor que o modelo), `Rigidbody` com **Is Kinematic**;
   - `PlayerLaneSwitcher` (arraste o filho visual em *Visual*) e `NearMissDetector`.
4. **Obstáculos:** prefabs simples (cubo coral `#FF4F5A`) com `BoxCollider` **Is Trigger** e `Obstacle`. Ajuste *Length* para o tamanho em Z. Para o patinete, *Own Speed* = 6.
5. **Spawner:** GameObject vazio com `ObstacleSpawner`; ligue os prefabs em *Types*, o jogador em *Player*. Dica: patinete com *Min Difficulty* = 0.3.
6. Ligue o spawner no campo *Spawner* do `NearMissDetector`.
7. **Câmera:** atrás e acima do jogador, ex.: posição `(0, 6, -8)`, rotação `(25, 0, 0)`, tela em retrato.
8. **UI:** Canvas + EventSystem com `HUD` e os textos/painéis; ligue o botão "Continuar" em `HUD.OnContinuePressed`.

Dê Play: toque (ou clique / barra de espaço) para começar e para trocar de calçada.

## Como o gerador é justo

Quando o próximo obstáculo está na calçada oposta, o espaço livre entre os dois é sempre de, no mínimo:

```
velocidade_prevista × (tempo_de_reação + tempo_de_troca) + profundidade_do_jogador
```

As duas calçadas nunca são bloqueadas ao mesmo tempo. Se o jogador perde, a culpa é dele: *"nossa, errei por um milissegundo!"*.
