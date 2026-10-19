'use strict';
// Transporte: pontos de ônibus e táxi (térreo/subsolo, fila e veículos), metrô em várias estações lado a lado (túnel por lado) e heliponto no topo.
const {FAC, HAIL, TRAIN, LINES, ok, done, mk, put, roundTrip} = require('./helpers');

const world = () => {
  const g = mk(100); g.msg = () => {}; g.star = 5; g.placeFloorSpan(-1, 0, 199);
  for (let L = 1; L <= 4; L++) g.placeFloorSpan(L, 0, 99);
  for (let L = -1; L < 4; L++) g.placeStairs('stairs', L, 20);
  return g;
};
const MAINT_OK = () => true;
const near = (a, b) => Math.abs(a - b) < 1e-9;

// 1. regras de construção
{
  const g = world();
  ok(FAC.busstop.maxL === 0 && FAC.taxi.maxL === 0 && FAC.busstop.star === 2 && FAC.taxi.star === 2, 'ônibus e táxi: 2★, só no térreo ou no subsolo');
  ok(g.canPlaceFac('busstop', 0, 100).ok && g.canPlaceFac('taxi', 0, 120).ok && !g.canPlaceFac('taxi', 2, 20).ok, 'no térreo pode, em andar alto não');
  const sub = g.canPlaceFac('busstop', -1, 124); ok(!sub.ok && /rampa/.test(sub.err), 'no subsolo precisa encostar numa rampa de carros (não há nenhuma)');
  const ramp = put(g, 'parkramp', -1, 140);
  ok(g.canPlaceFac('busstop', -1, 124).ok && !g.canPlaceFac('busstop', -1, 156).ok, 'a rampa sobe para a direita: o ponto encosta na ponta baixa (esquerda), não na alta');
  ok(!g.canPlaceFac('busstop', -1, 100).ok, 'mas não longe dela');
  ok(!g.canPlaceFac('tunnel', 1, 136).ok, 'túnel só no subsolo');
  const t1 = put(g, 'tunnel', -1, 136); ok(t1 && g.canPlaceFac('busstop', -1, 120).ok && !g.canPlaceFac('tunnel', -1, 100).ok, 'o túnel encostado na rampa estende a ligação; um túnel sem nada encostado não pode ser construído');
  ok(!g.canPlaceFac('tunnel', -1, 60).ok, 'túnel solto, sem nada encostado, é recusado');
  const t2 = put(g, 'tunnelCam', -1, 132), bs = put(g, 'busstop', -1, 116);
  ok(g.stops('busstop').includes(bs) && g.vehLinked().get(bs) === ramp, 'ponto ligado à rampa por dois túneis funciona');
  ok(g.corrNear(bs, 'cam') && FAC.tunnelCam.corr === 'cam' && FAC.tunnelCam.veh && FAC.tunnelExt.corr === 'ext' && FAC.tunnelHyd.corr === 'hyd' && FAC.tunnelSpr.corr === 'spr', 'túneis podem ter câmera, extintor, hidrante e sprinklers (cobrem as salas por perto como os corredores)');
  ok(FAC.tunnel.cost > FAC.corridor.cost && MAINT_OK(), 'túnel custa mais que o corredor e tem manutenção');
  g.bulldoze(t1.L, t1.x); ok(!g.stops('busstop').includes(bs), 'demolir um túnel da cadeia corta a ligação: o ponto para de funcionar');
}

// 2. fila: o ponto escoa N por minuto; quem chega com a fila cheia espera e estressa
{
  const g = world(); const bus = put(g, 'busstop', 0, 100), taxi = put(g, 'taxi', 0, 120);
  let w = 0; for (let i = 0; i < 40; i++) w = g.hailJoin(bus);
  ok(near(w, 39 / HAIL.busstop.rate) && w > 5, `40 pessoas de uma vez: a última espera ${w.toFixed(1)} min`);
  g.t += 5; const q = g.hailQueue(bus);
  ok(near(q, Math.max(0, 40 - 5 * HAIL.busstop.rate)), `em 5 minutos a fila escoa ${5 * HAIL.busstop.rate} pessoas (restam ${q.toFixed(0)})`);
  g.t += 100; ok(g.hailQueue(bus) === 0, 'depois de um tempo a fila zera');
  let wt = 0; for (let i = 0; i < 40; i++) wt = g.hailJoin(taxi);
  ok(wt > w, 'o táxi escoa menos por minuto: a mesma fila espera mais (' + wt.toFixed(1) + ' > ' + w.toFixed(1) + ')');
}

