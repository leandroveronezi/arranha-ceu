'use strict';
// Teste de comportamento (golden master): roda cenários completos com sorteio FIXO e compara com `tests/snapshots/comportamento.json`.
// Qualquer mudança que altere as constantes ou o resultado das simulações aparece aqui como diferença.
// Mudou de propósito? Confira o que mudou, depois rode `npm run test:update` e revise o diff do JSON antes de commitar.
const fs = require('fs'), path = require('path');
const H = require('./helpers');
const {Game, FAC, CORR, TRUCK, SEC, K, TRANSPORT, CRIME_W, THEFT, FX_DUR, LIMITS, MAINT, PROX, NOISE, INCIDENT, NEAR, RIDE, ok, done, mk, put} = H;

const FILE = path.join(__dirname, 'snapshots', 'comportamento.json');
const UPDATE = process.argv.includes('--update');

// sorteio repetível (mulberry32); o jogo usa Math.random em tudo (nomes, eventos, falhas)
const realRandom = Math.random;
const seed = n => { let a = n >>> 0; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const r1 = v => Math.round(v * 10) / 10, r0 = Math.round;
const sub = (o, keys) => Object.fromEntries(keys.map(k => [k, o[k]]));

// 1. constantes e tabelas: dinheiro, estrelas, tamanhos, alcances, tempos
const constantes = () => ({
  K, CORR, TRUCK, SEC, THEFT, CRIME_W, FX_DUR, LIMITS, MAINT, PROX, NOISE, INCIDENT, NEAR, RIDE,
  TRANSPORT: Object.fromEntries(Object.entries(TRANSPORT).map(([k, v]) => [k, sub(v, ['cost', 'star', 'w', 'cap', 'vmax', 'board', 'maxSpan', 'carCost'])])),
  FAC: Object.fromEntries(Object.entries(FAC).map(([k, v]) => [k, sub(v, ['cost', 'star', 'w', 'h', 'pop', 'struct', 'corr', 'limit', 'cap', 'perCustomer'])])),
});

// contador de mensagens do jogo por tipo (primeiro caractere/emoji)
const counter = g => { const c = {}; g.msg = (t) => { const k = String(t).trim().slice(0, 2); c[k] = (c[k] || 0) + 1; }; return c; };
const tower = (floors, cars = 2, o = {}) => {
  const g = mk(); const msgs = counter(g);
  for (let L = 1; L <= floors; L++) g.placeFloorSpan(L, 0, 63);
  for (let L = 1; L <= floors; L++) for (const x of [0, 8, 16, 24]) {
    const kind = L % 5 === 0 && x === 16 ? 'restaurant' : L % 3 === 0 && x < 16 ? 'condo' : 'office';
    const r = g.placeFac(kind, L, x); if (r.ok) g.facs[g.facs.length - 1].build = 1;
  }
  for (let L = 0; L < floors; L++) g.placeStairs('stairs', L, 40);
  const s = g.placeShaft('elevator', 56, 0, floors).shaft; for (let i = 1; i < cars; i++) g.addCar(s);
  if (o.security) { const p = g.placeFac('security', 1, 32); if (p.ok) { g.facs[g.facs.length - 1].build = 1; g.onBuilt(g.facs[g.facs.length - 1]); } }
  return {g, s, msgs};
};
const run = (g, secs) => { for (let t = 0; t < secs; t += 0.1) g.step(0.1); };

// 2. cenários simulados
const cenarios = {
  torre12_3dias() {
    seed(1001); const {g, s, msgs} = tower(12, 2, {security: true}); let stair = 0, ride = 0, fails = 0; const ft = g.failTrip.bind(g); g.failTrip = p => { fails++; return ft(p); };
    for (let t = 0; t < 3 * 360; t += 0.1) { g.step(0.1); for (const p of g.people) { if (p.st === 'stair') stair++; if (p.st === 'ride') ride++; } }
    return {pop: g.pop, pessoas: g.people.length, avgEval: r0(g.avgEval), funds: r0(g.funds / 1000), ocorrencias: g.incidents.length, escadaPct: r0(100 * stair / (stair + ride + 1)), viagensPerdidas: fails, msgs};
  },
  elevadores_25andares() {
    const out = {};
    for (const cars of [1, 3]) {
      seed(2002); const {g, s} = tower(25, cars); let fails = 0, maxQ = 0; const ft = g.failTrip.bind(g); g.failTrip = p => { fails++; return ft(p); };
      for (let t = 0; t < 2 * 360; t += 0.1) { g.step(0.1); for (const k in s.q) maxQ = Math.max(maxQ, s.q[k].length); }
      out[cars + ' cabine(s)'] = {pop: g.pop, estresse: r1(g.people.reduce((a, p) => a + p.stress, 0) / Math.max(1, g.people.length)), viagensPerdidas: fails, maiorFila: maxQ};
    }
    return out;
  },
  incendios() {
    const out = {};
    const caso = (nome, setup) => {
      seed(3003); const g = mk(); const msgs = counter(g);
      for (let L = 1; L <= 8; L++) g.placeFloorSpan(L, 0, 63);
      for (let L = 0; L < 8; L++) g.placeStairs('stairs', L, 40);
      const room = put(g, 'office', 8, 16), nb = put(g, 'office', 8, 0);
      setup(g, room, nb); g.ignite(room, 'teste'); const f0 = g.funds; let t = 0, peak = 1;
      for (; t < 120; t += 0.1) { g.step(0.1); peak = Math.max(peak, room.fire || 0); if (!room.fire || room.dead) break; }
      out[nome] = {salvou: g.facs.includes(room), segundos: r1(t), picoDoFogo: r1(peak), gasto: r0((f0 - g.funds) / 1000), helicoptero: !!g.heli, msgs};
    };
    caso('sem_protecao', () => {});
    caso('extintor', (g, room, nb) => { put(g, 'corridorExt', 8, 12); const p = g.mkPerson('resident', nb); g.placeIn(p, nb); });
    caso('sprinklers', g => { put(g, 'corridorSpr', 8, 12); });
    caso('hidrante_e_escada', g => { put(g, 'corridorHyd', 8, 12); });
    return out;
  },
  seguranca_noites() {
    const out = {};
    for (const [nome, cfg] of [['sem_nada', {}], ['camera', {cam: true}], ['posto', {security: true}]]) {
      seed(4004); const g = mk(); const msgs = counter(g); g.pop = 400;
      for (let L = 1; L <= 3; L++) g.placeFloorSpan(L, 0, 63);
      for (let L = 0; L <= 1; L++) { const r = g.placeStairs('stairs', L, 56); if (!r.ok) throw new Error(r.err); }   // acesso até os andares 2 e 3: sala sem acesso não atende
      const bar = put(g, 'bar', 1, 16), shop = put(g, 'shop', 2, 0), off = put(g, 'office', 1, 40); shop.occ = true; off.occ = true;
      if (cfg.cam) put(g, 'corridorCam', 1, 8);
      if (cfg.security) { const p = put(g, 'security', 2, 16); g.onBuilt(p); p.persons.forEach(q => { q.st = 'idle'; q.at = p; }); }
      let brigas = 0, furtos = 0; g.crimeCheck = Game.prototype.crimeCheck;
      for (let n = 0; n < 4000; n++) {
        const crowd = []; if (g.people.length < 25) for (let k = 0; k < 20; k++) { const q = g.mkPerson('visitor', bar); g.placeIn(q, bar); q.stress = 0; crowd.push(q); }
        g.t = 20 * 60; bar.fight = null; g.incidents = []; for (const q of g.people) if (q.at === bar) q.stress = 0;
        g.crimeCheck(); if (bar.fight) brigas++; furtos += g.incidents.filter(i => i.k === 'theft').length;
      }
      out[nome] = {brigas, furtos};
    }
    return out;
  },
};

// roda cada cenário (duas vezes, para garantir que o sorteio fixo mesmo repete) e monta o resultado
const actual = {constantes: constantes()};
H.UTIL.reach.grid = 1e6;   // cenários de torres altas: o alcance da rede pública não é o assunto (rede.test.js cobre)
for (const [nome, fn] of Object.entries(cenarios)) {
  const a = fn(), b = fn();
  if (JSON.stringify(a) !== JSON.stringify(b)) { ok(false, `cenário "${nome}" não é repetível com o mesmo sorteio (algo no jogo usa aleatoriedade fora do Math.random)`); }
  actual[nome] = a;
}
Math.random = realRandom;

// compara em profundidade e lista as diferenças
const diff = (e, a, p = '') => {
  if (e && a && typeof e === 'object' && typeof a === 'object') return [...new Set([...Object.keys(e), ...Object.keys(a)])].flatMap(k => diff(e[k], a[k], p ? p + '.' + k : k));
  return JSON.stringify(e) === JSON.stringify(a) ? [] : [`${p}: era ${JSON.stringify(e)}, agora ${JSON.stringify(a)}`];
};
if (UPDATE) {
  fs.writeFileSync(FILE, JSON.stringify(actual, null, 1) + '\n');
  console.log('snapshot atualizado: ' + path.relative(process.cwd(), FILE) + ' (revise o diff antes de commitar)');
  process.exit(0);
}
if (!fs.existsSync(FILE)) { ok(false, 'falta o snapshot; gere com `npm run test:update`'); done('comportamento'); }
const expected = JSON.parse(fs.readFileSync(FILE, 'utf8'));
for (const sec of Object.keys({...expected, ...actual})) {
  const d = diff(expected[sec], actual[sec], sec);
  ok(d.length === 0, sec === 'constantes' ? 'constantes e tabelas do jogo (custos, estrelas, alcances, tempos) iguais ao snapshot' : `cenário "${sec}" se comporta como no snapshot` + (d.length ? '\n       ' + d.slice(0, 12).join('\n       ') + (d.length > 12 ? `\n       ... mais ${d.length - 12} diferenças` : '') + '\n       (mudou de propósito? `npm run test:update` e revise o diff)' : ''));
}
done('comportamento');
