'use strict';
// Clima: sorteado pela estação (o de amanhã é previsto), ajusta consumo, placa solar e chance de apagão, e liga a chuva.
const {FAC, UTIL, OUTAGE, STORM, weatherName, WEATHER, WEATHER_KEYS, WEATHER_ODDS, SEASON_DAYS, ok, done, mk: mk0, put, roundTrip} = require('./helpers');
// estes testes medem a regra do próprio assunto, não o acesso: toda sala conta como alcançável (acesso: acesso.test.js e invariantes.test.js)
const mk = (...a) => { const g = mk0(...a); g.reachable = f => !f.dead && f.k !== 'ruin'; return g; };

const world = () => { const g = mk(120); g.msg = () => {}; g.star = 5; for (let L = 1; L <= 6; L++) g.placeFloorSpan(L, 0, 119); return g; };
const near = (a, b) => Math.abs(a - b) < 1e-6;
const season = (g, i) => { g.t = i * SEASON_DAYS * 1440 + 6 * 60; g._utk = null; };

{
  ok(WEATHER_ODDS.length === 4 && WEATHER_ODDS.every(o => o.length === WEATHER_KEYS.length && near(o.reduce((a, b) => a + b, 0), 1)), 'cada estação tem chances que somam 100%');
  ok(WEATHER_KEYS.join() === 'sol,nublado,garoa,chuva,tempestade,calor,frio', 'tipos de clima: sol, nublado, garoa, chuva, tempestade, calor, frio');
  const g = world(); const n = 3000, c = [0, 1, 2, 3].map(() => ({}));
  for (let s = 0; s < 4; s++) for (let i = 0; i < n; i++) { const w = g.pickWeather(s * SEASON_DAYS); c[s][w] = (c[s][w] || 0) + 1; }
  ok(!c[3].calor && !c[0].frio && !c[1].frio && !c[2].calor, 'inverno nunca tem calor; verão e primavera, nunca frio');
  ok((c[1].calor || 0) / n > 0.28 && (c[3].frio || 0) / n > 0.28 && (c[0].chuva || 0) > (c[1].chuva || 0) && c.every(x => x.tempestade > 0), 'verão tem calor, inverno tem frio, primavera chove mais que o verão e toda estação tem tempestade');
}

// previsão vira o clima do dia seguinte
{
  const g = world(); g.forecast = 'calor'; g.t = (g.day + 1) * 1440 + 10; g.newDay();
  ok(g.weather === 'calor' && WEATHER_KEYS.includes(g.forecast), 'o clima do dia é a previsão de ontem, e uma nova previsão é sorteada');
  for (const w of ['garoa', 'chuva', 'tempestade']) { g.forecast = w; g.t += 1440; g.newDay(); ok(g.weather === w && g.rainWin && g.rainWin[1] > g.rainWin[0], w + ' abre uma janela de chuva'); }
  g.forecast = 'sol'; g.t += 1440; g.newDay(); ok(g.weather === 'sol' && !g.rainWin, 'sem chuva nos outros climas');
}

// efeitos no consumo, na placa solar e no apagão
{
  const g = world(); const apt = put(g, 'condo', 1, 0); apt.occ = true; season(g, 0);
  const base = [g.utilUse(apt, 0), g.utilUse(apt, 1)];
  const at = w => { g.weather = w; return [g.utilUse(apt, 0) / base[0], g.utilUse(apt, 1) / base[1]]; };
  const calor = at('calor'), frio = at('frio'), chuva = at('chuva'), sol = at('sol'); at('sol');
  ok(near(calor[0], WEATHER.calor.energia) && near(calor[1], WEATHER.calor.agua), 'onda de calor: água ×' + WEATHER.calor.agua + ', energia ×' + WEATHER.calor.energia);
  ok(near(frio[0], WEATHER.frio.energia) && near(frio[1], 1), 'frio forte: energia ×' + WEATHER.frio.energia);
  ok(near(chuva[1], WEATHER.chuva.agua) && chuva[1] < 1 && near(sol[0], 1) && near(sol[1], 1), 'chuva gasta menos água; sol é a base');
  put(g, 'solar', 6, 40); g.t = 12 * 60; season(g, 0); g.t += 6 * 60;
  const cap = w => { g.weather = w; return g.utilCap('energia') - UTIL.grid.energia; };
  const full = cap('sol');
  ok(near(cap('nublado'), full * WEATHER.nublado.sun) && near(cap('chuva'), full * WEATHER.chuva.sun) && cap('calor') > full, 'a placa solar rende metade no nublado, um quarto na chuva e mais no calor');
  // chance de apagão: com sorteio fixo entre os dois limiares só o clima ruim derruba
  const p = OUTAGE.chance / 24, orig = Math.random;
  const outage = w => { const h = world(); h.pop = 400; h.weather = w; Math.random = () => p * 1.4; try { h.utilEvents(); } finally { Math.random = orig; } return h.outage.energia > h.t; };
  ok(!outage('sol') && outage('calor') && outage('frio') && !outage('nublado'), 'onda de calor e frio forte dobram/aumentam a chance de apagão; sol e nublado não');
}

