# Assistente de Poker

App Android com duas calculadoras, que também abre numa janela flutuante sobre outros apps:

- **Poker** (Texas Hold'em): equidade por simulação e recomendação de jogada.
- **21** (blackjack): estratégia básica — pedir carta, parar, dobrar, dividir ou desistir.

## Estrutura

| Caminho | O que é |
|---|---|
| `app/src/main/assets/www/` | A interface e a lógica (HTML, CSS, JS). Dá para abrir o `index.html` direto no navegador para testar. |
| `app/src/main/assets/www/js/poker.js`, `blackjack.js` | Lógica do poker e do 21. |
| `app/src/main/java/br/poker/assistente/MainActivity.java` | Tela principal (WebView que mostra o `www/`). |
| `app/src/main/java/br/poker/assistente/OverlayService.java` | Janela flutuante (bolha + painel arrastável). |
| `app/src/main/java/br/poker/assistente/OverlayResize.java` | Barra que redimensiona a janela flutuante. |
| `app/src/main/res/` | Ícones, cores, nome do app. |
| `tests/` | Testes da lógica (`node tests/blackjack.test.js`). |

## Compilar

Abra a pasta no **Android Studio** e use *Build > Build APK(s)*, ou pela linha de comando:

    ./gradlew assembleRelease

O APK sai em `app/build/outputs/apk/release/app-release.apk`.

### Assinatura

Para instalar uma versão nova por cima da antiga, o APK tem que ser assinado com a **mesma chave**.
Coloque o arquivo da chave (`assistente.p12`) na raiz do projeto e crie `keystore.properties`
(os dois ficam fora do git):

    storeFile=assistente.p12
    storePassword=android
    keyAlias=assistente
    keyPassword=android

Sem esse arquivo o release é assinado com a chave de debug do seu computador, e aí é preciso
desinstalar o app antes de instalar.

A cada versão nova, aumente `versionCode` em `app/build.gradle`.
