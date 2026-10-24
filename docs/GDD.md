# ATRASADO! 🏃‍♂️💨🚌
### Game Design Document — Hyper-Casual One-Touch

> **Pitch em uma frase:** Você está atrasado para o trabalho, de pijama e gravata, com um café quente na mão — e o ônibus está indo embora. Toque para trocar de calçada e desviar do caos da cidade.

---

## 1. Conceito e Premissa

**Tema universal:** todo mundo, em qualquer país, já correu atrás de um ônibus/metrô. É identificação instantânea, engraçada e sem barreira de idioma.

**Protagonista:** "Zé" — um boneco cabeçudo, de pijama listrado, gravata torta, chinelo, cabelo em pé e um copo de café que nunca derrama (até ele morrer — aí derrama em câmera lenta).

**Objetivo visível:** o ônibus está **sempre na tela, lá na frente**. Você nunca sabe se vai alcançar. Cada metro corrido diminui a distância. A tela de derrota diz: **"Faltaram 12m pro busão!"** — o "quase" é o produto.

**Cenário:** uma rua reta e infinita, com duas calçadas (esquerda/direita). O caos cotidiano vem na sua direção:

| Obstáculo | Comportamento | Morte engraçada |
|---|---|---|
| 🛒 Vovó com carrinho de feira | parada | Zé capota por cima, vovó dá bengalada |
| 🐕 Cachorro salsicha | parado, late antes (aviso sonoro) | Zé tropeça na coleira e roda 3x |
| 🕳️ Bueiro aberto | buraco | Zé cai, só a gravata fica pra fora |
| 🛴 Patinete elétrico | **vem na sua direção** (mais rápido) | Zé vira "panqueca" com marca de pneu |
| 📦 Entregador com caixas | ocupa a calçada, aparece de uma porta | Avalanche de caixas |
| 🐦 Pombo | rasante (evento raro, só visual + susto) | — |

---

## 2. Mecânica Principal (Core Loop)

### Input: **1 toque = troca de calçada.** Só isso.

- Zé corre sozinho para frente; a velocidade aumenta com o tempo.
- Cada toque em **qualquer lugar da tela** faz Zé dar um "pulinho lateral" rápido (0,12s) para a outra calçada.
- Não existe segurar, deslizar ou duplo toque. Um bebê entende; um adulto vicia.

### Por que isso gera tensão?

**O sistema "POR UM TRIZ!" (Near-Miss)** transforma um input binário em uma decisão de risco:

- Trocar de calçada **cedo** = seguro, pontuação normal.
- Trocar **no último instante** (obstáculo a menos de ~1,5m) = **"POR UM TRIZ!"**, câmera lenta de 0,3s, som de "fiuuu", multiplicador de combo **x2, x3, x4...**
- Errar o tempo = morte imediata.

Então o jogador **escolhe** esperar até o último milissegundo. Tensão voluntária = diversão. É o mesmo motivo de Flappy Bird funcionar: precisão pura, mas aqui com recompensa por ousadia.

### Core loop (ciclo de 30–90 segundos)

```
TOQUE PRA COMEÇAR → corre → desvia → "POR UM TRIZ!" (combo) → acelera
      ↑                                                          ↓
   "SÓ MAIS UMA"  ←  "Faltaram 12m pro busão!"  ←  morte engraçada (slow-mo)
```

**Tempo entre morte e nova partida: < 1,5 segundo.** Um toque na tela de game over já reinicia. Nada de menus no caminho.

### Clímax: Alcançar o ônibus
A cada ~1000m o ônibus para num ponto. Se você chegar, Zé pula pra dentro, as portas fecham, tela de "CHEGUEI!" + confete — e o próximo ônibus sai (nova fase, mais rápida, cenário muda: centro → praia → favela colorida → Tóquio → Nova York). Isso dá **meta de curto prazo** dentro de um jogo infinito.

---

## 3. Fator Vício e Retenção

