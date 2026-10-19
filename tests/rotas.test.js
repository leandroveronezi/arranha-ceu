'use strict';
// Modelo de tempo das rotas (escada × elevador): cada parte do custo — andar a pé, subir, esperar a cabine, fila — é testada sozinha,
// e o total previsto é comparado com viagens reais simuladas. Se mudar um custo, este arquivo diz o que deixou de bater.
const {K, TRANSPORT, ok, done, mk, put} = require('./helpers');
const {STAIR_COST, ESC_COST, WALK_COST, QUEUE_COST, WALK_SPEED, ELEV_BASE, ELEV_FLOOR, COST_PER_SEC} = K;

const world = (n, mode, o = {}) => {
  const g = mk(); for (let L = 1; L <= n; L++) g.placeFloorSpan(L, 0, 63);
  const room = put(g, 'office', n, 24);
  if (mode !== 'lift') for (let L = 0; L < n; L++) { const r = g.placeStairs(o.stair || 'stairs', L, 40); if (!r.ok) throw new Error(r.err); }
  let sh = null;
  if (mode !== 'stairs') { const r = g.placeShaft(o.shaft || 'elevator', 56, 0, n); if (!r.ok) throw new Error(r.err); sh = r.shaft; sh.cars[0].y = Math.min(o.carY || 0, n); }
  return {g, room, sh};
};
const from = {L: 0, x: 30};
// tempo previsto pelo modelo (segundos), igual ao que `route` usa para decidir
const predict = (g, room, staff = false) => {
  const a = g.nodeAt(0, from.x), b = g.nodeAt(room.L, room.x + room.w / 2), dx = room.x + 1;
  const l = g.search(a, from.x, staff).byNode.get(b);
  return l ? Math.min(...l.map(o => o.d + WALK_COST * Math.abs(o.x - dx))) / COST_PER_SEC : null;
};
const measure = (n, mode, o) => {
  const {g, room} = world(n, mode, o);
  const p = g.mkPerson('resident', room); p.st = 'idle'; p.L = 0; p.x = from.x; p.plan = []; p.transient = false; p.stress = 0; g.startTrip(p, room);
  let t = 0; for (; t < 300 && !(p.at === room && p.st === 'idle'); t += 0.05) g.step(0.05);
  return t;
};

// 1. calibração das unidades: o custo por segundo é coerente com o que o jogo faz de verdade
{
  const realStair = 5, realEsc = 2.5;   // segundos por andar (dur em game.js)
  ok(Math.abs(STAIR_COST / COST_PER_SEC - realStair) / realStair < 0.1, `escada: ${STAIR_COST} de custo ≈ ${realStair} s por andar (modelo diz ${(STAIR_COST / COST_PER_SEC).toFixed(1)} s)`);
  ok(Math.abs(ESC_COST / COST_PER_SEC - realEsc) / realEsc < 0.4, `escada rolante: ${ESC_COST} de custo ≈ ${realEsc} s por andar (modelo diz ${(ESC_COST / COST_PER_SEC).toFixed(1)} s)`);
  ok(Math.abs(WALK_COST / COST_PER_SEC - 1 / WALK_SPEED) / (1 / WALK_SPEED) < 0.25, `caminhada: ${(WALK_COST / COST_PER_SEC).toFixed(2)} s por unidade ≈ ${(1 / WALK_SPEED).toFixed(2)} s reais`);
  const v = TRANSPORT.elevator.vmax; ok(ELEV_FLOOR / COST_PER_SEC <= 2 / v, `subir um andar de elevador custa ${(ELEV_FLOOR / COST_PER_SEC).toFixed(2)} s no modelo (cabine real: ${(1 / v).toFixed(2)} s)`);
}

// 2. espera pela cabine: zero com a cabine no andar, cresce com a distância, soma o embarque em andamento, vale a mais próxima
{
  const {g, sh} = world(12, 'lift'), car = sh.cars[0], v = TRANSPORT.elevator.vmax;
  car.y = 5; car.dwell = 0;
  ok(g.carWait(sh, 5) === 0, 'cabine parada no andar: espera 0');
  const w3 = g.carWait(sh, 8), w6 = g.carWait(sh, 11);
  ok(Math.abs(w3 - 3 / v * COST_PER_SEC) < 1e-9 && Math.abs(w6 - 2 * w3) < 1e-9, 'a espera cresce na proporção da distância até a cabine (dividida pela velocidade)');
  car.dwell = 0.6; ok(Math.abs(g.carWait(sh, 5) - 0.6 * COST_PER_SEC) < 1e-9, 'cabine ainda embarcando no andar: espera = o que falta do embarque');
  car.dwell = 0; g.addCar(sh); sh.cars[1].y = 9;
  ok(Math.abs(g.carWait(sh, 8) - 1 / v * COST_PER_SEC) < 1e-9, 'com mais de uma cabine vale a mais próxima');
  ok(g.carWait({cat: 'stair', cars: []}, 3) === 0 && g.carWait(world(3, 'stairs').g.stairs[0], 1) === 0, 'escada não tem espera');
  const fake = k => ({cat: 'shaft', k, cars: [{y: 0, dwell: 0}]});
  ok(g.carWait(fake('express'), 8) < g.carWait(fake('elevator'), 8), 'o elevador expresso, mais rápido, espera menos pela mesma distância');
}

