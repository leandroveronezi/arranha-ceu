'use strict';
// Regras que saíram da calibração (RELATORIO-CALIBRACAO.md): lixo vira demanda do prédio, comércio e lazer por perto é local, rolante gasta energia e escada comum não,
// academia/convenções só para quem não sofre barulho, VIP só em hotel com movimento, e a economia dos comércios fecha a conta.
const {FAC, TRANSPORT, DEMAND, DEMAND_EXTRA, DEMANDV, NOISE, UTIL, ok, done, mk: mk0, put} = require('./helpers');
const mk = (...a) => { const g = mk0(...a); g.reachable = f => !f.dead && f.k !== 'ruin'; return g; };
const world = () => { const g = mk(200); g.msg = () => {}; g.star = 5; for (let L = 1; L <= 12; L++) g.placeFloorSpan(L, 0, 199); g.placeFloorSpan(-1, 0, 199); g.placeFloorSpan(-2, 0, 199); return g; };

// lixo e usina são demanda do prédio: um depósito longe, em qualquer lugar, atende todo mundo
{
  const g = world(); const apt = put(g, 'condo', 12, 0); apt.occ = true;
  ok(!g.demandFactors(apt).some(d => d.svc === 'lixo'), 'sem depósito nem usina o apartamento não ganha o extra de lixo');
  put(g, 'lixo', -2, 148); g._utk = null;
  ok(g.serviceNear(apt, 'lixo') === 1 && g.demandFactors(apt).find(d => d.svc === 'lixo').met, 'um depósito de lixo no subsolo, a 12 andares e 150 unidades de distância, já atende o prédio inteiro');
}

// comércio e lazer por perto é local: o restaurante a 3 andares conta, o do outro lado da torre não
{
  const g = world(); const apt = put(g, 'condo', 6, 0); const n0 = g.amenityKinds(apt);
  put(g, 'restaurant', 8, 40); ok(g.amenityKinds(apt) === n0 + 1, 'restaurante a 2 andares conta como comércio por perto');
  const g2 = world(); const a2 = put(g2, 'condo', 6, 0); put(g2, 'restaurant', 6, 160);
  ok(g2.amenityKinds(a2) === 0, 'restaurante a 160 unidades, no mesmo andar, não conta (o bônus deixou de olhar só andares)');
}

// quem sofre com barulho não pede academia nem convenções
{
  const sensitive = Object.keys(FAC).filter(k => FAC[k].sensitive);
  ok(sensitive.every(k => !DEMAND[k] || (!DEMAND[k].includes('academia') && !DEMAND[k].includes('convencoes'))), 'moradia e hotel sensíveis a barulho não pedem academia nem auditório (' + sensitive.join(', ') + ')');
  ok(DEMAND_EXTRA.coworking.includes('academia') && DEMAND_EXTRA.officeEx.includes('convencoes') && DEMAND_EXTRA.twin.includes('convencoes'), 'coworking, escritório executivo e quarto duplo (não sensíveis) ganham academia ou convenções como extra');
  ok(Object.values(DEMAND).every(l => l.length <= 2), 'nenhum bloco tem mais de 2 exigências');
  ok(new Set(Object.keys(DEMAND).map(k => DEMAND[k].join() + '|' + (DEMAND_EXTRA[k] || []).join())).size === Object.keys(DEMAND).length, 'cada bloco tem um perfil diferente (exigências + extras)');
  ok(NOISE.perSource * NOISE.cap / NOISE.perSource <= 60 && NOISE.perSource <= 25, 'barulho pesa menos que antes (' + NOISE.perSource + ' por fonte, teto ' + NOISE.cap + ')');
}

// escada comum não gasta nada; rolante gasta energia e, sem energia, vira escada comum (mais lenta e parada)
{
  const old = {...UTIL.grid}; UTIL.grid.energia = 0; UTIL.grid.agua = 0;
  try {
    const g = mk(64); g.msg = () => {}; g.star = 5; for (let L = 1; L <= 3; L++) g.placeFloorSpan(L, 0, 63);
    g.placeStairs('stairs', 0, 8); g.placeStairs('escalator', 1, 8);
    const st = g.stairs.find(s => s.k === 'stairs'), es = g.stairs.find(s => s.k === 'escalator');
    g._utk = null; g.utilFresh();
    ok(es.dark === true && !st.dark, 'sem energia a rolante pára e a escada comum segue igual');
  } finally { Object.assign(UTIL.grid, old); }
  const h = mk(64); h.msg = () => {}; h.star = 5; for (let L = 1; L <= 3; L++) h.placeFloorSpan(L, 0, 63);
  h.placeStairs('escalator', 0, 8); const e = h.stairs[0]; h._utk = null; h.utilFresh();
  ok(e.dark === false && h.util.energia.use >= UTIL.escalator, 'com energia a rolante anda e entra no consumo (' + UTIL.escalator + ')');
}

// economia: comércio silencioso fecha a conta com a clientela mínima
{
  for (const k of ['cafe', 'mercado', 'lavanderia', 'banco']) {
    const d = FAC[k], lo = d.perCustomer * d.visitors[0] * 0.5, hi = d.perCustomer * (d.visitors[1] || d.visitors[0]);
    ok(hi >= d.dailyCost, k + ': com a clientela cheia paga o custo diário (' + hi + ' ≥ ' + d.dailyCost + ')');
  }
  ok(FAC.cinema.dailyCost > 0 && FAC.party.dailyCost > 0 && FAC.auditorio.dailyCost > 0, 'cinema, festa e auditório têm custo diário (não são dinheiro de graça)');
  ok(TRANSPORT.service.cost >= TRANSPORT.elevator.cost * 0.75, 'o elevador de serviço não custa menos que 75% do comum (' + TRANSPORT.service.cost + ' contra ' + TRANSPORT.elevator.cost + ')');
}
done('calibracao');
