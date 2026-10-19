'use strict';
// Elevador de carros: do térreo para baixo, casa de máquinas em cima, fora da rota das pessoas. Se chega ao térreo é uma entrada de carros
// por conta própria; só no subsolo liga níveis de vagas que já têm saída (só ele faz essa ponte). Tem fila, capacidade e desistência.
const {mk, put, ok, done, FAC, TRANSPORT, CARLIFT, Game, UTIL} = require('./helpers');
const congela = g => { g._utk = g.ver + ':' + g.facs.length + ':' + Math.floor(g.t / 60); };   // impede o recálculo horário de energia de desfazer o `dark` forçado no teste

const world = () => { const g = mk(64); g.updPerson = () => {}; g.reachable = () => true; for (const L of [-1, -2, -3, -4, -5]) g.placeFloorSpan(L, 0, 127); g.ver++; return g; };

// regras de construção
{
  const g = world(), t = TRANSPORT.carlift;
  ok(t && t.carlift && t.maxHi === 0 && t.star > FAC.parkramp.star && t.star < FAC.tunnelPortal.star, 'existe, vai do térreo para baixo e fica entre a rampa e o portal em estrelas (' + FAC.parkramp.star + '★ < ' + t.star + '★ < ' + FAC.tunnelPortal.star + '★)');
  ok(!g.shaftCheck('carlift', 24, -1, 1).ok && /térreo para baixo/.test(g.shaftCheck('carlift', 24, -1, 1).err), 'não passa do térreo para cima');
  ok(g.shaftCheck('carlift', 24, -2, 0).ok, 'do térreo (A1) para baixo pode');
  ok(g.shaftCheck('carlift', 24, -5, -3).ok, 'só no subsolo, sem tocar a rua, também pode (B3 a B5)');
  const s = g.placeShaft('carlift', 24, -2, 0).shaft;
  ok(s && s.carlift && g.shaftCapAt(1, 24) === s && g.shaftCapAt(-3, 24) === s, 'casa de máquinas no 2º andar (acima do térreo) e poço embaixo, como o elevador comum');
  ok(!g.canPlaceFac('office', 1, 24).ok, 'a casa de máquinas ocupa a casa de cima');
  const g2 = world(); put(g2, 'office', 1, 24);
  ok(!g2.shaftCheck('carlift', 24, -2, 0).ok && /casa de máquinas/.test(g2.shaftCheck('carlift', 24, -2, 0).err), 'sem casa livre em cima não dá para construir');
  const g3 = mk(64); g3.placeFloorSpan(-3, 0, 127); g3.placeFloorSpan(-4, 0, 127);   // só os níveis do poço têm laje: a casa de máquinas em cima não tem piso
  ok(g3.shaftCheck('carlift', 24, -4, -3).ok && !g3.shaftCheck('elevator', 24, -4, -3).ok, 'no subsolo o elevador de carros não pede apoio em cima (a casa de máquinas é o teto dele)');
  ok(g.nodeAt(-1, 28) >= 0 && g.nodeAt(-1, 28) === g.nodeAt(-1, 20) && g.nodeAt(-1, 28) === g.nodeAt(-1, 40), 'o poço não bloqueia as pessoas: dá para passar de um lado ao outro, como no elevador comum');
}

// chegando ao térreo: entrada de carros por conta própria (sem rampa nem túnel)
{
  const g = world();
  ok(!g.hasRamp(), 'sem nada não há entrada de carros');
  const lift = g.placeShaft('carlift', 24, -2, 0).shaft;
  ok(g.hasRamp() && g.vehLinked().has(lift), 'o elevador que chega ao térreo é uma entrada de carros');
  const a = put(g, 'parkspace', -1, 20), b = put(g, 'parkspace', -2, 32), c = put(g, 'parkspace', -1, 16), longe = put(g, 'parkspace', -2, 60);
  g.ver++;
  ok(g.serves(a) && g.serves(b) && g.serves(c), 'vagas coladas ao elevador, em qualquer nível, e as da fileira delas, estão ligadas');
  ok(!g.serves(longe) && g.vehUnlinked(longe), 'uma vaga longe dele continua sem ligação');
  ok(g.liftsFor(a).includes(lift) && g.liftsFor(c).includes(lift), 'todo carro dessas vagas desce no elevador');
  g.spawnGarageCar(true); ok(g.cars.length === 1 && g.cars[0].goal === lift.x + lift.w / 2, 'os carros da rua vão até o elevador');
  lift.dark = true; g.ver++; g._vl = null;
  ok(!g.hasRamp() && !g.serves(a), 'sem energia ele para: não é entrada e as vagas dele perdem a ligação');
}

