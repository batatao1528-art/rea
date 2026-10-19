# Checklist para publicar na Play Store

## Arquivos prontos
| O quê | Onde |
|---|---|
| App Bundle (o que a Play pede) | `dist/CuidadorCaotico.aab` (assinado com a chave de upload) |
| APK para testar no celular | `dist/CuidadorCaotico.apk` |
| Ícone 512×512 | `store/icon-512.png` |
| Gráfico de recursos 1024×500 | `store/feature-graphic-1024x500.png` |
| Capturas de tela 1080×1920 | `store/screenshots/` |
| Textos da ficha | `store/listing-pt-BR.md` |
| Política de privacidade | `docs/privacy-policy.html` (precisa estar numa URL pública) |

## Antes de enviar
1. **Chave de upload**: o arquivo `keystore/upload-keystore.jks` + `keystore.properties` NÃO estão no git (de propósito).
   Guarde uma cópia segura. Ao criar o app no Play Console, deixe ativado o **Play App Signing**:
   se perder a chave de upload, dá para pedir a troca ao Google.
2. **applicationId** é `com.cuidadorcaotico.game` e **não pode mudar depois do 1º envio**. Se quiser outro
   (ex.: `br.com.seunome.cuidador`), troque em `app/build.gradle` (`applicationId`) **antes** de enviar.
3. **Política de privacidade**: preencha o e-mail em `docs/privacy-policy.html` e publique
   (ex.: GitHub Pages → Settings → Pages → branch/`docs`). Cole a URL no Play Console.
4. Cada novo envio precisa de `versionCode` maior em `app/build.gradle`.

## Formulários do Play Console (jogo infantil)
- **Público-alvo**: marque faixas 3–5 e 6–8 → entra no programa "Feito para a família" (regras mais rígidas).
- **Anúncios**: Não. **Compras no app**: Não.
- **Segurança dos dados**: "Não coleta nem compartilha dados". (O app não tem permissão de internet.)
- **Classificação de conteúdo**: responda o questionário (sem violência, sem interação social) → deve sair Livre.
- **App de notícias / governo / saúde / finanças**: Não.
- Se o app ficar sob "Feito para a família", mantenha-o sem links externos e sem SDKs de terceiros (hoje não há nenhum).

## Contas pessoais novas
Contas pessoais criadas depois de nov/2023 normalmente precisam rodar um **teste fechado com pelo menos 12 testadores
por 14 dias seguidos** antes de pedir produção. Confirme a regra atual no Play Console. Dica: já suba o `.aab` numa
faixa de **Teste fechado** e convide os testadores por e-mail/grupo enquanto o perfil é liberado.

## Gerar novo AAB
```bash
export ANDROID_HOME=/caminho/do/android-sdk
./gradlew bundleRelease     # saída: app/build/outputs/bundle/release/app-release.aab
```
