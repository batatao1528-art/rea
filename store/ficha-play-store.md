# ATRASADO! — Kit de publicação na Google Play

## Arquivos

| O quê | Arquivo | Onde usar no Play Console |
|---|---|---|
| Pacote do app (envio) | `dist/atrasado-1.1.0.aab` | Teste / Produção → Criar versão |
| APK assinado (só para testar no seu celular) | `dist/atrasado-1.1.0.apk` | — |
| Gráfico de destaque e capturas **em inglês** | `store/en/feature-1024x500.png`, `store/en/screenshots/*.png` | Ficha em inglês (veja abaixo) |
| Ícone 512×512 | `store/icone-512.png` | Presença na loja → Ficha principal |
| Gráfico de destaque 1024×500 | `store/destaque-1024x500.png` | Ficha principal |
| Capturas de tela (1080×1920) | `store/screenshots/*.png` | Ficha principal → Smartphone |
| Política de privacidade | `store/politica-de-privacidade.html` | Precisa estar num link público (veja abaixo) |

Dados técnicos: pacote `com.atrasado.game` · versão 1.1.0 (código 10) · Android 7.0+ (API 24) · target API 36 (Android 16) · sem anúncios, sem compras, sem internet.

> ⚠️ O nome do pacote (`com.atrasado.game`) **não pode ser mudado depois de publicado**. Se esse nome já estiver em uso na Play, troque `applicationId` em `android/app/build.gradle` (ex.: `com.seunome.atrasado`) e gere o `.aab` de novo.

---

## Textos da ficha (pt-BR)

**Nome do app** (máx. 30): `ATRASADO! Corre pro Busão`

**Descrição curta** (máx. 80):
`Um toque pra trocar de calçada. O busão chega pertinho... e foge. Sempre! 🚌`

**Descrição completa:**

```
Você tá ATRASADO. De pijama, gravata torta e café na mão. E o busão tá indo embora.

UM TOQUE SÓ: toque em qualquer lugar da tela pra trocar de calçada e desviar do caos da cidade — vovó com carrinho de feira, cachorro salsicha, bueiro aberto, pilha de encomendas e patinete elétrico na contramão.

POR UM TRIZ! Troque de calçada no último segundo pra ganhar câmera lenta, combo e muito mais pontos. Quanto mais ousado, mais perto o busão chega...

O BUSÃO NUNCA ESPERA. Ele chega pertinho, acende a luz de freio, você acha que vai dar... e ele arranca. Sempre. Até onde você consegue chegar?

🏙️ Corra pelo Centro, 🏖️ pela orla da praia no calçadão de peixinhos, 🌉 atravesse a ponte e chegue até a 🌾 estrada do interior.
🌅 Dia, pôr do sol e noite mudam enquanto você corre.
👕 Desbloqueie skins: Zé Pescador, Dino, Astronauta, Executivo, Carnaval e o lendário Zé Dourado.
🎯 Missões que renovam e vales pra gastar na loja.
📤 Compartilhe quanto faltou pro busão e desafie os amigos.

Sem cadastro. Sem internet. Sem anúncios. Só você, um toque e o busão que nunca para.
```

**Categoria:** Jogos → Casual (alternativa: Arcade)
**Tags sugeridas:** Casual, Arcade, Corrida infinita, Um toque, Offline

---

## Store listing (English — United States)

O jogo detecta o idioma do celular: português para quem usa o aparelho em português, inglês para todo o resto (dá pra trocar no botão PT/EN do menu). O nome do app no celular também muda: **ATRASADO!** em português, **Running Late!** nos demais idiomas.

No Play Console: *Presença na loja → Ficha principal da loja → Gerenciar traduções → Adicionar suas próprias traduções → Inglês (Estados Unidos)*. Cole os textos abaixo e, ainda na ficha em inglês, envie `store/en/feature-1024x500.png` e as capturas de `store/en/screenshots/` (o ícone pode ser o mesmo).

**App name** (max 30): `Running Late! Catch the Bus`

**Short description** (max 80):
`One tap to switch sidewalks. The bus gets so close... then leaves. Always! 🚌`

**Full description:**

