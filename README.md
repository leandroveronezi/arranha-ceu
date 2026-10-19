# Arranha-Céu

Jogo de construir torres (no estilo do SimTower) em JavaScript puro, sem build e sem dependências. Construa andar por andar, ligue elevadores e escadas, cuide de energia, água, segurança e incêndios e mantenha os inquilinos felizes para chegar às cinco estrelas.

**[Jogar agora](https://leandroveronezi.github.io/arranha-ceu/)** · [Catálogo de salas](https://leandroveronezi.github.io/arranha-ceu/catalogo.html)

## Como jogar

Abra o link acima, ou rode localmente: baixe o repositório e abra o `index.html` no navegador, ou sirva a pasta:

```sh
npm run serve   # http://localhost:8000
```

Na tela inicial há Novo jogo, Continuar (autosave), Carregar/Importar saves, Como jogar e Som. O progresso é salvo no navegador (`localStorage`) e pode ser exportado e importado como arquivo.

**Controles:** arrastar move a câmera · Ctrl+roda, +/− ou pinça dão zoom · Espaço pausa · 1–4 mudam a velocidade · V troca a visão do mapa · R gira rampas e portais · Esc cancela.

## Destaques

- **Mundo sem teto:** constrói-se para qualquer lado, para cima e para baixo (subsolos).
- **Tudo é local:** barulho, serviços, segurança, energia e água dependem da distância entre as salas; nada vale para o prédio inteiro.
- **Transporte:** elevadores com até 3 cabines por poço (comum, de serviço e expresso), escadas, escadas rolantes, metrô, ônibus, táxi, garagem com elevador de carros e heliponto.
- **Infraestrutura:** geradores, placas solares, baterias, bombas, caixas d'água e usina de reciclagem.
- **Imprevistos:** incêndios (com bombeiros e sprinklers), brigas, furtos, apagões, clima e estações do ano.
- **Sem arquivos de mídia:** a arte é desenhada em código e os sons e vozes são sintetizados.

## Catálogo

O [`catalogo.html`](https://leandroveronezi.github.io/arranha-ceu/catalogo.html) mostra todas as salas, elevadores, escadas, túneis e utilidades, desenhados pelos mesmos painters do jogo e animados, com estrelas, tamanho, custo e descrição. Dá para filtrar por grupo, estrela e busca.

## Desenvolvimento

Requer Node 18 ou mais novo (só para testes e ferramentas; o jogo roda direto no navegador).

```sh
npm test                 # todos os testes + simulação de humor
npm run test:update      # regrava o snapshot de comportamento (revise o diff)
npm run bench            # custo de cada passo da simulação
npm run sim:progressao   # jogador automático medindo o tempo até cada estrela
npm run catalogo         # regera catalogo-dados.js
npm run demo             # regera js/demo-torre.js
```

O núcleo da simulação (`js/game.js`) não depende do DOM e roda no Node, e um teste de *golden master* (`tests/comportamento.test.js`) acusa qualquer mudança de comportamento do jogo. A estrutura do código, o modelo do jogo e as convenções estão em [CLAUDE.md](CLAUDE.md).

Textos do jogo, comentários e mensagens de commit são em português do Brasil.

## Créditos

Inspirado no SimTower (Maxis/OPeN), sem usar nenhum de seus recursos: toda a arte é desenhada em código e o som é sintetizado.