// só no subsolo (B3 a B5): liga níveis de vagas que já têm saída: saída - vaga - vaga - elevador - vaga
{
  const g = world();
  put(g, 'tunnelPortal', -3, 40);   // saída para a direita; o lado de dentro é a esquerda
  const a = put(g, 'parkspace', -3, 36), b = put(g, 'parkspace', -3, 32);
  const lift = g.placeShaft('carlift', 24, -5, -3).shaft;
  const c = put(g, 'parkspace', -3, 20), d = put(g, 'parkspace', -4, 32), e = put(g, 'parkspace', -5, 20), solta = put(g, 'parkspace', -4, 40);
  g.ver++;
  ok(g.serves(a) && g.serves(b), 'as vagas em fileira com a saída funcionam');
  ok(g.vehLinked().has(lift), 'o elevador encostado numa vaga ligada fica ligado');
  ok(g.serves(c) && g.serves(d) && g.serves(e), 'a vaga do outro lado e as de outros níveis do elevador estão ligadas');
  ok(!g.serves(solta) && g.vehUnlinked(solta), 'a vaga que só toca a fileira de outro nível, longe do elevador, continua sem ligação');
  ok(g.liftsFor(c).length === 0 && g.liftsFor(a).length === 0, 'no mesmo nível o carro passa pela frente do elevador: a vaga do outro lado não depende da cabine');
  ok(g.liftsFor(d).includes(lift) && g.liftsFor(e).includes(lift), 'só quem muda de nível depende da cabine');
  ok(!g.alerts().some(x => /elevador\(es\) de carros sem ligação/.test(x.title)), 'ligado, não há alerta de elevador sem ligação');
  lift.dark = true; g.ver++; g._vl = null;
  ok(g.serves(c) && g.serves(b) && !g.serves(d) && !g.serves(e), 'sem energia, só as vagas de outros níveis ficam sem ligação (as do mesmo nível passam pela frente do poço)');
  lift.dark = false; g.ver++; g._vl = null;
  g.bulldoze(-3, 32);
  ok(!g.serves(c) && !g.serves(d), 'cortada a ligação com a saída, tudo atrás do elevador para');
  ok(g.alerts().some(x => /elevador\(es\) de carros sem ligação/.test(x.title)), 'e o elevador sem ligação gera alerta');
}

// elevador só no subsolo e solto, sem saída, não liga nada
{
  const g = world(); const lift = g.placeShaft('carlift', 24, -4, -2).shaft;
  const v = put(g, 'parkspace', -2, 20), w = put(g, 'parkspace', -3, 32);
  ok(!g.vehLinked().has(lift) && !g.serves(v) && !g.serves(w), 'sem saída para a rua, nem o elevador nem as vagas valem');
}

