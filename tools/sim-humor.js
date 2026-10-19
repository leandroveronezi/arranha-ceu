#!/usr/bin/env node
'use strict';
// Simulação sem navegador: monta uma torre, roda alguns dias e mostra a distribuição de humor.
// Uso: node tools/sim-humor.js [dias=6] [andares=12]
const fs = require('fs'), vm = require('vm'), path = require('path');
const days = +process.argv[2] || 6, floors = Math.min(27, +process.argv[3] || 12);   // o poço vai de −2 a `andares` e o máximo por poço é 30: acima de 27 andares usar mais de um poço
// sorteio com semente (tools/sim-humor.js [dias] [andares] [cabines] [semente]): a mesma torre dá sempre o mesmo resultado
let seed = (+process.argv[5] || 1) >>> 0;
const rng = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const SeededMath = Object.create(Math); SeededMath.random = rng;
const ctx = vm.createContext({console, Math: SeededMath, Date, performance: {now: () => Date.now()}, window: {}, document: {}, localStorage: {}, location: {search: ''}});
const src = ['data', 'game'].map(f => fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8')).join('\n;');
vm.runInContext(src + '\n;globalThis.__G = Game; globalThis.__API = {FAC, UTIL, EVAL_GOOD, EVAL_GREAT, evalTier};', ctx);
const {FAC, UTIL, EVAL_GOOD, EVAL_GREAT, evalTier} = ctx.__API;
UTIL.grid.energia = 1400; UTIL.grid.agua = 800; UTIL.reach.grid = 1e6;   // a ferramenta mede o humor, não a infraestrutura (energia e água locais têm rede.test.js)
const g = new ctx.__G();
g.funds = 1e9;
g.star = 5;   // libera boutique, restaurante, clínica e posto de segurança (exigem 3 e 2 estrelas); vem antes de construir
const must = (r, what) => { if (!r.ok) throw new Error(what + ': ' + r.err); return r; };
must(g.placeFac('lobby', 0, 0, {w: 64}), 'lobby');
for (const f of g.facs) f.build = 1;
const stat = (kind, L, x) => { const r = g.placeFac(kind, L, x); if (r.ok) g.facs[g.facs.length - 1].build = 1; return r.ok; };
for (let L = 1; L <= floors; L++) {
  if (L % 3 === 0) { stat('condo', L, 0); stat('condo', L, 16); } else { for (const x of [0, 8, 16, 24]) stat('office', L, x); }
  if (L === 1) stat('shop', L, 36); else if (L === 2) stat('restaurant', L, 36); else { stat('office', L, 36); stat('office', L, 44); }
}
const sh = must(g.placeShaft('elevator', 32, -2, floors), 'elevador'); for (let i = 0; i < (+process.argv[4] || 3) - 1; i++) g.addCar(sh.shaft);
// torre bem cuidada: clínica e posto de segurança no subsolo, no meio das unidades (os bônus agora são locais, valem só por perto)
for (const [k, L, x] of [['clinic', -1, 0], ['security', -1, 44]]) must(g.placeFac(k, L, x), k), g.facs[g.facs.length - 1].build = 1;
// serviços que os moradores e as empresas procuram por perto (café, coworking, banco, mercadinho, lavanderia e jardim)
for (const [k, L, x] of [['cafe', 1, 48], ['banco', 6, 52], ['coworking', 1, 56], ['mercado', 3, 52], ['lavanderia', 4, 52], ['jardim', 5, 52], ['academia', -2, 16], ['bike', -1, 36]]) stat(k, L, x);
g.pickWeather = () => 'sol'; g.utilEvents = function () { this.utilTick(); };   // clima bom e sem apagões ao acaso: a ferramenta mede as faixas de humor
g.fireEvent = () => {}; g.bombEvent = () => {}; g.crimeCheck = () => {};   // a ferramenta mede as faixas de humor: incêndio, bomba, brigas e furtos ao acaso derrubariam a clínica, o posto ou o restaurante (ou a nota das unidades) e escondem o que se quer ver
g.speed = 1;
const tally = () => {
  const c = [0, 0, 0], vals = [];
  for (const f of g.facs) { const d = FAC[f.k]; if (d.tenant && f.occ) { c[evalTier(f.eval)]++; vals.push(f.eval); } }
  vals.sort((a, b) => a - b);
  return {ruim: c[0], boa: c[1], otima: c[2], min: Math.round(vals[0] ?? 0), max: Math.round(vals[vals.length - 1] ?? 0), media: Math.round(g.avgEval), pop: g.pop};
};
const step = 0.1, secPerDay = 1440 / 4;
for (let d = 0; d < days; d++) {
  for (let t = 0; t < secPerDay; t += step) g.step(step);
  console.log(`dia ${d + 1}`, JSON.stringify(tally()), 'hotel', Math.round(g.avgHotelEval));
}
const t = tally(), bad = [];
if (process.env.DETALHE) { const top = g.facs.filter(f => FAC[f.k].tenant && f.occ).sort((a, b) => b.eval - a.eval)[0]; if (top) console.log(top.k, 'andar', top.L, 'x', top.x, Math.round(top.eval), '\n' + g.evalBreakdown(top).map(o => '  ' + o.v.toFixed(1) + ' ' + o.label).join('\n')); }
if (t.otima + t.boa + t.ruim === 0) bad.push('nenhum inquilino ocupou a torre');
if (!(t.max >= EVAL_GREAT)) bad.push('nenhuma unidade chegou a "Ótima" (>= ' + EVAL_GREAT + ')');
if (t.otima === t.boa + t.otima + t.ruim && t.ruim === 0 && t.boa === 0 && t.min >= EVAL_GREAT) console.log('(aviso: tudo verde)');
console.log(bad.length ? 'FALHOU: ' + bad.join('; ') : 'OK: faixas de humor alcançáveis');
process.exit(bad.length ? 1 : 0);
