'use strict';
// Efeitos locais: nada age no prédio inteiro. Barulho, ocorrências, clínica, fluxo da boutique, humor da vizinhança,
// reputação do quarto, metrô e vagas dos moradores, atração de visitantes e de hóspedes: tudo pesa pela distância entre salas.
const {FAC, PROX, NOISE, INCIDENT, NEAR, RIDE, ok, done, mk: mk0, put} = require('./helpers');
// estes testes medem o efeito da distância, não o acesso: toda sala conta como alcançável (o acesso tem teste próprio em acesso.test.js)
const mk = (...a) => { const g = mk0(...a); g.reachable = f => !f.dead && f.k !== 'ruin'; return g; };

const world = (floors = 6) => {
  const g = mk(240); g.msg = () => {}; g.star = 5;
  for (let L = 1; L <= floors; L++) g.placeFloorSpan(L, 0, 239);
  return g;
};
const get = (g, f, key) => g.evalBreakdown(f).find(o => o.key === key);
const near = (a, b) => Math.abs(a - b) < 1e-9;
const crowd = (f, n) => { f.occ = true; f.persons = new Array(n).fill(0); return f; };   // gente "de mentira": só conta para quem circula perto

// 1. distância entre salas: folga horizontal + andares inteiros entre elas × 8
{
  const g = world(); const a = put(g, 'condo', 1, 0), b = put(g, 'office', 1, 16), c = put(g, 'office', 1, 24);
  const up = put(g, 'office', 2, 0), up2 = put(g, 'office', 3, 0);
  ok(g.roomDist(a, b) === 0 && g.roomDist(a, c) === 8 && g.roomDist(a, up) === 0, 'salas coladas (ao lado ou em cima) estão a 0; com 8 unidades de folga, a 8');
  ok(g.roomDist(a, up2) === PROX.floorUnits && g.roomDist(a, b) === g.roomDist(b, a), 'um andar inteiro de folga vale 8 unidades, e a distância é simétrica');
  ok(near(g.prox(a, c, 16), 0.5) && g.prox(a, c, 8) === 0 && g.prox(a, b, 16) === 1, 'o peso vai de 1 (colado) a 0 (no alcance)');
}

// 2. barulho por distância
{
  const at = (kind, x, L = 1) => { const g = world(); const a = put(g, 'condo', 1, 0); if (L > 1) for (let l = 1; l < L; l++) put(g, 'office', l + 1, 40); const o = put(g, kind, L, x); return {g, a, o}; };
  const noise = (kind, x) => { const {g, a} = at(kind, x); return g.noiseOf(a); };
  ok(near(noise('restaurant', 16), 1) && near(noise('restaurant', 24), 0.5) && noise('restaurant', 32) === 0, `restaurante colado pesa 1, a 8 unidades 0,5 e a 16 (alcance) nada`);
  ok(near(noise('bar', 32), 1 - 16 / NOISE.loudRange) && noise('bar', 48) === 0, `bar (muito barulhento) tem alcance maior: a 16 unidades ainda pesa ${(1 - 16 / NOISE.loudRange).toFixed(2)}`);
  const g = world(); put(g, 'restaurant', 1, 0); const a = put(g, 'condo', 1, 24); put(g, 'fastfood', 1, 40);
  ok(near(g.noiseOf(a), 2), 'fontes diferentes (uma de cada lado) somam: 2');
  const g2 = world(); put(g2, 'restaurant', 1, 0); const apt = put(g2, 'condo', 1, 24); put(g2, 'restaurant', 1, 40); put(g2, 'restaurant', 2, 24);
  ok(near(g2.noiseOf(apt), 3) && near(get(g2, apt, 'noise').v, -NOISE.cap), 'três fontes coladas pesam 3, mas o desconto tem teto (' + NOISE.cap + ')');
  const g3 = world(); const off = put(g3, 'office', 1, 0); put(g3, 'restaurant', 1, 8);
  ok(!get(g3, off, 'noise'), 'escritório não é sensível a barulho');
  const g4 = world(); const ap4 = put(g4, 'condo', 1, 0), far = put(g4, 'condo', 1, 100); put(g4, 'restaurant', 1, 16);
  ok(get(g4, ap4, 'noise') && !get(g4, far, 'noise') && g4.evalFac(far) === g4.evalFac(far), 'o barulho de um restaurante só chega perto, não no prédio todo');
  const g5 = world(); const a5 = put(g5, 'condo', 1, 0); put(g5, 'office', 2, 0); const up = put(g5, 'office', 3, 0); put(g5, 'restaurant', 3, 8);
  ok(g5.noiseOf(a5) > 0 && g5.noiseOf(a5) < 1, 'o barulho de dois andares acima chega mais fraco');
}

// 3. clínica e reciclagem por perto
{
  const g = world(); const a = put(g, 'condo', 1, 0), far = put(g, 'condo', 1, 120);
  put(g, 'clinic', -1, 0);
  const b = get(g, a, 'service');
  ok(b && near(b.v, NEAR.service.bonus * (1 - 8 / NEAR.service.range)), `a clínica um andar abaixo dá ${b && b.v.toFixed(1)} (10 × peso por distância)`);
  ok(!get(g, far, 'service'), 'uma unidade fora do alcance (32 unidades) não ganha nada');
  const g2 = world(); const u = put(g2, 'condo', 1, 0); ok(!get(g2, u, 'service'), 'sem clínica nem reciclagem por perto não há bônus');
}