// 3. chegar de ônibus/táxi: entrada escolhida, estresse e veículo animado
{
  const g = world(); const bus = put(g, 'busstop', 0, 100), off = put(g, 'office', 1, 40);
  const dest = g.nodeAt(off.L, off.x + 4); let n = {bus: 0, other: 0};
  for (let i = 0; i < 400; i++) { const e = g.chooseEntry(dest); if (e && e.type === 'busstop') n.bus++; else n.other++; }
  ok(n.bus > 0 && n.bus < 200, `com um ponto, parte das chegadas vem de ônibus (${n.bus}/400)`);
  const g2 = world(); const o2 = put(g2, 'office', 1, 40); const d2 = g2.nodeAt(o2.L, o2.x + 4); let any = 0;
  for (let i = 0; i < 300; i++) { const e = g2.chooseEntry(d2); if (e && (e.type === 'busstop' || e.type === 'taxi')) any++; } ok(any === 0, 'sem pontos, ninguém chega de ônibus/táxi');
  g.updPerson = () => {}; g.cars = [];
  const p = g.mkPerson('visitor', null); p.st = 'away'; p.stress = 0;
  for (let i = 0; i < 30; i++) g.hailJoin(bus);   // fila cheia
  const orig = g.chooseEntry; g.chooseEntry = () => ({type: 'busstop', L: 0, x: bus.x + 8, key: g.nodeAt(0, bus.x + 8), fac: bus});
  g.startTrip(p, off); g.chooseEntry = orig;
  ok(p.via.type === 'busstop' && p.stress > 0 && p.stress <= HAIL.maxStress, `quem chega com fila cheia chega estressado (${p.stress.toFixed(1)}, máx ${HAIL.maxStress})`);
  const v = g.cars.find(c => c.kind === 'busstop');
  ok(v && v.ride && v.goal === bus.x + bus.w / 2 && !v.hide, 'um ônibus entra pela rua até o ponto');
  const x0 = v.x; for (let i = 0; i < 800 && !v.parked; i++) g.updCars(0.1);
  ok(v.parked && v.x === v.goal && x0 !== v.x, 'o ônibus para no ponto');
  for (let i = 0; i < 100 && v.parked; i++) g.updCars(0.1);
  ok(!v.parked && g.cars.includes(v), 'depois da parada ele segue viagem');
  for (let i = 0; i < 3000 && g.cars.includes(v); i++) g.updCars(0.1);
  ok(!g.cars.includes(v), 'e sai de cena');
}

// 4. no subsolo o veículo some na rampa; no térreo ele fica na rua
{
  const g = world(); put(g, 'parkramp', -1, 140); const t = put(g, 'taxi', -1, 132); g.cars = [];
  g.spawnRide(t, true); const v = g.cars[0];
  ok(v.hide && v.kind === 'taxi', 'táxi do subsolo vai até a rampa e some');
  const ramp = g.facs.find(f => f.k === 'parkramp'); ok(v.goal === ramp.x + ramp.w / 2, 'o destino é a rampa');
  for (let i = 0; i < 400; i++) g.updCars(0.1);
  ok(!g.cars.includes(v), 'o carro desaparece ao chegar na rampa');
  g.cars = []; g.spawnRide(t, false); ok(g.cars.length === 1 && g.cars[0].x === ramp.x + ramp.w / 2, 'quem sai do subsolo parte da rampa');
  const g2 = world(); put(g2, 'parkramp', -1, 140); const t2 = put(g2, 'taxi', -1, 132); g2.facs.splice(g2.facs.findIndex(f => f.k === 'parkramp'), 1); g2.cars = []; g2.spawnRide(t2, true); ok(g2.cars.length === 0, 'sem rampa nenhum veículo aparece');
}

// 5. acesso: pontos aumentam os visitantes (prédio inteiro, como pedido)
{
  const g = world(); g.pop = 400; for (let i = 0; i < 6; i++) { const o = put(g, 'office', 1 + (i >> 1), (i % 2) * 8 + 40); o.occ = true; o.persons = new Array(100).fill(0); }
  const cafe = put(g, 'cafe', 1, 56), count = () => { g.people = []; g.t = 1440 + 6 * 60; let n = 0; for (let k = 0; k < 200; k++) { g.people = []; g.planCrowd(g.dayCtx()); n += g.people.filter(p => p.kind === 'visitor').length; } return n; };
  const a = count(); put(g, 'busstop', 0, 100); put(g, 'taxi', 0, 120); const b = count();
  ok(b > a, `ponto de ônibus e de táxi trazem mais visitantes (${a} → ${b})`);
}