// fila, capacidade e desistência (ida e volta)
{
  const g = world();
  const lift = g.placeShaft('carlift', 24, -2, 0).shaft; const c = put(g, 'parkspace', -1, 20); g.ver++;
  ok(g.liftWaitMin(lift) === 0, 'elevador vazio: sem espera');
  const p = {stress: 0};
  for (let i = 0; i < 12; i++) g.liftTrip(p, c);
  ok(g.liftWaitMin(lift) > CARLIFT.giveUp - 1 && p.stress > 0, 'a fila cresce e estressa o motorista (espera ' + g.liftWaitMin(lift).toFixed(1) + ' min)');
  const escolhiveis = g.facs.filter(f => f.k === 'parkspace' && !f.owner && g.serves(f) && g.liftsFor(f).every(s => g.liftWaitMin(s) < CARLIFT.giveUp));
  ok(escolhiveis.length === 0, 'com a fila grande, as vagas atrás do elevador não são escolhidas');
  const w0 = g.liftWaitMin(lift);
  ok(!g.addCar(lift) && lift.cars.length === 2 && g.liftWaitMin(lift) < w0, 'mais uma cabine escoa a fila mais rápido');
  ok(lift.trips.length > 0, 'cada carro que usa o elevador entra na fila de viagens da cabine (animação)');
  g.t += 10; ok(g.liftWaitMin(lift) === 0, 'com o tempo a fila esvazia');
  for (let i = 0; i < 40; i++) g.step(1);
  const g2 = mk(64); g2.load(JSON.parse(JSON.stringify(g.serialize())));
  ok(g2.shafts.some(x => x.carlift && x.lo === -2 && x.hi === 0), 'salvar e carregar mantém o elevador de carros');
}

// quem estaciona anda do carro até o destino, e na volta anda do trabalho/casa até a vaga antes de o carro sair (nada de teletransporte)
{
  const g = world(); g.placeFloorSpan(1, 0, 127);
  for (const L of [-1, 0]) g.placeStairs('stairs', L, 8); g.stairs.forEach(x => { x.build = 1; });
  const lift = g.placeShaft('carlift', 24, -2, 0).shaft; const vaga = put(g, 'parkspace', -1, 20);
  const sala = put(g, 'office', 1, 0); delete g.reachable; delete g.updPerson; g.ver++;
  const p = g.mkPerson('visitor', null); p.transient = true; p.st = 'away';
  g.chooseEntry = () => ({type: 'car', L: vaga.L, x: vaga.x + 2, key: g.nodeAt(vaga.L, vaga.x + 2), space: vaga});
  let cabMin = 0, cabCheiaDesc = false, carroNaRua = 0, holdVisto = false, carroNaVagaAntes = false; const passo = g.step.bind(g); g.step = h => { passo(h); const cab = lift.cars[0]; cabMin = Math.min(cabMin, cab.y); if (cab.full && cab.dir < 0) cabCheiaDesc = true; if (vaga.holdCar) holdVisto = true; carroNaRua = Math.max(carroNaRua, g.cars.filter(c => c.goal === undefined && !c.traffic && Math.abs(c.x - (lift.x + lift.w / 2)) < 400).length); };
  g.startTrip(p, sala);
  ok(p.L === -1 && vaga.owner === p, 'chega de carro: aparece na vaga, no subsolo');
  ok(vaga.carWait === true, 'mas o carro dele só aparece na vaga quando a cabine o entregar (a vaga espera a cabine)');
  let minL = 9, maxL = -9, steps = 0;
  const run = cond => { while (!cond() && steps++ < 4000) { g.step(0.5); const L = p.st === 'stair' ? p.fy : p.L; minL = Math.min(minL, L); maxL = Math.max(maxL, L); } };
  run(() => p.st === 'idle' && p.L === 1);
  ok(p.L === 1 && maxL >= 1, 'anda da vaga até as escadas e sobe até a sala (andar ' + p.L + ')');
  p.dest = null; p.at = null; g.startExit(p);
  ok(p.dest && p.dest.exit && p.dest.L === -1, 'na saída o destino é a vaga do carro, no subsolo');
  const antes = vaga.owner; let abaixo = 9; steps = 0;
  while (p.st !== 'away' && steps++ < 4000) { g.step(0.5); abaixo = Math.min(abaixo, p.st === 'stair' ? p.fy : p.L); }
  ok(p.st === 'away' && abaixo <= -1 && antes === p && vaga.owner === null, 'desce a pé até a vaga e só então o carro sai (a vaga fica livre)');
  for (let i = 0; i < 400; i++) g.step(0.5);
  ok(holdVisto && !vaga.holdCar && !vaga.carWait, 'na saída o carro fica na vaga até a cabine pegá-lo; depois nada fica retido');
  ok(cabMin <= -1 + 1e-6 && cabCheiaDesc, 'na simulação de verdade a cabine desce carregada até o nível da vaga (B2 = ' + cabMin.toFixed(1) + ')');
  ok(carroNaRua > 0, 'e na saída o carro aparece na rua quando a cabine o entrega');
}