// 3. fila: sem fila não soma nada; cada pessoa soma QUEUE_COST
{
  const {g, room, sh} = world(4, 'lift'), base = predict(g, room);
  for (const n of [0, 1, 5, 10]) {
    sh.q[0] = Array.from({length: n}, () => ({step: {to: 4}})); g._pc = {}; g._pcT = g.simT;
    const t = predict(g, room);
    ok(Math.abs(t - base - n * QUEUE_COST / COST_PER_SEC) < 1e-6, `fila de ${n}: soma ${(n * QUEUE_COST / COST_PER_SEC).toFixed(1)} s (${n ? 'cresce' : 'zero sem fila'})`);
  }
}

// 4. as partes somam: tempo previsto de uma viagem só de escada e só de elevador
{
  const n = 4, s = world(n, 'stairs'), l = world(n, 'lift'), ts = predict(s.g, s.room), tl = predict(l.g, l.room);
  const a = 30, st = 40, rx = 24 + 1;
  const walkStairs = (Math.abs(a - (st + 1)) + (n - 1) * (st + 7 - (st + 1)) + Math.abs(st + 7 - rx)) * WALK_COST;
  ok(Math.abs(ts - (n * STAIR_COST + walkStairs) / COST_PER_SEC) < 0.05, `escada: ${n} andares × ${STAIR_COST} + caminhadas = ${ts.toFixed(1)} s`);
  const walkLift = (Math.abs(a - 58) + Math.abs(58 - rx)) * WALK_COST;
  ok(Math.abs(tl - (ELEV_BASE + n * ELEV_FLOOR + walkLift) / COST_PER_SEC) < 0.05, `elevador livre: base + ${n} andares + caminhadas = ${tl.toFixed(1)} s`);
}

// 5. o modelo bate com o jogo: previsto × medido em viagens reais
for (const [mode, label, opt] of [['stairs', 'escada', {}], ['stairs', 'escada rolante', {stair: 'escalator'}], ['lift', 'elevador (cabine no térreo)', {}], ['lift', 'elevador (cabine no topo)', {carY: 99}]]) {
  let worst = 0, worstN = 0;
  for (const n of [1, 2, 4, 6]) {
    const {g, room} = world(n, mode, opt); const pred = predict(g, room) + (opt.carY ? g.carWait(g.shafts[0], 0) / COST_PER_SEC : 0), real = measure(n, mode, opt);
    const err = Math.abs(real - pred); if (err > worst) { worst = err; worstN = n; }
    if (err > 3 + 0.3 * real) ok(false, `${label}, ${n} andares: previsto ${pred.toFixed(1)} s, real ${real.toFixed(1)} s`);
  }
  ok(true, `${label}: previsto × real bate (maior diferença ${worst.toFixed(1)} s, em ${worstN} andares)`);
}

// 6. decisão: a rota escolhida é a de menor tempo previsto, e o previsto aponta a melhor opção real
{
  let agree = 0, total = 0;
  for (const n of [1, 2, 3, 4, 5, 6, 8]) {
    const b = world(n, 'both'), a = b.g.nodeAt(0, from.x), t = b.g.nodeAt(n, b.room.x + b.room.w / 2), e = b.g.route(a, t, from.x, b.room.x + 1, false);
    const chosen = e.conn.cat === 'stair' ? 'stairs' : 'lift', real = {stairs: measure(n, 'stairs'), lift: measure(n, 'lift')};
    const best = real.stairs < real.lift ? 'stairs' : 'lift'; total++; if (chosen === best || Math.abs(real.stairs - real.lift) < 3) agree++;
  }
  ok(agree === total, `a escolha coincide com a opção realmente mais rápida (ou empata em 3 s) em ${agree} de ${total} distâncias`);
}
done('rotas');