// 4. fluxo de pessoas da boutique: só a gente que circula perto dela
{
  const g = world(); const shop = put(g, 'shop', 1, 0);
  ok(get(g, shop, 'traffic').v === -5, 'boutique sem ninguém por perto: pouco movimento (−5)');
  const o = crowd(put(g, 'office', 1, 12), 60);
  const t = get(g, shop, 'traffic');
  ok(t.v > 0 && near(t.v, Math.min(NEAR.traffic.cap, g.localPop(shop, NEAR.traffic.range) / NEAR.traffic.per)), `com 60 pessoas coladas o fluxo vira bônus (+${t.v.toFixed(1)})`);
  const g2 = world(); const s2 = put(g2, 'shop', 1, 0); crowd(put(g2, 'office', 1, 100), 500);
  ok(get(g2, s2, 'traffic').v === -5, 'gente longe (fora de 48 unidades) não conta, por mais numerosa que seja');
  const g3 = world(); const s3 = put(g3, 'shop', 1, 0), s4 = put(g3, 'shop', 1, 200); crowd(put(g3, 'office', 1, 12), 60);
  ok(get(g3, s3, 'traffic').v > 0 && get(g3, s4, 'traffic').v === -5, 'duas boutiques no mesmo prédio têm fluxos diferentes, cada uma o do seu lugar');
}

// 5. procura por aluguel: o humor dos vizinhos, não o do prédio
{
  const g = world(); const f = put(g, 'office', 1, 100);
  ok(g.localMood(f) === 150, 'sem vizinhos o humor da vizinhança é neutro (150)');
  const n1 = put(g, 'office', 1, 108); n1.occ = true; n1.eval = 40;
  const lowCh = g.rentChance(f);
  const g2 = world(); const f2 = put(g2, 'office', 1, 100); const m1 = put(g2, 'office', 1, 108); m1.occ = true; m1.eval = 250;
  ok(lowCh < g2.rentChance(f2), `vizinho infeliz derruba a procura (${(lowCh * 100).toFixed(0)}%) e vizinho feliz sobe (${(g2.rentChance(f2) * 100).toFixed(0)}%)`);
  const g3 = world(), gb = world(); const f3 = put(g3, 'office', 1, 100), far = put(g3, 'office', 1, 200); far.occ = true; far.eval = 10; g3.avgEval = 10;
  ok(near(g3.rentChance(f3), gb.rentChance(put(gb, 'office', 1, 100))), 'um inquilino infeliz longe (e a média do prédio) não mudam a procura daqui');
  const g4 = world(); const f4 = put(g4, 'office', 1, 100), c = put(g4, 'office', 1, 108), d = put(g4, 'office', 1, 140); c.occ = true; c.eval = 250; d.occ = true; d.eval = 10;
  ok(g4.localMood(f4) > 150, 'entre vizinhos feliz (perto) e infeliz (longe), pesa mais o mais perto');
}

// 6. reputação do quarto: quartos sujos por perto, não do hotel todo
{
  const g = world(); g.placeStairs('stairs', 0, 100);
  const A = [0, 4, 8].map(x => put(g, 'single', 1, x)), B = [180, 184, 188].map(x => put(g, 'single', 1, x));
  ok([...A, ...B].every(f => f.rep === 100), 'quartos começam com reputação 100');
  for (let d = 0; d < 3; d++) { A.forEach(f => { f.dirty = true; }); g.t = (g.day + 1) * 1440 + 60; g.newDay(); }
  ok(A.every(f => f.rep <= 80) && B.every(f => f.rep === 100), `quartos sujos derrubam só a reputação de quem está perto (${A.map(f => f.rep).join('/')} contra ${B.map(f => f.rep).join('/')})`);
  const ra = get(g, A[0], 'rep'), rb = get(g, B[0], 'rep');
  ok(ra && ra.v < 0 && (!rb || rb.v >= 0), 'e isso entra na nota do quarto como "Reputação do quarto e dos vizinhos"');
  ok(g.facs.filter(f => FAC[f.k].hotel).every(f => 'rep' in f), 'todo quarto tem reputação própria (e vai no save)');
}