| Gancho psicológico | Como aplicamos |
|---|---|
| **Quase-vitória (near-miss effect)** | "Faltaram 12m pro busão!" e "Faltou 38m pro seu recorde!" na tela de derrota. A barra de progresso do recorde aparece *sempre*, mostrando quanto faltou. |
| **Reinício instantâneo** | Game over → toque → já está correndo. Sem fricção, sem tempo para "pensar em parar". |
| **Recompensa variável** | Moedas de "vale-transporte" aparecem em padrões aleatórios; baú surpresa a cada 3 partidas. |
| **Morte como entretenimento** | Cada obstáculo tem uma morte em ragdoll + slow-mo + café voando. Morrer é engraçado → frustração vira risada → risada vira revanche. |
| **Progressão visível** | Cada partida enche uma barra de XP; nível novo = skin nova desbloqueada. Nunca uma partida "inútil". |
| **Missões diárias (3/dia)** | "Faça 5 POR UM TRIZ seguidos", "Pule 3 bueiros", "Corra 500m sem pegar moeda". Motivo para voltar amanhã. |
| **Streak de login** | Dia 7 seguido = skin exclusiva "Zé de Terno Dourado". |
| **Competição social** | Placar semanal entre amigos + "fantasma" do amigo correndo do seu lado (só visual). |
| **Dificuldade em ondas** | Velocidade sobe, mas a cada ~45s vem um "respiro" de 3s sem obstáculos — o cérebro relaxa e o jogador continua. |

### Frustração Justa (regra de ouro do código)
- **Hitbox 15% menor** que o modelo visual: o jogador sente que "escapou raspando", nunca que morreu sem encostar.
- O spawner **garante matematicamente** que sempre existe tempo de reação humana (ver `ObstacleSpawner.cs`): a distância mínima entre obstáculos em calçadas opostas é `velocidade × (tempo de troca + tempo de reação)`.
- Obstáculos móveis (patinete) têm **aviso sonoro e visual** (buzina + seta piscando) 1s antes.
- **Nenhum toque é ignorado**: tocar no meio de uma troca inverte a direção na hora — o jogo nunca "engole" um toque.
- A janela do "POR UM TRIZ!" é medida em **tempo** (0,15s), não em metros: fica igualmente difícil em qualquer velocidade.

---

## 4. Direção de Arte e Identidade Sonora

### Estilo gráfico
**3D low-poly, flat shading, sem texturas** (só cor por vértice). Personagens "cabeçudos" (cabeça = 40% do corpo), animações exageradas estilo cartoon (squash & stretch). Câmera atrás e acima (3/4), levemente inclinada — legível em tela vertical.

Leve, roda liso em celular barato (meta: 60fps em Android de entrada) e fica lindo em vídeo vertical.

### Paleta de cores (alta legibilidade, "pop" no feed)

| Função | Cor | Hex |
|---|---|---|
| Céu / fundo | Azul-manhã | `#7FD4FF` |
| Asfalto/rua | Lavanda acinzentada | `#5B5F97` |
| Calçadas | Creme | `#FFE8C2` |
| **Jogador (Zé)** | Pijama amarelo-limão | `#FFD23F` |
| **Obstáculos (perigo)** | Coral/vermelho | `#FF4F5A` |
| Moedas/recompensa | Verde-menta | `#3EE6A1` |
| Ônibus (objetivo) | Laranja | `#FF9F1C` |
| UI / texto | Branco com contorno roxo-escuro | `#FFFFFF` / `#2B2D42` |

**Regra:** perigo é SEMPRE vermelho-coral, recompensa é SEMPRE verde. O olho do jogador aprende em 1 partida sem nenhum tutorial.

### Identidade sonora
- **Trilha:** loop de 8-bit/chiptune misturado com samba-funk acelerado; o BPM sobe junto com a velocidade.
- **Toque (troca de calçada):** "*bloop*" curto e satisfatório, com pitch subindo a cada combo (dó-ré-mi-fá...) — o combo *soa* como progresso.
- **POR UM TRIZ!:** "*fiuuuu*" + música abafa por 0,3s (efeito "underwater") + volta com tudo.
- **Morte:** som de cartoon (buzina de palhaço / "boing") + música para abruptamente + café caindo "*splash*".
- **Ônibus:** buzina característica "*fon-fon*" e o "pssshh" das portas — som-assinatura do jogo (o "flap" do Flappy Bird).
- **Voz do Zé:** gritinhos curtos em gibberish ("Ê-pera! Ê-pera!") — universal, sem tradução.

---

## 5. Estrutura de Monetização

Princípio: **nunca interromper a partida.** Anúncio só em pausas naturais ou quando o jogador *escolhe*.

