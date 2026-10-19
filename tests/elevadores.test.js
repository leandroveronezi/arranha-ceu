'use strict';
// Elevadores: no máximo 3 cabines por poço; cada uma corre na sua pista, então são independentes.
const {Game, ok, done, mk, put} = require('./helpers');

const shaftOf = (g, a = 0, b = 10) => { const r = g.placeShaft('elevator', 32, a, b); if (!r.ok) throw new Error(r.err); return r.shaft; };
const spread = s => new Set(s.cars.map(c => Math.round(c.y))).size;

// limite e posicionamento
{
  const g = mk(), s = shaftOf(g);
  ok(g.addCar(s) === null && g.addCar(s) === null, 'dá para chegar a 3 cabines');
  ok(g.addCar(s) !== null && s.cars.length === 3, 'a 4ª cabine é recusada');
  ok(spread(s) === 3, 'as cabines nascem espalhadas pelo poço, em andares diferentes');
  const g2 = mk(), s2 = shaftOf(g2, 0, 1);
  ok(g2.addCar(s2) === null && g2.addCar(s2) === null && s2.cars.length === 3, 'mesmo um poço de 2 andares aceita 3 cabines (cada uma tem a sua pista)');
  const f0 = g.funds; ok(g.removeCar(s) === null && s.cars.length === 2, 'remover cabine continua funcionando');
}

// jogos antigos com mais de 3 cabines: sobram 3 e as outras são reembolsadas
{
  const g = mk(), s = shaftOf(g); g.addCar(s); g.addCar(s);
  const d = JSON.parse(JSON.stringify(g.serialize())); d.shafts[0].cars = 6; d.shafts[0].cy = [0, 1, 2, 3, 4, 5]; d.funds = 5e8;
  const g2 = new Game(); g2.msg = () => {}; g2.load(d);
  ok(g2.shafts[0].cars.length === 3, 'save antigo com 6 cabines vira 3');
  ok(g2.funds === 5e8 + 3 * 50000, 'as 3 cabines removidas são reembolsadas');
}

// cabines independentes: uma não espera pela outra
const run = (setup, secs, until) => {
  const g = mk(); g.updPerson = () => {}; g.advance = p => { p.done = true; };
  const s = shaftOf(g); g.addCar(s); g.addCar(s);
  const [a, b, c] = s.cars;
  const rider = (car, to) => { const p = {st: 'ride', stress: 0, board0: 0, step: {k: 'lift', conn: s, to}}; car.pax.push(p); return p; };
  const rs = setup(s, a, b, c, rider);
  let t = 0; for (; t < secs; t += 0.1) { g.step(0.1); if (until(rs)) break; }
  return {g, s, t, rs, cars: [a, b, c]};
};
const park = (cars, ys) => cars.forEach((car, i) => { car.y = ys[i]; car.dir = 0; car.dwell = 0; });
{
  const {t, rs} = run((s, a, b, c, rider) => { park([a, b, c], [3, 5, 10]); return rider(a, 8); }, 30, p => p.done);
  ok(rs.done && t < 6, 'a cabine passa pela outra e chega ao andar 8 sem esperar (' + t.toFixed(1) + ' s)');
}
{
  const {t, rs, cars} = run((s, a, b, c, rider) => { park([a, b, c], [3, 8, 11]); return rider(a, 8); }, 30, p => p.done);
  ok(rs.done && t < 6, 'destino com outra cabine parada no mesmo andar: desembarca na hora (' + t.toFixed(1) + ' s)');
  ok(Math.round(cars[1].y) === 8, 'a outra cabine não é empurrada nem se mexe');
}
{
  const {t, rs} = run((s, a, b, c, rider) => { park([a, b, c], [3, 8, 11]); b.dwell = 5; return rider(a, 8); }, 30, p => p.done);
  ok(rs.done && t < 6, 'a outra estar embarcando no mesmo andar não atrapalha (' + t.toFixed(1) + ' s)');
}

