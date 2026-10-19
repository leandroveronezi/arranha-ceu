'use strict';
// Torre de exibição da tela inicial (js/demo-torre.js, gerada por tools/gerar-demo.js): carrega, anda e não depende de nenhum save.
const fs = require('fs'), vm = require('vm'), path = require('path');
const {Game, FAC, upgradeSave, ok, done} = require('./helpers');
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'demo-torre.js'), 'utf8');
const demo = vm.runInNewContext(src + ';DEMO_TORRE', {});

const g = new Game(); g.msg = () => {};
let erro = null;
try { g.load(upgradeSave(JSON.parse(JSON.stringify(demo)))); } catch (e) { erro = e; }
ok(!erro, 'a torre de exibição carrega pelo caminho normal de saves' + (erro ? ': ' + erro.message : ''));
ok(g.star === 5 && g.facs.length > 100, `é uma torre grande (${g.facs.length} salas, ${g.star}★)`);
const t = g.facs.filter(f => FAC[f.k].tenant);
ok(t.length > 50 && t.every(f => f.occ), 'todas as unidades saem ocupadas (a vitrine não mostra placas de aluguel)');
ok(g.topBuilt() >= 20, 'tem andares de sobra para enquadrar a câmera (topBuilt ' + g.topBuilt() + ')');
ok(!demo.people && !demo.log && !demo.hist, 'não carrega gente, log nem histórico (nada de save de ninguém)');

// anda sozinha por alguns dias sem estourar nem gerar NaN
g.speed = 2; let falhou = null;
try { for (let i = 0; i < 3000; i++) g.tick(0.1); } catch (e) { falhou = e; }
ok(!falhou, 'roda dias a 2x sem erro' + (falhou ? ': ' + falhou.message : ''));
ok(Number.isFinite(g.funds) && Number.isFinite(g.t) && g.people.every(p => Number.isFinite(p.x) && Number.isFinite(p.L)), 'dinheiro, relógio e posições das pessoas continuam números');
ok(g.people.length > 0, 'tem gente circulando (' + g.people.length + ')');
done('demo');