// 6. metrô: várias estações lado a lado, cada uma com o seu trilho
{
  const g = world(); g.placeFloorSpan(-3, 0, 255); g.star = 5;
  for (let L = -3; L <= -1; L++) g.placeFloorSpan(L, 0, 255);
  const a = put(g, 'transit', -3, 40), r = g.canPlaceFac('transit', -3, 104);
  ok(r.ok, 'uma segunda estação pode ser construída (não há mais limite de 1)');
  const b = put(g, 'transit', -3, 104);
  ok(g.stations().length === 2, 'duas estações lado a lado');
  ok(g.tunnelSides(a).l && !g.tunnelSides(a).r && !g.tunnelSides(b).l && g.tunnelSides(b).r, 'cada estação só tem túnel do lado livre: não dividem trilho');
  ok(g.trainDir(a) === 1 && g.trainDir(b) === -1, 'a da esquerda recebe o trem pela esquerda, a da direita pela direita');
  const c = put(g, 'transit', -3, 168); ok(!g.tunnelSides(b).l && !g.tunnelSides(b).r && g.trainClipped(b) && Math.abs(g.trainDir(b)) === 1 && !g.trainClipped(a), 'estação do meio, cercada: o trem continua chegando pelo túnel (não ligado à vizinha) e aparece na parede da estação');
  ok(g.trainState(a).phase !== undefined && g.trainState(a) !== g.trainState(b) && (a.id * 37) % TRAIN.cycle !== (b.id * 37) % TRAIN.cycle, 'cada estação tem o seu próprio horário de trem');
}

// linhas do metrô: cada estação tem uma linha (cor), em rodízio, trocável e salva
{
  const g = world(); g.placeFloorSpan(-3, 0, 400); for (let L = -3; L <= -1; L++) g.placeFloorSpan(L, 0, 400); g.star = 5;
  ok(LINES.length === 5 && LINES.map(l => l.name).join() === 'Azul,Vermelha,Amarela,Verde,Lilás', 'cinco linhas: azul, vermelha, amarela, verde e lilás');
  const st = [0, 1, 2, 3, 4, 5].map(i => put(g, 'transit', -3, 40 + i * 64));
  ok(st.map(s => s.line).join() === '0,1,2,3,4,0', 'cada estação nova pega a próxima linha em rodízio');
  st[0].line = 3; const r = roundTrip(g); ok(r.facs.filter(f => f.k === 'transit').map(f => f.line).join() === '3,1,2,3,4,0', 'a linha de cada estação vai no save');
  const h = world(); h.placeFloorSpan(-3, 0, 120); for (let L = -3; L <= -1; L++) h.placeFloorSpan(L, 0, 120); const s2 = put(h, 'transit', -3, 40, {line: 2}); ok(s2.line === 2, 'dá para escolher a linha ao construir');
  const old = JSON.parse(JSON.stringify(g.serialize())); for (const f of old.facs) delete f.ln; const k = world(); k.placeFloorSpan(-3, 0, 400); k.load(old); ok(k.facs.filter(f => f.k === 'transit').every(f => f.line === 0), 'save antigo volta tudo na linha azul');
}

// garagem: o túnel com portal também é entrada de carros (não só a rampa), e os carros atravessam os túneis ligados
{
  const g = world(); g.cars = [];
  ok(!g.hasRamp(), 'sem rampa nem portal não há entrada de carros');
  const p = put(g, 'tunnelPortal', -1, 60);
  ok(g.hasRamp(), 'um túnel com portal basta como entrada da garagem');
  g.spawnGarageCar(true); ok(g.cars.length === 1 && g.cars[0].goal === p.x + p.w / 2, 'os carros da garagem vão até o portal');
}

