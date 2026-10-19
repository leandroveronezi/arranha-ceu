'use strict';
// Desempenho: não deixa voltar custos quadráticos. Mede o passo da simulação em torres de tamanhos diferentes e confere que o tempo
// cresce quase em proporção ao tamanho (e não ao quadrado). Usa razões entre medidas, então não depende da velocidade da máquina.
const {Game, ok, done} = require('./helpers');

const build = (floors, perFloor) => {
  const g = new Game(); g.funds = 1e13; g.star = 5; g.msg = () => {};
  const W = perFloor * 8 + 40;
  g.placeLobbySpan(0, 0, W - 1); g.facs.forEach(f => { f.build = 1; });
  for (let L = 1; L <= floors; L++) g.placeFloorSpan(L, 0, W - 1);
  for (let L = 0; L < floors; L++) g.placeStairs('stairs', L, perFloor * 8 + 4);
  for (let lo = 0, k = 0; lo < floors; k++) { const hi = Math.min(lo + 29, floors), r = g.placeShaft('elevator', perFloor * 8 + 16 + (k % 4) * 4, lo, hi); if (!r.ok) break; g.addCar(r.shaft); g.addCar(r.shaft); lo = hi; }
  for (let L = 1; L <= floors; L++) for (let i = 0; i < perFloor; i++) { const r = g.placeFac('office', L, i * 8); if (r.ok) { const f = g.facs[g.facs.length - 1]; f.build = 1; f.occ = true; g.moveIn(f); } }
  g.calcStats();
  return g;
};
// custo médio de um passo ao longo de um período movimentado (a manhã), em ms, e o pior passo
const measure = g => {
  for (let i = 0; i < 40; i++) g.step(0.1);   // aquece (o primeiro passo planeja o dia de todo mundo)
  let sum = 0, worst = 0; const N = 500;
  for (let i = 0; i < N; i++) { const a = process.hrtime.bigint(); g.step(0.1); const d = Number(process.hrtime.bigint() - a) / 1e6; sum += d; worst = Math.max(worst, d); }
  return {avg: sum / N, worst};
};

const small = build(40, 10), big = build(160, 14);
const a = measure(small), b = measure(big);
const growth = big.pop / small.pop, slow = b.avg / a.avg;
ok(small.pop > 1500 && big.pop > 9000, `torres de ${small.pop} e ${big.pop} pessoas (${growth.toFixed(1)}× mais gente)`);
ok(slow < growth * 3, `o passo cresce quase com o tamanho, não com o quadrado: ${a.avg.toFixed(2)} ms → ${b.avg.toFixed(2)} ms (${slow.toFixed(1)}× para ${growth.toFixed(1)}× mais gente; teto aceito ${(growth * 3).toFixed(0)}×)`);
ok(b.avg < 40 && b.worst < 800, `e em termos absolutos fica longe de travar mesmo numa máquina lenta (média ${b.avg.toFixed(1)} ms, pior ${b.worst.toFixed(0)} ms)`);

// construir e consultar não pode varrer o mundo todo
{
  const g = build(160, 14); const t0 = process.hrtime.bigint();
  for (let i = 0; i < 2000; i++) g.noiseOf(g.facs[(i * 37) % g.facs.length]);
  const noise = Number(process.hrtime.bigint() - t0) / 1e6 / 2000;
  ok(noise < 0.5, `noiseOf numa torre de ${g.facs.length} salas custa ${(noise * 1000).toFixed(0)} µs (só olha os andares próximos)`);
  const t1 = process.hrtime.bigint(); for (let i = 0; i < 2000; i++) g.guardsFor(g.facs[(i * 53) % g.facs.length]);
  const guards = Number(process.hrtime.bigint() - t1) / 1e6 / 2000;
  ok(guards < 0.5, `guardsFor custa ${(guards * 1000).toFixed(0)} µs (não varre as pessoas todas)`);
  const t2 = process.hrtime.bigint(); for (let i = 0; i < 3000; i++) g.groundEntrances();
  const ge = Number(process.hrtime.bigint() - t2) / 1e6 / 3000;
  ok(ge < 0.05, `groundEntrances fica em cache (${(ge * 1000).toFixed(1)} µs por chamada)`);
}
done('desempenho');
