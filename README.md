# Bloco Rush

Quebra-cabeça de blocos competitivo para navegador (celular e PC).
Todos os jogadores de uma sala recebem **exatamente as mesmas peças**: vence quem joga melhor.

> Protótipo com **fichas virtuais**, sem valor em dinheiro. Antes de qualquer sala
> com dinheiro real é obrigatório validar o modelo com um advogado.

## Como rodar

Precisa de Node.js 20 ou mais novo. Não há dependências para instalar.

```bash
npm start          # http://localhost:3000
npm test           # testes do motor, das salas e da API
```

Variáveis opcionais: `PORT` (padrão 3000) e `DB_FILE` (padrão `data/db.json`).

## Publicar online (Render, plano grátis)

1. Crie uma conta em https://render.com entrando com o GitHub.
2. Clique em **New → Blueprint** e escolha o repositório `rea`.
3. O Render lê o `render.yaml` e cria o serviço `bloco-rush`. Clique em **Apply**.
4. Em alguns minutos o jogo fica em `https://bloco-rush-xxxx.onrender.com`.

No plano grátis o servidor dorme após 15 minutos sem uso (o primeiro acesso demora
uns 50 segundos) e **os dados são apagados a cada reinício ou nova publicação**:
contas e fichas voltam do zero. Para guardar dados, use um disco persistente
(plano pago) apontando `DB_FILE` para ele, ou um banco de dados.

## Regras

- Tabuleiro 8×8, 3 peças por vez; a bandeja só renova quando as 3 forem usadas.
- Completar linha ou coluna limpa os blocos.
- Pontos: 1 por bloco colocado + `10 × L × (L+1) / 2` por L linhas limpas de uma vez,
  multiplicado pelo combo (limpezas seguidas, até ×8). O combo zera após 3 jogadas sem limpar.
- Limpar o tabuleiro inteiro: +300.
- A partida dura 2 minutos ou acaba antes se nenhuma peça couber.

## Salas

- 30 vagas, entrada de 10 fichas, prazo de 30 minutos (ou até lotar).
- Cada um joga quando quiser dentro do prazo; todos com a mesma seed.
- A casa fica com 10%. Divisão do prêmio pelo número de quem terminou:
  2–4 → 1º leva tudo; 5–9 → 65/35; 10+ → 50/30/20. Empate: vence quem terminou antes.
- Menos de 2 jogadores válidos: a entrada é devolvida.
- Jogador novo começa com 1000 fichas; bônus diário de 200.

## Anti-trapaça

O navegador **nunca informa a pontuação** que vale. Ele envia o replay
(`peça, linha, coluna, tempo` de cada jogada) e o servidor refaz a partida inteira
com o mesmo motor (`shared/engine.js`). O replay é recusado se:

- alguma jogada for impossível (fora do tabuleiro, sobreposta, peça já usada);
- os tempos andarem para trás ou passarem de 2 minutos;
- o replay disser que durou mais do que o tempo real que passou no servidor;
- chegar depois do prazo (2 min + 15 s de folga).

Partidas com ritmo de robô (jogadas rápidas demais ou intervalos constantes demais)
ficam sinalizadas em `flags` para revisão manual.

## Estrutura

```
shared/engine.js   motor determinístico (usado pelo navegador e pelo servidor)
server/rooms.js    jogadores, fichas, salas, validação e prêmios
server/server.js   servidor HTTP (API + arquivos estáticos), sem dependências
server/store.js    persistência em arquivo JSON
public/            interface: index.html, style.css, app.js, game.js (canvas)
test/              testes com node:test
```

## API

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/players` | `{name}` → cria jogador, devolve `token` |
| GET | `/api/me` | saldo e próximo bônus |
| POST | `/api/bonus` | pega o bônus diário |
| POST | `/api/rooms/join` | entra numa sala e começa a partida (devolve a seed) |
| POST | `/api/rooms/:id/submit` | `{attemptId, moves, clientScore}` → pontuação validada |
| GET | `/api/rooms/:id` | ranking e prêmios da sala |

Autenticação: cabeçalho `Authorization: Bearer <token>`.

## Próximos passos

- Banco de dados de verdade (Postgres) no lugar do arquivo JSON.
- Contas com e-mail/telefone; verificação de CPF + selfie antes de qualquer sala paga.
- Painel de revisão das partidas sinalizadas.
- Salas com entradas diferentes e separação por nível.
- Instalar como app (PWA), sons e vibração.