// torre cheia: mais cabines atendem melhor
const tower = cars => {
  const g = mk(), floors = 25;
  for (let L = 1; L <= floors; L++) for (const x of [0, 8, 16, 24, 36, 44, 52]) { const r = g.placeFac(L % 3 === 0 && x < 24 ? 'condo' : 'office', L, x); if (r.ok) g.facs[g.facs.length - 1].build = 1; }
  const s = g.placeShaft('elevator', 32, 0, floors).shaft; for (let i = 1; i < cars; i++) g.addCar(s);
  let fails = 0; const ft = g.failTrip.bind(g); g.failTrip = p => { fails++; return ft(p); };
  for (let t = 0; t < 3 * 360; t += 0.1) g.step(0.1);
  return fails;
};
{
  const one = tower(1), three = tower(3);
  ok(three < one, `3 cabines perdem menos viagens que 1 (${three} contra ${one})`);
}
// escolha entre escada e elevador: com o elevador livre, só vai de escada quem sobe 1 andar
const world = (n, mode, carY = 0) => {
  const g = mk(); for (let L = 1; L <= n; L++) g.placeFloorSpan(L, 0, 63);
  const room = put(g, 'office', n, 24);
  if (mode !== 'lift') for (let L = 0; L < n; L++) { const r = g.placeStairs('stairs', L, 40); if (!r.ok) throw new Error(r.err); }
  let sh = null; if (mode !== 'stairs') { const r = g.placeShaft('elevator', 56, 0, n); if (!r.ok) throw new Error(r.err); sh = r.shaft; sh.cars[0].y = Math.min(carY, n); }
  return {g, room, sh};
};
const firstStep = (g, room) => { const a = g.nodeAt(0, 30), b = g.nodeAt(room.L, room.x + room.w / 2), e = g.route(a, b, 30, room.x + 1, false); return e ? e.conn.cat : null; };
const trip = (n, mode, carY) => {
  const {g, room} = world(n, mode, carY);
  const p = g.mkPerson('resident', room); p.st = 'idle'; p.L = 0; p.x = 30; p.plan = []; p.transient = false; p.stress = 0; g.startTrip(p, room);
  let t = 0; for (; t < 200 && !(p.at === room && p.st === 'idle'); t += 0.05) g.step(0.05);
  return t;
};
{
  const pick = Array.from({length: 8}, (_, i) => { const {g, room} = world(i + 1, 'both'); return firstStep(g, room); });
  ok(pick[0] === 'stair' && pick.slice(1).every(c => c === 'shaft'), `elevador livre: 1 andar vai de escada, de 2 a 8 vai de elevador (${pick.map(c => c === 'stair' ? 'E' : 'V').join('')})`);
  let worst = 0;
  for (let n = 1; n <= 6; n++) {
    const {g, room} = world(n, 'both'); const p = g.mkPerson('resident', room); p.st = 'idle'; p.L = 0; p.x = 30; p.plan = []; p.transient = false; p.stress = 0; g.startTrip(p, room);
    let t = 0; for (; t < 200 && !(p.at === room && p.st === 'idle'); t += 0.05) g.step(0.05);
    worst = Math.max(worst, t - Math.min(trip(n, 'stairs'), trip(n, 'lift', 0)));
  }
  ok(worst < 3, `a escolha do jogo fica a menos de 3 s da melhor opção em viagens de 1 a 6 andares (pior diferença ${worst.toFixed(1)} s)`);
  const q = world(2, 'both'); q.sh.q[0] = Array.from({length: 15}, () => ({step: {to: 2}}));
  ok(firstStep(q.g, q.room) === 'stair', 'com 15 pessoas esperando o elevador, quem sobe 2 andares prefere a escada');
  const far = world(4, 'both', 4); ok(firstStep(far.g, far.room) === 'shaft', 'cabine parada no andar de cima: ainda vale o elevador para 4 andares');
}
done('elevadores');
