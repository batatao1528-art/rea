# Controle de Fichas — Poker presencial

Site para controlar **apenas as fichas** de um jogo de poker. As cartas são jogadas
na mesa física; o site cuida do saldo de cada jogador, das apostas, do pote e dos
blinds, em tempo real em todos os celulares.

## Como funciona

1. **Depósito** — o jogador paga você (Pix ou dinheiro), registra o pedido no site
   e as fichas entram na carteira dele quando você clica em *Recebi o dinheiro*.
2. **Mesa** — o jogador senta com um buy-in tirado da carteira. Na mesa ele pode
   *pagar*, *passar*, *apostar/aumentar*, *all-in* ou *desistir*.
3. **Dealer (admin)** — inicia cada mão (gira o botão e cobra os blinds sozinho),
   recolhe as apostas a cada rua e paga o pote para quem ganhou na mesa física
   (dá para dividir o pote ou pagar side pots por partes).
4. **Saque** — o jogador sai da mesa (o stack volta para a carteira) e pede o saque.
   As fichas ficam reservadas até você clicar em *Já paguei*.

A **primeira conta criada vira o administrador**. Depois você pode tornar outras
pessoas admin no painel. O painel também tem uma *Conferência de fichas* que mostra
se o total em circulação bate com o que foi depositado menos o que foi sacado.

## Rodando

Precisa só do [Node.js](https://nodejs.org) 18 ou mais novo — não há dependências.

```bash
npm start          # abre em http://localhost:3000
npm test           # testes da API
```

Variáveis opcionais:

| Variável         | Padrão          | Para quê                                        |
|------------------|-----------------|-------------------------------------------------|
| `PORT`           | `3000`          | Porta do servidor                               |
| `DATA_FILE`      | `data/db.json`  | Onde os dados ficam salvos                      |
| `SECURE_COOKIES` | —               | Use `1` quando o site estiver em HTTPS          |

Para os jogadores acessarem pelo celular na mesma rede Wi-Fi, abra
`http://IP-DO-COMPUTADOR:3000`. Para acessar pela internet, hospede em um serviço
como Render, Railway ou uma VPS (com disco persistente para o `data/db.json`) e
use HTTPS com `SECURE_COOKIES=1`.

> **Backup:** todos os saldos ficam em `data/db.json`. Faça cópias desse arquivo.
