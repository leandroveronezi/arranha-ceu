#!/usr/bin/env node
'use strict';
// Gera js/demo-torre.js: a torre de exibição que roda ao fundo da tela inicial (nada a ver com os saves do jogador).
// Monta uma torre arrumada de 5 estrelas, deixa alguns dias passarem para os andares se encherem e grava o resultado.
// Uso: node tools/gerar-demo.js [andares=26]   (depois commite js/demo-torre.js)
const fs = require('fs'), path = require('path');
const {mk, put, FAC} = require('../tests/helpers.js');
const FLOORS = +process.argv[2] || 26;
const g = mk(64);
g.placeShaft('elevator', 56, 0, FLOORS);
// preenche o resto da fileira (56 unidades, ao lado do poço) com corredores: câmera de um lado e extintor do outro
const row = (L, plan) => {
  let x = 0;
  for (const k of plan) { put(g, k, L, x); x += FAC[k].w; }
  for (let i = 0; x < 56; i++, x += 4) put(g, i % 2 ? 'corridorCam' : 'corridorExt', L, x);
};
for (let L = 1; L <= FLOORS; L++) {
  if (L === 1) row(L, ['cafe', 'mercado', 'banco', 'cafe', 'coworking']);
  else if (L % 6 === 0) row(L, ['jardim', 'academia', 'coworking', 'mercado']);
  else if (L % 3 === 0) row(L, ['condo', 'condo', 'condo']);
  else row(L, ['office', 'office', 'office', 'office', 'office', 'office']);
}
put(g, 'heliport', FLOORS + 1, 24);
// alguns dias a 8x para os andares se encherem de gente (a rede de energia e água dos testes é generosa; o jogo faz o mesmo na tela inicial)
g.speed = 8;
for (let i = 0; i < 6000; i++) g.tick(0.1);
// o jogo leva semanas para encher a torre: na vitrine as unidades já saem ocupadas e bem avaliadas
for (const f of g.facs) if (FAC[f.k].tenant) { f.occ = true; f.eval = 230; f.poorDays = 0; }
const d = g.serialize();
for (const k of ['log', 'hist', 'uh', 'fin', 'inc', 'people']) delete d[k];
d.funds = 50000000; d.speed = 2;
const out = path.join(__dirname, '..', 'js', 'demo-torre.js');
fs.writeFileSync(out, "'use strict';\n// Gerado por tools/gerar-demo.js: torre de exibição que roda ao fundo da tela inicial (não é save de ninguém).\nconst DEMO_TORRE = " + JSON.stringify(d) + ";\n");
const t = d.facs.filter(f => FAC[f.k].tenant); console.log('torre com', d.facs.length, 'salas;', t.filter(f => f.occ).length + '/' + t.length, 'unidades ocupadas; estrela', d.star, Math.round(fs.statSync(out).size / 1024) + ' KB');
