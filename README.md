# Assistente de Poker ♠

App web para Texas Hold'em que analisa sua mão e diz se vale continuar: **aumentar, pagar, passar ou desistir**.

## Como usar

Abra o `index.html` no navegador (funciona no celular e no PC, sem instalar nada).

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
