'use strict';
// Utilitários dos testes: carrega data.js e game.js sem navegador e monta torres pequenas.
const fs = require('fs'), vm = require('vm'), path = require('path');

const ctx = vm.createContext({console, Math, Date, performance: {now: () => Date.now()}, window: {}, document: {}, localStorage: {}, location: {search: ''}});
const src = ['data', 'game', 'saves', 'cheats', 'sons'].map(f => fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8')).join('\n;');
vm.runInContext(src + '\n;globalThis.__API = {SoundMix, SONS, SOM_CATS, SOM_MAX_TOTAL, SOM_DUCK, grammelot, GRAMMELOT, Cheats, Game, FAC, CORR, TRUCK, SEC, STREET, X_MIN, X_MAX, SaveStore, upgradeSave, SAVE_SLOTS, SAVE_KEYS, K: {STAIR_COST, ESC_COST, WALK_COST, QUEUE_COST, WALK_SPEED, ELEV_BASE, ELEV_FLOOR, EXPR_BASE, EXPR_FLOOR, COST_PER_SEC, MIN_PER_SEC, SAVE_VERSION}, TRANSPORT, CARLIFT, CRIME_W, THEFT, FX_DUR, LIMITS, MAINT, PROX, NOISE, INCIDENT, NEAR, RIDE, BIKE, HAIL, SVC_STAR, SVC_NAMES, WEATHER, WEATHER_KEYS, WEATHER_ODDS, UTIL, USE, UPRIO, LIXO, TRAIN, LINES, BIZ, STORM, weatherName, OUTAGE, SEASONS, SEASON_DAYS, YEAR_DAYS, DEMAND, DEMAND_EXTRA, DEMANDV, SERVICES};', ctx);
const {SoundMix, SONS, SOM_CATS, SOM_MAX_TOTAL, SOM_DUCK, grammelot, GRAMMELOT, Cheats, Game, FAC, CORR, TRUCK, SEC, STREET, X_MIN, X_MAX, SaveStore, upgradeSave, SAVE_SLOTS, SAVE_KEYS, K, TRANSPORT, CARLIFT, CRIME_W, THEFT, FX_DUR, LIMITS, MAINT, PROX, NOISE, INCIDENT, NEAR, RIDE, BIKE, HAIL, SVC_STAR, SVC_NAMES, WEATHER, WEATHER_KEYS, WEATHER_ODDS, UTIL, USE, UPRIO, LIXO, TRAIN, LINES, BIZ, STORM, weatherName, OUTAGE, SEASONS, SEASON_DAYS, YEAR_DAYS, DEMAND, DEMAND_EXTRA, DEMANDV, SERVICES} = ctx.__API;

// rede de teste: os testes de assuntos que não são energia/água precisam de rede pública generosa (no jogo real a água não vem da rua e a energia é pouca: ver UTIL em data.js).
// Quem testa a rede de verdade usa `REAL_GRID` (os valores do jogo) e restaura.
const REAL_GRID = {...UTIL.grid};
UTIL.grid.energia = 1400; UTIL.grid.agua = 800;
const useRealGrid = () => { UTIL.grid.energia = REAL_GRID.energia; UTIL.grid.agua = REAL_GRID.agua; };

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) fails++; };
const done = name => { console.log(fails ? `${name}: ${fails} FALHA(S)` : `${name}: TUDO OK`); process.exit(fails ? 1 : 0); };

// jogo novo com dinheiro de sobra, 5 estrelas e um saguão (64 unidades por padrão) no térreo
const mk = (lobbyW = 64) => {
  const g = new Game(); g.funds = 1e9; g.star = 5; g.msg = () => {};
  const r = g.placeFac('lobby', 0, 0, {w: lobbyW}); if (!r.ok) throw new Error(r.err);
  g.facs.forEach(f => f.build = 1);
  return g;
};
// constrói e já termina a obra
const put = (g, k, L, x, o) => {
  const r = g.placeFac(k, L, x, o); if (!r.ok) throw new Error(k + ': ' + r.err);
  const f = g.facs[g.facs.length - 1]; f.build = 1; return f;
};
// pessoa mínima para os testes (não passa por updPerson: use g.updPerson = () => {} ao chamar step)
const person = (at, st = 'idle') => ({dead: false, st, at});
const roundTrip = g => { const g2 = new Game(); g2.msg = () => {}; g2.load(JSON.parse(JSON.stringify(g.serialize()))); return g2; };

module.exports = {REAL_GRID, useRealGrid, SoundMix, SONS, SOM_CATS, SOM_MAX_TOTAL, SOM_DUCK, grammelot, GRAMMELOT, Cheats, Game, FAC, CORR, TRUCK, SEC, STREET, X_MIN, X_MAX, SaveStore, upgradeSave, SAVE_SLOTS, SAVE_KEYS, K, TRANSPORT, CARLIFT, CRIME_W, THEFT, FX_DUR, LIMITS, MAINT, PROX, NOISE, INCIDENT, NEAR, RIDE, BIKE, HAIL, SVC_STAR, SVC_NAMES, WEATHER, WEATHER_KEYS, WEATHER_ODDS, UTIL, USE, UPRIO, LIXO, TRAIN, LINES, BIZ, STORM, weatherName, OUTAGE, SEASONS, SEASON_DAYS, YEAR_DAYS, DEMAND, DEMAND_EXTRA, DEMANDV, SERVICES, ok, done, mk, put, person, roundTrip};
