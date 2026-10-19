# O Cuidador Caótico 🐶🧼

Pet virtual casual para crianças de 3 a 6 anos: o bichinho (capivara, cachorrinho ou dino) se
enfiou numa enrascada e fica sujo, arranhado e cheio de folhas. A criança usa ferramentas simples
para deixá-lo limpinho, e no final vê o **Antes e Depois**.

## Como jogar
1. **Esponja** – esfregue a lama/tinta/gosma (vira espuma).
2. **Chuveiro** – enxágue a espuma (cuidado com o espirro: *ATCHIM!*).
3. **Curativo** – toque nos arranhões. Toque nas folhas para puxá-las.
4. **Secador** – seque o pelo (ele fica todo arrepiado e as orelhas voam).
5. **Carinho** – faça cócegas, hora de risada e corações.

Ao terminar, o botão 👀 mostra o **Antes e Depois** com um slider (ótimo para gravar vídeos curtos).

## Estrutura
- `app/src/main/assets/www/` – o jogo (HTML5 Canvas, sem dependências, sem imagens externas, sons sintetizados).
- `app/src/main/java/.../MainActivity.java` – casca Android (WebView em tela cheia, sem permissão de internet).
- Minijogos por bichinho: **Skate** (toque para pular obstáculos e pegar estrelas) e **Voo** (estilo Flappy, com hélice na cabeça).
- `dist/CuidadorCaotico.apk` – APK pronto para instalar (assinado com chave de debug, para testes).

## Gerar o APK
```bash
export ANDROID_HOME=/caminho/do/android-sdk   # platform 34 + build-tools 34
./gradlew assembleRelease
# saída: app/build/outputs/apk/release/app-release.apk
```

Para testar no navegador do computador, abra `app/src/main/assets/www/index.html`.
