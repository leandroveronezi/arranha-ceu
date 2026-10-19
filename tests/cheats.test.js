'use strict';
// Cheats / modo deus (console): cada comando faz o que diz e erros viram texto, nunca exceção.
const {Cheats, FAC, SEASONS, ok, done, mk: mk0} = require('./helpers');
// estes testes medem a regra do próprio assunto, não o acesso: toda sala conta como alcançável (acesso: acesso.test.js e invariantes.test.js)
const mk = (...a) => { const g = mk0(...a); g.reachable = f => !f.dead && f.k !== 'ruin'; return g; };

const mkc = () => { const g = mk(64); g.msg = () => {}; g.star = 1; g.placeFloorSpan(1, 0, 63); g.placeFloorSpan(-1, 0, 63); return {g, c: new Cheats(g)}; };

{
  const {g, c} = mkc();
  ok(/construir/.test(c.run('ajuda')) && /deus/.test(c.run('ajuda')) && /construir <sala>/.test(c.run('ajuda construir')), 'ajuda lista os comandos e detalha um');
  ok(/desconhecido/.test(c.run('xyz')) && /ajuda/.test(c.run('xyz')), 'comando desconhecido responde com texto');
  ok(/erro/.test(c.run('construir banco 99')) && /erro/.test(c.run('construir naoexiste 1 0')) && /erro/.test(c.run('dinheiro abc')), 'argumentos ruins viram "erro: ..." (sem exceção)');
}
{
  const {g, c} = mkc(); const f0 = g.funds;
  c.run('dinheiro 5_000'); ok(g.funds === f0 + 5000, 'dinheiro soma (com _ nos milhares)');
  c.run('dinheiro -1000'); ok(g.funds === f0 + 4000, 'dinheiro negativo tira');
  c.run('estrelas 4'); ok(g.star === 4, 'estrelas'); ok(/erro/.test(c.run('estrelas 9')), 'estrelas fora da faixa dá erro');
}
{
  const {g, c} = mkc(); g.funds = 0;
  const r = c.run('construir office 2 8');
  ok(/construído/.test(r) && g.funds === 0, 'construir é de graça (dinheiro intacto)');
  const f = g.facAt(1, 8); ok(f && f.k === 'office' && f.build === 1, 'sala pronta no andar 2 (rótulo do jogo), x na grade');
  ok(/construído/.test(c.run('construir gerador B1 0')) && g.facAt(-1, 0).k === 'gerador', 'B1 é o primeiro subsolo');
  c.run('construir cafe 2 24 1 obra'); ok(g.facAt(1, 24).build < 1, 'com "obra" a sala fica em obras');
  ok(/erro/.test(c.run('construir office 2 8')), 'espaço ocupado dá erro');
  ok(/demolido/.test(c.run('demolir 2 8')) && !g.facAt(1, 8), 'demolir');
  c.run('construir parkramp B1 20 -1'); ok(g.facAt(-1, 20).dir === -1, 'lado -1 vai para rampas e túneis descendentes');
  ok(/[Cc]afé|cafe/i.test(c.run('salas caf')) && !/office/.test(c.run('salas caf')), 'salas filtra por nome');
}
{
  const {g, c} = mkc(); const t0 = g.t;
  c.run('avancar 120'); ok(Math.abs(g.t - t0 - 120) < 0.5, 'avancar 120 move o relógio em 120 min');
  c.run('ate 15'); ok(g.minute >= 15 * 60 - 1 && g.minute < 15 * 60 + 10, 'ate 15 para às 15h (' + c.clock() + ')');
  for (const [nm, i] of [['verao', 1], ['inverno', 3], ['primavera', 0], ['outono', 2]]) { c.run('estacao ' + nm); ok(g.season === i, 'estacao ' + nm + ' → ' + SEASONS[g.season].name); }
  ok(/erro/.test(c.run('estacao marte')), 'estação inexistente dá erro');
}
{
  const {g, c} = mkc();
  ok(/apagão por 30/.test(c.run('apagao energia 30')) && g.outage.energia > g.t && /FALTA/.test(c.run('utilidades')), 'apagão liga e aparece em utilidades');
  c.run('apagao agua'); ok(g.outage.agua > g.t, 'falta d\'água');
  c.run('restaurar'); ok(!g.outage.energia && !g.outage.agua, 'restaurar encerra tudo');
  c.run('evento apagao'); ok(g.outage.energia > g.t, 'evento apagao');
  c.run('construir suite 2 0'); c.run('estrelas 5');
  ok(/disparado/.test(c.run('evento fogo')) && g.facs.some(f => f.fire), 'evento fogo ateia fogo');
  ok(/erro/.test(c.run('evento xis')), 'evento desconhecido dá erro');
  ok(/dia \d+ \d\d:\d\d/.test(c.run('status')) && /energia/.test(c.run('status')), 'status resume o jogo');
}
{
  const {g, c} = mkc(); c.run('construir office 2 0'); const f = g.facAt(1, 0); f.occ = true; g.moveIn(f);
  const s = c.run('sala 2 0'); ok(/Escritório/.test(s) && /nota \d+/.test(s) && /\+|-/.test(s), 'sala mostra a nota e os motivos');
  ok(/erro/.test(c.run('sala 3 0')), 'sala vazia dá erro');
  c.run('velocidade 4'); ok(g.speed === 4, 'velocidade');
}
{
  const {g, c} = mkc(); g.funds = 10; g.star = 1;
  ok(/ligado/.test(c.run('deus')) && g.funds >= 1e12 && g.star >= 5 && g.god, 'deus liga: dinheiro alto e 5 estrelas');
  g.funds = 5; const r = g.placeFac('office', 2, 40); g.step(0.1);
  ok(g.funds >= 1e12, 'o dinheiro é reposto a cada passo');
  if (r.ok) ok(g.facs[g.facs.length - 1].build === 1, 'obras são instantâneas em modo deus'); 
  ok(/desligado/.test(c.run('deus')) && !g.god, 'deus alterna');
}
{
  const {g, c} = mkc();
  c.run('clima calor'); ok(g.weather === 'calor' && /Onda de calor/.test(c.run('utilidades')), 'clima muda o dia de hoje');
  c.run('clima frio amanha'); ok(g.forecast === 'frio' && g.weather === 'calor', 'clima ... amanha muda só a previsão');
  ok(/erro/.test(c.run('clima neblina')), 'clima inexistente dá erro');
  c.run('construir bateria B1 0'); const r = c.run('carga energia 50');
  ok(Math.abs(g.store.energia - FAC.bateria.util.store.cap / 2) < 1e-6 && /250\/500/.test(r) && /bateria 250\/500/.test(c.run('utilidades')), 'carga define o nível da bateria');
}
done('cheats');
