# NavegaDor — protótipo

App de navegação náutica **próprio**, sem mensalidade e sem login, usando
cartas e dados **abertos**. Protótipo navegável (v0.1).

## O que já funciona

- **Mapa unificado** com camadas que você liga/desliga:
  - Base: OpenStreetMap, Satélite (Esri World Imagery) ou Topográfico (OpenTopoMap)
  - Sobreposição náutica: **OpenSeaMap** (boias, faróis, canais, marcas de profundidade)
- **GPS ao vivo** ("Meu barco"): posição, círculo de precisão, seguir automático
- **Velocidade (nós / SOG)** e **rumo (COG)** a partir do GPS
- **Rota e waypoints**: toque em "Marcar" e no mapa para criar pontos;
  arraste para ajustar; distância total em **milhas náuticas**, número de
  pernas e rumo do primeiro trecho
- **Distância até o próximo ponto** em tempo real
- **Instalável** na tela inicial (PWA) e **cache offline** dos mapas já
  visitados (service worker)
- Os waypoints ficam salvos no próprio aparelho (localStorage)

## Como abrir no Android

Precisa ser servido por HTTP(S) — GPS e service worker não funcionam abrindo
o arquivo direto (`file://`). Duas formas:

1. **GitHub Pages** (recomendado): nas configurações do repositório, ative
   Pages apontando para esta branch e a pasta `/app`. Depois abra a URL no
   Chrome do Android e use "Adicionar à tela inicial".

2. **Servidor local** (para testar no PC ou na mesma rede):
   ```bash
   cd app && python3 -m http.server 8080
   ```
   Abra `http://SEU_IP:8080` no celular (mesma rede Wi-Fi). Para o GPS
   funcionar fora de `localhost`, o navegador normalmente exige HTTPS.

## Fontes de dados (todas abertas / livres)

| Camada | Fonte | Licença |
|---|---|---|
| Base de mapa | OpenStreetMap | ODbL |
| Marcas náuticas | OpenSeaMap | ODbL / CC-BY-SA |
| Satélite | Esri World Imagery | uso com atribuição |
| Topográfico | OpenTopoMap | CC-BY-SA |

> Observação: as cartas oficiais eletrônicas (ENC) de cada país, como as da
> Marinha do Brasil / DHN, têm licença própria. Este protótipo usa
> OpenSeaMap, que é livre. Dá para somar cartas oficiais depois, respeitando
> a licença de cada uma.

## Próximos passos possíveis

- Empacotar como app Android nativo (Capacitor) e publicar APK
- Download de áreas offline por região (não só o que foi visto)
- Camadas de vento / maré / clima (Open-Meteo Marine, estações de maré)
- Alarme de fundeio, AIS, gravação de trilha (track), exportar GPX