// diagnóstico: o motivo da falta de ligação cita o elevador de carros encostado (sem energia, ou que não chega ao térreo)
{
  const g = world();
  const v0 = put(g, 'parkspace', -2, 60); g.ver++;
  ok(g.vehUnlinked(v0) && /ligado a esta fileira/.test(g.vehWhy(v0)), 'sem nada encostado: pede para ligar a fileira a uma rampa, portal ou elevador');
  const lift = g.placeShaft('carlift', 24, -3, -2).shaft; const v = put(g, 'parkspace', -2, 32); g.ver++;
  ok(g.vehUnlinked(v) && /só vai de .* e não chega à rua/.test(g.vehWhy(v)) && /térreo/.test(g.vehWhy(v)), 'elevador só de subsolo, sem saída: explica que precisa chegar ao térreo ou ligar a uma saída');
  ok(g.alerts().some(a => /vaga\(s\) sem ligação/.test(a.title) && /elevador de carros/.test(a.cause)), 'o alerta cita o elevador de carros');
  const e = g.extendShaft(lift, 1, 2); ok(e.ok && lift.hi === 0 && !g.vehUnlinked(v), 'estendido até o térreo, o elevador vira entrada e a fileira passa a funcionar');
  lift.dark = true; g.ver++; g._vl = null;
  ok(g.vehUnlinked(v) && /sem energia/.test(g.vehWhy(v)), 'sem energia: o motivo diz que o elevador está sem energia');
  lift.darkWhy = 'reach'; ok(/nenhuma fonte/.test(g.vehWhy(v)), 'e se é por alcance, diz que nenhuma fonte chega até ele');
  lift.darkWhy = 'cap'; ok(/não dão conta/.test(g.vehWhy(v)), 'ou que as fontes não dão conta');
  ok(g.alerts().some(a => /Elevador de carros sem energia/.test(a.title)), 'e há alerta de elevador de carros sem energia');
}

// animação em tempo real: quem entra de carro desce com ele na cabine; quem sai, a cabine desce vazia, pega o carro e sobe
{
  const g = world(); const lift = g.placeShaft('carlift', 24, -3, 0).shaft; const c = lift.cars[0];
  const vaga = put(g, 'parkspace', -2, 32); g.ver++;
  ok(c.y === 0 && !c.full && !c.trip, 'parada no topo (a rua), vazia');
  const p = {stress: 0};
  g.liftTrip(p, vaga, 'in');
  let min = 9, cheiaDescendo = false, passos = 0;
  while ((c.trip || lift.trips.length || passos === 0) && passos++ < 2000) { g.updCarLift(lift, c, 0.05); min = Math.min(min, c.y); if (c.full && c.dir < 0) cheiaDescendo = true; }
  for (let i = 0; i < 200; i++) g.updCarLift(lift, c, 0.05);
  ok(cheiaDescendo && min <= -2 + 1e-6 && c.y === 0 && !c.full, 'entrada: a cabine desce carregada até B2 (nível da vaga) e volta vazia ao topo (mínimo ' + min.toFixed(1) + ')');
  g.liftTrip(p, vaga, 'out');
  let semCarroIndo = false, cheiaSubindo = false, max = -9; min = 9; passos = 0;
  while ((c.trip || lift.trips.length || passos === 0) && passos++ < 2000) { g.updCarLift(lift, c, 0.05); min = Math.min(min, c.y); if (!c.full && c.dir < 0) semCarroIndo = true; if (c.full && c.dir > 0) cheiaSubindo = true; }
  ok(semCarroIndo && cheiaSubindo && min <= -2 + 1e-6, 'saída: a cabine desce vazia até a vaga, pega o carro e sobe com ele');
  for (let i = 0; i < 200; i++) g.updCarLift(lift, c, 0.05);
  ok(c.y === 0 && !c.full && c.dir === 0, 'passadas as viagens, espera vazia no topo');
  const w = world(); const l2 = w.placeShaft('carlift', 24, -3, 0).shaft; const v2 = put(w, 'parkspace', -1, 32); w.ver++;
  for (let i = 0; i < 20; i++) w.liftTrip({stress: 0}, v2, 'in');
  ok(l2.trips.length <= 8, 'a fila de viagens da animação tem limite');
}

