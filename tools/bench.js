#!/usr/bin/env node
'use strict';
// Benchmark de desempenho: monta uma torre grande (todos os escritórios ocupados, escadas e poços de elevador em trechos de 29 andares)
// e mede o custo de cada passo da simulação durante um dia inteiro.
// Uso: node tools/bench.js [andares=100] [escritórios por andar=12] [dias=1]
const fs = require('fs'), vm = require('vm'), path = require('path');
const floors = +process.argv[2] || 100, perFloor = +process.argv[3] || 12, days = +process.argv[4] || 1;
const ctx = vm.createContext({console, Math, Date, performance: {now: () => Date.now()}, window: {}, document: {}, localStorage: {}, location: {search: ''}});
const src = ['data', 'game'].map(f => fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8')).join('\n;');
vm.runInContext(src + '\n;globalThis.__G = Game;', ctx);
const g = new ctx.__G(); g.funds = 1e13; g.star = 5; g.msg = () => {};
const W = perFloor * 8 + 40, t0 = process.hrtime.bigint();
g.placeLobbySpan(0, 0, W - 1); g.facs.forEach(f => { f.build = 1; });
for (let L = 1; L <= floors; L++) g.placeFloorSpan(L, 0, W - 1);
for (let L = 0; L < floors; L++) g.placeStairs('stairs', L, perFloor * 8 + 4);
for (let lo = 0, k = 0; lo < floors; k++) { const hi = Math.min(lo + 29, floors), r = g.placeShaft('elevator', perFloor * 8 + 16 + (k % 4) * 4, lo, hi); if (!r.ok) break; g.addCar(r.shaft); g.addCar(r.shaft); lo = hi; }
for (let L = 1; L <= floors; L++) for (let i = 0; i < perFloor; i++) { const r = g.placeFac('office', L, i * 8); if (r.ok) { const f = g.facs[g.facs.length - 1]; f.build = 1; f.occ = true; g.moveIn(f); } }
g.calcStats();
console.log(`${floors} andares × ${perFloor} escritórios: ${g.facs.length} salas, ${g.pop} pessoas, montada em ${(Number(process.hrtime.bigint() - t0) / 1e6).toFixed(0)} ms`);
const times = [], spikes = [];
for (let i = 0; i < 3600 * days; i++) {
  const m = g.minute, a = process.hrtime.bigint(); g.step(0.1); const d = Number(process.hrtime.bigint() - a) / 1e6;
  times.push(d); if (d > 100 && i > 0) spikes.push(Math.floor(m / 60) + ':' + String(Math.floor(m % 60)).padStart(2, '0') + ' ' + d.toFixed(0) + 'ms');
}
const t = times.slice(1).sort((a, b) => a - b), q = p => t[Math.min(t.length - 1, Math.floor(p * t.length))];
console.log(`passo da simulação: mediana ${q(.5).toFixed(2)} ms · p95 ${q(.95).toFixed(1)} ms · p99 ${q(.99).toFixed(1)} ms · pior ${t[t.length - 1].toFixed(0)} ms · memória ${(process.memoryUsage().heapUsed / 1e6).toFixed(0)} MB`);
console.log(spikes.length ? `passos acima de 100 ms (${spikes.length}): ${spikes.slice(0, 12).join(' | ')}${spikes.length > 12 ? ' ...' : ''}` : 'nenhum passo acima de 100 ms');
