# 🌻 Vale Florido

Jogo de fazenda em **pixel art** para Android (e navegador), feito em HTML5 Canvas + JavaScript puro
e empacotado com **Capacitor**. Toda a arte (tiles 16x16, personagem 16x24, plantas, ícones) e todo o
som (efeitos e trilha lo-fi de violão/ukulele) são **gerados por código**, então não há arquivos de imagem ou áudio.

## Core loop

```
[ Limpar / Preparar o Solo ] ➡️ [ Plantar & Regar ] ➡️ [ Esperar os dias ]
            ⬆️                                              ⬇️
 [ Melhorar Ferramentas / Expansão ] ⬅️ [ Vender na Caixa de Envio ] ⬅️ [ Colher ]
```

## O que tem no jogo

- **Fazenda**: arar com a enxada, plantar, regar (encha o regador no lago), colher.
  Cada tile arado guarda `tile_x, tile_y, is_tilled, is_watered, crop_type, growth_stage, days_planted`.
- **Plantas** (5 estágios: semente, broto, médio, maduro, seco):
  🥕 Cenoura (3 dias) · 🌽 Milho (4 dias) · 🍅 Tomate (5 dias, produz de novo a cada 3) · 🍓 Morango (6 dias).
  Planta que fica 3 dias sem água seca; no inverno tudo morre.
- **Tempo**: 1 minuto real = 1 hora no jogo. Dormir (ou desmaiar às 02:00) chama o `NextDay()`:
  as plantas regadas crescem, a Caixa de Envio é vendida e a energia é restaurada.
  4 estações de 28 dias, com chuva (que rega tudo) e neve.
- **Energia**: cada ação gasta energia; comer recupera e dormir restaura 100%.
- **Economia**: venda na 📦 Caixa de Envio (pago de noite) e compre na barraca da Dona Rosa:
  sementes, comida e melhorias (enxada de ferro, regador grande, machado e picareta de ferro, mochilas maiores
  e a **expansão da fazenda**).
- **Progressão**: XP por cultivo, pesca e mineração; até o nível 10 (+5 de energia máxima por nível).
- **Pesca** no lago (toque quando aparecer "!") e **mineração** na pedreira (cobre e ferro).
- **Salvamento automático** ao dormir e ao sair do app.

## Controles

| Toque (Android) | Teclado (PC) |
|---|---|
| Arraste no mapa: D-pad dinâmico (aparece onde o dedo toca) | WASD / setas |
| Toque num tile: anda até lá (tap-to-move) | — |
| Toque num tile ao lado: usa o item nele | — |
| Botão grande à direita: ação contextual (arar, regar, colher, dormir…) | Espaço / E |
| Hotbar de 6 espaços + 🎒 mochila | 1–6 / I |
| ⚙️ menu (salvar, som, música, ajuda) | Esc |

## Jogar no navegador

Abra `www/index.html` direto no navegador (não precisa de servidor).

## Gerar o APK

**Automático:** a cada push, o GitHub Actions (`.github/workflows/android.yml`) gera o APK de debug.
Baixe em **Actions → execução mais recente → Artifacts → `vale-florido-apk`**.

**Local** (precisa de Node 20, JDK 17 e Android SDK):

```bash
npm install
npx cap add android
# opcional: paisagem + tela cheia, como no CI
sed -i 's|android:name=".MainActivity"|android:name=".MainActivity" android:screenOrientation="sensorLandscape"|' android/app/src/main/AndroidManifest.xml
cp android-template/MainActivity.java android/app/src/main/java/com/valeflorido/fazenda/MainActivity.java
npx cap sync android
cd android && ./gradlew assembleDebug
```

## Estrutura

```
www/
  index.html        página do jogo e HUD
  style.css         interface (HUD, hotbar, botão de ação, janelas)
  js/sprites.js     arte em pixel art gerada por código (terreno, objetos, plantas, ícones, personagem)
  js/audio.js       efeitos sonoros e trilha sintetizados (Web Audio)
  js/game.js        mapa, fazenda, tempo/dias, jogador, ações, pesca, renderização e controles
  js/ui.js          HUD, loja, caixa de envio, mochila, menus
android-template/   MainActivity com tela cheia imersiva
capacitor.config.json, package.json
```
