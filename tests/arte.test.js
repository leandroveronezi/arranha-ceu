'use strict';
// Teste de fumaça do desenho: roda os painters de art.js com um canvas falso para pegar exceções e valores NaN.
// Não confere como fica na tela: isso só abrindo o jogo.
const fs = require('fs'), vm = require('vm'), path = require('path');
const {ok, done} = require('./helpers');

const calls = {n: 0, nan: 0};
const c = new Proxy({}, {
  get: (t, k) => (k in t ? t[k] : k === 'createLinearGradient' ? () => ({addColorStop() {}}) : (...a) => { calls.n++; for (const v of a) if (typeof v === 'number' && !Number.isFinite(v)) { calls.nan++; calls.last = k; } }),
  set: (t, k, v) => { t[k] = v; return true; },
});
const ctx = vm.createContext({console, Math, Date, performance: {now: () => 0}, window: {}, document: {}, localStorage: {}, location: {search: ''}});
const src = ['data', 'game', 'art', 'art-salas'].map(f => fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8')).join('\n;');
vm.runInContext(src + '\n;globalThis.__A = {paintNoUtil, FAC, FX_DUR, paintFx, paintBomb, paintSprinkle, paintFacility, paintTruck, paintFire, paintActor, paintPerson, paintHeliDrop, paintMachineRoom, paintShaftPit, paintCar, paintStairs};', ctx);
const {paintNoUtil, paintMachineRoom, paintShaftPit, paintCar, paintStairs, FAC, FX_DUR, paintFx, paintBomb, paintSprinkle, paintFacility, paintTruck, paintFire, paintActor, paintPerson, paintHeliDrop} = ctx.__A;

const room = {id: 5, k: 'office', L: 3, x: 8, w: 8, h: 1, build: 1};
const corr = {k: 'corridorExt', L: 3, x: 24, w: 4, h: 1, build: 1};
const US = [0, 0.1, 0.34, 0.5, 0.84, 0.9, 1];

for (const k of Object.keys(FX_DUR)) {
  const before = calls.n; let err = null;
  try { for (const u of US) for (const ok2 of [true, false]) paintFx(c, {k, f: room, from: corr, ok: ok2, level: 1.2}, u, 1.7); } catch (e) { err = e; }
  ok(!err && calls.n > before, `efeito "${k}" desenha sem erro em todas as fases` + (err ? ': ' + err.message : ''));
}
ok(!!FX_DUR.ext && Object.keys(FX_DUR).length >= 5, 'todos os eventos têm duração definida');
{
  let err = null;
  try {
    for (const left of [0, 5, 59, 60, 240]) paintBomb(c, 64, -144, 64, 36, 2.2, left);
    paintSprinkle(c, 64, -144, 64, 36, 1.1); paintFire(c, 64, -144, 64, 36, 1, 1.5, false); paintActor(c, 10, 0, 1, 1, '#c33', true);
    paintTruck(c, 100, 7, 1, 2, true);
  } catch (e) { err = e; }
  ok(!err, 'bomba, sprinklers, fogo, pessoa e caminhão desenham sem erro' + (err ? ': ' + err.message : ''));
}
{
  let err = null, n = 0;
  try {
    for (const k of ['corridor', 'corridorExt', 'corridorSpr', 'corridorHyd', 'corridorCam']) for (const lod of [true, false]) for (const night of [true, false]) {
      paintFacility(c, {...corr, k, id: 7}, 0, -108, 32, 36, {night, lit: 0, vacant: false, lod, train: null, time: 3}); n++;
    }
  } catch (e) { err = e; }
  ok(!err && n === 20, 'os 5 corredores desenham com e sem detalhe, de dia e de noite' + (err ? ': ' + err.message : ''));
}
{
  let err = null;
  try { for (const kind of ['firefighter', 'staff', 'resident', 'visitor', 'vip']) for (const lod of [true, false]) paintPerson(c, {id: 7, kind, home: null, look: 3, stress: 40, st: 'walk', step: null, x: 10, task: null}, 10, 0, 2, lod); } catch (e) { err = e; }
  ok(!err, 'o bombeiro e os outros tipos de pessoa desenham sem erro' + (err ? ': ' + err.message : ''));
}
{
  let err = null;
  try {
    for (const hold of [6, 3, 0]) for (const reason of ['bomb', 'fire']) for (const phase of ['in', 'hold', 'out']) paintHeliDrop(c, {phase, reason, hold, fac: room}, 100, -200, 1.3);
    paintHeliDrop(c, {phase: 'hold', reason: 'fire', hold: 3, fac: {...room, dead: true}}, 100, -200, 1);
  } catch (e) { err = e; }
  ok(!err, 'a sacola do resgate e a água do helicóptero desenham sem erro' + (err ? ': ' + err.message : ''));
}
{
  // salas animadas: utilidades (reservatórios, geradores, placa solar), hotel dormindo, cinema com filme, saguão decorado, poço e casa de máquinas
  let err = null, n = 0;
  try {
    const mkf = (k, L = 1, x = 8) => ({id: 11, k, L, x, w: FAC[k].w, h: FAC[k].h, build: 1, guests: [{}], persons: [], dirty: false, bugs: 0, film: 2, fire: 0, price: 1, sty: 12345, lixo: 120, truckEta: 5});
    for (const k of ['caixa', 'caixaMedia', 'caixaGrande', 'caixaTorre', 'bateriaPequena', 'bateriaGrande', 'bombaMedia', 'bombaForte', 'bombaRecalque', 'bateria', 'gerador', 'geradorGas', 'bomba', 'tratamento', 'solar', 'lixo', 'tunnelPortal', 'tunnelPortal2', 'tunnelCam', 'heliport', 'housekeeping', 'shop', 'academia', 'parkspace', 'bike']) for (const lvl of [0, 0.4, 1]) for (const night of [true, false]) for (const lod of [true, false]) {
      paintFacility(c, mkf(k), 0, -72, FAC[k].w * 8, FAC[k].h * 36, {night, lit: 0, vacant: false, lod, lvl, sun: lvl, time: 7.3}); n++;
    }
    for (const k of ['single', 'twin', 'suite']) for (const dark of [true, false]) for (const wl of [0, 1, 2, 3]) {
      const f = mkf(k); f._dark = dark; f.price = wl;
      paintFacility(c, f, 0, -72, FAC[k].w * 8, 36, {night: true, lit: 1, vacant: false, lod: true, time: 4.1}); n++;
    }
    for (const lit of [0, 3, 40]) for (const film of [0, 3, 7]) { const f = mkf('cinema', 1, 0); f.film = film; paintFacility(c, f, 0, -72, FAC.cinema.w * 8, 72, {night: false, lit, vacant: false, lod: true, time: 9.9}); n++; }
    for (const L of [0, 15, -1]) for (const x of [0, 4, 36]) { const f = mkf('lobby', L, x); f.w = 12; paintFacility(c, f, x * 8, -36 * (L + 1), 96, 36, {night: true, lit: 2, vacant: false, lod: true, time: 1}); n++; }
    for (const line of [0, 1, 2, 3, 4]) for (const ph of ['none', 'arrive', 'open', 'leave']) { const f = mkf('transit', -3, 0); f.line = line; paintFacility(c, f, 0, -108, 512, 108, {night: false, lit: 0, vacant: false, lod: true, time: 3, train: {phase: ph, p: .5, next: 40}, tdir: line % 2 ? -1 : 1, tclip: true}); n++; }
    const s = {x: 4, w: 4, lo: 0, hi: 5, k: 'elevator', cars: [{y: 2, dir: 1, pax: [], dwell: 0}, {y: 0, dir: 0, pax: [], dwell: 0}], q: {}, off: {}};
    for (const powered of [true, false]) for (const z of [0.2, 1]) { paintMachineRoom(c, s, 3.3, powered, {z}); paintShaftPit(c, s, {z}); n++; }
    paintCar(c, s, s.cars[0], 0, 2); paintCar(c, s, {y: 1, dir: -1, pax: new Array(30), dwell: 1}, 1, 2); paintStairs(c, {x: 2, w: 4, L: 1, k: 'escalator'}, 5.5, false);
  } catch (e) { err = e; }
  ok(!err && n > 100, 'utilidades animadas, hotel dormindo, cinema, saguão, poço e casa de máquinas desenham sem erro' + (err ? ': ' + err.message : ''));
}
{
  let err = null, n = 0;
  try { for (const act of [undefined, 'sit', 'dance', 'drink', 'wait', 'browse', 'gym']) for (const k of ['restaurant', 'cinema', 'lobby']) for (const lod of [true, false]) { paintPerson(c, {id: 5, kind: 'visitor', home: null, look: 3, stress: 20, st: 'idle', step: null, x: 0, at: {k}}, 10, 0, 2.2, lod, act); n++; } } catch (e) { err = e; }
  ok(!err && n === 42, 'as ações das pessoas (sentar, dançar, beber, esperar, olhar vitrine, malhar) desenham sem erro' + (err ? ': ' + err.message : ''));
}
// toda sala do catálogo, com e sem detalhe, de dia e de noite, ocupada/vaga e com as opções que o jogo passa (fila, caminhão, nível, trem...): pega variável esquecida
{
  const errs = []; let n = 0;
  const base = {lod: true, time: 3, lit: 0, train: null, tdir: 1, tclip: true, lvl: .5, sun: 1, fill: .5, st: 2, truckP: .5, rushNow: 3, traffic: true, theme: 2, edgeL: true, edgeR: true, heliAway: false, open: true};
  for (const k of Object.keys(FAC)) {
    if (k === 'ruin') continue;
    for (const lod of [true, false]) for (const night of [true, false]) for (const extra of [{}, {vacant: true, lit: 9}, {theme: 0, rushNow: 0, open: false}, {heliAway: true, train: {phase: 'open', p: .5, next: 10}}]) {
      const d = FAC[k], f = {id: 9, k, L: 1, x: 0, w: d.w, h: d.h, build: 1, fire: 0, guests: [{}], persons: [], emp: [], occ: true, rush: 5, closed: false, lixo: 100, truckEta: 5, owner: {id: 3}, line: 1, film: 0};
      try { paintFacility(c, f, 0, -108, d.w * 8, d.h * 36, {...base, night, lod, ...extra}); n++; } catch (e) { errs.push(k + ': ' + e.message); }
    }
  }
  ok(errs.length === 0 && n > 400, 'toda sala do catálogo desenha com e sem detalhe, dia e noite (' + n + ' desenhos)' + (errs.length ? ' — ' + errs.slice(0, 3).join(' | ') : ''));
}
{ let err = null; try { for (const e of [true, false]) for (const a of [true, false]) for (const lod of [true, false]) paintNoUtil(c, 0, -36, 64, 36, e, a, 3, lod); } catch (x) { err = x; } ok(!err, 'sala sem energia/água desenha o raio e a gota' + (err ? ': ' + err.message : '')); }
ok(calls.nan === 0, 'nenhum desenho recebeu NaN' + (calls.nan ? ' (último: ' + calls.last + ')' : ''));
done('arte');
