'use strict';
// Cheats / modo deus, só pelo console do navegador (F12): cheat('ajuda'). Serve para testar o jogo sem esperar: dinheiro, estrelas,
// construir de graça, avançar o tempo, disparar eventos (fogo, apagão, VIP...) e inspecionar salas. Lógica pura, testada no Node.
const parseFloorArg = s => {   // aceita o rótulo do jogo: 1 = térreo, 2 = 1º andar..., B1 = primeiro subsolo
  const m = /^b(\d+)$/i.exec(String(s));
  if (m) return -(+m[1]);
  const n = parseInt(s, 10);
  if (!Number.isFinite(n) || n < 1) throw new Error('andar inválido: "' + s + '" (use 1 = térreo, 2, 3... ou B1, B2...)');
  return n - 1;
};
const parseNum = s => { const n = Number(String(s).replace(/_/g, '').replace(',', '.')); if (!Number.isFinite(n)) throw new Error('número inválido: "' + s + '"'); return n; };

class Cheats {
  constructor(game) {
    this.g = game;
    const g = () => this.g;
    const roomAt = (L, x) => { const f = g().facAt(L, x); if (!f) throw new Error('nenhuma sala em ' + floorLabel(L) + ' x=' + x); return f; };
    this.cmds = {
      ajuda: {use: 'ajuda [comando]', desc: 'lista os comandos', fn: a => a[0] && this.cmds[a[0]] ? a[0] + ': ' + this.cmds[a[0]].use + ' — ' + this.cmds[a[0]].desc
        : Object.entries(this.cmds).map(([k, c]) => c.use + ' — ' + c.desc).join('\n')},
      deus: {use: 'deus [on|off]', desc: 'modo deus: dinheiro sempre alto, 5 estrelas e obras instantâneas', fn: a => {
        const on = a[0] ? a[0] !== 'off' : !g().god;
        g().god = on; if (on) { g().funds = Math.max(g().funds, 1e12); g().star = Math.max(g().star, 5); }
        return 'modo deus ' + (on ? 'ligado' : 'desligado');
      }},
      dinheiro: {use: 'dinheiro <valor>', desc: 'soma (ou tira, com sinal negativo) dinheiro', fn: a => { g().funds += parseNum(a[0]); return 'dinheiro: ' + fmtMoney(g().funds); }},
      estrelas: {use: 'estrelas <1-6>', desc: 'define a classificação (libera as salas dessa faixa)', fn: a => { const n = parseNum(a[0]); if (n < 1 || n > 6) throw new Error('de 1 a 6'); g().star = n; return 'estrelas: ' + n; }},
      salas: {use: 'salas [filtro]', desc: 'lista as chaves de sala para "construir"', fn: a => Object.keys(FAC).filter(k => !a[0] || k.includes(a[0])).join(', ')},
      construir: {use: 'construir <sala> <andar> <x> [lado:1|-1] [obra]', desc: 'constrói de graça e sem exigir estrelas (andar: 1 = térreo, B1 = subsolo); obra = deixa em obras em vez de pronta', fn: a => {
        const [k, fl, xs, side] = a;
        if (!FAC[k]) throw new Error('sala desconhecida: "' + k + '" (veja "salas")');
        const L = parseFloorArg(fl), x = Math.floor(parseNum(xs) / BOX) * BOX, old = g().funds, st = g().star;
        g().funds = Math.max(g().funds, 1e12); g().star = Math.max(st, 5);   // de graça e sem exigir estrelas
        const r = g().placeFac(k, L, x, {dir: side === '-1' ? -1 : 1, w: FAC[k].w});
        g().funds = old; g().star = st;
        if (!r.ok) throw new Error(r.err);
        if (!a.includes('obra')) r.fac.build = 1;
        return FAC[k].label + ' construído(a) em ' + floorLabel(L) + ', x=' + x + '.';
      }},
      piso: {use: 'piso <andar> <x1> <x2>', desc: 'estende o piso do andar entre dois x', fn: a => { const L = parseFloorArg(a[0]), r = g().placeFloorSpan(L, parseNum(a[1]), parseNum(a[2])); return r && r.err ? r.err : 'piso feito'; }},
      demolir: {use: 'demolir <andar> <x>', desc: 'demole o que estiver ali', fn: a => { const r = g().bulldoze(parseFloorArg(a[0]), parseNum(a[1])); return r.err || 'demolido: ' + (r.what || 'ok'); }},
      avancar: {use: 'avancar <minutos de jogo>', desc: 'roda a simulação (1 dia = 1440)', fn: a => {
        const mins = parseNum(a[0]); let left = mins / MIN_PER_SEC; const sp = g().speed; g().speed = 1;
        for (; left > 0; left -= 0.1) g().step(Math.min(0.1, left));
        g().speed = sp;
        return 'avançou ' + mins + ' min → ' + this.clock();
      }},
      ate: {use: 'ate <hora 0-23>', desc: 'avança até a próxima vez que for essa hora', fn: a => { const h = parseNum(a[0]); let m = (h * 60 - g().minute + 1440) % 1440; if (m === 0) m = 1440; return this.cmds.avancar.fn([String(m)]); }},
      estacao: {use: 'estacao <primavera|verao|outono|inverno>', desc: 'pula para o primeiro dia da estação', fn: a => {
        const i = SEASONS.findIndex(s => s.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') === String(a[0]).toLowerCase());
        if (i < 0) throw new Error('estação desconhecida');
        const yearStart = Math.floor(g().day / YEAR_DAYS) * YEAR_DAYS; let d = yearStart + i * SEASON_DAYS; if (d < g().day) d += YEAR_DAYS;
        g().t = d * 1440 + 6 * 60; g()._utk = null; return 'agora é ' + SEASONS[g().season].name + ' (dia ' + d + ')';
      }},
      evento: {use: 'evento <fogo|bomba|vip|furto|briga|apagao|agua|casamento>', desc: 'dispara um evento agora', fn: a => {
        const k = a[0];
        if (k === 'fogo') g().fireEvent(); else if (k === 'bomba') g().bombEvent(); else if (k === 'vip') g().vipEvent();
        else if (k === 'furto') { const p = THEFT.p; THEFT.p = 1; try { g().theftCheck(); } finally { THEFT.p = p; } }
        else if (k === 'briga') g().crimeCheck(); else if (k === 'casamento') g().weddingEvent();
        else if (k === 'apagao') return this.cmds.apagao.fn(['energia']); else if (k === 'agua') return this.cmds.apagao.fn(['agua']);
        else throw new Error('evento desconhecido: "' + k + '"');
        return 'evento disparado: ' + k;
      }},
      apagao: {use: 'apagao <energia|agua> [minutos]', desc: 'liga um apagão/falta d\'água', fn: a => {
        const res = a[0] === 'agua' ? 'agua' : 'energia', m = a[1] ? parseNum(a[1]) : 90;
        g().outage[res] = g().t + m; g()._utk = null; g().utilFresh(); return (res === 'agua' ? 'falta d\'água' : 'apagão') + ' por ' + m + ' min';
      }},
      clima: {use: 'clima <sol|nublado|chuva|calor|frio> [amanha]', desc: 'muda o clima de hoje (ou a previsão de amanhã)', fn: a => {
        if (!WEATHER[a[0]]) throw new Error('clima desconhecido (' + WEATHER_KEYS.join(', ') + ')');
        if (a[1] === 'amanha') { g().forecast = a[0]; return 'previsão de amanhã: ' + WEATHER[a[0]].name; }
        g().weather = a[0]; g()._utk = null; return 'clima de hoje: ' + WEATHER[a[0]].name;
      }},
      carga: {use: 'carga <energia|agua> <0-100>', desc: 'define o nível (%) da bateria ou das caixas d\'água', fn: a => {
        const res = a[0] === 'agua' ? 'agua' : 'energia', sp = g().storeSpec(res), p = parseNum(a[1]);
        for (const f of g().storeFacs(res)) f.lvl = FAC[f.k].util.store.cap * Math.max(0, Math.min(100, p)) / 100; g()._utk = null; const lv = g().storeSpec(res).level; g().store[res] = lv; return res + ': ' + Math.round(lv) + '/' + sp.cap;
      }},
      restaurar: {use: 'restaurar', desc: 'encerra apagão e falta d\'água', fn: () => { g().outage.energia = g().outage.agua = 0; g()._utk = null; g().utilFresh(); return 'serviços restaurados'; }},
      utilidades: {use: 'utilidades', desc: 'energia e água: consumo / capacidade', fn: () => { const u = g().utilFresh(), f = (n, r) => n + ' ' + Math.round(r.use) + '/' + Math.round(r.cap) + (r.cut ? ' (' + r.cut + ' cortadas)' : '') + (r.out ? ' [FALTA]' : ''); return f('energia', u.energia) + (u.energia.storeCap ? ' [bateria ' + Math.round(u.energia.store) + '/' + u.energia.storeCap + ']' : '') + ' · ' + f('água', u.agua) + (u.agua.storeCap ? ' [caixas ' + Math.round(u.agua.store) + '/' + u.agua.storeCap + ']' : '') + ' · ' + WEATHER[g().weather].name + (g().elevOff ? ' · elevadores parados' : ''); }},
      status: {use: 'status', desc: 'resumo do jogo', fn: () => 'dia ' + g().day + ' ' + this.clock() + ' · ' + SEASONS[g().season].name + ' · dinheiro ' + fmtMoney(g().funds) + ' · pop ' + g().pop + ' · ' + g().star + '★ · salas ' + g().facs.length + ' · ' + this.cmds.utilidades.fn([])},
      sala: {use: 'sala <andar> <x>', desc: 'detalhes de uma sala: nota e motivos', fn: a => {
        const f = roomAt(parseFloorArg(a[0]), parseNum(a[1])), d = FAC[f.k];
        let s = d.label + ' (' + f.k + ') andar ' + floorLabel(f.L) + ' x=' + f.x + ' · obra ' + Math.round(f.build * 100) + '%' + (f.fire ? ' · EM CHAMAS' : '') + (f.cutE ? ' · sem energia' : '') + (f.cutA ? ' · sem água' : '');
        if (d.tenant || d.hotel) s += '\n' + g().evalBreakdown(f).map(o => '  ' + (o.v >= 0 ? '+' : '') + o.v.toFixed(1) + ' ' + o.label).join('\n') + '\n  nota ' + Math.round(g().evalFac(f));
        return s;
      }},
      velocidade: {use: 'velocidade <0-8>', desc: 'velocidade do jogo (0 = pausa)', fn: a => { g().speed = parseNum(a[0]); return 'velocidade ' + g().speed; }},
    };
  }
  clock() { const m = Math.floor(this.g.minute); return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
  // executa uma linha de comando e devolve o texto da resposta (erros viram texto, nunca exceção)
  run(line) {
    const a = String(line || '').trim().split(/\s+/).filter(Boolean), name = (a.shift() || 'ajuda').toLowerCase();
    const c = this.cmds[name];
    if (!c) return 'comando desconhecido: "' + name + '". Digite cheat("ajuda").';
    try { return String(c.fn(a)); } catch (e) { return 'erro: ' + e.message + '  (uso: ' + c.use + ')'; }
  }
}
