'use strict';
// Estações do ano: SEASON_DAYS dias cada, ano de 4 estações; verão dobra a água, inverno dobra a energia; a placa solar rende mais no verão; aviso antes da virada.
const {FAC, UTIL, USE, SEASONS, SEASON_DAYS, YEAR_DAYS, ok, done, mk: mk0, put} = require('./helpers');
// estes testes medem a regra do próprio assunto, não o acesso: toda sala conta como alcançável (acesso: acesso.test.js e invariantes.test.js)
const mk = (...a) => { const g = mk0(...a); g.reachable = f => !f.dead && f.k !== 'ruin'; return g; };

const world = () => { const g = mk(120); g.msg = () => {}; g.star = 5; for (let L = 1; L <= 6; L++) g.placeFloorSpan(L, 0, 119); return g; };
const at = (g, day, hour = 6) => { g.t = day * 1440 + hour * 60; };
const near = (a, b) => Math.abs(a - b) < 1e-6;

{
  ok(YEAR_DAYS === SEASON_DAYS * 4 && SEASON_DAYS >= 1, `o ano tem ${YEAR_DAYS} dias (${SEASON_DAYS} por estação)`);
  const g = world(); const seen = [];
  for (let d = 0; d < YEAR_DAYS * 2; d++) { at(g, d); seen.push(g.season); }
  ok(seen.slice(0, YEAR_DAYS).filter((s, i) => s === Math.floor(i / SEASON_DAYS)).length === YEAR_DAYS && seen[YEAR_DAYS] === 0, 'primavera, verão, outono e inverno em sequência, e o ano recomeça');
  at(g, 0); const y1 = g.year; at(g, YEAR_DAYS); ok(y1 === 1 && g.year === 2, 'o ano vira a cada ' + YEAR_DAYS + ' dias');
  ok(SEASONS.length === 4 && SEASONS.map(s => s.name).join() === 'Primavera,Verão,Outono,Inverno', 'nomes das estações');
}

// consumo: primavera e outono são a base; verão dobra a água; inverno dobra a energia
{
  const g = world(); const apt = put(g, 'condo', 1, 0), off = put(g, 'office', 2, 0); apt.occ = off.occ = true;
  const use = (d, f, i) => { at(g, d * SEASON_DAYS); return g.utilUse(f, i); };
  const base = [USE.condo[0] * apt.w, USE.condo[1] * apt.w];
  ok(near(use(0, apt, 0), base[0]) && near(use(0, apt, 1), base[1]) && near(use(2, apt, 0), base[0]) && near(use(2, apt, 1), base[1]), 'primavera e outono: consumo base');
  ok(near(use(1, apt, 1), base[1] * 2) && near(use(1, apt, 0), base[0]), 'verão: água ×2, energia ×1');
  ok(near(use(3, apt, 0), base[0] * 2) && near(use(3, apt, 1), base[1]), 'inverno: energia ×2, água ×1');
  at(g, 3 * SEASON_DAYS); const e = g.utilCalc().energia.use; at(g, 0); ok(e > g.utilCalc().energia.use, 'a torre toda gasta mais energia no inverno');
}

// placa solar
{
  const g = world(); put(g, 'solar', 6, 0);
  const cap = d => { at(g, d * SEASON_DAYS, 12); return g.utilCap('energia') - UTIL.grid.energia; };
  const sp = cap(0), su = cap(1), au = cap(2), wi = cap(3);
  ok(su > sp && sp > au && au > wi && near(wi, FAC.solar.util.energia * SEASONS[3].sol), `a placa rende mais no verão (${su.toFixed(0)}) e menos no inverno (${wi.toFixed(0)})`);
}

// pico de inverno derruba a torre perto do limite; gerador compensa
{
  const g = world(); const old = {...UTIL.grid}; UTIL.grid.agua = 1e9;
  try {
    for (let L = 1; L <= 6; L++) for (const x of [0, 20, 40, 60]) { try { put(g, 'office', L, x).occ = true; } catch (e) {} }
    const need = (() => { at(g, 0); return g.utilCalc().energia.use; })();
    UTIL.grid.energia = need * 1.3;
    at(g, 0); ok(g.utilCalc().energia.cut === 0, 'na primavera a torre cabe na capacidade');
    at(g, 3 * SEASON_DAYS); ok(g.utilCalc().energia.cut > 0, 'no inverno (×2) a mesma torre passa do limite');
    g.placeFloorSpan(-1, 0, 119); put(g, 'gerador', -1, 24); put(g, 'gerador', -1, 32); put(g, 'gerador', -1, 40); at(g, 3 * SEASON_DAYS);
    ok(g.utilCalc().energia.cut === 0, 'geradores cobrem o pico do inverno');
    const f = g.facs.find(o => o.k === 'office'); at(g, 3 * SEASON_DAYS); UTIL.grid.energia = need * 0.5; g.utilCalc(); const m = g.evalBreakdown(f).find(o => o.key === 'util:energia');
    ok(!m || /inverno/.test(m.label), 'o motivo explica que é o inverno (consumo maior)');
  } finally { Object.assign(UTIL.grid, old); }
}

// aviso antes da virada da estação
{
  const g = world(); const msgs = []; g.msg = (t, c) => msgs.push([t, c]);
  at(g, SEASON_DAYS - 1, 12);   // último dia da primavera → amanhã é verão
  g.minute; g.utilEvents();
  ok(msgs.some(([t]) => /Amanhã começa o\(a\) verão/.test(t) && /água ×2/.test(t)), 'meio-dia antes do verão avisa que a água dobra');
  msgs.length = 0; at(g, 3 * SEASON_DAYS - 1, 12); g.utilEvents();
  ok(msgs.some(([t]) => /inverno/.test(t) && /energia ×2/.test(t)), 'e antes do inverno, que a energia dobra');
  msgs.length = 0; at(g, 0, 12); g.utilEvents(); ok(!msgs.some(([t]) => /Amanhã começa/.test(t)), 'sem aviso no meio da estação');
}
done('estacoes');
