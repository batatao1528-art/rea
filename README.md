# 🚗💥 Caos do Trânsito: Manobrista de Respeito

Jogo arcade 2D (visão de cima) feito em HTML5 Canvas. Você é o manobrista de uma festa na marina:
estacione os carros na vaga verde antes do tempo acabar, **sem destruir nada**.

- **Controles:** volante na tela (arraste para girar) + pedais *Freio/Ré* e *Acelera*. Teclado: setas ou WASD.
- **Física de derrapagem:** o carro escorrega e bate nos outros de forma desastrosa.
- **Veículos esquisitos:** moto, Kombi cheia de bagagem, van, limusine de luxo (R$ 150 mil!) e caminhão de mudança que mal cabe.
- **Efeito "Quase Deu":** cada batida gera prejuízo em R$. Passou do limite do nível? *Você está demitido!* 
- Botão de **compartilhar** o prejuízo no fim do nível (gancho viral).

## Testar no navegador
```bash
npm run serve   # abre http://localhost:8080
```
(ou apenas abra `www/index.html`).

## Publicar na Play Store (Capacitor)
Pré-requisitos: Node 18+, Android Studio (SDK + JDK 17).

```bash
npm install
npx cap add android
npm run assets            # gera ícones a partir de resources/icon.png (1024x1024)
npx cap sync android
npx cap open android      # abre no Android Studio
```

Antes de gerar o pacote:
1. Em `android/app/src/main/AndroidManifest.xml`, na tag `<activity>`, adicione
   `android:screenOrientation="portrait"`.
2. Em `android/app/build.gradle` ajuste `versionCode` / `versionName` a cada envio.
3. No Android Studio: **Build ▸ Generate Signed Bundle / APK ▸ Android App Bundle (.aab)**,
   crie e **guarde com segurança** sua keystore.
4. Envie o `.aab` no [Google Play Console](https://play.google.com/console).

### Checklist da loja
- Ícone 512×512: `resources/icon.png` (redimensione para 512).
- Imagem de destaque 1024×500 e prints (tire do jogo rodando).
- Política de privacidade: o jogo não coleta dados e não usa internet (só salva progresso local).
- Classificação indicativa: sem violência real, sem anúncios, sem compras.
- `appId`: `br.com.caosdotransito.manobrista` (em `capacitor.config.json`; troque se quiser, não muda depois de publicado).