// intensidades: garoa < chuva < tempestade; no inverno vira neve; tempestade traz raios e apagões
{
  ok(WEATHER.garoa.level < WEATHER.chuva.level && WEATHER.chuva.level < WEATHER.tempestade.level && WEATHER.tempestade.storm && !WEATHER.chuva.storm, 'três intensidades de chuva, só a tempestade tem raios');
  ok(WEATHER.garoa.outage < WEATHER.chuva.outage && WEATHER.chuva.outage < WEATHER.tempestade.outage && WEATHER.tempestade.outage >= 4, 'quanto mais pesada a chuva, maior a chance de apagão (tempestade ×' + WEATHER.tempestade.outage + ')');
  ok(weatherName('chuva', 0) === 'Chuva' && weatherName('chuva', 3) === 'Neve' && weatherName('garoa', 3) === 'Neve fraca' && weatherName('tempestade', 3) === 'Nevasca' && weatherName('sol', 3) === 'Ensolarado', 'no inverno a chuva vira neve fraca, neve e nevasca');
  const mkS = w => { const h = world(); h.pop = 400; h.weather = w; h.forecast = w; h.day0 = h.day; return h; };
  const orig = Math.random; let hit = 0;
  Math.random = () => STORM.blackout / 2; try { const a = mkS('tempestade'); a.utilEvents(); hit = a.outage.energia > a.t ? 1 : 0; const b = mkS('chuva'); b.utilEvents(); ok(!(b.outage.energia > b.t) || OUTAGE.chance / 24 * WEATHER.chuva.outage > STORM.blackout / 2, 'chuva comum não tem raio'); } finally { Math.random = orig; }
  ok(hit === 1, 'na tempestade um raio derruba a rede (chance por hora ' + STORM.blackout * 100 + '%)');
  const g = mkS('tempestade'); g.step(0.1); g.weather = 'tempestade'; g.rain = 1; g.rainWin = [g.t - 10, g.t + 1e6]; g.simT = 100; const sounds = []; g.emit = (t, d) => { if (t === 'sound') sounds.push(d.name); };
  for (let i = 0; i < 400; i++) g.step(0.1);
  ok(g.flashT !== undefined && sounds.includes('thunder'), 'durante a tempestade há raios (a tela pisca) e trovões');
  const q = mkS('sol'); q.step(0.1); q.rain = 1; q.rainWin = [q.t - 10, q.t + 1e6]; q.simT = 50; const s2 = []; q.emit = (t, d) => { if (t === 'sound') s2.push(d.name); }; for (let i = 0; i < 400; i++) q.step(0.1); ok(!s2.includes('thunder') && q.flashT === undefined, 'sem tempestade não há raios nem trovões');
}

// previsão às 18h
{
  const g = world(); const msgs = []; g.msg = t => msgs.push(t); g.forecast = 'calor'; g.t = 18 * 60 + 5; g.utilEvents();
  ok(msgs.some(t => /Previsão para amanhã/.test(t) && /onda de calor/.test(t) && /água ×1\.25/.test(t)), 'às 18h avisa o clima de amanhã e o efeito no consumo');
  msgs.length = 0; g.t = 10 * 60; g.utilEvents(); ok(!msgs.some(t => /Previsão/.test(t)), 'só às 18h');
}

// salvar e carregar
{
  const g = world(); g.weather = 'frio'; g.forecast = 'chuva'; const r = roundTrip(g);
  ok(r.weather === 'frio' && r.forecast === 'chuva', 'clima e previsão vão no save');
  const old = JSON.parse(JSON.stringify(g.serialize())); delete old.wx; delete old.fc; const h = world(); h.load(old); ok(h.weather === 'sol' && h.forecast === 'sol', 'save antigo volta com sol');
}
done('clima');