| Fonte | Implementação | Por que não estraga |
|---|---|---|
| **Anúncio recompensado: "Continuar"** | Ao morrer: "Assistir vídeo para continuar?" (1x por partida, só se estiver perto do recorde ou do ônibus). | É o momento de maior desejo — o jogador *quer* ver. Maior eCPM do jogo. |
| **Anúncio recompensado: "Dobrar moedas"** | Na tela final, opcional. | Escolha do jogador. |
| **Intersticial** | Só a cada 3 mortes **e** mínimo de 90s entre eles; nunca nas primeiras 3 partidas da vida do jogador. | Respeita retenção do D1. |
| **Skins (moedas ou IAP)** | Zé Astronauta, Zé de Noiva, Zé Dinossauro, Vovó jogável, Cachorro salsicha jogável. Puramente cosméticas. | Zero pay-to-win. Skins aparecem nos vídeos = marketing grátis. |
| **"Sem Anúncios" (IAP ~US$ 2,99)** | Remove intersticiais; mantém recompensados opcionais. | Clássico do gênero. |
| **Passe de Temporada (~US$ 4,99/mês)** | Trilha de skins temáticas (Carnaval, Halloween, Natal) + missões extras. | Para a baleia; o jogador comum nem percebe. |
| **Cenários-patrocínio (futuro)** | Uma marca real de café/transporte numa cidade temática. | Integração nativa, não intrusiva. |

---

## 6. Compartilhamento Orgânico (TikTok / Reels)

- **Replay automático:** o jogo grava os últimos 8 segundos em buffer. Na morte, botão **"📲 Compartilhar"** gera um vídeo vertical com câmera lenta no momento da morte, o texto "Faltaram 3m pro busão 😭" e a logo.
- **Momento "POR UM TRIZ" x5+:** combo grande ativa câmera cinematográfica (estilo Matrix girando ao redor do Zé) — pura isca de vídeo.
- **Mortes raras ("easter eggs")**: 1% de chance de a morte ter uma variação absurda (Zé é levado por um bando de pombos, cai num bueiro e sai em outra cidade). As pessoas gravam para provar que viram.
- **Desafio de hashtag:** `#FaltouPoucoProBusão` — missão semanal "Morra a menos de 5m do ônibus".
- **Nome do recorde na tela:** "Você correu 2.340m — mais que o trajeto até a padaria!" (comparações absurdas e compartilháveis).

---

## 7. Métricas-alvo (benchmarks hyper-casual)

| KPI | Meta |
|---|---|
| Retenção D1 | ≥ 40% |
| Retenção D7 | ≥ 12% |
| Duração média de sessão | ≥ 8 min |
| Partidas por sessão | ≥ 7 |
| CPI no teste de marketing | < US$ 0,30 (EUA) |
| Tempo até 1º toque | < 3 s |

**Plano de validação:** antes de produzir arte final, fazer um protótipo com cubos e rodar teste de CPI com 3 criativos de vídeo (morte engraçada / "quase pegou o ônibus" / combo POR UM TRIZ). Só seguir com o criativo vencedor.

---

## 8. Protótipo de Código (Unity C#)

Os scripts estão em [`/Unity/Assets/Scripts`](../Unity/Assets/Scripts):

| Script | Responsabilidade |
|---|---|
| `Core/TapInput.cs` | O único input: "tocou neste frame?" (ignora toques em botões de UI). |
| `Core/GameManager.cs` | Estados (Pronto → Jogando → Morto), velocidade crescente, câmera lenta, reinício instantâneo, "Continuar", distância até o ônibus/recorde. |
| `Player/PlayerLaneSwitcher.cs` | Troca de calçada com 1 toque, ease-out, pulinho e squash & stretch (só no visual). |
| `Player/NearMissDetector.cs` | Detecta "POR UM TRIZ!", combo e slow-mo. |
| `Obstacles/Obstacle.cs` | Movimento relativo, morte do jogador, auto-reciclagem. |
| `Obstacles/ObstacleSpawner.cs` | Geração aleatória **justa** por padrões, com distância mínima garantida, "respiros" e pool de objetos (sem `Instantiate`/`Destroy` durante a partida). |
| `UI/HUD.cs` | Pontuação, combo, tela de derrota com "Faltaram Xm pro busão!" e botão "Continuar". |

Ver o [README](../README.md) para montar a cena em 5 minutos.
