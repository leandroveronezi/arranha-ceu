'use strict';
// Lixo: depósito no subsolo (ligado à rampa) enche com as unidades por perto, chama o caminhão, esvazia por R$ e, cheio, transborda e pesa na vizinhança; a usina de reciclagem processa sozinha.
const {FAC, LIXO, ok, done, mk: mk0, put, roundTrip} = require('./helpers');
// estes testes medem a regra do próprio assunto, não o acesso: toda sala conta como alcançável (acesso: acesso.test.js e invariantes.test.js)
const mk = (...a) => { const g = mk0(...a); g.reachable = f => !f.dead && f.k !== 'ruin'; return g; };

const world = () => { const g = mk(64); g.msg = () => {}; g.star = 5; g.placeFloorSpan(-1, 0, 63); g.placeFloorSpan(-2, 0, 63); for (let L = 1; L <= 4; L++) g.placeFloorSpan(L, 0, 63); return g; };
const near = (a, b) => Math.abs(a - b) < 1e-9;
const inh = (g, k, L, x) => { const f = put(g, k, L, x); f.occ = true; g.moveIn(f); return f; };
const withRamp = g => put(g, 'lixo', -2, 32);   // galpão de 2 andares no subsolo (B2-B3...)

{
  ok(FAC.lixo.star === 3 && FAC.lixo.underOnly && !FAC.lixo.needRamp && FAC.lixo.h === 2 && FAC.lixo.svc === 'lixo' && FAC.recycling.svc === 'lixo' && FAC.recycling.waste.process > 0, 'depósito: 3★, galpão alto (2 andares) só no subsolo, sem exigir rampa; a usina de reciclagem também atende o serviço');
  const g = world(); ok(g.canPlaceFac('lixo', -2, 32).ok, 'pode ser construído sem rampa nem túnel'); ok(!g.canPlaceFac('lixo', -1, 32).ok && /térreo/.test(g.canPlaceFac('lixo', -1, 32).err), 'mas precisa caber nos dois andares abaixo do térreo (não cruza o térreo)'); ok(!g.canPlaceFac('lixo', 1, 32).ok, 'e não vai acima do solo');
}
// enche com quem está por perto (e só dentro do alcance)
{
  const g = world(); const dep = withRamp(g); const near1 = inh(g, 'office', 1, 24);
  g.trashDaily();
  ok(near(dep.lixo, near1.persons.length * LIXO.perPerson) && near1.persons.length > 0, `um escritório por perto manda ${dep.lixo.toFixed(1)} de lixo por dia (${near1.persons.length} pessoas)`);
  const g2 = mk(240); g2.msg = () => {}; g2.star = 5; g2.placeFloorSpan(-1, 0, 239); g2.placeFloorSpan(-2, 0, 239); g2.placeFloorSpan(1, 0, 239); const d2 = put(g2, 'lixo', -2, 32); inh(g2, 'office', 1, 200); g2.trashDaily(); ok(!(d2.lixo > 0), 'unidade longe do depósito (além de ' + LIXO.range + ' unidades) não manda lixo');
  const g3 = world(); const d3 = withRamp(g3); const c3 = put(g3, 'cafe', 1, 24); const b = d3.lixo || 0; g3.trashDaily(); ok(near(d3.lixo, c3.w * LIXO.perWidth), 'comércio gera lixo pela largura');
  const g4 = world(); const d4 = withRamp(g4); put(g4, 'office', 1, 24); g4.trashDaily(); ok(!(d4.lixo > 0), 'sala vaga não gera lixo');
}
// caminhão: é uma ação do jogador (nunca vem sozinho); esvazia depois da espera, cobra e anima
{
  const g = world(); const dep = withRamp(g); g.cars = [];
  dep.lixo = FAC.lixo.waste.cap * .95; g.trashDaily(); g.trashTick(); ok(!dep.truckEta && !g.cars.length, 'mesmo quase cheio, o caminhão não vem sozinho');
  const ge = world(), de = withRamp(ge); de.lixo = 0; ok(/vazio/.test(ge.callGarbage(de)), 'depósito vazio: nada a coletar');
  const f0 = g.funds; ok(g.callGarbage(dep) === null, 'o jogador chama o caminhão');
  ok(dep.truckEta === g.t + LIXO.eta && g.cars.some(c => c.kind === 'lixo' && !c.hide), 'ele para na rua em cima do galpão (e entra na doca no desenho)');
  ok(/a caminho/.test(g.callGarbage(dep)), 'não dá para chamar duas vezes');
  const gr = world(); const dr = withRamp(gr); put(gr, 'parkramp', -1, 48); gr.cars = []; dr.lixo = 300; gr.callGarbage(dr); ok(gr.cars.some(c => c.kind === 'lixo'), 'com rampa ligada o caminhão também vem');
  g.t += LIXO.eta - 1; g.trashTick(); ok(dep.lixo > 0 && dep.truckEta, 'antes de chegar não esvazia');
  g.t += 2; g.trashTick(); ok(dep.lixo === 0 && !dep.truckEta && near(f0 - g.funds, LIXO.cost), 'o caminhão esvazia o depósito e cobra a coleta (R$ ' + LIXO.cost + ')');
  ok(g.fin.cur.mnt.lixo === LIXO.cost, 'a despesa entra em "Coleta de lixo"');
  const g2 = world(); const d2 = withRamp(g2); d2.lixo = 390; g2.funds = 100; ok(/Dinheiro/.test(g2.callGarbage(d2)) && !d2.truckEta, 'sem dinheiro o caminhão não vem');
  const rc = world(); const rec = put(rc, 'recycling', 1, 40); rec.lixo = 100; ok(/sozinha/.test(rc.callGarbage(rec)), 'a usina não usa caminhão');
}
// alerta e painel: a partir da metade o depósito avisa e oferece a ação
{
  const g = world(); const dep = withRamp(g); g.t += 10;
  ok(!g.alerts().some(a => /Lixo/.test(a.title)), 'com folga não há alerta');
  dep.lixo = FAC.lixo.waste.cap * .8; const al = g.alerts().find(a => /Lixo acumulando/.test(a.title));
  ok(al && al.sev === 1 && al.actions.some(x => x.type === 'garbage' && x.fac === dep && x.cost === LIXO.cost), 'a 80% aparece o alerta com o botão "Chamar caminhão"');
  dep.lixo = FAC.lixo.waste.cap; const al2 = g.alerts().find(a => /transbordando/.test(a.title)); ok(al2 && al2.sev === 2, 'cheio, o alerta fica grave');
  dep.truckEta = g.t + 20; ok(/a caminho/.test(g.alerts().find(a => /Lixo/.test(a.title)).status) && !g.alerts().find(a => /Lixo/.test(a.title)).actions.some(x => x.type === 'garbage'), 'com o caminhão a caminho o botão some');
}
// o descontentamento cresce com o lixo acumulado (a partir de `annoy`) até transbordar, e só perto
{
  const g = world(); const dep = withRamp(g); const u = inh(g, 'condo', 1, 24); g.t += 10; const cap = FAC.lixo.waste.cap;
  const v = lv => { dep.lixo = cap * lv; g._utk = null; const m = g.evalBreakdown(u).find(o => o.key === 'lixo'); return m ? m.v : 0; };
  ok(v(.2) === 0 && v(LIXO.annoy) === 0, 'até a metade ninguém reclama');
  const a = v(.65), b = v(.85), c = v(1);
  ok(a < 0 && b < a && c < b, `quanto mais cheio, pior: ${a.toFixed(1)} → ${b.toFixed(1)} → ${c.toFixed(1)}`);
  dep.lixo = cap * .7; ok(/acumulado/.test(g.evalBreakdown(u).find(o => o.key === 'lixo').label), 'antes de encher o motivo diz "acumulado"');
  dep.lixo = cap; ok(/transbordando/.test(g.evalBreakdown(u).find(o => o.key === 'lixo').label) && Math.abs(g.evalFac(u) - Math.max(0, Math.min(300, g.evalBreakdown(u).reduce((x, o) => x + o.v, 0)))) < 1e-9, 'cheio, transborda; a nota continua sendo a soma dos motivos');
  const w = mk(240); w.msg = () => {}; w.star = 5; w.placeFloorSpan(-1, 0, 239); w.placeFloorSpan(-2, 0, 239); w.placeFloorSpan(1, 0, 239); const wd = put(w, 'lixo', -2, 32); const wfar = inh(w, 'condo', 1, 200); wd.lixo = cap; w._utk = null;
  ok(!w.evalBreakdown(wfar).find(o => o.key === 'lixo'), 'mas só perto: o apartamento longe não sente');
  const lo = world(); const dl = put(lo, 'lixo', -2, 32); dl.lixo = cap; const ul = inh(lo, 'condo', 1, 24); lo.star = 2; lo._utk = null;
  ok(!lo.evalBreakdown(ul).find(o => o.key === 'lixo'), 'antes do 3★ o lixo não pesa em ninguém');
}
// usina de reciclagem processa sozinha e nunca precisa de caminhão
{
  const g = world(); const rec = put(g, 'recycling', 1, 40); inh(g, 'office', 1, 16);
  rec.lixo = 1000; g.trashDaily(); ok(rec.lixo <= 1000 - FAC.recycling.waste.process + 10 && !rec.truckEta, 'a usina processa o lixo por dia e não chama caminhão');
}
// só a partir do 3★, e salvar/carregar
{
  const lo = world(); const d = withRamp(lo); d.lixo = 77; d.truckEta = 4321;
  const r = roundTrip(lo), rd = r.facs.find(f => f.k === 'lixo');
  ok(rd && rd.lixo === 77 && rd.truckEta === 4321, 'nível do depósito e caminhão a caminho vão no save');
  const old = JSON.parse(JSON.stringify(lo.serialize())); for (const f of old.facs) { delete f.lx; delete f.te; } const h = world(); h.load(old); ok(h.facs.find(f => f.k === 'lixo').lixo === 0, 'save antigo carrega com depósito vazio');
}
done('lixo');
