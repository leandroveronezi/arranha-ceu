#!/usr/bin/env node
'use strict';
// Simulação de progressão: um "jogador" automático constrói a torre seguindo uma política simples e o script mede quanto tempo leva
// para chegar a cada estrela, como anda o dinheiro (aluguéis × manutenção) e se energia/água/eventos travam o crescimento.
// Uso: node tools/sim-progressao.js [dias=30] [estrela-alvo=3] [semente=1] [blocos-max=4]
const fs = require('fs'), vm = require('vm'), path = require('path');
const DAYS = +process.argv[2] || 30, TARGET = +process.argv[3] || 3, MAXB = +process.argv[5] || 4;
let seed = (+process.argv[4] || 1) >>> 0;
const rng = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const SM = Object.create(Math); SM.random = rng;
const ctx = vm.createContext({console, Math: SM, Date, performance: {now: () => Date.now()}, window: {}, document: {}, localStorage: {}, location: {search: ''}});
let src = ['data', 'game'].map(f => fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8')).join('\n;');
// SIM_SET="QDAYS=4,START_FUNDS=3000000": troca constantes numéricas de data.js só nesta simulação (para testar ajustes de equilíbrio sem mexer no jogo)
for (const kv of (process.env.SIM_SET || '').split(',').filter(Boolean)) { const [k, v] = kv.split('='); const re = new RegExp('(const (?:[A-Za-z_, ]*?, )?' + k + ' = )[^,;]+'); if (!re.test(src)) throw new Error('constante não encontrada: ' + k); src = src.replace(re, '$1' + v); }
vm.runInContext(src + '\n;globalThis.__G = Game; globalThis.__A = {FAC, STAR_POP, UTIL, MIN_PER_SEC, QDAYS, SEASONS, START_FUNDS, TRANSPORT};', ctx);
const {FAC, STAR_POP, MIN_PER_SEC, QDAYS, SEASONS, START_FUNDS} = ctx.__A;
const g = new ctx.__G(); g.msg = (t, c, f) => { if (/Apagão|Falta d|Nova estrela|Incêndio|Furto|bomba|Bomba|fechou|novo comerciante/.test(t)) log.push([g.day, t]); };
const log = [];
const BW = 64;                       // largura de um bloco da torre (saguão + 1 poço de elevador)
const FLOORS = 29;                   // andares por poço
const place = (k, L, x, o) => { const r = g.placeFac(k, L, x, o); if (r.ok) { r.fac.build = 1; return r.fac; } return null; };   // obras instantâneas: mede a economia, não a velocidade de obra
const cost = (k, w) => FAC[k].cost * (w || FAC[k].w) / FAC[k].w;

// ---- política do jogador
const blocks = [];
const reserve = () => Math.max(120000, 1.3 * (lastMaint || 0));
let lastMaint = 0;
const sumVals = o => Object.values(o || {}).reduce((a, b) => a + b, 0);
const rowPlan = (b, L) => {       // lista de salas (chave, largura) para o andar L do bloco b, em unidades 0..55
  const star = g.star, plan = [], svc = ['cafe', 'coworking', 'mercado', 'lavanderia', 'academia', 'jardim'].filter(k => FAC[k].star <= star);
  const kind = star >= 2 && L % 6 === 0 && svc.length ? 'svc' : L % 3 === 0 ? 'res' : 'off';
  let used = 0;
  const add = (k, w) => { if (used + w <= 56) { plan.push([k, w]); used += w; return true; } return false; };
  if (kind === 'svc') { let i = L; while (used < 48) { const k = svc[i++ % svc.length]; if (!add(k, FAC[k].w)) break; } }
  else if (kind === 'res') { for (let i = 0; i < 3; i++) add(star >= 1 ? 'condo' : 'kitnet', 16); }
  else { for (let i = 0; i < 6; i++) add(FAC.officeEx && star >= 3 && i < 2 ? 'officeEx' : 'office', FAC[star >= 3 && i < 2 ? 'officeEx' : 'office'].w); }
  add('corridorExt', 4); if (star >= 2) add('corridorCam', 4);
  return plan;
};
const growBlock = (b) => {
  const x0 = b.i * BW;
  if (!b.init) {
    const need = (b.i ? cost('lobby', BW) : 0) + 250000;
    if (g.funds < need + reserve()) return false;
    if (b.i && !place('lobby', 0, x0, {w: BW})) return false;
    const r = g.placeShaft('elevator', x0 + 56, 0, FLOORS); if (!r.ok) return false;
    b.shaft = r.shaft; b.init = true; b.top = 0; b.row = null;
  }
  // continua a fileira em andamento ou abre a próxima
  for (let guard = 0; guard < 6; guard++) {
    if (!b.row) {
      if (b.top >= FLOORS) return false;
      const L = b.top + 1, slab = g.floorCheck(L, x0, x0 + BW - 1);
      if (!slab.ok || g.funds < slab.cost + reserve() + 100000) return false;
      g.placeFloorSpan(L, x0, x0 + BW - 1);
      b.row = {L, todo: rowPlan(b, L), x: 0};
    }
    const row = b.row;
    while (row.todo.length) {
      const [k, w] = row.todo[0];
      if (g.funds < cost(k, w) + reserve()) return true;     // espera juntar dinheiro
      if (!g.canPlaceFac(k, row.L, x0 + row.x).ok || !place(k, row.L, x0 + row.x)) { row.todo.shift(); row.x += w; continue; }
      row.todo.shift(); row.x += w;
    }
    b.top = row.L; b.row = null;
    const want = Math.min(3, 1 + Math.floor(b.top / 9));
    while (b.shaft.cars.length < want && !g.addCar(b.shaft)) {}
  }
  return true;
};
const basementX = {}; let bnext = 0, basementStairs = false;
const putBasement = (k) => {
  if (g.star < FAC[k].star || g.funds < FAC[k].cost + 50000) return false;   // infraestrutura tem prioridade sobre novas salas
  if (!g.slab.get(-1, 0)) { const r = g.floorCheck(-1, 0, MAXB * BW - 1); if (r.ok) g.placeFloorSpan(-1, 0, MAXB * BW - 1); }
  if (!basementStairs) { const r = g.placeStairs('stairs', -1, 0); if (!r.ok && process.env.SIM_DEBUG) console.log('escada do subsolo:', r.err); if (r.ok) { basementStairs = true; bnext = Math.max(bnext, 8); g.stairs.forEach(o => { o.build = 1; }); } }   // sem acesso o subsolo não funciona: uma escada liga o térreo ao subsolo
  for (let x = bnext; x < MAXB * BW; x += 4) if (g.canPlaceFac(k, -1, x).ok) { const f = place(k, -1, x); if (f) { bnext = x + FAC[k].w; return true; } }
  return false;
};
// energia e água são locais: gerador/bomba perto das salas cortadas por falta de alcance (andares altos); tenta os andares logo abaixo e acima da sala mais alta cortada
const putNear = (k, flag, maxL) => {
  if (g.star < FAC[k].star || g.funds < FAC[k].cost + 50000) return false;   // infraestrutura tem prioridade sobre novas salas
  const cut = g.facs.filter(f => f[flag] && f.build >= 1 && !f.dead).sort((a, b) => b.L - a.L)[0];
  if (!cut) return false;
  const Ls = maxL ? Array.from({length: 8}, (_, i) => Math.min(maxL, cut.L - 4) - i).filter(L => L >= 1) : [cut.L - 3, cut.L - 2, cut.L - 1, cut.L + 1, cut.L];
  const errs = {};
  for (const L of Ls) for (let x = cut.x - 40; x <= cut.x + 40; x += 4) { const r = g.canPlaceFac(k, L, x); if (r.ok) { const f = place(k, L, x); if (f) return true; } else errs[r.err] = (errs[r.err] || 0) + 1; }
  if (process.env.SIM_DEBUG) console.log('putNear', k, 'falhou:', JSON.stringify(errs), 'alvo andar', cut.L);
  return false;
};
let ground = MAXB * BW + 8;
const decide = () => {
  const act = Math.min(MAXB, g.star >= 4 ? 4 : g.star >= 3 ? 3 : g.star >= 2 ? 2 : 1);
  for (let i = 0; i < act; i++) { let b = blocks[i]; if (!b) b = blocks[i] = {i, init: false, top: 0, row: null}; growBlock(b); }
  const u = g.utilFresh();
  if (g.star >= 2 && g.facs.filter(f => f.k === 'security').length < Math.ceil(act / 1) && g.pop > 150) putBasement('security');
  if (g.star >= 3 && g.pop > 700 && !g.facs.some(f => f.k === 'clinic')) putBasement('clinic');
  if (g.star >= 1 && u.energia.cut > 0 && g.facs.some(f => f.cutWhyE === 'reach')) putNear('gerador', 'cutE');
  // a água não vem da rua: bombas no subsolo (maior e de maior alcance conforme a estrela) e, para o alcance, caixas acima delas
  if (g.pop > 0 && !g.facs.some(f => f.k.startsWith('bomba'))) putBasement('bomba');
  if (u.agua.cut > 0 && g.facs.some(f => f.cutWhyA === 'reach')) { if (!(g.star >= 4 && putBasement('bombaForte')) && !(g.star >= 2 && putBasement('bombaMedia'))) putBasement('bomba'); }
  if (u.agua.cut > 0 && g.facs.some(f => f.cutWhyA === 'reach') && g.facs.some(f => f.k.startsWith('bomba'))) putNear('caixa', 'cutA', 14);   // caixa d'água num andar médio, ao alcance da bomba do subsolo: ela leva a água mais para cima
  if (u.agua.cut > 0 && g.facs.some(f => f.cutWhyA === 'cap')) putBasement(g.star >= 2 ? 'bombaMedia' : 'bomba');
  if (g.star >= 1 && (u.energia.cut > 0 || u.energia.use > 0.85 * u.energia.cap)) putBasement(g.star >= 4 && g.funds > 1500000 ? 'geradorGas' : 'gerador');
  if (g.star >= 3 && u.energia.storeCap < 500 && u.energia.use > 0.6 * u.energia.cap) putBasement('bateria');
  if (g.star >= 2 && g.pop > 250 && !g.facs.some(f => f.k === 'taxi') && g.funds > 400000) { if (place('taxi', 0, ground)) ground += 8; }
  if (g.star >= 2 && g.pop > 400 && !g.facs.some(f => f.k === 'busstop') && g.funds > 500000) { if (place('busstop', 0, ground)) ground += 16; }
  if (g.star >= 3 && g.pop > 600 && g.funds > 300000 && !g.facs.some(f => f.k === 'bike')) putBasement('bike');
};

// ---- início: saguão e primeiro bloco
{ const lb = place('lobby', 0, 0, {w: BW}); if (!lb) throw new Error('saguão'); }
const milestones = {1: {day: 0, pop: 0, funds: g.funds}};
let lastStar = 1, bankrupt = 0, maxCut = {energia: 0, agua: 0}, outages = 0, lastOut = {energia: 0, agua: 0}, fires = 0, minFunds = g.funds;
const rows = [];
const step = 0.2, secPerDay = 1440 / MIN_PER_SEC, decideEvery = 120 / MIN_PER_SEC;
let acc = 0, wall0 = Date.now();
decide();
for (let d = 0; d < DAYS; d++) {
  for (let t = 0; t < secPerDay; t += step) {
    g.step(step); acc += step;
    if (acc >= decideEvery) { acc = 0; decide(); }
    if (g.funds < 0) bankrupt += step / secPerDay;
    minFunds = Math.min(minFunds, g.funds);
  }
  const u = g.utilFresh();
  maxCut.energia = Math.max(maxCut.energia, u.energia.cut); maxCut.agua = Math.max(maxCut.agua, u.agua.cut);
  for (const r of ['energia', 'agua']) { if (g.outage[r] && !lastOut[r]) outages++; lastOut[r] = g.outage[r]; }
  if (g.star > lastStar) { for (let s = lastStar + 1; s <= g.star; s++) milestones[s] = {day: d + 1, pop: g.pop, funds: g.funds, rooms: g.facs.length}; lastStar = g.star; }
  if (g.fin.last) lastMaint = sumVals(g.fin.last.mnt);
  const last = g.fin.last || {inc: {}, mnt: {}};
  rows.push({d: d + 1, season: SEASONS[g.season].name, star: g.star, pop: g.pop, funds: Math.round(g.funds / 1000), ev: Math.round(g.avgEval), rooms: g.facs.length, top: Math.max(0, ...blocks.map(b => b.top)), cutE: u.energia.cut, cutA: u.agua.cut, use: Math.round(100 * u.energia.use / u.energia.cap), uw: Math.round(100 * u.agua.use / u.agua.cap), eU: Math.round(u.energia.use), wU: Math.round(u.agua.use), eC: Math.round(u.energia.cap), wC: Math.round(u.agua.cap), inc: Math.round(sumVals(last.inc) / 1000), mnt: Math.round(sumVals(last.mnt) / 1000)});
  process.stderr.write(`\rdia ${d + 1}/${DAYS} · ${g.star}★ · pop ${g.pop} · ${Math.round((Date.now() - wall0) / 1000)}s   `);
  if (g.star >= TARGET && d + 1 >= (milestones[TARGET] ? milestones[TARGET].day + 2 : 0)) break;
}
process.stderr.write('\n');
console.log('dia estação    ★  pop    caixa(k)  nota andares salas  ⚡%  💧%  corte(E/Á)  trimestre anterior: receita/manutenção (k)');
for (const r of rows) console.log(String(r.d).padStart(3), r.season.padEnd(9), r.star, String(r.pop).padStart(6), String(r.funds).padStart(9), String(r.ev).padStart(5), String(r.top).padStart(7), String(r.rooms).padStart(5), String(r.use).padStart(4), String(r.uw).padStart(4), `   ${r.cutE}/${r.cutA}`.padEnd(10), `   ${r.inc}/${r.mnt}`);
console.log('\nconsumo/capacidade no último dia: energia ' + rows[rows.length - 1].eU + '/' + rows[rows.length - 1].eC + ', água ' + rows[rows.length - 1].wU + '/' + rows[rows.length - 1].wC + ' · pop ' + rows[rows.length - 1].pop);
console.log('\n== marcos ==');
for (const [s, m] of Object.entries(milestones)) console.log(`${s}★: dia ${m.day} (≈ ${Math.round(m.day * 6)} min reais a 1×) · pop ${m.pop} · caixa ${Math.round(m.funds / 1000)}k${m.rooms ? ' · ' + m.rooms + ' salas' : ''}`);
console.log(`\ncaixa mínimo ${Math.round(minFunds / 1000)}k · dias no vermelho ${bankrupt.toFixed(2)} · cortes máx. energia ${maxCut.energia}, água ${maxCut.agua} · apagões/faltas d'água ${outages}`);
const ev = {}; for (const [, t] of log) { const k = /Apag/.test(t) ? 'apagões' : /Falta d/.test(t) ? 'falta d\'água' : /Incêndio/.test(t) ? 'incêndios' : /fechou/.test(t) ? 'comércios fechados' : /novo comerciante/.test(t) ? 'reaberturas' : /Furto/.test(t) ? 'furtos' : /bomba|Bomba/.test(t) ? 'bombas' : null; if (k) ev[k] = (ev[k] || 0) + 1; }
console.log('eventos:', JSON.stringify(ev));
const types = {}; for (const f of g.facs) types[f.k] = (types[f.k] || 0) + 1;
console.log('salas:', Object.entries(types).sort((a, b) => b[1] - a[1]).map(([k, n]) => k + ' ' + n).join(', '));
const occ = {}; for (const f of g.facs) if (FAC[f.k].tenant && f.build >= 1) { const o = occ[f.k] = occ[f.k] || {n: 0, ocupadas: 0, pessoas: 0}; o.n++; if (f.occ) { o.ocupadas++; o.pessoas += f.persons.length; } }
console.log('ocupação:', Object.entries(occ).map(([k, o]) => `${k} ${o.ocupadas}/${o.n} (${o.pessoas} pessoas)`).join(', '));
console.log(`tempo de execução: ${Math.round((Date.now() - wall0) / 1000)}s`);