// 7. heliponto: só no topo, VIPs chegam de helicóptero
{
  const g = world(); g.updPerson = () => {};
  const off = put(g, 'office', 4, 0);
  ok(!g.canPlaceFac('heliport', 3, 0).ok && /topo/.test(g.canPlaceFac('heliport', 3, 0).err), 'não se constrói heliponto com salas acima');
  const hp = put(g, 'heliport', 4, 40);
  ok(hp && FAC.heliport.star === 5 && g.canPlaceFac('heliport', 4, 60).ok, 'no andar mais alto pode (5★)');
  const up = g.canPlaceFac('office', 5, 40); ok(!up.ok && /heliponto/.test(up.err), 'nada se constrói em cima do heliponto');
  for (let L = 1; L <= 4; L++) g.placeFloorSpan(L, 0, 99);
  const s = put(g, 'suite', 3, 60); s.occ = true; g.t = 0;
  g.vipEvent(); ok(!s.vip || (g.pendingHeli && g.pendingHeli.length === 1 && g.pendingHeli[0].L === hp.L), 'o VIP agenda um helicóptero até o heliponto');
  if (g.pendingHeli && g.pendingHeli.length) { g.t = g.pendingHeli[0].t + 1; g.step(0.05); ok(g.heli && g.heli.reason === 'vip' && g.heli.L === hp.L, 'o helicóptero VIP voa até o heliponto'); }
}
// ponto encostado num túnel que não chega a uma rampa: pode construir, mas não funciona
{
  const g = world(); const r = put(g, 'parkramp', -1, 140), t = put(g, 'tunnel', -1, 136), t2 = put(g, 'tunnel', -1, 132), bs = put(g, 'busstop', -1, 116);
  ok(g.stops('busstop').includes(bs), 'ponto no fim da cadeia funciona');
  g.facs.splice(g.facs.indexOf(t), 1); g.grid.set(-1, 136, null); g.grid.set(-1, 137, null); g.grid.set(-1, 138, null); g.grid.set(-1, 139, null); g.dirty();
  ok(!g.stops('busstop').includes(bs) && g.facs.includes(bs) && g.facs.includes(t2), 'a cadeia cortada deixa o ponto sem funcionar, mas ele continua lá');
}
// rampas têm lado e se encadeiam para níveis fundos (o túnel descendente foi aposentado: a rampa faz esse papel)
{
  const g = world(); g.placeFloorSpan(-2, 0, 199); g.placeFloorSpan(-3, 0, 199);
  const a = put(g, 'parkramp', -1, 140);
  ok(a.dir === 1 && FAC.parkramp.slope, 'a rampa tem lado (padrão: sobe para a direita)');
  ok(FAC.tunnelDown.nobuild && !g.canPlaceFac('tunnelDown', -1, 100).ok, 'o túnel descendente está aposentado: não dá mais para construir');
  ok(!g.canPlaceFac('parkramp', -2, 100).ok, 'uma rampa sem nada na ponta alta nem do lado é recusada');
  const b = put(g, 'parkramp', -2, 124);   // ponta alta encostada na rampa de cima
  ok(g.vehLinked().get(b) === a, 'a segunda rampa, com a ponta alta na de cima, fica ligada');
  const bs = put(g, 'busstop', -2, 108);
  ok(g.stops('busstop').includes(bs), 'ponto encostado na ponta baixa da rampa, dois andares abaixo, funciona sem outra rampa');
  const c = put(g, 'parkramp', -3, 108, {dir: 1});
  ok(g.vehLinked().get(c) === a, 'dá para descer mais um andar encadeando outra rampa');
  const g2 = world(); const r2 = put(g2, 'parkramp', -1, 100, {dir: -1});
  ok(r2.dir === -1 && g2.canPlaceFac('busstop', -1, 116).ok && !g2.canPlaceFac('busstop', -1, 84).ok, 'rampa que sobe para a esquerda: o ponto encosta na direita (ponta baixa)');
  const rt = roundTrip(g); const rd = rt.facs.find(f => f.k === 'parkramp' && f.L === -2);
  ok(rd && rd.dir === 1 && roundTrip(g2).facs.find(f => f.k === 'parkramp').dir === -1, 'o lado da rampa é salvo e carregado');
  g.facs.splice(g.facs.indexOf(a), 1); for (let u = a.x; u < a.x + a.w; u++) g.grid.set(a.L, u, null); g.dirty();
  ok(!g.stops('busstop').includes(bs), 'sem a rampa da rua, nada abaixo dela funciona');
}
// túnel com portal: tem a própria entrada para a rua, sem rampas até a superfície
{
  const g = world(); g.placeFloorSpan(-2, 0, 199); g.placeFloorSpan(-3, 0, 199); g.placeFloorSpan(-4, 0, 199);
  ok(FAC.tunnelPortal.portal && FAC.tunnelPortal.cost > FAC.tunnel.cost && FAC.tunnelPortal.cost > FAC.tunnel.cost * 10 && FAC.tunnelPortal2.h === 2 && FAC.tunnelPortal2.cost > FAC.tunnelPortal.cost, 'o túnel com portal é bem mais caro; o de 2 níveis ainda mais');
  ok(g.canPlaceFac('tunnelPortal', -3, 60).ok, 'o portal pode ficar em qualquer nível do subsolo, sem rampa nenhuma');
  const p = put(g, 'tunnelPortal', -3, 60), bs = put(g, 'busstop', -3, 44);
  ok(g.stops('busstop').includes(bs) && g.vehLinked().get(bs) === p, 'ponto encostado no portal funciona sem ligação com a superfície');
  ok(!g.canPlaceFac('taxi', -3, 68).ok, 'do lado da saída (direita) nada se liga ao portal: o ponto nem pode encostar ali');
  const p3 = put(g, 'tunnelPortal', -4, 60, {dir: -1}), t = put(g, 'tunnelCam', -4, 68), tx = put(g, 'taxi', -4, 72);
  ok(p3.dir === -1 && g.stops('taxi').includes(tx), 'portal com a saída à esquerda liga pelo lado direito; túneis comuns (até com câmera) encadeiam a partir dele');
  const p2 = put(g, 'tunnelPortal2', -3, 120);   // ocupa -3 e -2
  const bs2 = put(g, 'busstop', -2, 104);
  ok(g.stops('busstop').includes(bs2) && g.grid.get(-2, 120) === p2 && g.grid.get(-3, 120) === p2, 'o portal de 2 níveis liga os dois andares que ocupa');
  ok(!g.canPlaceFac('tunnelPortal2', -1, 120).ok, 'o de 2 níveis não pode cruzar o térreo');
  ok(roundTrip(g).stops('busstop').length === 2, 'salvar e carregar mantém tudo ligado');
}
// vagas: podem ser construídas em qualquer lugar do subsolo, mas só funcionam ligadas à entrada dos carros (direto ou por uma fileira de vagas); sem ligação, aviso
{
  const g = world(); g.cars = [];
  const solta = put(g, 'parkspace', -1, 0);
  ok(!g.serves(solta) && g.vehUnlinked(solta), 'vaga solta pode ser construída, mas não funciona');
  ok(g.alerts().some(a => a.title.includes('vaga(s) sem ligação')), 'e gera aviso em alerts()');
  const p = put(g, 'tunnelPortal', -1, 60);
  const a = put(g, 'parkspace', -1, 56), b = put(g, 'parkspace', -1, 52), vao = put(g, 'parkspace', -1, 44);
  ok(g.serves(a) && g.serves(b), 'vagas encostadas no portal, direto ou em fileira, funcionam');
  ok(!g.serves(vao) && g.vehUnlinked(vao), 'com um vão no meio a vaga não funciona');
  const fora = put(g, 'parkspace', -1, 68);   // do lado da saída (a direita do portal)
  ok(!g.serves(fora) && g.vehUnlinked(fora), 'vaga do lado da saída do portal não está ligada');
  const pe = put(g, 'tunnelPortal', -1, 100, {dir: -1}), ve = put(g, 'parkspace', -1, 108), vd = put(g, 'parkspace', -1, 92);
  ok(g.serves(ve) && !g.serves(vd), 'com a saída à esquerda só a vaga da direita está ligada');
  g.bulldoze(-1, 56);
  ok(!g.serves(b), 'se a vaga do meio é demolida, a de trás perde a ligação e não funciona');
  ok(g.vehLinked().has(p) && !g.vehLinked().has(b), 'a ligação some do mapa de veículos');
  g.spawnGarageCar(true); ok(g.cars.every(c => !c.space || g.serves(c.space)), 'carros só vão para vagas ligadas');
  put(g, 'tunnelPortal', -1, 136); put(g, 'tunnel', -1, 132); const ps = put(g, 'busstop', -1, 116);
  ok(g.serves(ps) && !g.vehUnlinked(ps), 'ponto ligado ao portal por um túnel funciona');
  g.bulldoze(-1, 132);
  ok(!g.serves(ps) && g.vehUnlinked(ps) && g.alerts().some(a => a.title.includes('ponto(s) de ônibus/táxi sem ligação')), 'cortada a ligação, o ponto no subsolo para e gera aviso');
}
done('transporte');