// andares atendidos: só os níveis ativos ligam vagas; sem o térreo ativo ele não é entrada de carros
{
  const g = world(); const lift = g.placeShaft('carlift', 24, -3, 0).shaft;
  const a = put(g, 'parkspace', -1, 32), b = put(g, 'parkspace', -2, 32), c = put(g, 'parkspace', -3, 32); g.ver++;
  ok(g.serves(a) && g.serves(b) && g.serves(c), 'com todos os andares atendidos, as vagas dos três níveis estão ligadas');
  g.setStopOff(lift, -2, true); g._vl = null;
  ok(g.serves(a) && !g.serves(b) && g.serves(c), 'desativado B2: a vaga desse nível fica sem ligação e as outras continuam');
  ok(/não atende este andar/.test(g.vehWhy(b)) && /B2|3/.test(g.vehWhy(b)), 'o motivo explica que o andar está desativado');
  g.setStopOff(lift, -2, false); g._vl = null; ok(g.serves(b), 'reativado, volta a ligar');
  g.setStopOff(lift, 0, true); g._vl = null;
  ok(!g.streetLift(lift) && !g.hasRamp() && !g.serves(a), 'sem o térreo ativo ele deixa de ser entrada de carros (e nada fica ligado)');
  g.setStopOff(lift, 0, false); g._vl = null; ok(g.streetLift(lift) && g.serves(a), 'com o térreo de volta, tudo volta');
  g.setStopOff(lift, -3, true);
  const g2 = mk(64); g2.load(JSON.parse(JSON.stringify(g.serialize())));
  ok(g2.shafts.find(x => x.carlift).off[-3] === true, 'os andares desativados são salvos e carregados');
}

// rota dos carros: como as pessoas, cada vaga usa a melhor rota (menos trechos, menos elevadores, menor fila); elevador parado não serve
{
  const g = world();
  put(g, 'tunnelPortal', -1, 40); const a = put(g, 'parkspace', -1, 36), b = put(g, 'parkspace', -1, 32);
  const lift = g.placeShaft('carlift', 24, -2, 0).shaft; g.ver++;
  ok(g.serves(b) && g.liftsFor(b).length === 0, 'a vaga que tem saída direta e também elevador usa a saída direta (sem elevador)');
  g.bulldoze(-1, 36); g._vl = null;
  ok(g.serves(b) && g.liftsFor(b).includes(lift), 'cortada a saída direta, a mesma vaga passa a usar o elevador');
}
{
  const g = world();
  const l1 = g.placeShaft('carlift', 24, -2, 0).shaft, l2 = g.placeShaft('carlift', 40, -2, 0).shaft;
  const x = put(g, 'parkspace', -2, 32), y = put(g, 'parkspace', -2, 36); g.ver++;
  ok(g.liftsFor(x)[0] === l1 && g.liftsFor(y)[0] === l2, 'cada vaga usa o elevador mais perto (menos trechos)');
  const t0 = g.t; for (let i = 0; i < 30; i++) g.liftJoin(l1);
  g.t += 5; g._vl = null; g.ver++;
  ok(g.liftsFor(x)[0] === l2 && g.serves(x), 'com a fila grande no primeiro elevador, a vaga passa a usar o outro (rota de menor custo)');
  g.t += 200; g._vl = null; g.ver++; g.utilFresh(); l2.dark = true; congela(g);
  ok(g.serves(x) && g.liftsFor(x)[0] === l1, 'com o outro parado, volta ao primeiro, mesmo com fila (é a única rota)');
  l1.dark = true; g._vl = null; congela(g);
  ok(!g.serves(x) && !g.serves(y), 'com os dois parados, nada tem rota');
}

