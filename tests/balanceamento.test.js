'use strict';
// Balanceamento: o jogo não pode cobrar o que o jogador ainda não pode construir. Demanda, eventos e exigências só valem a partir da estrela em que o item existe.
const {FAC, TRANSPORT, DEMAND, DEMANDV, SERVICES, SVC_STAR, SVC_NAMES, UTIL, OUTAGE, SEASONS, SEASON_DAYS, WEATHER_KEYS, ok, done, mk, put} = require('./helpers');

const world = (star, floors = 12) => { const g = mk(64); g.msg = () => {}; g.star = star; g.placeFloorSpan(-1, 0, 63); for (let L = 1; L <= floors; L++) g.placeFloorSpan(L, 0, 63); return g; };
const tenants = Object.keys(FAC).filter(k => FAC[k].tenant || FAC[k].hotel);

// 1. a demanda só cobra serviços que já existem para a estrela atual
{
  let bad = [];
  for (let s = 1; s <= 5; s++) {
    const g = world(s);
    for (const k of tenants) {
      if (FAC[k].star > s) continue;
      let f; try { f = put(g, k, 1 + tenants.indexOf(k) % 10, (tenants.indexOf(k) % 3) * 24); } catch (e) { continue; }
      for (const d of g.demandFactors(f)) if (SVC_STAR[d.svc] > s) bad.push(k + '@' + s + '★ cobra ' + d.svc + ' (' + SVC_STAR[d.svc] + '★)');
    }
  }
  ok(bad.length === 0, 'em nenhuma estrela a demanda cobra algo ainda bloqueado' + (bad.length ? ': ' + bad.slice(0, 3).join('; ') : ''));
  const g1 = world(1), off = put(g1, 'office', 1, 0), kit = put(g1, 'kitnet', 2, 0);
  ok(JSON.stringify(g1.demandFactors(off).map(d => d.svc).sort()) === JSON.stringify(['cafe']), 'no começo (1★) o escritório só exige café (o transporte é do 2★): ' + g1.demandFactors(off).map(d => d.svc).join(', '));
  ok(JSON.stringify(g1.demandFactors(kit).map(d => d.svc).sort()) === JSON.stringify(['cafe']), 'e a kitnet também (a lavanderia é do 2★)');
  ok(g1.vacancyReasons(off).filter(r => /^Falta .* por perto/.test(r.text)).length === 1, '"Por que está vago?" só lista o que dá para construir');
  const g2 = world(2), o2 = put(g2, 'office', 1, 0); ok(g2.demandFactors(o2).map(d => d.svc).includes('transporte') && !g2.demandFactors(o2).map(d => d.svc).includes('banco'), 'no 2★ entra o transporte (táxi/ônibus), ainda sem banco');
  ok(!world(2).demandFactors(put(world(2), 'condo', 1, 0)).some(d => d.svc === 'creche') && world(3).demandFactors(put(world(3), 'condo', 1, 0)).some(d => d.svc === 'creche'), 'a creche (3★) só entra na demanda dos apartamentos no 3★');
  const unlock = new Set(); for (const [k, d] of Object.entries(DEMAND)) for (const sv of d) if (SERVICES.has(sv)) unlock.add(SVC_STAR[sv]);
  ok([...unlock].every(s => s >= 1 && s <= 5) && SVC_STAR.cafe === 1 && SVC_STAR.bike === 1 && SVC_STAR.piscina === 4, 'estrelas dos serviços: café e bicicletário no início, piscina no 4★');
}

// 2. exigências entre salas: nada exige um item de estrela maior
{
  ok(FAC.caixa.star >= FAC.bomba.star, 'a caixa d\'água não vem antes da bomba que a enche');
  ok(['tunnel', 'tunnelExt', 'tunnelCam', 'tunnelHyd', 'tunnelSpr'].every(k => FAC[k].star >= FAC.parkramp.star), 'túneis só aparecem junto com a rampa a que se ligam');
  ok(FAC.tunnelPortal.star >= FAC.tunnel.star && FAC.tunnelPortal2.star >= FAC.tunnelPortal.star, 'portais vêm depois dos túneis comuns');
  const g = world(2); ok(g.canPlaceFac('busstop', 0, 64).ok && g.canPlaceFac('taxi', 0, 80).ok, 'ônibus e táxi (2★) podem ser construídos no térreo sem rampa nem túnel (que são do 3★)');
  ok(FAC.bateria.star <= FAC.geradorGas.star && FAC.gerador.star <= FAC.bateria.star, 'energia: gerador a diesel antes da bateria, e esta antes do gerador a gás');
  ok(FAC.corridorExt.star === 1 && FAC.corridorCam.star === 1 && FAC.bike.star === 1 && FAC.cafe.star === 1, 'extintor, câmera, bicicletário e café estão no início');
}

