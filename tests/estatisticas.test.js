'use strict';
// Histórico por hora que alimenta os gráficos de Estatísticas (energia, água, reservas, lixo, filas) e o lixo entrando por hora.
const {FAC, LIXO, ok, done, mk: mk0, put, roundTrip} = require('./helpers');
// mede o histórico por hora, não o acesso: toda sala conta como alcançável
const mk = (...a) => { const g = mk0(...a); g.reachable = f => !f.dead && f.k !== 'ruin'; return g; };

const world = () => { const g = mk(120); g.msg = () => {}; g.star = 5; g.placeFloorSpan(-1, 0, 119); g.placeFloorSpan(-2, 0, 119); for (let L = 1; L <= 4; L++) g.placeFloorSpan(L, 0, 119); g.pop = 100; return g; };
const near = (a, b) => Math.abs(a - b) < 1e-9;

{
  const g = world(); const dep = put(g, 'lixo', -2, 32), o = put(g, 'office', 1, 24); o.occ = true; g.moveIn(o); put(g, 'bateria', -1, 0); g.store.energia = 250;
  ok(g.uhist.length === 0, 'começa sem histórico');
  for (let h = 0; h < 80; h++) { g.t += 60; g.utilEvents(); }
  ok(g.uhist.length === 72, 'guarda só as últimas 72 horas');
  const l = g.uhist[g.uhist.length - 1];
  ok(['t', 'e', 'a', 'se', 'sa', 'l', 'q', 'oe', 'oa'].every(k => Number.isFinite(l[k])) && l.e >= 0 && l.se > 0 && l.l > 0, 'cada hora registra consumo, reservas, lixo, fila e apagão (' + JSON.stringify(l) + ')');
  const r = roundTrip(g); ok(r.uhist.length === 72 && r.uhist[71].e === l.e, 'o histórico vai no save');
  const old = JSON.parse(JSON.stringify(g.serialize())); delete old.uh; const k = world(); k.load(old); ok(Array.isArray(k.uhist) && k.uhist.length === 0, 'save antigo carrega com histórico vazio');
}
// lixo por hora
{
  const g = world(); const dep = put(g, 'lixo', -2, 32), o = put(g, 'office', 1, 24); o.occ = true; g.moveIn(o);
  const day = g.trashOf(o); g.trashHourly(); ok(near(dep.lixo, day / 24), 'a cada hora entra 1/24 do lixo diário (' + dep.lixo.toFixed(2) + ' de ' + day.toFixed(1) + ')');
  for (let h = 1; h < 24; h++) g.trashHourly(); ok(near(dep.lixo, day), 'em 24 horas entra o total do dia');
  const g2 = world(); const rec = put(g2, 'recycling', 1, 40); rec.lixo = 100; g2.trashHourly(); ok(near(rec.lixo, 100 - FAC.recycling.waste.process / 24), 'a usina também processa por hora');
  const g3 = world(); put(g3, 'lixo', -2, 32); const o3 = put(g3, 'office', 1, 24); o3.occ = true; g3.moveIn(o3); const d3 = g3.facs.find(f => f.k === 'lixo'); g3.t = 3 * 1440; g3.star = 2; g3.utilEvents(); ok(!d3.lixo, 'antes do 3★ o lixo não acumula');
}
done('estatisticas');