// carro preso: a energia acaba, o elevador para e a vaga não tem outra ligação: o dono sai a pé, o carro fica, avisa, e sai sozinho quando a ligação volta
{
  const g = world(); g.placeFloorSpan(1, 0, 127);
  for (const L of [-1, 0]) g.placeStairs('stairs', L, 8); g.stairs.forEach(x => { x.build = 1; });
  const lift = g.placeShaft('carlift', 24, -2, 0).shaft; const vaga = put(g, 'parkspace', -1, 20);
  const sala = put(g, 'office', 1, 0); delete g.reachable; delete g.updPerson; g.ver++;
  const p = g.mkPerson('visitor', null); p.transient = true; p.st = 'away';
  g.chooseEntry = () => ({type: 'car', L: vaga.L, x: vaga.x + 2, key: g.nodeAt(vaga.L, vaga.x + 2), space: vaga});
  g.startTrip(p, sala);
  let n = 0; while (!(p.st === 'idle' && p.L === 1) && n++ < 4000) g.step(0.5);
  n = 0; while (vaga.carWait && n++ < 2000) g.step(0.5);   // a cabine entrega o carro
  ok(p.L === 1 && vaga.owner === p && !vaga.carWait, 'o dono chegou ao destino e o carro está na vaga');
  const energia = UTIL.grid.energia; UTIL.grid.energia = 0; g._vl = null; g._utk = null; g.ver++; g.utilFresh();   // acabou a energia: o elevador para
  g.chooseEntry = Game.prototype.chooseEntry;
  p.dest = null; p.at = null; g.startExit(p);
  ok(vaga.stuck === true && vaga.owner === p && p.via === null, 'sem o elevador, o carro fica preso na vaga (ela continua ocupada)');
  ok(p.dest && p.dest.exit && p.dest.L === 0, 'e o dono vai embora a pé, pela rua');
  ok(g.vehUnlinked(vaga) && g.alerts().some(a => /carro\(s\) preso\(s\)/.test(a.title)), 'a vaga mostra o "!" (sem ligação) e há alerta de carro preso');
  n = 0; while (p.st !== 'away' && n++ < 4000) g.step(0.5);
  ok(p.st === 'away' && vaga.owner === p && vaga.stuck, 'o dono sai; o carro continua lá');
  UTIL.grid.energia = energia; g._vl = null; g._utk = null; g.ver++; g.utilFresh(); const antes = g.cars.length;
  g.releaseStuck();
  ok(!vaga.stuck && vaga.owner === null && vaga.holdCar === true, 'voltando a energia, o carro é liberado (a cabine vai buscá-lo)');
  ok(!g.alerts().some(a => /carro\(s\) preso\(s\)/.test(a.title)), 'e o alerta some');
}

// elevador não é obstáculo (nem para pessoas, nem para carros): é algo na parede, passa-se pela frente dele
{
  const g = world();
  const esq = g.placeShaft('carlift', 0, -3, 0).shaft, dir = g.placeShaft('carlift', 8, -3, 0).shaft;   // dois elevadores de carros colados
  const v = put(g, 'parkspace', -3, 16), w = put(g, 'parkspace', -2, 16), u = put(g, 'parkspace', -2, 20); g.ver++;
  ok(g.serves(v) && g.serves(w) && g.serves(u), 'as vagas encostadas só no elevador da direita estão ligadas');
  ok(g.liftsFor(v).length === 1, 'e cada carro usa um só elevador (os dois chegam à vaga pela frente um do outro, com o mesmo custo)');
  const alvo = put(g, 'parkspace', -2, 40); g.ver++;
  ok(g.vehLinked().has(esq), 'o elevador da esquerda, colado no outro, também fica ligado (o carro passa pela frente do da direita)');
  g.setStopOff(dir, -2, true); g.setStopOff(dir, 0, true); g._vl = null;
  ok(g.serves(w) && g.liftsFor(w)[0] === esq && g.streetLift(esq), 'se o da direita não atende, as vagas passam pela frente dele e usam o da esquerda');
  g.setStopOff(dir, -2, false); g.setStopOff(dir, 0, false);
  const h = world();
  put(h, 'tunnelPortal', -1, 56);   // saída para a direita
  const a = put(h, 'parkspace', -1, 52), b = put(h, 'parkspace', -1, 36);
  h.placeShaft('elevator', 40, -2, 0); h.placeShaft('service', 48, -2, 0); const c = put(h, 'parkspace', -1, 32);   // dois elevadores de pessoas entre as vagas
  const d = put(h, 'parkspace', -1, 44); h.ver++;
  ok(h.nodeAt(-1, 20) >= 0 && h.nodeAt(-1, 20) === h.nodeAt(-1, 60), 'as pessoas atravessam o andar passando pela frente dos elevadores de pessoas');
  ok(!h.vehUnlinked(a), 'a vaga colada no portal funciona');
  ok(h.serves(b) && h.serves(c) && h.serves(d), 'e as vagas do outro lado dos elevadores de pessoas (normal e de serviço) também: o carro passa pela frente');
}

