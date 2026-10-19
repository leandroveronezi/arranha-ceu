#!/usr/bin/env node
'use strict';
// Simulação sem navegador: moradores que trabalham no prédio (escritórios, lojas, lanchonete, restaurante).
// Uso: node tools/sim-empregos.js [dias=8] [andares=12]
const fs = require('fs'), vm = require('vm'), path = require('path');
const days = +process.argv[2] || 8, floors = +process.argv[3] || 12;
const ctx = vm.createContext({console, Math, Date, performance: {now: () => Date.now()}, window: {}, document: {}, localStorage: {}, location: {search: ''}});
const src = ['data', 'game'].map(f => fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8')).join('\n;');
vm.runInContext(src + '\n;globalThis.__G = Game; globalThis.__API = {FAC};', ctx);
const {FAC} = ctx.__API;
const g = new ctx.__G();
g.funds = 1e9;
const must = (r, what) => { if (!r.ok) throw new Error(what + ': ' + r.err); return r; };
must(g.placeFac('lobby', 0, 0, {w: 64}), 'lobby');
for (const f of g.facs) f.build = 1;
g.star = 5;
const stat = (kind, L, x) => { const r = g.placeFac(kind, L, x); if (r.ok) g.facs[g.facs.length - 1].build = 1; return r.ok; };
for (let L = 1; L <= floors; L++) {
  if (L % 2 === 0) { stat('condo', L, 0); stat('condo', L, 16); } else { for (const x of [0, 8, 16, 24]) stat('office', L, x); }
  if (L === 1) { stat('shop', L, 36); stat('fastfood', L, 48); } else if (L === 2) stat('restaurant', L, 36); else { stat('office', L, 36); stat('office', L, 44); }
}
console.log('bar', stat('bar', floors + 1, 36), 'cinema', stat('cinema', floors + 1, 0));
for (const [k, L, x] of [['clinic', -1, 0], ['security', -1, 28]]) must(g.placeFac(k, L, x), k), g.facs[g.facs.length - 1].build = 1;
const sh = must(g.placeShaft('elevator', 32, 0, floors + 2), 'elevador'); for (let i = 0; i < 3; i++) g.addCar(sh.shaft);
for (let L = 1; L < floors; L += 1) stat2(L);
function stat2(L) { g.placeStairs('stairs', L, 56); }
const errs = [];
const check = tag => {
  for (const f of g.facs) {
    const d = FAC[f.k];
    if (!(d.office || d.jobs)) continue;
    if (f.emp.length > g.jobCap(f)) errs.push(tag + ': ' + d.label + ' com empregados demais');
    for (const p of f.emp) if (p.job !== f || p.dead || !p.home || p.home.dead) errs.push(tag + ': empregado inconsistente em ' + d.label);
    if (d.office && f.occ && f.persons.length + f.emp.length !== g.jobCap(f)) errs.push(tag + ': vagas do escritório não fecham (' + f.persons.length + '+' + f.emp.length + '≠' + g.jobCap(f) + ')');
  }
};
const report = tag => {
  let inb = 0, out = 0, res = 0, atWork = 0;
  for (const p of g.people) if (!p.dead && p.kind === 'resident' && p.home && (p.prof === 'day' || p.prof === 'night')) { res++; if (g.jobOf(p)) { inb++; if (p.st !== 'away' && p.at === p.job) atWork++; } else if (p.job === null) out++; }
  const by = {}; for (const f of g.facs) if (f.emp && f.emp.length) by[FAC[f.k].label] = (by[FAC[f.k].label] || 0) + f.emp.length;
  console.log(tag, JSON.stringify({pop: g.pop, adultos: res, noPredio: inb, fora: out, noTrabalhoAgora: atWork, vagas: by}), 'hora', Math.floor(g.minute / 60), g.dayName);
};
const run = (secs, step = 0.1) => { for (let t = 0; t < secs; t += step) g.step(step); };
const secPerDay = 1440 / 4;
for (let d = 0; d < days; d++) {
  if (d === 3) { let n = 0; for (const p of g.people) if (p.kind === 'resident' && p.prof === 'day' && p.home && n++ % 2) { g.leaveJob(p); p.prof = 'night'; p.job = undefined; for (let i = 0; i < 30 && !p.job; i++) { p.job = undefined; g.findJob(p); } } }
  for (let h = 0; h < 8; h++) { run(secPerDay / 8); check('dia' + (d + 1)); if (d === days - 1 && h % 2 === 1) report('dia ' + (d + 1)); }
}
// demissão: fecha o escritório com mais empregados
const big = g.facs.filter(f => f.emp && f.emp.length).sort((a, b) => b.emp.length - a.emp.length)[0];
const msgs = g.log.slice(0, 5).map(m => m.text);
if (big) {
  const names = big.emp.map(p => p.name), n = big.emp.length;
  console.log('demolindo', FAC[big.k].label, 'andar', big.L, 'com', n, 'empregados');
  g.removeFac(big);
  const after = names.map((nm, i) => 0);
  run(secPerDay / 2); check('pós-demissão'); report('pós');
}
// salvar / carregar
const data = JSON.parse(JSON.stringify(g.serialize()));
const g2 = new ctx.__G(); g2.funds = 1e9; g2.load(data);
const cnt = gg => gg.people.filter(p => !p.dead && p.job).length;
console.log('empregados no prédio antes/depois de carregar:', cnt(g), cnt(g2));
Object.assign(g, g2); run(secPerDay / 2); check('pós-load'); report('pós-load');
console.log(errs.length ? 'FALHOU:\n' + [...new Set(errs)].slice(0, 10).join('\n') : 'OK');
process.exit(errs.length ? 1 : 0);
