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
- **Plantas por estação** (5 estágios: semente, broto, médio, maduro, seco):
  🌸 Primavera: Cenoura, Morango, Girassol · ☀️ Verão: Milho, Tomate, Melancia, Girassol ·
  🍂 Outono: Cenoura, Milho, Tomate, Abóbora. Planta 3 dias sem água seca; fora da estação, morre na virada.
- **Qualidade ★**: colheitas, peixes, ovos e leite podem sair prata (+25%) ou ouro (+50%).
- **Aspersores** 💦: fabricados com cobre/ferro e pedra, regam sozinhos toda manhã (3x3 ou 5x5).
- **Animais** 🐔🐄: construa Galinheiro e Estábulo, compre galinhas e vacas, alimente com feno,
  faça carinho e colete ovos e leite todo dia (mais amizade = mais qualidade).
- **Quadro de Pedidos** 📋: os vizinhos pedem itens com prazo; entregue para ganhar ouro e amizade.
- **Cozinha** 🍳: fogão na casa com 6 receitas (salada, omelete, peixe assado, pamonha, sopa de abóbora, bolo de morango).
- **Moradores** 💬: Dona Rosa (loja), Seu Zé (pescador, vende isca e compra peixe) e Tião (ferreiro, vende aspersores e
  compra minério). Converse e dê presentes: com corações eles dão presentes e 10% de desconto.
- **Decoração** 🔨: fabrique cercas, caminhos de pedra, canteiros de flores e lampiões (que iluminam a noite).
- **Conquistas e diário** 🏆: 18 conquistas, estatísticas e amizades.
- **Festivais** 🎪 todo dia 14: Festa das Flores, Festival da Pesca, Feira da Colheita e Noite das Lanternas.
- **Tempo**: 1 minuto real = 1 hora no jogo. Dormir (ou desmaiar às 02:00) chama o `NextDay()`.
  4 estações de 28 dias, com chuva (que rega tudo) e neve.
- **Energia**: cada ação gasta energia; comer recupera e dormir restaura 100%.
- **Economia e melhorias**: Caixa de Envio (paga de noite), ferramentas de ferro, mochilas e expansão da fazenda.
- **Progressão**: XP por cultivo, pesca e mineração; até o nível 10.
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
  js/data.js        conteúdo: plantas, itens, receitas, moradores, conquistas e festivais
  js/sprites.js     arte em pixel art gerada por código (terreno, objetos, plantas, ícones, personagens, animais)
  js/audio.js       efeitos sonoros e trilha sintetizados (Web Audio)
  js/game.js        mapa, fazenda, tempo/dias, jogador, ações, animais, pedidos, festivais, renderização e controles
  js/ui.js          HUD e janelas (lojas, moradores, animais, pedidos, fogão, fabricação, conquistas)
android-template/   MainActivity com tela cheia imersiva
capacitor.config.json, package.json
```
