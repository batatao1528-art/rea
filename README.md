# Assistente de Poker

App Android (WebView) com duas calculadoras:

- **Poker** (Texas Hold'em): equidade por simulação e recomendação de jogada.
- **21** (blackjack): estratégia básica — pedir carta, parar, dobrar, dividir ou desistir — com chance de estourar e de ganhar se parar.

A parte web fica em `www/` (é o que vai em `assets/www` do APK).

## Testes

    node tests/blackjack.test.js

## Gerar o APK

    tools/build-apk.sh caminho/do/assistente-poker-original.apk

Troca o `assets/www` do APK original pelo `www/` daqui, acrescenta o código nativo de `android/`
(barra para redimensionar a janela flutuante, ligada ao `OverlayService` original por `android/patch_overlay.py`)
e assina de novo. Precisa de Java, Node e Python; as ferramentas Android são baixadas para `build/cache`. O APK sai em `build/`.
A chave de assinatura fica em `~/.android/assistente.p12` (criada na primeira vez); use sempre a mesma
para conseguir atualizar o app sem desinstalar.
