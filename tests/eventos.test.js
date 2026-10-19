'use strict';
// Apagão e falta d'água: derrubam a rede pública (só valem as fontes próprias), param elevadores, apagam câmeras, desligam sprinklers, passam sozinhos e entram no save.
const {FAC, UTIL, OUTAGE, ok, done, mk: mk0, put, roundTrip} = require('./helpers');
// estes testes medem a regra do próprio assunto, não o acesso: toda sala conta como alcançável (acesso: acesso.test.js e invariantes.test.js)
const mk = (...a) => { const g = mk0(...a); g.reachable = f => !f.dead && f.k !== 'ruin'; return g; };

const world = () => {
  const g = mk(120); g.msg = () => {}; g.star = 5; g.placeFloorSpan(-1, 0, 119); for (let L = 1; L <= 6; L++) g.placeFloorSpan(L, 0, 119);
  for (let L = 0; L < 6; L++) g.placeStairs('stairs', L, 100);
  return g;
};
const near = (a, b) => Math.abs(a - b) < 1e-6;

// 1. apagão: a rede some, só as fontes valem; elevadores param se a fonte não os sustenta
{
  const g = world(); const s = g.placeShaft('elevator', 80, 0, 6).shaft; g.addCar(s); g.addCar(s);
  g.utilFresh(); ok(!g.elevOff && g.util.energia.cap === UTIL.grid.energia, 'sem apagão: rede pública e elevadores ligados');
  g.outage.energia = g.t + 120; g._utk = null; g.utilFresh();
  ok(g.util.energia.cap === 0 && g.util.energia.out && g.elevOff, 'em apagão sem gerador a capacidade é 0 e os elevadores param');
  ok(g.carWait(s, 3) > 1000, 'a espera por um elevador parado é enorme (ninguém espera: vai de escada)');
  const c = s.cars[0]; const y0 = c.y; g.updPerson = () => {}; for (let i = 0; i < 50; i++) g.step(0.1); ok(c.y === y0 && c.dir === 0, 'as cabines ficam paradas');
  put(g, 'gerador', -1, 72); g._utk = null; g.utilFresh();
  ok(near(g.util.energia.cap, FAC.gerador.util.energia) && !g.elevOff, 'com um gerador os elevadores continuam (a fonte própria cobre as cabines)');
  g.outage.energia = g.t - 1; let msgs = []; g.msg = (t, c) => msgs.push(t); g.utilEvents();
  ok(!g.outage.energia && g.util.energia.cap === UTIL.grid.energia + FAC.gerador.util.energia && msgs.some(m => /energia voltou/.test(m)), 'o apagão passa sozinho e avisa que a energia voltou');
}

// 2. sorteio: sobrecarga multiplica a chance; só acontece com a torre de pé (população)
{
  const run = (setup, pop, n = 4000) => { let hits = 0; for (let i = 0; i < n; i++) { const g = world(); g.msg = () => {}; g.pop = pop; setup && setup(g); g.utilEvents(); if (g.outage.energia > g.t) hits++; } return hits; };
  const base = run(null, 400), low = run(null, 50);
  ok(base > 0 && base < 4000 * 0.01, `apagões são raros (${base} em 4000 horas)`);
  ok(low === 0, 'torre pequena (menos de 150 pessoas) não sofre apagão');
  const old = {...UTIL.grid}; UTIL.grid.energia = 1;
  try { const over = run(g => { put(g, 'office', 1, 0).occ = true; }, 400); ok(over > base * 2, `sobrecarga aumenta bastante a chance (${over} contra ${base})`); } finally { Object.assign(UTIL.grid, old); }
  const t = world(); t.pop = 400; const orig = Math.random; Math.random = () => 0; try { t.utilEvents(); } finally { Math.random = orig; }
  ok(t.outage.energia - t.t === OUTAGE.minutes[0], 'a duração parte de ' + OUTAGE.minutes[0] + ' minutos (até ' + OUTAGE.minutes[1] + ')');
}

// 3. câmeras e furtos no escuro
{
  const g = world(); const o = put(g, 'office', 1, 8); o.occ = true; put(g, 'corridorCam', 1, 0);
  ok(g.corrNear(o, 'cam'), 'a câmera cobre a sala');
  g.outage.energia = g.t + 60; g._utk = null; g.utilFresh();
  ok(o.cutE && !g.corrNear(o, 'cam'), 'sem energia a câmera falha');
  ok(get(g, o, 'util:energia') !== undefined && OUTAGE.crime > 1, 'a sala sem energia mostra o motivo e furtos sobem (×' + OUTAGE.crime + ')');
}
function get(g, f, key) { return g.evalBreakdown(f).find(o => o.key === key); }

// 4. falta d'água: sprinklers e hidrantes caem
{
  const g = world(); const o = put(g, 'office', 1, 8); o.occ = true; put(g, 'corridorSpr', 1, 0); put(g, 'corridorHyd', 1, 16);
  ok(g.corrNear(o, 'spr') && g.corrNear(o, 'hyd'), 'com água, cobertos');
  g.outage.agua = g.t + 60; g._utk = null; g.utilFresh();
  ok(o.cutA && !g.corrNear(o, 'spr') && !g.corrNear(o, 'hyd') && g.util.agua.out, 'na falta d\'água sprinklers e hidrantes falham');
  put(g, 'bomba', -1, 40); const cx = put(g, 'caixa', 1, 40); cx.lvl = 600; g._utk = null; g.utilFresh();
  ok(g.util.agua.cap === FAC.bomba.util.agua + FAC.caixa.util.store.rate && !o.cutA, 'bomba e caixa d\'água mantêm a torre pequena funcionando na falta da rede');
  ok(!g.elevOff, 'falta d\'água não para elevadores');
}

// 5. salvar e carregar
{
  const g = world(); g.outage.energia = g.t + 90; g.outage.agua = g.t + 30;
  const r = roundTrip(g);
  ok(r.outage.energia === g.outage.energia && r.outage.agua === g.outage.agua, 'o apagão em curso vai no save');
  const old = JSON.parse(JSON.stringify(g.serialize())); delete old.outage; const h = world(); h.load(old);
  ok(h.outage.energia === 0 && h.outage.agua === 0, 'save antigo (sem apagão) carrega sem falhar');
}
done('eventos');
