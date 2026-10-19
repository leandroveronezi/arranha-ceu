# Arranha-Céu

Jogo de construir torres (no estilo do SimTower) em JavaScript puro, sem build e sem dependências. Construa andar por andar, ligue elevadores e escadas, cuide de energia, água, segurança e incêndios e mantenha os inquilinos felizes para chegar às cinco estrelas.

## Como jogar

Abra o `index.html` no navegador, ou sirva a pasta:

```sh
npm run serve   # http://localhost:8000
```

Na tela inicial há Novo jogo, Continuar (autosave), Carregar/Importar saves, Como jogar e Som.

## Destaques

- Mundo sem teto: constrói-se para qualquer lado, para cima e para baixo (subsolos).
- Tudo é local: barulho, serviços, segurança, energia e água dependem da distância entre as salas.
- Elevadores com várias cabines, escadas, metrô, garagem, elevador de carros e heliponto.
- Incêndios, brigas, furtos, apagões, clima e estações do ano.
- Sons e vozes sintetizados, sem arquivos de áudio.

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

O `catalogo.html` mostra todas as salas e o transporte, desenhados pelos mesmos painters do jogo.

A estrutura do código, o modelo do jogo e as convenções estão em [CLAUDE.md](CLAUDE.md).

Textos do jogo, comentários e mensagens de commit são em português do Brasil.

## Créditos

Inspirado no SimTower (Maxis/OPeN), sem usar nenhum de seus recursos: toda a arte é desenhada em código e o som é sintetizado.