// pessoas atravessam o elevador de carros: vagas à esquerda do elevador de carros, elevador de pessoas à direita
{
  const g = world(); g.placeFloorSpan(1, 0, 127);
  const lift = g.placeShaft('carlift', 8, -2, 0).shaft; const pes = g.placeShaft('elevator', 40, -1, 1).shaft;
  const v1 = put(g, 'parkspace', -1, 4), v2 = put(g, 'parkspace', -1, 0);   // à esquerda do elevador de carros
  const sala = put(g, 'office', 1, 0); delete g.reachable; delete g.updPerson; g.ver++;
  ok(g.vehLinked().has(v1) && g.vehLinked().has(v2), 'os carros da esquerda estão ligados (o elevador de carros do térreo está colado nelas)');
  ok(g.nodeAt(-1, 2) === g.nodeAt(-1, 20) && g.nodeAt(-1, 2) === g.nodeAt(-1, 40), 'as pessoas atravessam o elevador de carros no nível das vagas');
  ok(g.reachable(v1) && g.reachable(v2), 'as vagas da esquerda têm acesso (por baixo do térreo, passando pela frente do elevador de carros)');
  const p = g.mkPerson('visitor', null); p.transient = true; p.st = 'away';
  g.chooseEntry = () => ({type: 'car', L: v2.L, x: v2.x + 2, key: g.nodeAt(v2.L, v2.x + 2), space: v2});
  g.startTrip(p, sala);
  let n = 0, maxX = 0; while (!(p.st === 'idle' && p.L === 1) && n++ < 4000) { g.step(0.5); if (p.L === -1) maxX = Math.max(maxX, p.x); }
  ok(p.L === 1 && p.st === 'idle', 'quem estaciona na vaga da esquerda anda até o elevador de pessoas, do outro lado do elevador de carros, e chega ao destino');
  ok(maxX > 24, 'e atravessou o poço do elevador de carros a pé (foi até x=' + maxX.toFixed(0) + ')');
  p.dest = null; p.at = null; g.startExit(p);
  ok(p.dest && p.dest.exit && p.dest.L === -1 && p.dest.x < 8, 'na saída volta a pé até a vaga da esquerda');
  n = 0; while (p.st !== 'away' && n++ < 4000) g.step(0.5);
  ok(p.st === 'away', 'e sai (o carro vai embora pelo elevador de carros)');
}

// balanceamento: vaga e elevador nunca vêm antes de uma entrada de carros (rampa/portal) e o portal é o topo da garagem
{
  const entrada = FAC.parkramp.star;
  ok(FAC.parkspace.star >= entrada && TRANSPORT.carlift.star >= entrada, 'vaga e elevador de carros só aparecem quando já existe a rampa (' + entrada + '★)');
  ok(FAC.tunnelPortal.star === 5 && FAC.tunnelPortal2.star === 5 && FAC.tunnel.star === entrada, 'só os túneis com portal são do 5★; os túneis comuns acompanham a rampa');
}
done('elevador-carros');