// 3. eventos de energia/água só depois de o jogador poder construir fontes
{
  // gerador, bomba e caixa d'água são do 1★: a água é produzida pelo jogador e só a energia vem da rua (e é pouca); eventos só com gente suficiente (pop ≥ 150)
  ok(OUTAGE.minStar === Math.min(FAC.gerador.star, FAC.bomba.star, FAC.caixa.star) && FAC.bomba.star === 1 && FAC.caixa.star === 1 && FAC.gerador.star === 1, 'o apagão começa na estrela da primeira fonte (' + OUTAGE.minStar + '★): gerador, bomba e caixa já no 1★');
  let hits = 0; const lo = world(1); lo.pop = 100; for (let i = 0; i < 20000; i++) { lo.outage.energia = lo.outage.agua = 0; lo.utilEvents(); if (lo.outage.energia || lo.outage.agua) hits++; }
  ok(hits === 0, 'com menos de 150 pessoas não há apagão nem falta d\'água');
  let h2 = 0; const hi = world(OUTAGE.minStar); hi.pop = 400; for (let i = 0; i < 20000; i++) { hi.outage.energia = hi.outage.agua = 0; hi.utilEvents(); if (hi.outage.energia || hi.outage.agua) h2++; }
  ok(h2 > 0, 'a partir de ' + OUTAGE.minStar + '★ eles passam a acontecer (' + h2 + ' em 20000 horas)');
}

// 4. a torre que o 1★ pode construir aguenta o pior clima sem ninguém cortado
{
  const g = world(1, 12);
  for (let L = 1; L <= 12; L++) for (const x of [0, 8, 16, 24, 36, 44]) { try { put(g, L % 3 === 0 && x < 20 ? 'condo' : 'office', L, x).occ = true; } catch (e) {} }
  g.placeShaft('elevator', 56, 0, 12); const s = g.shafts[0]; g.addCar(s); g.addCar(s);
  let worst = null;
  for (let si = 0; si < 4; si++) for (const w of WEATHER_KEYS) {
    g.t = si * SEASON_DAYS * 1440 + 12 * 60; g.weather = w; g._utk = null; const u = g.utilCalc();
    if (u.energia.cut || u.agua.cut) worst = SEASONS[si].name + '/' + w + ' (' + u.energia.use.toFixed(0) + '/' + u.energia.cap.toFixed(0) + ' · ' + u.agua.use.toFixed(0) + '/' + u.agua.cap.toFixed(0) + ')';
  }
  ok(!worst, 'torre de 12 andares lotada, no pior clima de qualquer estação, não fica sem energia nem água' + (worst ? ': ' + worst : ''));
  const u = (g.t = 3 * SEASON_DAYS * 1440 + 12 * 60, g.weather = 'frio', g._utk = null, g.utilCalc());
  ok(u.energia.use < u.energia.cap && u.energia.use > u.energia.cap * 0.4, 'mas o pico de inverno já ocupa boa parte da rede (' + (100 * u.energia.use / u.energia.cap).toFixed(0) + '%): torres maiores precisam de fontes');
}

// 5. transporte público em níveis: táxi < ônibus < metrô
{
  ok(FAC.taxi.tier < FAC.busstop.tier && FAC.busstop.tier < FAC.transit.tier && FAC.taxi.svc === 'transporte' && FAC.busstop.svc === 'transporte' && FAC.transit.svc === 'transporte', 'táxi, ônibus e metrô são a mesma família (transporte público), um nível acima do outro');
  ok(FAC.taxi.star <= FAC.busstop.star && FAC.busstop.star < FAC.transit.star && SVC_STAR.transporte === FAC.taxi.star && SVC_NAMES.transporte === 'transporte público', 'a família existe desde o táxi; o metrô é o nível mais alto');
  const g = world(5); g.placeFloorSpan(-3, 0, 63); const off = put(g, 'office', 1, 0);
  const val = () => { const d = g.demandFactors(off).find(x => x.svc === 'transporte'); return d ? d.v : null; };
  const none = val(); ok(none < 0 && g.transportTier() === 0 && /Falta transporte público/.test(g.demandFactors(off).find(x => x.svc === 'transporte').label), 'sem transporte público: "Falta transporte público por perto"');
  put(g, 'taxi', 0, 64); const t1 = val(); ok(g.transportTier() === 1 && t1 > 0, 'com táxi já conta');
  put(g, 'busstop', 0, 80); const t2 = val(); ok(g.transportTier() === 2 && t2 > t1, 'o ônibus vale mais que o táxi (' + t1.toFixed(1) + ' → ' + t2.toFixed(1) + ')');
  put(g, 'transit', -3, 0); const t3 = val(); ok(g.transportTier() === 3 && t3 > t2 && near(t3, DEMANDV.met), 'o metrô é o nível mais alto: vale o bônus inteiro (' + t3.toFixed(1) + ')');
  put(g, 'busstop', 0, 100); ok(near(val(), t3), 'mais pontos do mesmo nível não somam: vale o melhor nível presente');
  const far = world(5), ofar = put(far, 'office', 12, 40); put(far, 'taxi', 0, 64); ok(far.demandFactors(ofar).find(x => x.svc === 'transporte').met, 'o transporte público atende a torre inteira (andar 12, ponto no térreo)');
}
function near(a, b) { return Math.abs(a - b) < 1e-6; }
done('balanceamento');
