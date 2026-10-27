# Assistente de Poker ♠

App web para Texas Hold'em que analisa sua mão e diz se vale continuar: **aumentar, pagar, passar ou desistir**.

## Instalar no Android (APK)

1. No celular, abra o arquivo [`apk/assistente-poker.apk`](apk/assistente-poker.apk) aqui no GitHub e toque em **Download** (ou "View raw").
2. Abra o arquivo baixado. O Android vai pedir para **permitir instalar apps desta fonte** (o navegador ou o gerenciador de arquivos): permita.
3. Toque em **Instalar**. Se aparecer o aviso do Play Protect, toque em "Instalar mesmo assim" — é normal para apps que não vêm da Play Store.

O app funciona 100% offline. Requer Android 8.0 ou mais novo.

### Janela flutuante

Toque em **Abrir janela flutuante** (no fim da tela do app). Na primeira vez o Android pede para
ativar **"Sobrepor a outros apps"** para o Assistente de Poker: ative e volte ao app.

- Aparece um **balão** que fica por cima de qualquer app. Arraste para onde quiser.
- Toque no balão para abrir o **painel compacto**; arraste pela barra de título para movê-lo.
- **—** (ou o botão voltar) minimiza de novo para o balão; **✕** fecha. Também dá para fechar pela notificação.

As cartas são marcadas por você: o app **não lê a tela** do jogo. A maioria dos sites de poker
online (PokerStars, GGPoker etc.) proíbe ferramentas de assistência em tempo real durante mãos
valendo dinheiro e pode banir a conta — use em mesas de fichas grátis, contra bots, para treinar ou
para revisar mãos.

### Gerar o APK de novo

```
cd android
./gradlew assembleRelease
# saída: android/app/build/outputs/apk/release/app-release.apk
```

Precisa do JDK 17+ e do Android SDK (`ANDROID_HOME`). O APK é assinado com a chave
`android/app/assistente-poker.keystore`, que fica no repositório para que toda versão nova
instale por cima da anterior. Como a chave é pública, ela serve só para uso pessoal — para
publicar na Play Store, gere uma chave própria e mantenha-a fora do repositório.

Ao fazer push na branch `main`, o GitHub Actions (`.github/workflows/apk.yml`) roda os testes,
compila o APK e publica na release **latest** do repositório.

## Usar no navegador

Abra o `index.html` no navegador. Se o site estiver publicado (por exemplo no GitHub Pages),
o Chrome oferece **"Instalar app"** / "Adicionar à tela inicial" e ele passa a funcionar offline.

## Como usar

1. Toque em duas cartas do baralho para montar **sua mão**.
2. Conforme o jogo anda, adicione as cartas da **mesa** (flop, turn, river).
3. Informe quantos **oponentes** ainda estão na mão, sua **posição**, o **pote** e quanto você precisa **pagar**.

O app mostra na hora:

- **Recomendação** (Aumente / Aposte / Pague / Passe / Desista)
- **Equidade**: sua fatia esperada do pote contra mãos aleatórias (simulação Monte Carlo, 15 mil rodadas)
- **Pot odds**: a equidade mínima para o call ser lucrativo (a marca branca na barra)
- Mão feita atual, **projetos** (flush, sequência) e a chance de terminar com cada tipo de mão
- No pré-flop: força da mão inicial (fórmula de Chen) ajustada pela posição

## Testes

```
node test/poker.test.js
```

## Limitações

- Os oponentes são simulados com mãos aleatórias; jogadores reais que continuam na mão costumam ter mãos melhores que a média.
- A recomendação é um apoio para estudo, não considera leitura de jogo, stack ou tendências dos adversários.
