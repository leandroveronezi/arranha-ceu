'use strict';
// Casa de máquinas (acima) e poço (abaixo) do elevador: ocupam uma casa na coluna e servem para estender ou encurtar o poço.
const {TRANSPORT, ok, done, mk, put, roundTrip} = require('./helpers');

const world = (floors = 8) => { const g = mk(64); g.msg = () => {}; g.star = 5; g.placeFloorSpan(-1, 0, 63); g.placeFloorSpan(-2, 0, 63); for (let L = 1; L <= floors; L++) g.placeFloorSpan(L, 0, 63); return g; };

{
  const g = world(); const s = g.placeShaft('elevator', 32, 0, 4).shaft;
  ok(g.shaftCapAt(5, 32) === s && g.shaftCapAt(-1, 35) === s && !g.shaftCapAt(2, 32) && !g.shaftCapAt(5, 36), 'a casa de máquinas fica uma casa acima do último andar e o poço uma abaixo do primeiro, na coluna do elevador');
  ok(!g.canPlaceFac('office', 5, 32).ok && /casa de máquinas/.test(g.canPlaceFac('office', 5, 32).err) && !g.canPlaceFac('cafe', -1, 32).ok, 'não se constrói em cima delas');
  ok(g.canPlaceFac('office', 6, 32).ok && g.canPlaceFac('office', 5, 40).ok, 'mas acima delas e ao lado pode');
  ok(!g.canPlaceStairs('stairs', 5, 32).ok, 'nem escada');
}
{
  const g = world(); const s = g.placeShaft('elevator', 32, 0, 4).shaft, f0 = g.funds;
  const r = g.extendShaft(s, 1, 3);
  ok(r.ok && s.hi === 7 && s.lo === 0 && g.tg.get(7, 33) === s && g.tg.get(5, 33) === s && g.shaftCapAt(8, 32) === s, 'estender 3 andares para cima: o poço vai a 7 e a casa de máquinas sobe junto');
  ok(r.cost > 0 && near(f0 - g.funds, r.cost) && r.cost === g.shaftCost(s, 8) - g.shaftCost(s, 5), 'o custo é a diferença do poço (R$ ' + r.cost + ')');
  ok(g.stopsOf(s).includes(7) && !g.stopsOf(s).includes(8), 'o novo andar passa a ter parada');
  const d = g.extendShaft(s, -1, 2);
  ok(d.ok && s.lo === -2 && g.tg.get(-2, 33) === s && g.shaftCapAt(-3, 32) === s, 'estender para baixo cria subsolos e o poço desce junto');
  const car = s.cars[0]; ok(car.y >= s.lo && car.y <= s.hi, 'a cabine continua dentro do poço');
  ok(roundTrip(g).shafts[0].lo === -2 && roundTrip(g).shafts[0].hi === 7, 'o novo tamanho vai no save');
}
function near(a, b) { return Math.abs(a - b) < 1e-9; }
{
  const g = world(); const s = g.placeShaft('elevator', 32, 0, 4).shaft;
  put(g, 'office', 7, 32 - 0);
  ok(!g.extendShaft(s, 1, 3).ok, 'não estende por cima de uma sala (espaço ocupado)');
  const e = g.extendShaft(s, 1, 1); ok(e.ok && s.hi === 5, 'um andar cabe (a casa de máquinas vai para o 6)');
  ok(!g.extendShaft(s, 1, 1).ok, 'o seguinte esbarra na sala que está no andar da casa de máquinas');
  const h = world(); const t = h.placeShaft('elevator', 32, 0, 29).shaft; ok(/No máximo 30/.test(h.extendShaft(t, 1).err), 'respeita o máximo de andares do poço (30)');
  const x = world(); const q = x.placeShaft('elevator', 32, 0, 4).shaft; x.funds = 10; ok(/Dinheiro/.test(x.extendShaft(q, 1).err), 'sem dinheiro não estende');
  const ex = world(); ex.placeFloorSpan(15, 0, 63); ok(/expresso/.test(ex.extendShaft({k: 'express', lo: 0, hi: 15, x: 0, w: 8, cars: [], q: {}, off: {}}, 1).err), 'o expresso não se estende');
}
{
  const g = world(); const s = g.placeShaft('elevator', 32, 0, 6).shaft; g.addCar(s);
  const p = g.mkPerson('visitor', null); p.st = 'ride'; p.step = {to: 6}; s.cars[1].pax.push(p); s.cars[1].y = 6;
  const r = g.shrinkShaft(s, 1, 2);
  ok(r.ok && s.hi === 4 && !g.tg.get(5, 33) && !g.tg.get(6, 33), 'encurtar 2 andares libera as casas');
  ok(s.cars.every(c => c.y <= 4) && p.st === 'idle' && !s.cars[1].pax.length, 'quem estava na cabine nos andares removidos desce no novo topo');
  const t = g.shrinkShaft(s, 1, 10); ok(/pelo menos 2/.test(t.err), 'não deixa o poço com menos de 2 andares');
  ok(g.shrinkShaft(s, -1, 1).ok && s.lo === 1, 'também encurta por baixo');
}
done('poco');
