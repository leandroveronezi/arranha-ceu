'use strict';
// Bicicletário: ciclistas (fixos por pessoa), bicicleta no elevador (2 vagas) quando não há onde guardar,
// bicicletário local por perto, bônus de demanda e furto de madrugada.
const {FAC, TRANSPORT, BIKE, ok, done, mk: mk0, put} = require('./helpers');
// estes testes medem o efeito da distância, não o acesso: toda sala conta como alcançável (o acesso tem teste próprio em acesso.test.js)
const mk = (...a) => { const g = mk0(...a); g.reachable = f => !f.dead && f.k !== 'ruin'; return g; };

const world = () => { const g = mk(240); g.msg = () => {}; g.star = 5; g.placeFloorSpan(-1, 0, 239); for (let L = 1; L <= 4; L++) g.placeFloorSpan(L, 0, 239); return g; };
const riders = (g, f) => f.persons.filter(p => g.bikes(p));

// 1. regras da sala
{
  const g = world();
  ok(FAC.bike.star === 1 && FAC.bike.svc === 'bike' && FAC.bike.cost < FAC.parkspace.cost * 20, 'o bicicletário é de 1★ e barato');
  ok(g.canPlaceFac('bike', -1, 100).ok && g.canPlaceFac('bike', 2, 100).ok, 'pode ficar em qualquer andar (nos andares altos o bicicletário do térreo nunca estaria por perto)');
}

// 2. quem pedala é fixo por pessoa, em torno da fatia definida, só de trabalhadores e kitnets
{
  const g = world(); const off = put(g, 'office', 1, 0), kit = put(g, 'kitnet', 2, 0), apt = put(g, 'condo', 3, 0);
  const pool = []; for (let i = 0; i < 2000; i++) pool.push(g.mkPerson('worker', off));
  const n = pool.filter(p => g.bikes(p)).length;
  ok(Math.abs(n / 2000 - BIKE.share) < 0.03 && pool.every(p => g.bikes(p) === g.bikes(p)), `cerca de ${BIKE.share * 100}% dos trabalhadores pedalam (${(n / 20).toFixed(1)}%), sempre os mesmos`);
  ok(!g.bikes(g.mkPerson('visitor', null)) && !g.bikes(g.mkPerson('resident', apt)), 'visitantes e moradores de apartamento não pedalam');
  const k = []; for (let i = 0; i < 500; i++) k.push(g.mkPerson('resident', kit)); ok(k.some(p => g.bikes(p)), 'moradores de kitnet pedalam');
}

// 3. com e sem bicicletário por perto
{
  const g = world(); const off = put(g, 'office', 1, 0);
  let cyc = null; for (let i = 0; i < 200 && !cyc; i++) { const p = g.mkPerson('worker', off); if (g.bikes(p)) cyc = p; }
  const plain = g.mkPerson('worker', off); while (g.bikes(plain)) { plain.id++; }
  ok(g.slots(cyc) === BIKE.slots && g.slots(plain) === 1, `sem bicicletário a bicicleta sobe no elevador e ocupa ${BIKE.slots} vagas`);
  put(g, 'bike', -1, 8);
  ok(g.slots(cyc) === 1, 'com bicicletário por perto ela fica guardada e ocupa 1 vaga');
  const g2 = world(); const o2 = put(g2, 'office', 4, 200); put(g2, 'bike', -1, 8); let c2 = null; for (let i = 0; i < 200 && !c2; i++) { const p = g2.mkPerson('worker', o2); if (g2.bikes(p)) c2 = p; }
  ok(g2.slots(c2) === BIKE.slots, 'um bicicletário longe do escritório não ajuda (é local)');
}

// 4. cabine: bicicleta ocupa mais lugar
{
  const g = world(); g.updPerson = () => {}; const off = put(g, 'office', 1, 0);
  const s = g.placeShaft('elevator', 32, 0, 4).shaft, car = s.cars[0], cap = TRANSPORT.elevator.cap;
  const mkp = bike => { const p = g.mkPerson('worker', off); if (bike) { while (!g.bikes(p)) p.id++; } else while (g.bikes(p)) p.id++; p.st = 'wait'; p.L = 0; p.step = {to: 1}; p.wait0 = 0; return p; };
  const full = n => Array.from({length: n}, () => mkp(false));
  s.q[0] = full(cap - 1).concat([mkp(true)]); car.y = 0; car.dir = 0; car.pax = [];
  g.stopAt(s, car, 0);
  ok(g.carLoad(car) <= cap && car.pax.length === cap - 1 && s.q[0].length === 1, `a bicicleta não cabe no último lugar (${car.pax.length} a bordo, carga ${g.carLoad(car)}/${cap}); fica na fila`);
  const g2 = world(); const o2 = put(g2, 'office', 1, 0); const s2 = g2.placeShaft('elevator', 32, 0, 4).shaft;
  const b = g2.mkPerson('worker', o2); while (!g2.bikes(b)) b.id++; b.step = {to: 1}; b.wait0 = 0; s2.q[0] = [b]; s2.cars[0].y = 0; s2.cars[0].dir = 0;
  g2.stopAt(s2, s2.cars[0], 0); ok(s2.cars[0].pax.length === 1, 'cabine vazia sempre aceita quem leva bicicleta');
  const g3 = world(); const o3 = put(g3, 'office', 1, 0); const s3 = g3.placeShaft('elevator', 32, 0, 4).shaft;
  const a = g3.mkPerson('worker', o3), bk = g3.mkPerson('worker', o3); while (!g3.bikes(bk)) bk.id++; while (g3.bikes(a)) a.id++;
  s3.q[0] = [a, bk, a]; ok(g3.queueLen(s3, 0) === 1 + BIKE.slots + 1, 'a fila conta as vagas (bicicleta pesa mais)');
}

// 5. demanda: o bicicletário conta como serviço por perto
{
  const g = world(); const off = put(g, 'office', 1, 8);
  const before = g.evalFac(off); put(g, 'bike', -1, 16);
  ok(g.demandFactors(off).find(d => d.svc === 'bike').met && g.evalFac(off) - before > 0, 'o escritório ganha "Tem bicicletário por perto"');
}

// 6. furto de bicicletas
{
  const run = (setup, nights = 40000) => {
    const g = world(); g.pop = 400; const off = put(g, 'office', 1, 8); off.occ = true; for (let i = 0; i < 50 && !riders(g, off).length; i++) g.moveIn(off); const bk = put(g, 'bike', -1, 16); setup && setup(g, bk);
    let hits = 0; g.addFx = () => {}; const orig = g.addIncident.bind(g); g.addIncident = (k, f) => { if (f === bk) hits++; return orig(k, f); };
    for (let i = 0; i < nights; i++) g.bikeTheft();
    return {hits, g, off, bk};
  };
  const a = run(null);
  ok(a.hits > 0 && a.hits < 40000, `bicicletas são furtadas de vez em quando (${a.hits} em 40000 noites)`);
  const cam = run((g, bk) => { put(g, 'corridorCam', -1, 24); });
  ok(cam.hits < a.hits * 0.8, `câmera por perto reduz (${cam.hits} < ${a.hits})`);
  const none = run((g, bk) => { g.moveIn = () => {}; g.facs.find(f => f.k === 'office').occ = false; });
  ok(none.hits === 0, 'sem ciclistas por perto não há o que furtar');
}
done('bicicleta');