```
You're RUNNING LATE. In pajamas, crooked tie, coffee in hand. And the bus is pulling away.

ONE TAP: tap anywhere to switch sidewalks and dodge the chaos of the city — grandma and her shopping cart, a wiener dog, open manholes, piles of deliveries and e-scooters coming the wrong way.

NEAR MISS! Switch at the very last second for slow motion, combos and way more points. The bolder you play, the closer the bus gets...

THE BUS NEVER WAITS. It gets sooo close, the brake lights come on, you think you've made it... and it drives off. Every. Single. Time. How far can you go?

🏙️ Run through Downtown, 🏖️ along the beachfront on a fish-tile promenade, 🌉 across the bridge, all the way to the 🌾 country road.
🌅 Day, sunset and night change as you run.
👕 Unlock outfits: Fisherman Zé, Dino, Astronaut, Executive, Carnival and the legendary Golden Zé.
🎯 Rotating missions and tickets to spend in the shop.
📤 Share how close you got to the bus and challenge your friends.

No sign-up. No internet. No ads. Just you, one tap and a bus that never stops.
```

---

## Respostas dos formulários do Play Console

**Acesso ao app:** Todas as funcionalidades disponíveis sem restrições (sem login).

**Anúncios:** Não, o app não contém anúncios.

**Segurança dos dados (Data safety):**
- O app coleta ou compartilha algum dos tipos de dados obrigatórios? **Não.**
- (O recorde, os vales e as skins ficam salvos só no próprio celular. O botão "Compartilhar" abre o menu do Android e é o usuário quem escolhe para onde mandar — o app não envia nada.)

**Classificação do conteúdo (questionário IARC):** categoria Jogo. Responda **Não** para violência realista, sangue, sexo, linguagem imprópria, drogas, apostas, interação entre usuários, compartilhamento de localização e compras digitais. Há só humor pastelão de desenho (o personagem tropeça e cai). Resultado esperado: **Livre / PEGI 3**.

**Público-alvo:** recomendo **13 anos ou mais** nesta primeira versão — é o caminho mais simples. Se quiser incluir crianças (menores de 13), o app entra no programa "Famílias" da Google, que exige seguir regras extras (o app já cumpre a maioria: não coleta dados e não tem anúncios), e a revisão costuma demorar mais.

**Recursos financeiros, saúde, app governamental, notícias:** Não.

---

## Passo a passo

1. **Conta de desenvolvedor:** https://play.google.com/console — taxa única de **US$ 25** e verificação de identidade (documento).
2. **Publique a política de privacidade** num link público. Opções grátis:
   - Google Sites: crie uma página e cole o texto de `store/politica-de-privacidade.html`;
   - GitHub Pages, se o repositório for público.
   Antes de publicar, troque `[SEU E-MAIL DE CONTATO]` pelo seu e-mail.
3. **Criar app** → nome "ATRASADO! Corre pro Busão", idioma Português (Brasil), Jogo, Gratuito.
4. Preencha **Ficha principal** (textos e imagens acima) e todos os formulários de **Conteúdo do app** (acima).
5. **Assinatura:** aceite o *Play App Signing* (a Google guarda a chave final; a sua `atrasado-upload.jks` é só a chave de upload).
6. **Teste fechado obrigatório (contas pessoais novas):** a Google exige um teste fechado com **pelo menos 12 testadores por 14 dias seguidos** antes de liberar a produção. Crie uma lista de e-mails (amigos/família), envie o `.aab` em *Teste → Teste fechado* e peça para cada um instalar pelo link de convite e manter o app instalado.
7. Depois dos 14 dias, peça acesso à **Produção**, envie o mesmo `.aab` (ou um novo com `versionCode` maior) e mande para revisão. A primeira revisão costuma levar de alguns dias até ~1 semana.

## Atualizações futuras

1. Aumente `versionCode` (e `versionName`) em `android/app/build.gradle`.
2. Com `android/keystore.properties` e `android/atrasado-upload.jks` no lugar:
   ```bash
   cd android && gradle bundleRelease
   # → app/build/outputs/bundle/release/app-release.aab
   ```

## 🔐 A chave de upload

- Arquivo: `atrasado-upload.jks` (alias `upload`). **Não está no git** — guarde-a em dois lugares seguros (ex.: Google Drive + pendrive) junto com a senha.
- Se perder, não é o fim do mundo com o Play App Signing: dá para pedir ao suporte da Google a troca da chave de upload, mas leva alguns dias.

## Para monetizar depois

O jogo já tem os ganchos prontos: o botão "Continuar" (`revive()` em `web/index.html`) e o antigo "vales x2" podem virar anúncios recompensados com o AdMob. Ao adicionar anúncios, atualize as respostas de **Anúncios** e **Segurança dos dados** no Play Console.