// 7. metrô e vagas: afetam moradores, conforme quem costuma ter carro
{
  const g = world(); g.placeStairs('stairs', 0, 100);
  const prem = put(g, 'condo', 1, 60), promo = put(g, 'condo', 1, 80), off = put(g, 'office', 1, 120); prem.price = 0; promo.price = 3; prem.occ = true; promo.occ = true;
  ok(!get(g, prem, 'metro') && !get(g, prem, 'parking'), 'sem metrô nem vagas, não há bônus');
  put(g, 'transit', -3, 24);
  const mp = get(g, promo, 'metro'), mq = get(g, prem, 'metro');
  ok(mp && mq && mp.v > mq.v && near(mp.v, RIDE.metro * (1 - g.carShare(promo))), `metrô: ${mp.v.toFixed(1)} para quem mora numa faixa barata e ${mq.v.toFixed(1)} na faixa Premium`);
  ok(!get(g, off, 'metro') && !get(g, off, 'parking'), 'escritório não ganha bônus de metrô nem de vaga (só moradores)');
  put(g, 'parkramp', -1, 0); put(g, 'parkspace', -1, -4); put(g, 'parkspace', -1, -8);
  const pp = get(g, prem, 'parking'), pq = get(g, promo, 'parking');
  ok(pp && pq && pp.v > pq.v, `vagas: ${pp.v.toFixed(1)} para quem tem mais carro (Premium) e ${pq.v.toFixed(1)} para quem tem menos`);
  ok(g.carShare(prem) > g.carShare(promo), 'a chance de ter carro cresce com a faixa de preço (Premium ' + g.carShare(prem).toFixed(2) + ', Promoção ' + g.carShare(promo).toFixed(2) + ')');
  const sup1 = g.parkSupply();
  for (let i = 0; i < 5; i++) { const c = put(g, 'condo', 1, 128 + i * 16); c.price = 0; c.occ = true; }
  for (let i = 0; i < 3; i++) { const c = put(g, 'condo', 2, 128 + i * 16); c.price = 0; c.occ = true; }
  g._pk = null; g.t += 60;
  ok(g.parkSupply() < sup1, 'quando há mais carros do que vagas, o bônus das vagas diminui (' + sup1.toFixed(2) + ' → ' + g.parkSupply().toFixed(2) + ')');
  const g2 = world(); const c2 = put(g2, 'condo', 1, 60); c2.occ = true; put(g2, 'parkspace', -1, 16); ok(!get(g2, c2, 'parking'), 'vaga solta, sem rampa, não vale');
}

// 8. atração de visitantes e de hóspedes pelo lugar
{
  const run = () => {
    const g = world(); g.placeStairs('stairs', 0, 100); g.pop = 400;
    const bar1 = put(g, 'bar', 1, 0), bar2 = put(g, 'bar', 1, 200);
    for (let i = 0; i < 6; i++) crowd(put(g, 'office', 1, 16 + i * 8), 6);
    g.t = 2 * 1440 + 6 * 60; g.planCrowd(g.dayCtx());
    const by = new Map(); for (const p of g.people.filter(p => p.kind === 'visitor')) { const f = (p.plan[0] || {}).fac; by.set(f, (by.get(f) || 0) + 1); }
    return [by.get(bar1) || 0, by.get(bar2) || 0];
  };
  const [perto, longe] = run();
  ok(perto >= 5 && longe === 0, `um bar ao lado de gente recebe visitantes (${perto}) e um isolado, no mesmo prédio, nenhum (${longe})`);
  const guests = () => {
    const g = world(); g.placeStairs('stairs', 0, 100); g.pop = 400;
    const A = [], B = [];
    for (let i = 0; i < 12; i++) { A.push(put(g, 'single', 1, i * 4)); B.push(put(g, 'single', 1, 180 + i * 4)); }
    for (let i = 0; i < 6; i++) crowd(put(g, 'office', 1, 52 + i * 8), 40);
    g.t = 2 * 1440 + 6 * 60;
    let a = 0, b = 0; for (let k = 0; k < 40; k++) { g.people.length = 0; A.concat(B).forEach(f => { f.guests = []; }); g.planCrowd(g.dayCtx()); a += A.filter(f => f.guests.length).length; b += B.filter(f => f.guests.length).length; }
    return [a, b];
  };
  const [ga, gb] = guests();
  ok(ga > gb * 1.5, `quartos perto da gente que circula recebem mais hóspedes (${ga}) que os isolados (${gb})`);
}

// 9. nada vaza para o prédio todo: um evento longe (fora do alcance) não muda a nota de ninguém, só a de quem está perto
{
  const g = world(); g.placeStairs('stairs', 0, 100);
  const here = [put(g, 'condo', 1, 0), put(g, 'office', 1, 16), put(g, 'kitnet', 2, 0)], victim = put(g, 'shop', 1, 160), close = put(g, 'office', 1, 172);
  for (const f of [...here, close]) { f.occ = true; f.persons = []; }
  const snap = () => [...here, close].map(f => g.evalFac(f));
  const base = snap();
  g.addIncident('theft', victim); g.addIncident('fight', victim); g.addIncident('bomb', victim);
  const after = snap();
  ok(here.every((f, i) => near(base[i], after[i])), 'furto, briga e explosão num lugar não mexem na nota das unidades que estão longe');
  ok(after[3] < base[3], `e a unidade colada na boutique atingida sente (${Math.round(base[3])} → ${Math.round(after[3])})`);
  g.avgEval = 10; g.avgHotelEval = 10;
  ok(here.every((f, i) => near(after[i], snap()[i])), 'o humor médio do prédio, sozinho, não mexe na nota de nenhuma unidade');
  ok(!('safety' in g) && !('hotelRep' in g), 'não existem mais a "segurança do prédio" nem a "reputação do hotel" únicas');
}
done('local');
